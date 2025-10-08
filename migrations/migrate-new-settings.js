const fs = require('fs');
const path = require('path');
const { query } = require('../db');

async function migrate() {
  try {
    console.log('🔄 Running migration: add_new_settings.sql...');

    const sql = fs.readFileSync(
      path.join(__dirname, 'add_new_settings.sql'),
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
        console.log('✅ Executed:', statement.substring(0, 50) + '...');
      } catch (error) {
        // Ignore column already exists errors
        if (error.message.includes('duplicate column name')) {
          console.log('⚠️  Column already exists, skipping...');
        } else {
          throw error;
        }
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
