const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'certificates.db');
const db = new Database(DB_PATH);

db.pragma('foreign_keys = ON');

function query(sql, params = []) {
  const trimmed = sql.trim().toUpperCase();
  const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');

  if (isSelect) {
    const stmt = db.prepare(sql);
    const rows = params.length ? stmt.all(...params) : stmt.all();
    return Promise.resolve({ rows });
  }

  const stmt = db.prepare(sql);
  const result = params.length ? stmt.run(...params) : stmt.run();
  return Promise.resolve({
    rowCount: result.changes,
    lastID: result.lastInsertRowid
  });
}

function now() {
  return "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";
}

module.exports = { query, now, db };
