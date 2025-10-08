const fs = require('fs');
const path = require('path');
const { query } = require('../db');

async function migrate() {
  try {
    console.log('🔄 Running migration: update_environment_column.sql...');

    const sql = fs.readFileSync(
      path.join(__dirname, 'update_environment_column.sql'),
      'utf8'
    );

    // Split SQL statements and execute them one by one
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await query(statement);
        console.log('✅ Executed:', statement.substring(0, 60) + '...');
      } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
      }
    }

    console.log('✅ Migration complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
