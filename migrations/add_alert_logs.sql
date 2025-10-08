-- Alert Logs Table for Audit Trail
CREATE TABLE IF NOT EXISTS alert_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id INTEGER NOT NULL,
    result_id INTEGER,
    alert_type TEXT NOT NULL CHECK(alert_type IN ('email', 'teams')),
    recipients TEXT,
    webhook_url TEXT,
    status TEXT NOT NULL CHECK(status IN ('sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (config_id) REFERENCES certificate_configs(id) ON DELETE CASCADE,
    FOREIGN KEY (result_id) REFERENCES certificate_results(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_logs_config_id ON alert_logs(config_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_sent_at ON alert_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_logs_status ON alert_logs(status);
