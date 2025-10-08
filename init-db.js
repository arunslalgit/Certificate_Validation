const { db } = require('./db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  console.log('\n🚀 Initializing SQLite database...');

  try {
    // Read and execute schema
    const schemaFile = path.join(__dirname, 'schema-sqlite.sql');
    const schema = fs.readFileSync(schemaFile, 'utf8');

    // Split by semicolon and execute each statement
    const statements = schema.split(';').filter(s => s.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        db.exec(statement);
      }
    }

    console.log('✓ Database schema created');

    // Create default admin user if not exists
    const hashedPassword = bcrypt.hashSync('admin123', 10);

    const existingAdmin = db.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).get('admin');

    if (!existingAdmin) {
      db.prepare(`
        INSERT INTO users (username, password_hash, role, email)
        VALUES (?, ?, ?, ?)
      `).run('admin', hashedPassword, 'admin', 'admin@localhost');

      console.log('✓ Default admin user created (username: admin, password: admin123)');
      console.log('  ⚠️  Please change the password after first login!');
    } else {
      console.log('✓ Admin user already exists');
    }

    console.log('\n✅ Database initialization complete!');
    console.log(`📁 Database location: ${db.name}`);
    console.log('\nTo start the server, run: npm start');
    console.log('To run in development mode: npm run dev\n');

    process.exit(0);

  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
