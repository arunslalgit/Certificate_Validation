-- Add new system settings for proxy, TLS, environment, and alert days

-- Proxy settings
INSERT OR IGNORE INTO system_settings (key, value, description) VALUES
('proxy.enabled', 'false', 'Enable HTTP/HTTPS proxy for webhook and email'),
('proxy.host', '', 'Proxy server hostname'),
('proxy.port', '', 'Proxy server port'),
('proxy.username', '', 'Proxy authentication username (optional)'),
('proxy.password', '', 'Proxy authentication password (optional)');

-- TLS timeout and concurrency settings
INSERT OR IGNORE INTO system_settings (key, value, description) VALUES
('tls.timeout', '10000', 'TLS connection timeout in milliseconds'),
('tls.concurrency', '5', 'Maximum concurrent TLS checks');

-- Environment configuration
INSERT OR IGNORE INTO system_settings (key, value, description) VALUES
('environments.list', 'prod,non-prod', 'Comma-separated list of environment names');

-- Per-certificate alert day configuration
-- Add new column to certificate_configs table
ALTER TABLE certificate_configs ADD COLUMN alert_days TEXT DEFAULT NULL;
-- NULL means use global Monday/Friday settings
-- Otherwise it's a comma-separated list like 'monday,wednesday,friday'
