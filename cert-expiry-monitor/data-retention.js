const cron = require('node-cron');
const { query } = require('./db');

async function getRetentionSettings() {
  const { rows } = await query(
    'SELECT key, value FROM system_settings WHERE key LIKE "retention.%"'
  );
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

async function runRetentionCleanup() {
  const settings = await getRetentionSettings();
  if (settings['retention.enabled'] === 'false') {
    return;
  }

  const days = parseInt(settings['retention.results_days'] || '30', 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  await query('DELETE FROM certificate_results WHERE checked_at < ?', [cutoff.toISOString()]);
}

function startRetentionJob() {
  return cron.schedule('0 0 * * *', async () => {
    try {
      await runRetentionCleanup();
    } catch (error) {
      console.error('[Retention] cleanup failed', error.message);
    }
  });
}

module.exports = { startRetentionJob, runRetentionCleanup };
