const cron = require('node-cron');
const { checkCertificate } = require('./cert-checker');
const { query } = require('./db');
const { sendAlert } = require('./notifications');

let job = null;

function isAlertDay(settings) {
  const day = new Date().getDay();
  const mondayEnabled = settings['alert.monday_enabled'] !== 'false';
  const fridayEnabled = settings['alert.friday_enabled'] !== 'false';

  if (day === 1) return mondayEnabled;
  if (day === 5) return fridayEnabled;
  return false;
}

async function getSystemSettings() {
  const { rows } = await query('SELECT key, value FROM system_settings');
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

async function runScheduledChecks() {
  const nowIso = new Date().toISOString();
  const { rows: configs } = await query(
    `SELECT * FROM certificate_configs
     WHERE enabled = 1 AND (next_check_at IS NULL OR next_check_at <= ?)`,
    [nowIso]
  );

  if (!configs.length) {
    return;
  }

  const settings = await getSystemSettings();
  const alertDay = isAlertDay(settings);

  for (const config of configs) {
    try {
      const result = await checkCertificate(config.url);

      await query(
        `INSERT INTO certificate_results
         (config_id, hostname, certificate_valid, expiry_date, days_until_expiry,
          issuer, subject_alternate_names, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          config.id,
          result.hostname,
          result.valid ? 1 : 0,
          result.validTo,
          result.daysUntilExpiry,
          result.issuer,
          JSON.stringify(result.sans || []),
          result.status
        ]
      );

      const frequency = config.check_frequency_hours || Number(settings['check.default_frequency_hours']) || 4;
      const nextCheck = new Date();
      nextCheck.setHours(nextCheck.getHours() + Number(frequency));

      await query(
        'UPDATE certificate_configs SET last_checked = ?, next_check_at = ? WHERE id = ?',
        [new Date().toISOString(), nextCheck.toISOString(), config.id]
      );

      const threshold = config.alert_threshold_days || Number(settings['alert.default_threshold_days']) || 50;
      const withinThreshold = typeof result.daysUntilExpiry === 'number' && result.daysUntilExpiry <= threshold;
      const alreadyAlertedToday = config.last_alert_sent && new Date(config.last_alert_sent).toDateString() === new Date().toDateString();

      if (alertDay && withinThreshold && !alreadyAlertedToday && (config.email_recipients || config.teams_webhook_url)) {
        await sendAlert(config, result);
      }
    } catch (error) {
      console.error('[Scheduler] Failed to check certificate', config.url, error.message);
      await query(
        `INSERT INTO certificate_results
         (config_id, hostname, certificate_valid, status, error_message)
         VALUES (?, ?, 0, 'error', ?)`,
        [config.id, config.url, error.message]
      );

      const frequency = config.check_frequency_hours || Number(settings['check.default_frequency_hours']) || 4;
      const nextCheck = new Date();
      nextCheck.setHours(nextCheck.getHours() + Number(frequency));
      await query(
        'UPDATE certificate_configs SET last_checked = ?, next_check_at = ? WHERE id = ?',
        [new Date().toISOString(), nextCheck.toISOString(), config.id]
      );
    }
  }
}

function startScheduler() {
  if (job) {
    return job;
  }

  job = cron.schedule('*/15 * * * *', async () => {
    try {
      await runScheduledChecks();
    } catch (error) {
      console.error('[Scheduler] Job run failed', error.message);
    }
  });

  return job;
}

module.exports = { startScheduler, runScheduledChecks };
