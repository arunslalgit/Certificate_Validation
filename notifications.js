const nodemailer = require('nodemailer');
const axios = require('axios');
const { query } = require('./db');
const logger = require('./logger');

/**
 * Get SMTP settings from database
 */
async function getSmtpSettings() {
  const { rows } = await query(`
    SELECT key, value FROM system_settings
    WHERE key LIKE 'smtp.%'
  `);

  const settings = {};
  rows.forEach(row => {
    const key = row.key.replace('smtp.', '');
    settings[key] = row.value;
  });

  return settings;
}

/**
 * Send email notification
 */
async function sendEmail(recipients, subject, body) {
  try {
    const settings = await getSmtpSettings();

    if (settings.enabled !== 'true') {
      logger.info('Email notifications disabled');
      return { success: false, message: 'Email notifications disabled' };
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: parseInt(settings.port),
      secure: parseInt(settings.port) === 465,
      auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined
    });

    // Parse recipients
    const recipientList = recipients.split(',').map(e => e.trim()).filter(e => e);

    if (recipientList.length === 0) {
      return { success: false, message: 'No valid recipients' };
    }

    // Send email
    const info = await transporter.sendMail({
      from: settings.from,
      to: recipientList.join(', '),
      subject: subject,
      html: body
    });

    logger.info('Email sent', { messageId: info.messageId, recipients: recipientList });
    return { success: true, messageId: info.messageId };

  } catch (error) {
    logger.error('Failed to send email', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Send Microsoft Teams notification
 */
async function sendTeamsNotification(webhookUrl, title, message, color = 'warning') {
  try {
    if (!webhookUrl) {
      return { success: false, message: 'No webhook URL provided' };
    }

    const colorMap = {
      success: '0078D4',
      warning: 'FFA500',
      error: 'D13438',
      info: '00BCF2'
    };

    const card = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: title,
      themeColor: colorMap[color] || colorMap.warning,
      title: title,
      sections: [{
        text: message
      }]
    };

    const response = await axios.post(webhookUrl, card, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    logger.info('Teams notification sent', { status: response.status });
    return { success: true, status: response.status };

  } catch (error) {
    logger.error('Failed to send Teams notification', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Test webhook URL
 */
async function testWebhook(webhookUrl) {
  return sendTeamsNotification(
    webhookUrl,
    'Certificate Monitor - Test Notification',
    'This is a test notification from the Certificate Expiry Monitoring Tool. If you see this message, your webhook is configured correctly!',
    'success'
  );
}

/**
 * Format certificate alert message
 */
function formatCertificateAlert(config, result) {
  const statusEmoji = {
    expired: '🔴',
    expiring_soon: '🟠',
    valid: '🟢',
    error: '⚠️'
  };

  const emoji = statusEmoji[result.status] || '❓';
  const expiryDate = new Date(result.validTo).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let message = `${emoji} **Certificate Alert**\n\n`;
  message += `**EAI Name:** ${config.eai_name}\n`;
  message += `**EAI Number:** ${config.eai_number}\n`;
  message += `**Environment:** ${config.environment.toUpperCase()}\n`;
  message += `**URL:** ${config.url}\n`;
  message += `**Hostname:** ${result.hostname}\n\n`;
  message += `**Status:** ${result.status.replace('_', ' ').toUpperCase()}\n`;
  message += `**Days Until Expiry:** ${result.daysUntilExpiry}\n`;
  message += `**Expiry Date:** ${expiryDate}\n`;
  message += `**Issuer:** ${result.issuer}\n\n`;

  if (result.sans && result.sans.length > 0) {
    message += `**Subject Alternate Names:**\n`;
    result.sans.slice(0, 10).forEach(san => {
      message += `- ${san}\n`;
    });
    if (result.sans.length > 10) {
      message += `- ... and ${result.sans.length - 10} more\n`;
    }
  }

  return message;
}

/**
 * Send certificate expiry alert
 */
async function sendCertificateAlert(config, result) {
  const db = require('./db');
  const statusEmoji = result.status === 'expired' ? '🔴' : '🟠';
  const subject = `${statusEmoji} Certificate Expiry Alert: ${config.eai_name}`;

  const results = {
    email: null,
    teams: null
  };

  // Send email if configured
  if (config.email_recipients) {
    const htmlBody = formatEmailBody(config, result);
    results.email = await sendEmail(
      config.email_recipients,
      subject,
      htmlBody
    );

    // Log email alert
    try {
      await db.query(`
        INSERT INTO alert_logs
        (config_id, result_id, alert_type, recipients, webhook_url, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        config.id,
        result.id || null,
        'email',
        config.email_recipients,
        null,
        results.email.success ? 'sent' : 'failed',
        results.email.error || null
      ]);
      logger.info('Email alert logged', { configId: config.id, status: results.email.success ? 'sent' : 'failed' });
    } catch (error) {
      logger.error('Failed to log email alert', { error: error.message });
    }
  }

  // Send Teams notification if configured
  if (config.teams_webhook_url) {
    const teamsCard = formatTeamsCard(config, result);
    results.teams = await sendTeamsWebhook(config.teams_webhook_url, teamsCard);

    // Log Teams alert
    try {
      await db.query(`
        INSERT INTO alert_logs
        (config_id, result_id, alert_type, recipients, webhook_url, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        config.id,
        result.id || null,
        'teams',
        null,
        config.teams_webhook_url,
        results.teams.success ? 'sent' : 'failed',
        results.teams.error || null
      ]);
      logger.info('Teams alert logged', { configId: config.id, status: results.teams.success ? 'sent' : 'failed' });
    } catch (error) {
      logger.error('Failed to log Teams alert', { error: error.message });
    }
  }

  return results;
}

/**
 * Format email HTML body
 */
function formatEmailBody(config, result) {
  const expiryDate = new Date(result.validTo).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const daysColor = result.daysUntilExpiry <= 7 ? 'red' : 'orange';
  const statusEmoji = result.status === 'expired' ? '🔴' : '🟠';

  let html = `
    <h2>${statusEmoji} Certificate Expiry Alert: ${config.eai_name}</h2>
    <p><strong>Summary:</strong> Certificate for ${config.url} ${result.status === 'expired' ? 'has expired' : `expires in ${result.daysUntilExpiry} days`}</p>

    <h3>Certificate Details:</h3>
    <ul>
      <li><strong>EAI Number:</strong> ${config.eai_number}</li>
      <li><strong>EAI Name:</strong> ${config.eai_name}</li>
      <li><strong>URL:</strong> ${config.url}</li>
      <li><strong>Environment:</strong> ${config.environment.toUpperCase()}</li>
      <li><strong>Hostname:</strong> ${result.hostname}</li>
      <li><strong>Expiry Date:</strong> ${expiryDate}</li>
      <li><strong>Days Remaining:</strong> <span style="color: ${daysColor}; font-weight: bold;">${result.daysUntilExpiry}</span></li>
      <li><strong>Issuer:</strong> ${result.issuer}</li>
      <li><strong>Alert Threshold:</strong> ${config.alert_threshold_days} days</li>
    </ul>
  `;

  if (result.sans && result.sans.length > 0) {
    html += '<h4>Subject Alternate Names:</h4><ul>';
    result.sans.slice(0, 10).forEach(san => {
      html += `<li>${san}</li>`;
    });
    if (result.sans.length > 10) {
      html += `<li>... and ${result.sans.length - 10} more</li>`;
    }
    html += '</ul>';
  }

  html += `
    <p style="color: #666; font-size: 12px; margin-top: 20px;">
      This alert was triggered because the certificate expires within ${config.alert_threshold_days} days.
      Alerts are sent only on Monday and Friday, once per day per certificate.
    </p>
  `;

  return html;
}

/**
 * Format Teams MessageCard
 */
function formatTeamsCard(config, result) {
  const expiryDate = new Date(result.validTo).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const themeColor = result.daysUntilExpiry <= 7 ? 'D13438' : 'FFA500';
  const statusEmoji = result.status === 'expired' ? '🔴' : '🟠';

  let sansText = '';
  if (result.sans && result.sans.length > 0) {
    sansText = '\\n\\n**Subject Alternate Names:**\\n';
    result.sans.slice(0, 10).forEach(san => {
      sansText += `- ${san}\\n`;
    });
    if (result.sans.length > 10) {
      sansText += `- ... and ${result.sans.length - 10} more`;
    }
  }

  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: `Certificate for ${config.url} ${result.status === 'expired' ? 'has expired' : `expires in ${result.daysUntilExpiry} days`}`,
    themeColor: themeColor,
    title: `${statusEmoji} Certificate Expiry Alert: ${config.eai_name}`,
    sections: [{
      activityTitle: 'Certificate Details',
      facts: [
        { name: 'EAI Number:', value: config.eai_number },
        { name: 'EAI Name:', value: config.eai_name },
        { name: 'URL:', value: config.url },
        { name: 'Environment:', value: config.environment.toUpperCase() },
        { name: 'Hostname:', value: result.hostname },
        { name: 'Expiry Date:', value: expiryDate },
        { name: 'Days Remaining:', value: `**${result.daysUntilExpiry} days**` },
        { name: 'Issuer:', value: result.issuer },
        { name: 'Alert Threshold:', value: `${config.alert_threshold_days} days` }
      ],
      text: `⚠️ **Action Required:** Certificate ${result.status === 'expired' ? 'has expired' : 'expiring soon'} - please renew!${sansText}`
    }],
    potentialAction: [{
      '@type': 'OpenUri',
      name: 'View Certificate',
      targets: [{
        os: 'default',
        uri: config.url
      }]
    }]
  };
}

/**
 * Send Teams webhook (for custom cards)
 */
async function sendTeamsWebhook(webhookUrl, card) {
  try {
    const response = await axios.post(webhookUrl, card, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    logger.info('Teams MessageCard sent', { status: response.status });
    return { success: true, status: response.status };

  } catch (error) {
    logger.error('Failed to send Teams MessageCard', { error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendEmail,
  sendTeamsNotification,
  sendCertificateAlert,
  testWebhook,
  getSmtpSettings,
  sendTeamsWebhook,
  formatEmailBody,
  formatTeamsCard
};
