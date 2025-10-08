const cron = require('node-cron');
const { checkCertificate } = require('./cert-checker');
const { sendCertificateAlert } = require('./notifications');
const { query } = require('./db');
const logger = require('./logger');

let checkJob = null;

/**
 * Start the certificate check scheduler
 */
function startScheduler() {
  if (checkJob) {
    logger.warn('Scheduler already running');
    return;
  }

  // Run every 15 minutes to check which certificates need checking
  checkJob = cron.schedule('*/15 * * * *', async () => {
    logger.info('[Scheduler] Starting scheduled check cycle...');
    await runScheduledChecks();
  });

  logger.info('[Scheduler] Started - checking every 15 minutes for due certificates');

  // Also run an initial check after 1 minute
  setTimeout(() => {
    logger.info('[Scheduler] Running initial check...');
    runScheduledChecks();
  }, 60000);
}

/**
 * Stop the scheduler
 */
function stopScheduler() {
  if (checkJob) {
    checkJob.stop();
    checkJob = null;
    logger.info('[Scheduler] Stopped');
  }
}

/**
 * Run scheduled certificate checks
 */
async function runScheduledChecks() {
  const now = new Date().toISOString();

  try {
    // Find all enabled certificates that are due for checking
    const { rows: configs } = await query(`
      SELECT * FROM certificate_configs
      WHERE enabled = 1
      AND (next_check_at IS NULL OR next_check_at <= ?)
    `, [now]);

    if (configs.length === 0) {
      logger.info('[Scheduler] No certificates due for check');
      return;
    }

    logger.info(`[Scheduler] Found ${configs.length} certificate(s) due for check`);

    for (const config of configs) {
      await checkSingleCertificate(config);
    }

    logger.info('[Scheduler] Check cycle complete');

  } catch (error) {
    logger.error('[Scheduler] Error during scheduled checks', { error: error.message });
  }
}

/**
 * Check a single certificate and handle alerts
 */
async function checkSingleCertificate(config) {
  const now = new Date().toISOString();

  try {
    logger.info(`[Scheduler] Checking ${config.eai_name} (${config.url})`);

    const result = await checkCertificate(config.url);

    // Save result to database
    await query(`
      INSERT INTO certificate_results
      (config_id, hostname, certificate_valid, expiry_date,
       days_until_expiry, issuer, subject_alternate_names, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      config.id,
      result.hostname,
      result.valid ? 1 : 0,
      result.validTo,
      result.daysUntilExpiry,
      result.issuer,
      JSON.stringify(result.sans),
      result.status
    ]);

    // Calculate next check time based on this certificate's frequency
    const checkFrequency = config.check_frequency_hours || 4;
    const nextCheckDate = new Date();
    nextCheckDate.setHours(nextCheckDate.getHours() + checkFrequency);

    // Update last_checked and next_check_at
    await query(`
      UPDATE certificate_configs
      SET last_checked = ?, next_check_at = ?
      WHERE id = ?
    `, [now, nextCheckDate.toISOString(), config.id]);

    logger.info(
      `[Scheduler] ✓ ${config.eai_name}: ${result.status} (${result.daysUntilExpiry} days). ` +
      `Next check in ${checkFrequency}h`
    );

    // Check if alert needed
    if (shouldSendAlert(config, result)) {
      await sendAlert(config, result);
    }

  } catch (error) {
    logger.error(`[Scheduler] ✗ Failed to check ${config.url}:`, { error: error.message });

    // Save error result
    await query(`
      INSERT INTO certificate_results
      (config_id, hostname, certificate_valid, status, error_message)
      VALUES (?, ?, ?, ?, ?)
    `, [config.id, config.url, 0, 'error', error.message]);

    // Still update next check time even on error
    const checkFrequency = config.check_frequency_hours || 4;
    const nextCheckDate = new Date();
    nextCheckDate.setHours(nextCheckDate.getHours() + checkFrequency);

    await query(`
      UPDATE certificate_configs
      SET last_checked = ?, next_check_at = ?
      WHERE id = ?
    `, [now, nextCheckDate.toISOString(), config.id]);
  }
}

/**
 * Determine if an alert should be sent
 */
function shouldSendAlert(config, result) {
  // 1. Check if email or webhook is configured for this certificate
  if (!config.email_recipients && !config.teams_webhook_url) {
    return false;
  }

  // 2. Check if expiry within threshold (per-certificate setting)
  const threshold = config.alert_threshold_days || 50;
  if (result.daysUntilExpiry > threshold) {
    return false;
  }

  // 3. Check if it's Monday (1) or Friday (5)
  const today = new Date().getDay();
  if (today !== 1 && today !== 5) {
    logger.debug(`[Scheduler] Skipping alert - not Monday or Friday (day ${today})`);
    return false;
  }

  // 4. Check if alert already sent today for this certificate
  if (config.last_alert_sent) {
    const lastAlertDate = new Date(config.last_alert_sent);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (lastAlertDate >= todayStart) {
      logger.debug(`[Scheduler] Alert already sent today for ${config.eai_name}`);
      return false;
    }
  }

  return true;
}

/**
 * Send alert for a certificate
 */
async function sendAlert(config, result) {
  try {
    logger.info(`[Scheduler] Sending alert for ${config.eai_name}`);

    const alertResults = await sendCertificateAlert(config, result);

    // Update last_alert_sent timestamp
    await query(
      'UPDATE certificate_configs SET last_alert_sent = ? WHERE id = ?',
      [new Date().toISOString(), config.id]
    );

    logger.info(`[Scheduler] Alert sent for ${config.eai_name}`, {
      email: alertResults.email?.success,
      teams: alertResults.teams?.success
    });

  } catch (error) {
    logger.error(`[Scheduler] Failed to send alert for ${config.eai_name}`, {
      error: error.message
    });
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  runScheduledChecks,
  checkSingleCertificate
};
