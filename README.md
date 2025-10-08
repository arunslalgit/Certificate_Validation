# Certificate Expiry Monitoring Tool - Implementation Plan

## Project Overview
A certificate expiry monitoring system that checks SSL certificates from URLs, extracts Subject Alternate Names (SANs), and sends alerts via email or Microsoft Teams webhooks. **Each team can configure their own alert settings and check frequency per certificate.** Built using the same architecture as the existing 1-Click O11y project.

## Technology Stack
- **Frontend**: React + Mantine v8.0.1 + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: Better-SQLite3 only
- **Scheduler**: node-cron (checks every 15 minutes for due certificates)
- **Auth**: Cookie-based authentication
- **Notifications**: Email (nodemailer) + Teams webhooks

## Key Features

### Per-Certificate Configuration (Team-Level Control)
Each certificate entry can have its own:
- ✅ **Email recipients** - Comma-separated team emails
- ✅ **Teams webhook URL** - Team-specific webhook with test button
- ✅ **Check frequency** - 1h, 2h, 4h, 6h, 12h, or 24h intervals
- ✅ **Alert threshold** - Days before expiry to send alerts (default 50)

### Real-Time Monitoring
- ✅ **SSE Streaming** - Real-time certificate checks with live progress
- ✅ **Run Now** - On-demand checks with instant feedback
- ✅ **Auto-scheduling** - Each cert checked based on its own frequency
- ✅ **Smart alerts** - Monday/Friday only, once per day per certificate

### Results & Filtering
- ✅ **Filtered results** - By EAI name, environment, status, days until expiry
- ✅ **Visual highlighting** - Red (≤7 days), Orange (≤30 days)
- ✅ **Excel import/export** - Bulk configuration management
- ✅ **30-day retention** - Configurable data cleanup

### Example Configuration
```
Team A - Production API:
  URL: https://api-prod.example.com
  Email: team-a@example.com, api-team@example.com
  Teams Webhook: https://outlook.office.com/webhook/team-a/...
  Check Every: 4 hours
  Alert Threshold: 30 days

Team B - UAT Service:
  URL: https://uat-service.example.com
  Email: team-b@example.com
  Teams Webhook: https://outlook.office.com/webhook/team-b/...
  Check Every: 12 hours
  Alert Threshold: 60 days
```

---

## Database Schema (SQLite Only)

### Table 1: `users`
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user', 'viewer')),
    email TEXT,
    created_at TIMESTAMP DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

### Table 2: `certificate_configs`
```sql
CREATE TABLE IF NOT EXISTS certificate_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eai_number TEXT NOT NULL,
    eai_name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    environment TEXT NOT NULL CHECK(environment IN ('dev', 'qa', 'uat', 'prod')),
    
    -- Per-certificate alert settings
    alert_threshold_days INTEGER DEFAULT 50,
    email_recipients TEXT,                    -- Comma-separated emails for this cert
    teams_webhook_url TEXT,                   -- Teams webhook URL for this cert
    
    -- Per-certificate check frequency (in hours)
    check_frequency_hours INTEGER DEFAULT 4,  -- How often to check this cert
    
    enabled INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TIMESTAMP DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    created_by TEXT,
    last_checked TIMESTAMP,
    last_alert_sent TIMESTAMP,
    next_check_at TIMESTAMP                   -- When this cert should be checked next
);

CREATE INDEX IF NOT EXISTS idx_cert_configs_enabled ON certificate_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_cert_configs_url ON certificate_configs(url);
CREATE INDEX IF NOT EXISTS idx_cert_configs_eai ON certificate_configs(eai_name);
CREATE INDEX IF NOT EXISTS idx_cert_configs_next_check ON certificate_configs(next_check_at);
```

### Table 3: `certificate_results`
```sql
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
```

### Table 4: `system_settings`
```sql
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
('smtp.from', 'certs@example.com', 'Email from address');
```

---

## Sequential Implementation Tasks

### Phase 1: Project Setup & Backend Foundation (Day 1-2)

#### Task 1.1: Initialize Project Structure
**Files to create:**
```
cert-expiry-monitor/
├── package.json
├── .gitignore
├── .env.example
├── server.js
├── db.js
├── init-db.js
├── schema-sqlite.sql
├── auth.js
├── logger.js
├── cert-checker.js
├── notifications.js
├── scheduler.js
├── data-retention.js
├── cert-ui/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
```

**Implementation:**
1. Copy `package.json` from existing project and modify dependencies:
   - Add: `tls`, `https` (built-in Node.js modules for cert checking)
   - Keep: `express`, `better-sqlite3`, `bcryptjs`, `cookie-parser`, `node-cron`, `nodemailer`, `axios`
   - Remove: `pg` (no PostgreSQL needed)

2. Copy boilerplate files from existing project:
   - `auth.js` (cookie auth middleware - no changes needed)
   - `logger.js` (logging utility - no changes needed)
   - `.gitignore`

3. Create simplified `db.js` (SQLite only):
```javascript
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'certificates.db');
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

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
  return "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";
}

module.exports = { query, now, db };
```

4. Create `schema-sqlite.sql` with the 4 tables defined above

#### Task 1.2: Database Initialization
**File: `init-db.js`**
```javascript
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
    } else {
      console.log('✓ Admin user already exists');
    }
    
    // Initialize system settings
    const settings = [
      ['retention.enabled', 'true', 'Enable automatic data retention cleanup'],
      ['retention.results_days', '30', 'Days to retain certificate check results'],
      ['retention.batch_size', '1000', 'Batch size for deletion operations'],
      ['check.interval_hours', '4', 'Hours between certificate checks'],
      ['alert.days_threshold', '50', 'Alert if certificate expires within N days'],
      ['alert.monday_enabled', 'true', 'Send alerts on Monday'],
      ['alert.friday_enabled', 'true', 'Send alerts on Friday'],
      ['smtp.enabled', 'false', 'Enable email notifications'],
      ['smtp.host', 'smtp.example.com', 'SMTP server hostname'],
      ['smtp.port', '587', 'SMTP server port'],
      ['smtp.from', 'certs@example.com', 'Email from address']
    ];
    
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO system_settings (key, value, description)
      VALUES (?, ?, ?)
    `);
    
    for (const [key, value, description] of settings) {
      stmt.run(key, value, description);
    }
    
    console.log('✓ System settings initialized');
    console.log('\n✅ Database initialization complete!\n');
    
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    throw err;
  }
}

module.exports = { initDatabase };
```

#### Task 1.3: Certificate Checking Service
**File: `cert-checker.js` (NEW)**
```javascript
const https = require('https');
const tls = require('tls');

async function checkCertificate(url) {
  // 1. Parse URL to extract hostname and port
  // 2. Create TLS connection
  // 3. Extract certificate details:
  //    - Valid from/to dates
  //    - Subject
  //    - Issuer
  //    - Subject Alternate Names (SANs)
  // 4. Calculate days until expiry
  // 5. Return structured result
}

module.exports = { checkCertificate };
```

**Key implementation details:**
```javascript
const options = {
  host: hostname,
  port: port || 443,
  method: 'GET',
  rejectUnauthorized: false, // Accept self-signed certs
  agent: false
};

const socket = tls.connect(port || 443, hostname, { 
  rejectUnauthorized: false 
});

socket.on('secureConnect', () => {
  const cert = socket.getPeerCertificate(true);
  const validTo = new Date(cert.valid_to);
  const daysUntilExpiry = Math.floor(
    (validTo - new Date()) / (1000 * 60 * 60 * 24)
  );
  
  // Extract SANs
  const sans = cert.subjectaltname 
    ? cert.subjectaltname.split(',').map(s => s.trim()) 
    : [];
});
```

---

### Phase 2: Backend API Endpoints (Day 2-3)

#### Task 2.1: Authentication Endpoints
**File: `server.js`**
```javascript
// Copy from existing project:
POST   /api/auth/login          // Cookie-based login
POST   /api/auth/logout         // Clear cookie
GET    /api/auth/me             // Get current user
POST   /api/auth/change-password
```

#### Task 2.2: Certificate Config CRUD
```javascript
GET    /api/certificates        // List all configs
POST   /api/certificates        // Create new config
PUT    /api/certificates/:id    // Update config
DELETE /api/certificates/:id    // Delete config
POST   /api/certificates/:id/check  // Manual check trigger (single)
GET    /api/stream/certificates/check-all  // SSE: Stream check all certificates
GET    /api/stream/certificates/check/:id  // SSE: Stream check single certificate
POST   /api/certificates/test-webhook  // Test Teams webhook
```

**SSE Streaming Endpoint Implementation:**
```javascript
// GET /api/stream/certificates/check-all - Real-time streaming
app.get('/api/stream/certificates/check-all', requireAuth, async (req, res) => {
  const { configIds } = req.query; // Optional: specific configs to check
  
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  try {
    let query = 'SELECT * FROM certificate_configs WHERE enabled = 1';
    let params = [];
    
    if (configIds) {
      const ids = configIds.split(',').map(id => parseInt(id));
      query += ` AND id IN (${ids.map(() => '?').join(',')})`;
      params = ids;
    }
    
    const { rows: configs } = await db.query(query, params);
    
    // Check each certificate and stream results
    for (const config of configs) {
      try {
        const result = await checkCertificate(config.url);
        
        // Save to database
        await db.query(`
          INSERT INTO certificate_results 
          (config_id, hostname, certificate_valid, expiry_date, 
           days_until_expiry, issuer, subject_alternate_names, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          config.id, 
          result.hostname, 
          result.valid ? 1 : 0, 
          result.validTo,
          result.daysUntilExpiry, 
          result.issuer, 
          JSON.stringify(result.sans), 
          result.status
        ]);
        
        // Update last_checked timestamp
        await db.query(
          'UPDATE certificate_configs SET last_checked = ? WHERE id = ?',
          [new Date().toISOString(), config.id]
        );
        
        // Stream result to client
        const streamData = {
          config_id: config.id,
          eai_number: config.eai_number,
          eai_name: config.eai_name,
          url: config.url,
          environment: config.environment,
          hostname: result.hostname,
          valid: result.valid,
          expiry_date: result.validTo,
          days_until_expiry: result.daysUntilExpiry,
          issuer: result.issuer,
          sans: result.sans,
          status: result.status
        };
        
        res.write(`data: ${JSON.stringify(streamData)}\n\n`);
        
      } catch (error) {
        // Stream error for this certificate
        const errorData = {
          config_id: config.id,
          eai_name: config.eai_name,
          url: config.url,
          status: 'error',
          error: error.message
        };
        
        res.write(`data: ${JSON.stringify(errorData)}\n\n`);
        
        // Save error result to database
        await db.query(`
          INSERT INTO certificate_results 
          (config_id, hostname, certificate_valid, status, error_message)
          VALUES (?, ?, ?, ?, ?)
        `, [config.id, config.url, 0, 'error', error.message]);
      }
    }
    
    // Send completion event
    res.write('event: done\ndata: {}\n\n');
    res.end();
    
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// GET /api/stream/certificates/check/:id - Stream single certificate check
app.get('/api/stream/certificates/check/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  try {
    const { rows } = await db.query(
      'SELECT * FROM certificate_configs WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      res.write(`data: ${JSON.stringify({ error: 'Certificate not found' })}\n\n`);
      res.end();
      return;
    }
    
    const config = rows[0];
    const result = await checkCertificate(config.url);
    
    // Save to database
    await db.query(`
      INSERT INTO certificate_results 
      (config_id, hostname, certificate_valid, expiry_date, 
       days_until_expiry, issuer, subject_alternate_names, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      config.id, 
      result.hostname, 
      result.valid ? 1 : 0, 
      result.validTo,
      result.daysUntilExpiry, 
      result.issuer, 
      JSON.stringify(result.sans), 
      result.status
    ]);
    
    // Stream result
    const streamData = {
      config_id: config.id,
      eai_number: config.eai_number,
      eai_name: config.eai_name,
      url: config.url,
      environment: config.environment,
      hostname: result.hostname,
      valid: result.valid,
      expiry_date: result.validTo,
      days_until_expiry: result.daysUntilExpiry,
      issuer: result.issuer,
      sans: result.sans,
      status: result.status
    };
    
    res.write(`data: ${JSON.stringify(streamData)}\n\n`);
    res.write('event: done\ndata: {}\n\n');
    res.end();
    
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});
```

#### Task 2.3: Results & Reporting Endpoints
```javascript
GET    /api/results              // Get all results with filters
GET    /api/results/:config_id   // Results for specific config
GET    /api/results/latest       // Latest result per certificate
GET    /api/dashboard-stats      // Summary statistics
GET    /api/export/excel         // Export results to Excel
```

**Results endpoint with filtering:**
```javascript
// GET /api/results?eai_name=xxx&environment=prod&status=expiring_soon&days_max=30
app.get('/api/results', requireAuth, async (req, res) => {
  const { eai_name, environment, status, days_max, days_min, limit = 100 } = req.query;
  
  let query = `
    SELECT 
      cr.*,
      cc.eai_number,
      cc.eai_name,
      cc.url,
      cc.environment
    FROM certificate_results cr
    JOIN certificate_configs cc ON cr.config_id = cc.id
    WHERE 1=1
  `;
  const params = [];
  
  if (eai_name) {
    query += ' AND cc.eai_name LIKE ?';
    params.push(`%${eai_name}%`);
  }
  
  if (environment) {
    query += ' AND cc.environment = ?';
    params.push(environment);
  }
  
  if (status) {
    query += ' AND cr.status = ?';
    params.push(status);
  }
  
  if (days_max) {
    query += ' AND cr.days_until_expiry <= ?';
    params.push(parseInt(days_max));
  }
  
  if (days_min) {
    query += ' AND cr.days_until_expiry >= ?';
    params.push(parseInt(days_min));
  }
  
  query += ' ORDER BY cr.checked_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  const { rows } = await db.query(query, params);
  res.json({ results: rows });
});

// GET /api/results/latest - Get latest result for each certificate
app.get('/api/results/latest', requireAuth, async (req, res) => {
  const query = `
    SELECT 
      cr.*,
      cc.eai_number,
      cc.eai_name,
      cc.url,
      cc.environment,
      cc.alert_threshold_days
    FROM certificate_results cr
    JOIN certificate_configs cc ON cr.config_id = cc.id
    WHERE cr.id IN (
      SELECT MAX(id) 
      FROM certificate_results 
      GROUP BY config_id
    )
    AND cc.enabled = 1
    ORDER BY cr.days_until_expiry ASC
  `;
  
  const { rows } = await db.query(query);
  res.json({ results: rows });
});

// GET /api/dashboard-stats
app.get('/api/dashboard-stats', requireAuth, async (req, res) => {
  const stats = {
    total: 0,
    valid: 0,
    expiring_soon: 0,
    expired: 0,
    errors: 0
  };
  
  const { rows } = await db.query(`
    SELECT status, COUNT(*) as count
    FROM certificate_results
    WHERE id IN (
      SELECT MAX(id) FROM certificate_results GROUP BY config_id
    )
    GROUP BY status
  `);
  
  rows.forEach(row => {
    stats.total += row.count;
    stats[row.status] = row.count;
  });
  
  res.json(stats);
});
```

#### Task 2.4: User Management Endpoints
```javascript
// Copy from existing project:
GET    /api/users                // List users (admin only)
POST   /api/users                // Create user (admin only)
DELETE /api/users/:id            // Delete user (admin only)
```

---

### Phase 3: Scheduler & Background Jobs (Day 3-4)

#### Task 3.1: Certificate Check Scheduler with Per-Certificate Frequencies
**File: `scheduler.js`**
```javascript
const cron = require('node-cron');
const { checkCertificate } = require('./cert-checker');
const db = require('./db');

let checkJob = null;

async function startScheduler() {
  // Run every 15 minutes to check which certificates need checking
  // Each certificate has its own check_frequency_hours setting
  checkJob = cron.schedule('*/15 * * * *', async () => {
    console.log('[Scheduler] Checking for certificates due for check...');
    await runScheduledChecks();
  });
  
  console.log('[Scheduler] Started - checking every 15 minutes for due certificates');
}

async function runScheduledChecks() {
  const now = new Date().toISOString();
  
  // Find all enabled certificates that are due for checking
  // (next_check_at is null or in the past)
  const { rows: configs } = await db.query(`
    SELECT * FROM certificate_configs 
    WHERE enabled = 1 
    AND (next_check_at IS NULL OR next_check_at <= ?)
  `, [now]);
  
  if (configs.length === 0) {
    console.log('[Scheduler] No certificates due for check');
    return;
  }
  
  console.log(`[Scheduler] Found ${configs.length} certificate(s) due for check`);
  
  for (const config of configs) {
    try {
      console.log(`[Scheduler] Checking ${config.eai_name} (${config.url})`);
      
      const result = await checkCertificate(config.url);
      
      // Save result to database
      await db.query(`
        INSERT INTO certificate_results 
        (config_id, hostname, certificate_valid, expiry_date, 
         days_until_expiry, issuer, subject_alternate_names, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        config.id, 
        result.hostname, 
        result.valid ? 1 : 0, 
        result.validTo,
        result.daysUntilExpiry, 
        result.issuer, 
        JSON.stringify(result.sans), 
        result.status
      ]);
      
      // Calculate next check time based on this certificate's frequency
      const checkFrequency = config.check_frequency_hours || 4;
      const nextCheckDate = new Date();
      nextCheckDate.setHours(nextCheckDate.getHours() + checkFrequency);
      
      // Update last_checked and next_check_at
      await db.query(`
        UPDATE certificate_configs 
        SET last_checked = ?, next_check_at = ?
        WHERE id = ?
      `, [now, nextCheckDate.toISOString(), config.id]);
      
      console.log(`[Scheduler] ✓ ${config.eai_name}: ${result.status} (${result.daysUntilExpiry} days). Next check in ${checkFrequency}h`);
      
      // Check if alert needed (using certificate's own email/webhook settings)
      if (shouldSendAlert(config, result)) {
        await sendAlert(config, result);
      }
      
    } catch (error) {
      console.error(`[Scheduler] ✗ Failed to check ${config.url}:`, error.message);
      
      // Save error result
      await db.query(`
        INSERT INTO certificate_results 
        (config_id, hostname, certificate_valid, status, error_message)
        VALUES (?, ?, ?, ?, ?)
      `, [config.id, config.url, 0, 'error', error.message]);
      
      // Still update next check time even on error
      const checkFrequency = config.check_frequency_hours || 4;
      const nextCheckDate = new Date();
      nextCheckDate.setHours(nextCheckDate.getHours() + checkFrequency);
      
      await db.query(`
        UPDATE certificate_configs 
        SET last_checked = ?, next_check_at = ?
        WHERE id = ?
      `, [now, nextCheckDate.toISOString(), config.id]);
    }
  }
  
  console.log('[Scheduler] Check cycle complete');
}

function shouldSendAlert(config, result) {
  // 1. Check if email or webhook is configured for this certificate
  if (!config.email_recipients && !config.teams_webhook_url) {
    console.log(`[Scheduler] No alert config for ${config.eai_name}`);
    return false;
  }
  
  // 2. Check if expiry within threshold (per-certificate setting)
  const threshold = config.alert_threshold_days || 50;
  if (result.daysUntilExpiry > threshold) {
    return false;
  }
  
  // 3. Check if it's Monday (1) or Friday (5)
  const today = new Date().getDay();
  if (today !== 1 && today !== 5) {
    console.log(`[Scheduler] Skipping alert - not Monday or Friday (day ${today})`);
    return false;
  }
  
  // 4. Check if alert already sent today
  if (config.last_alert_sent) {
    const lastAlert = new Date(config.last_alert_sent);
    const now = new Date();
    if (lastAlert.toDateString() === now.toDateString()) {
      console.log(`[Scheduler] Skipping alert - already sent today`);
      return false;
    }
  }
  
  return true;
}

module.exports = { startScheduler, runScheduledChecks };
```

#### Task 3.2: Alert Notification System with Per-Certificate Settings
**File: `notifications.js`**
```javascript
const nodemailer = require('nodemailer');
const axios = require('axios');
const db = require('./db');

async function sendAlert(config, certResult) {
  const message = formatAlertMessage(config, certResult);
  
  let emailSent = false;
  let webhookSent = false;
  
  // Send email if configured for this certificate
  if (config.email_recipients && config.email_recipients.trim()) {
    try {
      await sendEmailAlert(config.email_recipients, message);
      emailSent = true;
      console.log(`[Notifications] ✓ Email sent to ${config.email_recipients}`);
    } catch (error) {
      console.error(`[Notifications] ✗ Email failed:`, error.message);
    }
  }
  
  // Send Teams webhook if configured for this certificate
  if (config.teams_webhook_url && config.teams_webhook_url.trim()) {
    try {
      await sendTeamsAlert(config.teams_webhook_url, message);
      webhookSent = true;
      console.log(`[Notifications] ✓ Teams webhook sent`);
    } catch (error) {
      console.error(`[Notifications] ✗ Teams webhook failed:`, error.message);
    }
  }
  
  // Update last_alert_sent timestamp if any notification succeeded
  if (emailSent || webhookSent) {
    await db.query(
      'UPDATE certificate_configs SET last_alert_sent = ? WHERE id = ?',
      [new Date().toISOString(), config.id]
    );
  }
}

function formatAlertMessage(config, result) {
  return {
    title: `⚠️ Certificate Expiry Alert: ${config.eai_name}`,
    summary: `Certificate for ${config.url} expires in ${result.daysUntilExpiry} days`,
    details: {
      eaiNumber: config.eai_number,
      eaiName: config.eai_name,
      url: config.url,
      environment: config.environment,
      expiryDate: new Date(result.validTo).toLocaleDateString(),
      daysRemaining: result.daysUntilExpiry,
      issuer: result.issuer,
      sans: result.sans,
      threshold: config.alert_threshold_days
    }
  };
}

async function sendEmailAlert(recipients, message) {
  // Get SMTP settings from system_settings
  const { rows: settings } = await db.query(
    'SELECT key, value FROM system_settings WHERE key LIKE "smtp.%"'
  );
  
  const smtpConfig = {};
  settings.forEach(s => {
    const key = s.key.replace('smtp.', '');
    smtpConfig[key] = s.value;
  });
  
  if (smtpConfig.enabled !== 'true') {
    console.log('[Notifications] SMTP not enabled');
    return;
  }
  
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: parseInt(smtpConfig.port) || 587,
    secure: smtpConfig.port === '465',
    tls: { rejectUnauthorized: false }
  });
  
  const emailList = recipients.split(',').map(e => e.trim());
  
  await transporter.sendMail({
    from: smtpConfig.from,
    to: emailList.join(', '),
    subject: message.title,
    html: `
      <h2>${message.title}</h2>
      <p><strong>Summary:</strong> ${message.summary}</p>
      <h3>Certificate Details:</h3>
      <ul>
        <li><strong>EAI Number:</strong> ${message.details.eaiNumber}</li>
        <li><strong>EAI Name:</strong> ${message.details.eaiName}</li>
        <li><strong>URL:</strong> ${message.details.url}</li>
        <li><strong>Environment:</strong> ${message.details.environment}</li>
        <li><strong>Expiry Date:</strong> ${message.details.expiryDate}</li>
        <li><strong>Days Remaining:</strong> <span style="color: ${
          message.details.daysRemaining <= 7 ? 'red' : 'orange'
        }; font-weight: bold;">${message.details.daysRemaining}</span></li>
        <li><strong>Issuer:</strong> ${message.details.issuer}</li>
        <li><strong>Alert Threshold:</strong> ${message.details.threshold} days</li>
      </ul>
      <h4>Subject Alternate Names:</h4>
      <ul>
        ${message.details.sans.map(san => `<li>${san}</li>`).join('')}
      </ul>
      <p style="color: #666; font-size: 12px;">
        This alert was triggered because the certificate expires within ${message.details.threshold} days.
        Alerts are sent only on Monday and Friday, once per day.
      </p>
    `
  });
}

async function sendTeamsAlert(webhookUrl, message) {
  const card = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    "summary": message.summary,
    "themeColor": message.details.daysRemaining < 7 ? "FF0000" : "FFA500",
    "title": message.title,
    "sections": [{
      "activityTitle": "Certificate Details",
      "facts": [
        { "name": "EAI Number:", "value": message.details.eaiNumber },
        { "name": "EAI Name:", "value": message.details.eaiName },
        { "name": "URL:", "value": message.details.url },
        { "name": "Environment:", "value": message.details.environment.toUpperCase() },
        { "name": "Expiry Date:", "value": message.details.expiryDate },
        { "name": "Days Remaining:", "value": `**${message.details.daysRemaining} days**` },
        { "name": "Issuer:", "value": message.details.issuer },
        { "name": "Alert Threshold:", "value": `${message.details.threshold} days` }
      ],
      "text": `⚠️ **Action Required:** Certificate expiring soon - please renew!\n\n**Subject Alternate Names:**\n${message.details.sans.map(san => `- ${san}`).join('\n')}`
    }],
    "potentialAction": [{
      "@type": "OpenUri",
      "name": "View Certificate",
      "targets": [{
        "os": "default",
        "uri": message.details.url
      }]
    }]
  };
  
  await axios.post(webhookUrl, card, {
    headers: { 'Content-Type': 'application/json' }
  });
}

module.exports = { sendAlert };
```

#### Task 3.3: Data Retention Job
**File: `data-retention.js`**
```javascript
// Copy pattern from existing project
// Run daily at midnight: 0 0 * * *
cron.schedule('0 0 * * *', async () => {
  const settings = await getSystemSettings();
  const retentionDays = parseInt(settings['retention.results_days']) || 30;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  await db.query(`
    DELETE FROM certificate_results 
    WHERE checked_at < $1
  `, [cutoffDate]);
});
```

---

### Phase 4: Frontend Development (Day 4-6)

#### Task 4.1: Setup Frontend Project
```bash
cd cert-ui
npm create vite@latest . -- --template react-ts
npm install @mantine/core @mantine/hooks @mantine/notifications @mantine/dates
npm install @mantine/dropzone @tabler/icons-react dayjs
npm install react-router-dom axios
```

**File: `vite.config.ts`**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
```

#### Task 4.2: Authentication Components
**Files to create (copy from existing project):**
- `src/components/SimpleLogin.tsx`
- `src/components/AuthWrapper.tsx`
- `src/contexts/ThemeContext.tsx`
- `src/components/ThemeToggle.tsx`

#### Task 4.3: Certificate Management Page
**File: `src/pages/CertificateManagement.tsx`**
```typescript
// Main page with:
// 1. DataTable showing all certificate configs with alert settings
// 2. Add/Edit modal with form
// 3. Delete confirmation modal
// 4. Manual check button
// 5. Test webhook button

import { useState, useEffect } from 'react';
import { 
  Container, Button, Group, Modal, TextInput, 
  Select, Textarea, Switch, Badge, ActionIcon, Text,
  Tooltip
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { 
  IconPlus, IconEdit, IconTrash, IconRefresh, 
  IconTestPipe, IconDownload, IconMail, IconBrandTeams
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export default function CertificateManagement() {
  const [certificates, setCertificates] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    loadCertificates();
  }, []);
  
  const loadCertificates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/certificates');
      const data = await res.json();
      setCertificates(data.certificates || []);
    } catch (error) {
      console.error('Failed to load certificates:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleEdit = (cert) => {
    setSelectedCert(cert);
    setModalOpen(true);
  };
  
  const handleAdd = () => {
    setSelectedCert(null);
    setModalOpen(true);
  };
  
  const handleManualCheck = async (cert) => {
    notifications.show({
      id: `check-${cert.id}`,
      loading: true,
      title: 'Checking Certificate',
      message: `Checking ${cert.eai_name}...`,
      autoClose: false,
    });
    
    try {
      const res = await fetch(`/api/certificates/${cert.id}/check`, {
        method: 'POST',
        credentials: 'include'
      });
      
      const data = await res.json();
      
      notifications.update({
        id: `check-${cert.id}`,
        color: data.status === 'valid' ? 'green' : 'orange',
        title: 'Check Complete',
        message: `${cert.eai_name}: ${data.days_until_expiry} days until expiry`,
        autoClose: 3000,
        loading: false
      });
      
      loadCertificates(); // Refresh list
    } catch (error) {
      notifications.update({
        id: `check-${cert.id}`,
        color: 'red',
        title: 'Check Failed',
        message: error.message,
        autoClose: 3000,
        loading: false
      });
    }
  };
  
  const handleDelete = async (cert) => {
    if (!confirm(`Delete certificate config for ${cert.eai_name}?`)) return;
    
    try {
      await fetch(`/api/certificates/${cert.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      notifications.show({
        title: 'Deleted',
        message: `${cert.eai_name} configuration deleted`,
        color: 'green'
      });
      
      loadCertificates();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red'
      });
    }
  };
  
  const columns = [
    { 
      accessor: 'eai_number', 
      title: 'EAI Number',
      width: 100
    },
    { 
      accessor: 'eai_name', 
      title: 'EAI Name',
      width: 150
    },
    { 
      accessor: 'url', 
      title: 'URL',
      render: (row) => (
        <Text size="sm" truncate style={{ maxWidth: 300 }}>
          {row.url}
        </Text>
      )
    },
    { 
      accessor: 'environment', 
      title: 'Environment',
      width: 100,
      render: (row) => (
        <Badge color={
          row.environment === 'prod' ? 'red' : 
          row.environment === 'uat' ? 'orange' : 'blue'
        }>
          {row.environment.toUpperCase()}
        </Badge>
      )
    },
    {
      accessor: 'alerts',
      title: 'Alerts',
      width: 80,
      render: (row) => (
        <Group gap="xs">
          {row.email_recipients && (
            <Tooltip label={row.email_recipients}>
              <IconMail size={16} color="blue" />
            </Tooltip>
          )}
          {row.teams_webhook_url && (
            <Tooltip label="Teams webhook configured">
              <IconBrandTeams size={16} color="purple" />
            </Tooltip>
          )}
          {!row.email_recipients && !row.teams_webhook_url && (
            <Text size="xs" c="dimmed">None</Text>
          )}
        </Group>
      )
    },
    {
      accessor: 'check_frequency_hours',
      title: 'Check Frequency',
      width: 120,
      render: (row) => (
        <Text size="sm">Every {row.check_frequency_hours || 4}h</Text>
      )
    },
    {
      accessor: 'alert_threshold_days',
      title: 'Alert Threshold',
      width: 120,
      render: (row) => (
        <Text size="sm">{row.alert_threshold_days || 50} days</Text>
      )
    },
    {
      accessor: 'enabled',
      title: 'Status',
      width: 80,
      render: (row) => (
        <Badge color={row.enabled ? 'green' : 'gray'}>
          {row.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      )
    },
    {
      accessor: 'last_checked',
      title: 'Last Checked',
      width: 150,
      render: (row) => (
        <Text size="sm" c="dimmed">
          {row.last_checked 
            ? new Date(row.last_checked).toLocaleString() 
            : 'Never'}
        </Text>
      )
    },
    {
      accessor: 'actions',
      title: 'Actions',
      width: 120,
      render: (row) => (
        <Group gap="xs">
          <ActionIcon 
            variant="subtle" 
            onClick={() => handleEdit(row)}
            title="Edit"
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon 
            variant="subtle" 
            color="blue"
            onClick={() => handleManualCheck(row)}
            title="Check Now"
          >
            <IconRefresh size={16} />
          </ActionIcon>
          <ActionIcon 
            variant="subtle" 
            color="red"
            onClick={() => handleDelete(row)}
            title="Delete"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      )
    }
  ];
  
  return (
    <Container size="xl">
      <Group justify="space-between" mb="lg">
        <div>
          <h1>Certificate Management</h1>
          <Text size="sm" c="dimmed">
            Configure certificate monitoring with custom alert settings per application
          </Text>
        </div>
        <Group>
          <Button 
            leftSection={<IconDownload size={16} />} 
            variant="light"
            onClick={downloadTemplate}
          >
            Download Template
          </Button>
          <Button 
            leftSection={<IconPlus size={16} />} 
            onClick={handleAdd}
          >
            Add Certificate
          </Button>
        </Group>
      </Group>
      
      <DataTable
        columns={columns}
        records={certificates}
        fetching={loading}
        striped
        highlightOnHover
        minHeight={200}
        noRecordsText="No certificates configured"
      />
      
      <CertificateFormModal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedCert(null);
          loadCertificates();
        }}
        certificate={selectedCert}
      />
    </Container>
  );
}
```

#### Task 4.4: Run Now Page with SSE Streaming
**File: `src/pages/RunNow.tsx`**
```typescript
// Real-time certificate checking using Server-Sent Events (SSE)
// Features:
// 1. Select all or specific certificates to check
// 2. "Check Now" button triggers immediate SSE stream
// 3. Real-time progress display as each certificate is checked
// 4. Results shown in a table with status badges
// 5. Highlight certificates close to expiry

import { useState, useEffect } from 'react';
import { 
  Container, Button, Group, Card, Text, Badge, 
  Checkbox, Stack, Progress, Alert, Table
} from '@mantine/core';
import { 
  IconRefresh, IconCheck, IconX, IconAlertTriangle,
  IconClock
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface Certificate {
  id: number;
  eai_name: string;
  eai_number: string;
  url: string;
  environment: string;
}

interface CheckResult {
  config_id: number;
  eai_name: string;
  eai_number: string;
  url: string;
  environment: string;
  hostname: string;
  valid: boolean;
  days_until_expiry: number;
  expiry_date: string;
  status: string;
  sans: string[];
  issuer: string;
  error?: string;
}

export default function RunNow() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [totalToCheck, setTotalToCheck] = useState(0);
  
  useEffect(() => {
    loadCertificates();
  }, []);
  
  const loadCertificates = async () => {
    const res = await fetch('/api/certificates');
    const data = await res.json();
    setCertificates(data.certificates || []);
    // Select all enabled by default
    setSelectedIds(
      (data.certificates || [])
        .filter((c: Certificate & { enabled: boolean }) => c.enabled)
        .map((c: Certificate) => c.id)
    );
  };
  
  const handleCheckNow = () => {
    if (selectedIds.length === 0) {
      notifications.show({
        title: 'No Selection',
        message: 'Please select at least one certificate to check',
        color: 'orange'
      });
      return;
    }
    
    setChecking(true);
    setProgress(0);
    setResults([]);
    setTotalToCheck(selectedIds.length);
    
    // Build SSE URL with selected config IDs
    const idsParam = selectedIds.join(',');
    const eventSource = new EventSource(
      `/api/stream/certificates/check-all?configIds=${idsParam}`
    );
    
    eventSource.onmessage = (event) => {
      try {
        const result: CheckResult = JSON.parse(event.data);
        
        // Update results
        setResults(prev => [...prev, result]);
        
        // Update progress
        setProgress(prev => {
          const newProgress = ((prev / 100 * totalToCheck) + 1) / totalToCheck * 100;
          return Math.min(newProgress, 100);
        });
        
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
      }
    };
    
    eventSource.addEventListener('done', () => {
      setProgress(100);
      setChecking(false);
      eventSource.close();
      
      const expiringSoon = results.filter(r => r.days_until_expiry <= 30).length;
      const critical = results.filter(r => r.days_until_expiry <= 7).length;
      
      notifications.show({
        title: 'Check Complete',
        message: `Checked ${results.length} certificate(s). ${expiringSoon} expiring within 30 days, ${critical} critical (≤7 days).`,
        color: critical > 0 ? 'red' : expiringSoon > 0 ? 'orange' : 'green',
        icon: <IconCheck />
      });
    });
    
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setChecking(false);
      eventSource.close();
      
      notifications.show({
        title: 'Error',
        message: 'Failed to check certificates',
        color: 'red',
        icon: <IconX />
      });
    };
  };
  
  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };
  
  const selectAll = () => {
    setSelectedIds(certificates.map(c => c.id));
  };
  
  const deselectAll = () => {
    setSelectedIds([]);
  };
  
  const getStatusColor = (days: number) => {
    if (days < 0) return 'red';
    if (days <= 7) return 'red';
    if (days <= 30) return 'orange';
    return 'green';
  };
  
  const getStatusBadge = (status: string, days: number) => {
    const colors: Record<string, string> = {
      valid: 'green',
      expiring_soon: 'orange',
      expired: 'red',
      error: 'gray'
    };
    
    return (
      <Badge color={colors[status] || 'gray'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };
  
  const getRowStyle = (result: CheckResult) => {
    if (result.status === 'error') return {};
    if (result.days_until_expiry < 0) return { backgroundColor: '#ffcccc' };
    if (result.days_until_expiry <= 7) return { backgroundColor: '#ffe0e0' };
    if (result.days_until_expiry <= 30) return { backgroundColor: '#fff3e0' };
    return {};
  };
  
  return (
    <Container size="xl">
      <Group justify="space-between" mb="lg">
        <div>
          <h1>Run Certificate Check Now</h1>
          <Text size="sm" c="dimmed">
            Manually check certificate expiry for selected applications with real-time streaming
          </Text>
        </div>
      </Group>
      
      <Card withBorder mb="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Select Certificates to Check</Text>
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={selectAll}>
                Select All
              </Button>
              <Button size="xs" variant="light" onClick={deselectAll}>
                Deselect All
              </Button>
            </Group>
          </Group>
          
          <Stack gap="xs">
            {certificates.map(cert => (
              <Checkbox
                key={cert.id}
                label={
                  <Group gap="xs">
                    <Text>{cert.eai_name}</Text>
                    <Text size="sm" c="dimmed">({cert.url})</Text>
                    <Badge size="sm" color={
                      cert.environment === 'prod' ? 'red' : 
                      cert.environment === 'uat' ? 'orange' : 'blue'
                    }>
                      {cert.environment.toUpperCase()}
                    </Badge>
                  </Group>
                }
                checked={selectedIds.includes(cert.id)}
                onChange={() => toggleSelection(cert.id)}
              />
            ))}
          </Stack>
          
          <Button
            leftSection={<IconRefresh />}
            onClick={handleCheckNow}
            loading={checking}
            disabled={selectedIds.length === 0}
            size="lg"
          >
            {checking ? 'Checking...' : `Check Now (${selectedIds.length} selected)`}
          </Button>
          
          {checking && (
            <div>
              <Progress value={progress} animated />
              <Text size="sm" c="dimmed" mt="xs">
                Checking certificates... {results.length} / {totalToCheck} completed
              </Text>
            </div>
          )}
        </Stack>
      </Card>
      
      {results.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="md">
            Check Results (Real-time)
          </Text>
          
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>EAI Name</Table.Th>
                <Table.Th>URL</Table.Th>
                <Table.Th>Environment</Table.Th>
                <Table.Th>Expires In</Table.Th>
                <Table.Th>Expiry Date</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Issuer</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {results.map((result, idx) => (
                <Table.Tr 
                  key={idx}
                  style={getRowStyle(result)}
                >
                  <Table.Td>
                    <div>
                      <Text fw={500}>{result.eai_name}</Text>
                      <Text size="xs" c="dimmed">{result.eai_number}</Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{result.url}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={
                      result.environment === 'prod' ? 'red' :
                      result.environment === 'uat' ? 'orange' : 'blue'
                    }>
                      {result.environment.toUpperCase()}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {result.status !== 'error' ? (
                      <Group gap="xs">
                        {result.days_until_expiry <= 30 && (
                          <IconAlertTriangle 
                            size={16} 
                            color={result.days_until_expiry <= 7 ? 'red' : 'orange'} 
                          />
                        )}
                        <Text 
                          fw={500}
                          c={getStatusColor(result.days_until_expiry)}
                        >
                          {result.days_until_expiry} days
                        </Text>
                      </Group>
                    ) : (
                      <Text size="sm" c="red">Error</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {result.status !== 'error' ? (
                      <Text size="sm">
                        {new Date(result.expiry_date).toLocaleDateString()}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {getStatusBadge(result.status, result.days_until_expiry)}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {result.status !== 'error' ? result.issuer : result.error}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          
          {/* Alert summary */}
          {!checking && (
            <Alert 
              icon={<IconAlertTriangle />} 
              color={
                results.filter(r => r.days_until_expiry <= 7).length > 0 ? 'red' :
                results.filter(r => r.days_until_expiry <= 30).length > 0 ? 'orange' : 'green'
              }
              mt="md"
            >
              <Text fw={500}>
                {results.filter(r => r.days_until_expiry <= 30).length} certificate(s) 
                expiring within 30 days
              </Text>
              <Text size="sm">
                {results.filter(r => r.days_until_expiry <= 7).length} critical 
                (≤7 days remaining), {' '}
                {results.filter(r => r.status === 'error').length} errors
              </Text>
            </Alert>
          )}
        </Card>
      )}
    </Container>
  );
}
```

#### Task 4.5: Results Page with Filtering
**File: `src/pages/Results.tsx`**
```typescript
// Dedicated results page with advanced filtering
// Features:
// 1. Filter by EAI Name (search/autocomplete)
// 2. Filter by Environment (dropdown)
// 3. Filter by Status (dropdown)
// 4. Filter by Days Until Expiry (range)
// 5. Highlight rows based on expiry proximity
// 6. Export to Excel
// 7. View certificate details modal

import { useState, useEffect } from 'react';
import { 
  Container, TextInput, Select, Group, Button, 
  Card, NumberInput, Badge, ActionIcon, Modal, Stack, Text
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { 
  IconSearch, IconFilter, IconDownload, IconEye,
  IconAlertTriangle
} from '@tabler/icons-react';

interface CertResult {
  id: number;
  eai_number: string;
  eai_name: string;
  url: string;
  environment: string;
  days_until_expiry: number;
  expiry_date: string;
  status: string;
  issuer: string;
  subject_alternate_names: string;
  checked_at: string;
}

export default function Results() {
  const [results, setResults] = useState<CertResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<CertResult | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Filters
  const [eaiFilter, setEaiFilter] = useState('');
  const [envFilter, setEnvFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [daysMax, setDaysMax] = useState<number | ''>(365);
  const [daysMin, setDaysMin] = useState<number | ''>(0);
  
  useEffect(() => {
    loadResults();
  }, []);
  
  const loadResults = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (eaiFilter) params.append('eai_name', eaiFilter);
      if (envFilter) params.append('environment', envFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (daysMax) params.append('days_max', daysMax.toString());
      if (daysMin) params.append('days_min', daysMin.toString());
      
      const res = await fetch(`/api/results/latest?${params}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Failed to load results:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleFilter = () => {
    loadResults();
  };
  
  const handleClearFilters = () => {
    setEaiFilter('');
    setEnvFilter('');
    setStatusFilter('');
    setDaysMax(365);
    setDaysMin(0);
    loadResults();
  };
  
  const getRowStyle = (record: CertResult) => {
    if (record.days_until_expiry <= 7) {
      return { backgroundColor: '#ffe0e0' }; // Light red
    }
    if (record.days_until_expiry <= 30) {
      return { backgroundColor: '#fff3e0' }; // Light orange
    }
    return {};
  };
  
  const columns = [
    {
      accessor: 'eai_name',
      title: 'EAI Name',
      sortable: true,
      render: (record: CertResult) => (
        <div>
          <Text fw={500}>{record.eai_name}</Text>
          <Text size="xs" c="dimmed">{record.eai_number}</Text>
        </div>
      )
    },
    {
      accessor: 'url',
      title: 'URL',
      render: (record: CertResult) => (
        <Text size="sm">{record.url}</Text>
      )
    },
    {
      accessor: 'environment',
      title: 'Environment',
      sortable: true,
      render: (record: CertResult) => (
        <Badge color={
          record.environment === 'prod' ? 'red' :
          record.environment === 'uat' ? 'orange' : 'blue'
        }>
          {record.environment.toUpperCase()}
        </Badge>
      )
    },
    {
      accessor: 'days_until_expiry',
      title: 'Days Until Expiry',
      sortable: true,
      render: (record: CertResult) => (
        <Group gap="xs">
          {record.days_until_expiry <= 30 && (
            <IconAlertTriangle 
              size={16} 
              color={record.days_until_expiry <= 7 ? 'red' : 'orange'}
            />
          )}
          <Text 
            fw={600}
            c={
              record.days_until_expiry < 0 ? 'red' :
              record.days_until_expiry <= 7 ? 'red' :
              record.days_until_expiry <= 30 ? 'orange' : 'green'
            }
          >
            {record.days_until_expiry}
          </Text>
        </Group>
      )
    },
    {
      accessor: 'expiry_date',
      title: 'Expiry Date',
      sortable: true,
      render: (record: CertResult) => (
        <Text size="sm">
          {new Date(record.expiry_date).toLocaleDateString()}
        </Text>
      )
    },
    {
      accessor: 'status',
      title: 'Status',
      sortable: true,
      render: (record: CertResult) => (
        <Badge color={
          record.status === 'expired' ? 'red' :
          record.status === 'expiring_soon' ? 'orange' :
          record.status === 'error' ? 'gray' : 'green'
        }>
          {record.status.replace('_', ' ').toUpperCase()}
        </Badge>
      )
    },
    {
      accessor: 'checked_at',
      title: 'Last Checked',
      sortable: true,
      render: (record: CertResult) => (
        <Text size="sm" c="dimmed">
          {new Date(record.checked_at).toLocaleString()}
        </Text>
      )
    },
    {
      accessor: 'actions',
      title: '',
      render: (record: CertResult) => (
        <ActionIcon 
          onClick={() => {
            setSelectedResult(record);
            setDetailsOpen(true);
          }}
        >
          <IconEye size={16} />
        </ActionIcon>
      )
    }
  ];
  
  return (
    <Container size="xl">
      <h1>Certificate Check Results</h1>
      
      <Card withBorder mb="lg">
        <Text fw={600} mb="md">Filters</Text>
        <Group grow mb="md">
          <TextInput
            placeholder="Search EAI Name..."
            leftSection={<IconSearch size={16} />}
            value={eaiFilter}
            onChange={(e) => setEaiFilter(e.target.value)}
          />
          
          <Select
            placeholder="Environment"
            data={[
              { value: '', label: 'All' },
              { value: 'dev', label: 'Development' },
              { value: 'qa', label: 'QA' },
              { value: 'uat', label: 'UAT' },
              { value: 'prod', label: 'Production' }
            ]}
            value={envFilter}
            onChange={(value) => setEnvFilter(value || '')}
            clearable
          />
          
          <Select
            placeholder="Status"
            data={[
              { value: '', label: 'All' },
              { value: 'valid', label: 'Valid' },
              { value: 'expiring_soon', label: 'Expiring Soon' },
              { value: 'expired', label: 'Expired' },
              { value: 'error', label: 'Error' }
            ]}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || '')}
            clearable
          />
        </Group>
        
        <Group grow mb="md">
          <NumberInput
            label="Min Days Until Expiry"
            placeholder="0"
            value={daysMin}
            onChange={setDaysMin}
            min={0}
          />
          <NumberInput
            label="Max Days Until Expiry"
            placeholder="365"
            value={daysMax}
            onChange={setDaysMax}
            min={0}
          />
        </Group>
        
        <Group>
          <Button 
            leftSection={<IconFilter />}
            onClick={handleFilter}
          >
            Apply Filters
          </Button>
          <Button 
            variant="light"
            onClick={handleClearFilters}
          >
            Clear Filters
          </Button>
          <Button 
            variant="light"
            leftSection={<IconDownload />}
            ml="auto"
          >
            Export to Excel
          </Button>
        </Group>
      </Card>
      
      <DataTable
        columns={columns}
        records={results}
        fetching={loading}
        striped
        highlightOnHover
        rowStyle={getRowStyle}
        minHeight={200}
        noRecordsText="No certificates found"
      />
      
      {/* Certificate Details Modal */}
      <Modal
        opened={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Certificate Details"
        size="lg"
      >
        {selectedResult && (
          <Stack gap="md">
            <div>
              <Text size="sm" c="dimmed">EAI Information</Text>
              <Text fw={500}>{selectedResult.eai_name}</Text>
              <Text size="sm">{selectedResult.eai_number}</Text>
            </div>
            
            <div>
              <Text size="sm" c="dimmed">URL</Text>
              <Text>{selectedResult.url}</Text>
            </div>
            
            <div>
              <Text size="sm" c="dimmed">Issuer</Text>
              <Text>{selectedResult.issuer}</Text>
            </div>
            
            <div>
              <Text size="sm" c="dimmed">Expiry</Text>
              <Text fw={500} c={
                selectedResult.days_until_expiry <= 7 ? 'red' :
                selectedResult.days_until_expiry <= 30 ? 'orange' : 'green'
              }>
                {new Date(selectedResult.expiry_date).toLocaleDateString()}
                {' '}({selectedResult.days_until_expiry} days remaining)
              </Text>
            </div>
            
            <div>
              <Text size="sm" c="dimmed">Subject Alternate Names</Text>
              <Stack gap="xs">
                {JSON.parse(selectedResult.subject_alternate_names || '[]').map((san: string, idx: number) => (
                  <Badge key={idx} variant="light">{san}</Badge>
                ))}
              </Stack>
            </div>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
```
**Component features:**
- Form fields: EAI Number, EAI Name, URL, Environment dropdown
- Notification type: Email, Teams, Both
- Email recipients (if email selected)
- Teams webhook URL (if teams selected)
- Alert threshold days slider (default 50)
- Test webhook button
- Enable/Disable switch

```typescript
function CertificateFormModal({ opened, onClose, certificate }) {
  const form = useForm({
    initialValues: {
      eai_number: certificate?.eai_number || '',
      eai_name: certificate?.eai_name || '',
      url: certificate?.url || 'https://',
      environment: certificate?.environment || 'prod',
      notification_type: certificate?.notification_type || 'email',
      email_recipients: certificate?.email_recipients || '',
      teams_webhook_url: certificate?.teams_webhook_url || '',
      alert_threshold_days: certificate?.alert_threshold_days || 50,
      enabled: certificate?.enabled !== undefined ? certificate.enabled : true
    },
    validate: {
      url: (value) => (value.startsWith('https://') ? null : 'URL must start with https://'),
      email_recipients: (value, values) => 
        (values.notification_type !== 'teams' && !value ? 'Email required' : null),
      teams_webhook_url: (value, values) =>
        (values.notification_type !== 'email' && !value ? 'Webhook URL required' : null)
    }
  });
  
  const handleTestWebhook = async () => {
    // POST /api/certificates/test-webhook
    // Send test message to Teams webhook
  };
  
  return (
    <Modal opened={opened} onClose={onClose} title="Certificate Configuration">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <TextInput 
          label="EAI Number" 
          required 
          {...form.getInputProps('eai_number')} 
        />
        <TextInput 
          label="EAI Name" 
          required 
          {...form.getInputProps('eai_name')} 
        />
        <TextInput 
          label="URL" 
          required 
          {...form.getInputProps('url')} 
        />
        <Select
          label="Environment"
          data={[
            { value: 'dev', label: 'Development' },
            { value: 'qa', label: 'QA' },
            { value: 'uat', label: 'UAT' },
            { value: 'prod', label: 'Production' }
          ]}
          {...form.getInputProps('environment')}
        />
        <Select
          label="Notification Type"
          data={[
            { value: 'email', label: 'Email Only' },
            { value: 'teams', label: 'Teams Only' },
            { value: 'both', label: 'Email & Teams' }
          ]}
          {...form.getInputProps('notification_type')}
        />
        
        {(form.values.notification_type === 'email' || 
          form.values.notification_type === 'both') && (
          <Textarea
            label="Email Recipients"
            description="Comma-separated email addresses"
            {...form.getInputProps('email_recipients')}
          />
        )}
        
        {(form.values.notification_type === 'teams' || 
          form.values.notification_type === 'both') && (
          <Group>
            <TextInput
              label="Teams Webhook URL"
              style={{ flex: 1 }}
              {...form.getInputProps('teams_webhook_url')}
            />
            <Button 
              variant="light" 
              leftSection={<IconTestPipe />}
              onClick={handleTestWebhook}
              mt={25}
            >
              Test
            </Button>
          </Group>
        )}
        
        <Switch
          label="Enable Monitoring"
          {...form.getInputProps('enabled', { type: 'checkbox' })}
        />
        
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </Group>
      </form>
    </Modal>
  );
}
```

#### Task 4.7: Main App Routing
**File: `src/App.tsx`**
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import AppLayout from '@/components/AppLayout';
import SimpleLogin from '@/components/SimpleLogin';
import { AuthWrapper } from '@/components/AuthWrapper';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Pages
import Dashboard from '@/pages/Dashboard';
import RunNow from '@/pages/RunNow';
import Results from '@/pages/Results';
import CertificateManagement from '@/pages/CertificateManagement';
import UserManagement from '@/pages/UserManagement';
import SystemSettings from '@/pages/SystemSettings';

export default function App() {
  return (
    <ThemeProvider>
      <MantineProvider>
        <Notifications />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<SimpleLogin />} />
            
            <Route path="/" element={
              <AuthWrapper>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/run-now" element={<RunNow />} />
                    <Route path="/results" element={<Results />} />
                    <Route path="/certificates" element={<CertificateManagement />} />
                    <Route path="/users" element={<UserManagement />} />
                    <Route path="/settings" element={<SystemSettings />} />
                  </Routes>
                </AppLayout>
              </AuthWrapper>
            } />
          </Routes>
        </BrowserRouter>
      </MantineProvider>
    </ThemeProvider>
  );
}
```

#### Task 4.8: AppLayout with Navigation
**File: `src/components/AppLayout.tsx`**
```typescript
// Navigation sidebar with menu items:
// - Dashboard (home icon)
// - Run Now (refresh icon)
// - Results (list icon)
// - Certificate Management (settings icon)
// - Users (admin only)
// - System Settings (admin only)

import { AppShell, NavLink } from '@mantine/core';
import { 
  IconHome, IconRefresh, IconList, IconCertificate,
  IconUsers, IconSettings
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSimpleAuth } from './SimpleLogin';
import { UserMenu } from './AuthWrapper';

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSimpleAuth();
  
  const menuItems = [
    { path: '/', label: 'Dashboard', icon: IconHome },
    { path: '/run-now', label: 'Run Now', icon: IconRefresh },
    { path: '/results', label: 'Results', icon: IconList },
    { path: '/certificates', label: 'Certificates', icon: IconCertificate },
  ];
  
  if (user?.role === 'admin') {
    menuItems.push(
      { path: '/users', label: 'Users', icon: IconUsers },
      { path: '/settings', label: 'Settings', icon: IconSettings }
    );
  }
  
  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text size="xl" fw={700}>Cert Monitor</Text>
          <UserMenu />
        </Group>
      </AppShell.Header>
      
      <AppShell.Navbar p="md">
        {menuItems.map(item => (
          <NavLink
            key={item.path}
            label={item.label}
            leftSection={<item.icon size={20} />}
            active={location.pathname === item.path}
            onClick={() => navigate(item.path)}
          />
        ))}
      </AppShell.Navbar>
      
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
```

---

### Phase 5: Additional Features (Day 7-8)

#### Task 5.1: Dashboard Page Enhancements
```typescript
// Display:
// 1. Summary cards: Total certs, Expiring soon, Expired, Errors
// 2. DataTable with all recent check results
// 3. Filters: Environment, Status, Date range
// 4. Color-coded status badges
// 5. Export to Excel button

export default function Dashboard() {
  return (
    <Container size="xl">
      <SimpleGrid cols={4} mb="lg">
        <StatsCard 
          title="Total Certificates" 
          value={stats.total} 
          icon={<IconCertificate />} 
        />
        <StatsCard 
          title="Expiring Soon" 
          value={stats.expiring} 
          color="orange"
          icon={<IconAlertTriangle />} 
        />
        <StatsCard 
          title="Expired" 
          value={stats.expired} 
          color="red"
          icon={<IconX />} 
        />
        <StatsCard 
          title="Errors" 
          value={stats.errors} 
          color="red"
          icon={<IconAlertCircle />} 
        />
      </SimpleGrid>
      
      <DataTable
        columns={[
          { accessor: 'eai_name', title: 'EAI Name' },
          { accessor: 'url', title: 'URL' },
          { accessor: 'environment', title: 'Environment' },
          { 
            accessor: 'days_until_expiry', 
            title: 'Days Until Expiry',
            render: (row) => (
              <Text color={
                row.days_until_expiry < 7 ? 'red' :
                row.days_until_expiry < 30 ? 'orange' : 'green'
              }>
                {row.days_until_expiry}
              </Text>
            )
          },
          { accessor: 'expiry_date', title: 'Expiry Date' },
          { accessor: 'issuer', title: 'Issuer' },
          {
            accessor: 'status',
            title: 'Status',
            render: (row) => (
              <Badge color={getStatusColor(row.status)}>
                {row.status}
              </Badge>
            )
          }
        ]}
        records={results}
      />
    </Container>
  );
}
```

#### Task 4.6: Excel Import Component
**File: `src/components/ExcelImport.tsx`**
```typescript
// Copy pattern from ExcelImportModal.tsx
// Template columns:
// - eai_number
// - eai_name  
// - url
// - environment
// - notification_type
// - email_recipients
// - teams_webhook_url
// - alert_threshold_days
// - enabled

function downloadTemplate() {
  const configSheet = [
    [
      "eai_number", "eai_name", "url", "environment", 
      "notification_type", "email_recipients", "teams_webhook_url",
      "alert_threshold_days", "enabled"
    ],
    [
      "EAI-001", "Production API", "https://api.example.com",
      "prod", "both", "admin@example.com", 
      "https://outlook.office.com/webhook/...", "50", "TRUE"
    ],
    [
      "EAI-002", "UAT Service", "https://uat.example.com",
      "uat", "email", "team@example.com", "", "30", "TRUE"
    ]
  ];
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(configSheet), "Certificates");
  XLSX.writeFile(wb, "certificate-import-template.xlsx");
}
```

---

### Phase 5: Additional Features (Day 7-8)

#### Task 5.2: User Management Page
- Copy `SimpleUserManagement.tsx` from existing project
- Admin can add/remove users
- Password change functionality

#### Task 5.3: System Settings Page
```typescript
// Settings to configure:
// - SMTP settings (host, port, from address)
// - Check interval (hours)
// - Alert threshold (days)
// - Alert days (Monday/Friday toggles)
// - Data retention period (days)
```

#### Task 5.4: Excel Import Component
**File: `src/components/ExcelImport.tsx`**
```typescript
// Copy pattern from ExcelImportModal.tsx
// Template columns with per-certificate settings:
// - eai_number
// - eai_name  
// - url
// - environment
// - email_recipients (comma-separated)
// - teams_webhook_url
// - alert_threshold_days
// - check_frequency_hours
// - enabled

function downloadTemplate() {
  const configSheet = [
    [
      "eai_number", "eai_name", "url", "environment", 
      "email_recipients", "teams_webhook_url",
      "alert_threshold_days", "check_frequency_hours", "enabled"
    ],
    [
      "EAI-001", "Production API", "https://api.example.com",
      "prod", "team1@example.com,admin@example.com", 
      "https://outlook.office.com/webhook/...", "50", "4", "TRUE"
    ],
    [
      "EAI-002", "UAT Service", "https://uat.example.com",
      "uat", "team2@example.com", "", "30", "6", "TRUE"
    ],
    [
      "EAI-003", "Dev API", "https://dev.example.com",
      "dev", "", "https://outlook.office.com/webhook/...", "60", "12", "FALSE"
    ]
  ];
  
  const descSheet = [
    ["Field", "Required", "Description", "Example"],
    ["eai_number", "YES", "Unique EAI identifier", "EAI-001"],
    ["eai_name", "YES", "Application/service name", "Production API"],
    ["url", "YES", "HTTPS URL to check certificate", "https://api.example.com"],
    ["environment", "YES", "Environment: dev, qa, uat, prod", "prod"],
    ["email_recipients", "Optional", "Comma-separated emails for alerts", "team@example.com,admin@example.com"],
    ["teams_webhook_url", "Optional", "Microsoft Teams webhook URL", "https://outlook.office.com/webhook/..."],
    ["alert_threshold_days", "Optional", "Alert if expiring within N days (default: 50)", "50"],
    ["check_frequency_hours", "Optional", "Check every N hours: 1,2,4,6,12,24 (default: 4)", "4"],
    ["enabled", "Optional", "TRUE or FALSE (default: TRUE)", "TRUE"]
  ];
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(configSheet), "Certificates");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(descSheet), "Field_Descriptions");
  XLSX.writeFile(wb, "certificate-import-template.xlsx");
}
```
```javascript
// Use MessageCard format for Teams:
{
  "@type": "MessageCard",
  "@context": "https://schema.org/extensions",
  "themeColor": "FFA500",
  "title": "Certificate Expiry Alert",
  "sections": [...]
}
```

### 4. Teams Webhook Format
```javascript
// Use MessageCard format for Teams:
async function sendTeamsAlert(webhookUrl, message) {
  const card = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    "summary": message.summary,
    "themeColor": message.details.daysRemaining < 7 ? "FF0000" : "FFA500",
    "title": message.title,
    "sections": [{
      "activityTitle": "Certificate Details",
      "facts": [
        { "name": "EAI Number:", "value": message.details.eaiNumber },
        { "name": "EAI Name:", "value": message.details.eaiName },
        { "name": "URL:", "value": message.details.url },
        { "name": "Environment:", "value": message.details.environment },
        { "name": "Expiry Date:", "value": message.details.expiryDate },
        { "name": "Days Remaining:", "value": message.details.daysRemaining.toString() },
        { "name": "Issuer:", "value": message.details.issuer }
      ],
      "text": "⚠️ Certificate expiring soon - please renew!"
    }],
    "potentialAction": [{
      "@type": "OpenUri",
      "name": "View Certificate",
      "targets": [{
        "os": "default",
        "uri": message.details.url
      }]
    }]
  };
  
  await axios.post(webhookUrl, card);
}
```

### 5. Real-time SSE Streaming
```javascript
// Server-Sent Events for real-time certificate checking
// Frontend uses EventSource to receive live updates

// SSE Response Format:
data: {"config_id": 1, "eai_name": "API", "status": "valid", ...}\n\n
data: {"config_id": 2, "eai_name": "Service", "status": "expiring_soon", ...}\n\n
event: done\ndata: {}\n\n

// Frontend EventSource pattern:
const eventSource = new EventSource('/api/stream/certificates/check-all');

eventSource.onmessage = (event) => {
  const result = JSON.parse(event.data);
  setResults(prev => [...prev, result]);
  setProgress(prev => prev + (100 / totalToCheck));
};

eventSource.addEventListener('done', () => {
  eventSource.close();
  setChecking(false);
});

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};
```
```typescript
// Row styling based on expiry proximity
const getRowStyle = (record: CertResult) => {
  if (record.days_until_expiry < 0) {
    return { backgroundColor: '#ffcccc' }; // Expired - dark red
  }
  if (record.days_until_expiry <= 7) {
    return { backgroundColor: '#ffe0e0' }; // Critical - light red
  }
  if (record.days_until_expiry <= 30) {
    return { backgroundColor: '#fff3e0' }; // Warning - light orange
  }
  return {}; // Valid - no highlight
};
```

---

## Deployment Checklist

- [ ] Initialize database with `init-db.js`
- [ ] Create default admin user (admin/admin123)
- [ ] Configure system settings (SMTP, check interval, alert threshold)
- [ ] Test certificate checking on sample URLs (google.com, github.com)
- [ ] Test Teams webhook integration with test button
- [ ] Test email notifications (if enabled)
- [ ] Verify scheduler runs every 4 hours
- [ ] Verify data retention cleanup runs daily
- [ ] Test Excel import with template
- [ ] Test Run Now page functionality
- [ ] Test Results page filtering by EAI and environment
- [ ] Verify certificate highlighting in results
- [ ] Test Monday/Friday alert logic
- [ ] Test once-per-day alert throttling
- [ ] Set up monitoring/logging
- [ ] Document API endpoints
- [ ] Create user guide with screenshots

---

## Project File Structure

```
cert-expiry-monitor/
├── package.json
├── .env
├── .gitignore
├── server.js                 # Main Express server
├── db.js                     # SQLite database wrapper
├── init-db.js               # Database initialization
├── schema-sqlite.sql        # Database schema
├── auth.js                  # Cookie authentication middleware
├── logger.js                # Logging utility
├── cert-checker.js          # Certificate checking logic
├── notifications.js         # Email & Teams alerts
├── scheduler.js             # Cron scheduler (every 4 hours)
├── data-retention.js        # Cleanup old results
├── data/
│   └── certificates.db      # SQLite database file
├── public/                  # Built frontend files
└── cert-ui/                 # React frontend
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── components/
        │   ├── SimpleLogin.tsx
        │   ├── AuthWrapper.tsx
        │   ├── AppLayout.tsx
        │   ├── ThemeToggle.tsx
        │   └── ExcelImport.tsx
        ├── pages/
        │   ├── Dashboard.tsx          # Overview with stats
        │   ├── RunNow.tsx             # Manual certificate check
        │   ├── Results.tsx            # Filtered results view
        │   ├── CertificateManagement.tsx  # CRUD for certs
        │   ├── UserManagement.tsx
        │   └── SystemSettings.tsx
        └── contexts/
            └── ThemeContext.tsx
```

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout and clear cookie
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/change-password` - Change user password

### Certificates
- `GET /api/certificates` - List all certificate configs
- `POST /api/certificates` - Create new certificate config
- `PUT /api/certificates/:id` - Update certificate config
- `DELETE /api/certificates/:id` - Delete certificate config
- `POST /api/certificates/:id/check` - Manually check single certificate (non-streaming)
- `GET /api/stream/certificates/check-all` - **SSE: Stream check all or selected certificates**
- `GET /api/stream/certificates/check/:id` - **SSE: Stream check single certificate**
- `POST /api/certificates/test-webhook` - Test Teams webhook

### Results
- `GET /api/results` - Get results with filters (eai_name, environment, status, days_max, days_min)
- `GET /api/results/latest` - Get latest result per certificate
- `GET /api/results/:config_id` - Get all results for specific certificate
- `GET /api/dashboard-stats` - Get summary statistics

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `DELETE /api/users/:id` - Delete user

### System Settings (Admin only)
- `GET /api/settings` - Get all system settings
- `PUT /api/settings` - Update system settings

---

## Future Enhancements

1. **Certificate Details Timeline** - View historical checks for each certificate
2. **Advanced Charts** - Expiry timeline chart, breakdown by environment
3. **Slack Integration** - Add Slack webhook option
4. **Certificate Upload** - Upload .pem/.crt files for analysis
5. **Custom Alert Templates** - Customize email/Teams message format
6. **API Key Authentication** - Alternative to cookie auth for automation
7. **Certificate Renewal Tracking** - Track when certs were renewed
8. **Compliance Reports** - Generate audit-ready reports
9. **Mobile App** - React Native mobile app
10. **Multi-tenant Support** - Separate certificates by organization

---

## Estimated Timeline

- **Phase 1-2** (Backend Setup & APIs): 3 days
- **Phase 3** (Scheduler & Notifications): 1 day  
- **Phase 4** (Frontend Pages): 3 days
- **Phase 5** (Additional Features): 1 day
- **Phase 6** (Testing & Deployment): 1 day
- **Total**: ~9 days

## Success Metrics

- ✅ Successfully check 100+ certificates
- ✅ Zero false alerts
- ✅ 100% alert delivery rate (email & Teams)
- ✅ < 2 second response time for dashboard
- ✅ SQLite database with efficient queries
- ✅ **Per-certificate configuration** - Each team controls their own alerts and check frequency
- ✅ **Real-time SSE streaming** for Run Now page with live progress
- ✅ **Flexible scheduling** - 1h to 24h check intervals per certificate
- ✅ Run Now page with instant feedback as each cert is checked
- ✅ Results page with EAI filtering and highlighting
- ✅ Clean, maintainable code following existing patterns
- ✅ Excel import/export functionality with team-specific settings
- ✅ 30-day data retention with configurable cleanup
- ✅ Monday/Friday only alerts with once-per-day throttling per certificate
