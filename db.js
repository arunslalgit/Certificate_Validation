const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'certificates.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Wrapper for async-style queries (matches existing pattern)
function query(sql, params = []) {
  const isSelect = sql.trim().toUpperCase().startsWith('SELECT');

  if (isSelect) {
    const stmt = db.prepare(sql);
    const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
    return Promise.resolve({ rows });
  } else {
    const stmt = db.prepare(sql);
    const result = params.length > 0 ? stmt.run(...params) : stmt.run();
    return Promise.resolve({
      rowCount: result.changes,
      lastID: result.lastInsertRowid
    });
  }
}

// Helper to get current timestamp in SQLite format
function now() {
  return new Date().toISOString();
}

module.exports = { query, now, db };
