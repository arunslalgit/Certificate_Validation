const nodemailer = require('nodemailer');
const axios = require('axios');
const { query } = require('./db');

async function getSmtpSettings() {
  const { rows } = await query('SELECT key, value FROM system_settings WHERE key LIKE "smtp.%"');
  const settings = {};
  for (const row of rows) {
    settings[row.key.replace('smtp.', '')] = row.value;
  }
  return settings;
}

function formatAlertMessage(config, result) {
  return {
    title: `⚠️ Certificate Expiry Alert: ${config.eai_name}`,
    summary: `Certificate for ${config.url} expires in ${result.daysUntilExpiry} days`,
    details: {
      eaiNumber: config.eai_number,
      eaiName: config.eai_name,
      url: config.url,
      environment: config.environment,
      expiryDate: result.validTo ? new Date(result.validTo).toLocaleString() : 'Unknown',
      daysRemaining: result.daysUntilExpiry,
      issuer: result.issuer,
      sans: result.sans || [],
      threshold: config.alert_threshold_days
    }
  };
}

async function sendEmailAlert(recipients, message) {
  const smtpConfig = await getSmtpSettings();
  if (smtpConfig.enabled !== 'true') {
    throw new Error('SMTP is not enabled');
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: parseInt(smtpConfig.port, 10) || 587,
    secure: smtpConfig.port === '465',
    tls: { rejectUnauthorized: false }
  });

  const emailList = recipients.split(',').map((addr) => addr.trim()).filter(Boolean);

  await transporter.sendMail({
    from: smtpConfig.from,
    to: emailList.join(', '),
    subject: message.title,
    html: `
      <h2>${message.title}</h2>
      <p>${message.summary}</p>
      <ul>
        <li><strong>EAI Number:</strong> ${message.details.eaiNumber}</li>
        <li><strong>EAI Name:</strong> ${message.details.eaiName}</li>
        <li><strong>URL:</strong> ${message.details.url}</li>
        <li><strong>Environment:</strong> ${message.details.environment.toUpperCase()}</li>
        <li><strong>Expiry Date:</strong> ${message.details.expiryDate}</li>
        <li><strong>Days Remaining:</strong> ${message.details.daysRemaining}</li>
        <li><strong>Issuer:</strong> ${message.details.issuer}</li>
        <li><strong>Alert Threshold:</strong> ${message.details.threshold} days</li>
      </ul>
      <h3>Subject Alternate Names</h3>
      <ul>
        ${(message.details.sans || []).map((san) => `<li>${san}</li>`).join('')}
      </ul>
      <p style="color:#888;font-size:12px;">
        This alert is sent once per day on Monday and Friday when certificates are within threshold.
      </p>
    `
  });
}

async function sendTeamsAlert(webhookUrl, message) {
  const card = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: message.summary,
    themeColor: message.details.daysRemaining < 7 ? 'FF0000' : 'FFA500',
    title: message.title,
    sections: [
      {
        activityTitle: 'Certificate Details',
        facts: [
          { name: 'EAI Number', value: message.details.eaiNumber },
          { name: 'EAI Name', value: message.details.eaiName },
          { name: 'URL', value: message.details.url },
          { name: 'Environment', value: message.details.environment.toUpperCase() },
          { name: 'Expiry Date', value: message.details.expiryDate },
          { name: 'Days Remaining', value: `${message.details.daysRemaining}` },
          { name: 'Issuer', value: message.details.issuer },
          { name: 'Alert Threshold', value: `${message.details.threshold} days` }
        ],
        text: `⚠️ Certificate expiring soon - please renew!\n\n**Subject Alternate Names:**\n${(message.details.sans || []).map((san) => `- ${san}`).join('\n')}`
      }
    ],
    potentialAction: [
      {
        '@type': 'OpenUri',
        name: 'View Certificate',
        targets: [
          {
            os: 'default',
            uri: message.details.url
          }
        ]
      }
    ]
  };

  await axios.post(webhookUrl, card, { headers: { 'Content-Type': 'application/json' } });
}

async function sendAlert(config, result) {
  const message = formatAlertMessage(config, result);
  let emailSent = false;
  let webhookSent = false;

  if (config.email_recipients) {
    try {
      await sendEmailAlert(config.email_recipients, message);
      emailSent = true;
    } catch (error) {
      console.error('[Notifications] Email failed:', error.message);
    }
  }

  if (config.teams_webhook_url) {
    try {
      await sendTeamsAlert(config.teams_webhook_url, message);
      webhookSent = true;
    } catch (error) {
      console.error('[Notifications] Teams webhook failed:', error.message);
    }
  }

  if (emailSent || webhookSent) {
    await query('UPDATE certificate_configs SET last_alert_sent = ? WHERE id = ?', [
      new Date().toISOString(),
      config.id
    ]);
  }
}

module.exports = { sendAlert, sendEmailAlert, sendTeamsAlert, formatAlertMessage };
