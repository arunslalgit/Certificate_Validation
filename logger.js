const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function formatDate() {
  return new Date().toISOString();
}

function log(level, message, meta = {}) {
  const logEntry = {
    timestamp: formatDate(),
    level,
    message,
    ...meta
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  // Write to file
  fs.appendFileSync(LOG_FILE, logLine);

  // Also log to console
  const consoleMsg = `[${logEntry.timestamp}] [${level.toUpperCase()}] ${message}`;
  if (level === 'error') {
    console.error(consoleMsg, meta);
  } else {
    console.log(consoleMsg, meta);
  }
}

module.exports = {
  info: (message, meta) => log('info', message, meta),
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  debug: (message, meta) => log('debug', message, meta)
};
