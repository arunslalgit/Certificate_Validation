CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user', 'viewer')),
    email TEXT,
    created_at TIMESTAMP DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS certificate_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eai_number TEXT NOT NULL,
    eai_name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    environment TEXT NOT NULL CHECK(environment IN ('dev', 'qa', 'uat', 'prod')),
    alert_threshold_days INTEGER DEFAULT 50,
    email_recipients TEXT,
    teams_webhook_url TEXT,
    check_frequency_hours INTEGER DEFAULT 4,
    enabled INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TIMESTAMP DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    created_by TEXT,
    last_checked TIMESTAMP,
    last_alert_sent TIMESTAMP,
    next_check_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cert_configs_enabled ON certificate_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_cert_configs_url ON certificate_configs(url);
CREATE INDEX IF NOT EXISTS idx_cert_configs_eai ON certificate_configs(eai_name);
CREATE INDEX IF NOT EXISTS idx_cert_configs_next_check ON certificate_configs(next_check_at);

CREATE TABLE IF NOT EXISTS certificate_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id INTEGER NOT NULL,
    checked_at TIMESTAMP DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    hostname TEXT NOT NULL,
    certificate_valid INTEGER NOT NULL,
    expiry_date TIMESTAMP,
    days_until_expiry INTEGER,
    issuer TEXT,
    subject_alternate_names TEXT,
    error_message TEXT,
    status TEXT NOT NULL CHECK(status IN ('valid', 'expiring_soon', 'expired', 'error')),
    FOREIGN KEY (config_id) REFERENCES certificate_configs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cert_results_config_id ON certificate_results(config_id);
CREATE INDEX IF NOT EXISTS idx_cert_results_checked_at ON certificate_results(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_cert_results_status ON certificate_results(status);
CREATE INDEX IF NOT EXISTS idx_cert_results_days_expiry ON certificate_results(days_until_expiry);

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT OR IGNORE INTO system_settings (key, value, description) VALUES
('retention.enabled', 'true', 'Enable automatic data retention cleanup'),
('retention.results_days', '30', 'Days to retain certificate check results'),
('retention.batch_size', '1000', 'Batch size for deletion operations'),
('alert.monday_enabled', 'true', 'Send alerts on Monday'),
('alert.friday_enabled', 'true', 'Send alerts on Friday'),
('smtp.enabled', 'false', 'Enable email notifications'),
('smtp.host', 'smtp.example.com', 'SMTP server hostname'),
('smtp.port', '587', 'SMTP server port'),
('smtp.from', 'certs@example.com', 'Email from address'),
('check.default_frequency_hours', '4', 'Default check frequency in hours'),
('alert.default_threshold_days', '50', 'Default alert threshold in days');
