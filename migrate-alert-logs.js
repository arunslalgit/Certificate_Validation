const { db } = require('./db');
const fs = require('fs');
const path = require('path');

async function migrateAlertLogs() {
  console.log('\n🔄 Adding alert_logs table for notification audit trail...');

  try {
    // Read migration SQL
    const migrationFile = path.join(__dirname, 'migrations', 'add_alert_logs.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    // Execute migration
    const statements = sql.split(';').filter(s => s.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        db.exec(statement);
      }
    }

    console.log('✓ alert_logs table created');
    console.log('✓ Indexes created');
    console.log('\n✅ Migration complete!');
    console.log('\nThe system will now track:');
    console.log('  - Every email sent (with recipients)');
    console.log('  - Every Teams notification sent (with webhook URL)');
    console.log('  - Success/failure status');
    console.log('  - Error messages if failed');
    console.log('  - Timestamp of when sent\n');

    process.exit(0);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  migrateAlertLogs();
}

module.exports = { migrateAlertLogs };
