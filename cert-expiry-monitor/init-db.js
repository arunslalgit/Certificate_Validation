const { db } = require('./db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  console.log('\n🚀 Initializing SQLite database...');

  try {
    const schemaFile = path.join(__dirname, 'schema-sqlite.sql');
    const schema = fs.readFileSync(schemaFile, 'utf8');
    const statements = schema
      .split(';')
      .map((stmt) => stmt.trim())
      .filter(Boolean);

    for (const statement of statements) {
      db.exec(statement);
    }

    console.log('✓ Database schema created/verified');

    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');

    if (!existingAdmin) {
      db.prepare(
        'INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)'
      ).run('admin', hashedPassword, 'admin', 'admin@localhost');
      console.log('✓ Default admin user created (admin / admin123)');
    } else {
      console.log('✓ Admin user already exists');
    }

    console.log('\n✅ Database initialization complete!\n');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  initDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { initDatabase };
