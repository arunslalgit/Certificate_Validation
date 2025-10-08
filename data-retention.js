const cron = require('node-cron');
const { query } = require('./db');
const logger = require('./logger');

let retentionJob = null;

/**
 * Start the data retention scheduler
 */
function startRetentionScheduler() {
  if (retentionJob) {
    logger.warn('Data retention scheduler already running');
    return;
  }

  // Run daily at 2 AM
  retentionJob = cron.schedule('0 2 * * *', async () => {
    logger.info('[Retention] Starting data retention cleanup...');
    await cleanupOldResults();
  });

  logger.info('[Retention] Scheduler started - running daily at 2 AM');
}

/**
 * Stop the retention scheduler
 */
function stopRetentionScheduler() {
  if (retentionJob) {
    retentionJob.stop();
    retentionJob = null;
    logger.info('[Retention] Scheduler stopped');
  }
}

/**
 * Clean up old certificate results based on retention settings
 */
async function cleanupOldResults() {
  try {
    // Get retention settings
    const { rows: settings } = await query(`
      SELECT key, value FROM system_settings
      WHERE key IN ('retention.enabled', 'retention.results_days', 'retention.batch_size')
    `);

    const config = {};
    settings.forEach(row => {
      const key = row.key.replace('retention.', '');
      config[key] = row.value;
    });

    // Check if retention is enabled
    if (config.enabled !== 'true') {
      logger.info('[Retention] Data retention is disabled');
      return;
    }

    const retentionDays = parseInt(config.results_days) || 30;
    const batchSize = parseInt(config.batch_size) || 1000;

    logger.info(`[Retention] Cleaning up results older than ${retentionDays} days`);

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffISO = cutoffDate.toISOString();

    // Count records to be deleted
    const { rows: countRows } = await query(
      'SELECT COUNT(*) as count FROM certificate_results WHERE checked_at < ?',
      [cutoffISO]
    );

    const totalToDelete = countRows[0].count;

    if (totalToDelete === 0) {
      logger.info('[Retention] No old results to clean up');
      return;
    }

    logger.info(`[Retention] Found ${totalToDelete} results to delete`);

    // Delete in batches
    let deletedTotal = 0;
    while (true) {
      const { rowCount } = await query(
        `DELETE FROM certificate_results
         WHERE id IN (
           SELECT id FROM certificate_results
           WHERE checked_at < ?
           LIMIT ?
         )`,
        [cutoffISO, batchSize]
      );

      if (rowCount === 0) {
        break;
      }

      deletedTotal += rowCount;
      logger.info(`[Retention] Deleted ${deletedTotal}/${totalToDelete} results`);

      // Small delay between batches to avoid locking issues
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info(`[Retention] Cleanup complete - deleted ${deletedTotal} old results`);

    // Optimize database after cleanup
    const { db } = require('./db');
    db.pragma('optimize');
    logger.info('[Retention] Database optimized');

  } catch (error) {
    logger.error('[Retention] Error during cleanup', { error: error.message });
  }
}

module.exports = {
  startRetentionScheduler,
  stopRetentionScheduler,
  cleanupOldResults
};
