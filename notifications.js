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
  const message = formatCertificateAlert(config, result);
  const subject = `Certificate Alert: ${config.eai_name} - ${result.status.replace('_', ' ')}`;

  const results = {
    email: null,
    teams: null
  };

  // Send email if configured
  if (config.email_recipients) {
    results.email = await sendEmail(
      config.email_recipients,
      subject,
      message.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    );
  }

  // Send Teams notification if configured
  if (config.teams_webhook_url) {
    results.teams = await sendTeamsNotification(
      config.teams_webhook_url,
      subject,
      message,
      result.status === 'expired' ? 'error' : 'warning'
    );
  }

  return results;
}

module.exports = {
  sendEmail,
  sendTeamsNotification,
  sendCertificateAlert,
  testWebhook,
  getSmtpSettings
};
