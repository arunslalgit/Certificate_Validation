-- Remove environment CHECK constraint to allow dynamic values
-- SQLite doesn't support ALTER TABLE to modify constraints,
-- so we need to recreate the table

-- Create new table without environment constraint
CREATE TABLE IF NOT EXISTS certificate_configs_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eai_number TEXT NOT NULL,
    eai_name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    environment TEXT NOT NULL,

    -- Per-certificate alert settings
    alert_threshold_days INTEGER DEFAULT 50,
    alert_days TEXT DEFAULT NULL,
    email_recipients TEXT,
    teams_webhook_url TEXT,

    -- Per-certificate check frequency (in hours)
    check_frequency_hours INTEGER DEFAULT 4,

    enabled INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TIMESTAMP DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    created_by TEXT,
    last_checked TIMESTAMP,
    last_alert_sent TIMESTAMP,
    next_check_at TIMESTAMP
);

-- Copy data from old table
INSERT INTO certificate_configs_new
SELECT id, eai_number, eai_name, url, environment,
       alert_threshold_days, alert_days, email_recipients, teams_webhook_url,
       check_frequency_hours, enabled, created_at, updated_at, created_by,
       last_checked, last_alert_sent, next_check_at
FROM certificate_configs;

-- Drop old table
DROP TABLE certificate_configs;

-- Rename new table
ALTER TABLE certificate_configs_new RENAME TO certificate_configs;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_cert_configs_enabled ON certificate_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_cert_configs_url ON certificate_configs(url);
CREATE INDEX IF NOT EXISTS idx_cert_configs_eai ON certificate_configs(eai_name);
CREATE INDEX IF NOT EXISTS idx_cert_configs_next_check ON certificate_configs(next_check_at);
