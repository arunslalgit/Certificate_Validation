require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { query } = require('./db');
const { requireAuth, requireAdmin, verifyCredentials, hashPassword } = require('./auth');
const { checkCertificate } = require('./cert-checker');
const { testWebhook } = require('./notifications');
const { startScheduler } = require('./scheduler');
const { startRetentionScheduler } = require('./data-retention');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Session store (in-memory for simplicity)
const sessions = new Map();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Session middleware
app.use((req, res, next) => {
  const sessionId = req.cookies.sessionId;
  if (sessionId && sessions.has(sessionId)) {
    req.session = sessions.get(sessionId);
  }
  next();
});

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await verifyCredentials(username, password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessions.set(sessionId, {
      userId: user.id,
      username: user.username,
      role: user.role
    });

    // Set cookie
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    });

    logger.info('User logged in', { username: user.username });
    res.json({ user });

  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.cookies.sessionId;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.clearCookie('sessionId');
  res.json({ message: 'Logged out' });
});

// Get current user
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, username, role, email FROM users WHERE id = ?',
      [req.session.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: rows[0] });
  } catch (error) {
    logger.error('Get user error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    // Get current user
    const { rows } = await query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    const user = rows[0];

    // Verify current password
    const bcrypt = require('bcryptjs');
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and update new password
    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

    logger.info('Password changed', { username: user.username });
    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    logger.error('Change password error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// USER MANAGEMENT ENDPOINTS
// ============================================================================

// List users (admin only)
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const { rows } = await query('SELECT id, username, role, email, created_at FROM users');
    res.json({ users: rows });
  } catch (error) {
    logger.error('List users error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user (admin only)
app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, role, email } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password, and role required' });
    }

    if (!['admin', 'user', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const passwordHash = await hashPassword(password);

    await query(
      'INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)',
      [username, passwordHash, role, email]
    );

    logger.info('User created', { username, role });
    res.json({ message: 'User created successfully' });

  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    logger.error('Create user error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id) === req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await query('DELETE FROM users WHERE id = ?', [id]);
    logger.info('User deleted', { userId: id });
    res.json({ message: 'User deleted successfully' });

  } catch (error) {
    logger.error('Delete user error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// CERTIFICATE CONFIG ENDPOINTS
// ============================================================================

// List all certificate configs
app.get('/api/certificates', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT * FROM certificate_configs
      ORDER BY eai_name ASC
    `);
    res.json({ certificates: rows });
  } catch (error) {
    logger.error('List certificates error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single certificate config
app.get('/api/certificates/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query('SELECT * FROM certificate_configs WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    res.json({ certificate: rows[0] });
  } catch (error) {
    logger.error('Get certificate error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create certificate config
app.post('/api/certificates', requireAuth, async (req, res) => {
  try {
    const {
      eai_number,
      eai_name,
      url,
      environment,
      alert_threshold_days,
      email_recipients,
      teams_webhook_url,
      check_frequency_hours,
      enabled
    } = req.body;

    if (!eai_number || !eai_name || !url || !environment) {
      return res.status(400).json({ error: 'EAI number, name, URL, and environment required' });
    }

    const result = await query(`
      INSERT INTO certificate_configs
      (eai_number, eai_name, url, environment, alert_threshold_days,
       email_recipients, teams_webhook_url, check_frequency_hours, enabled, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      eai_number,
      eai_name,
      url,
      environment,
      alert_threshold_days || 50,
      email_recipients || null,
      teams_webhook_url || null,
      check_frequency_hours || 4,
      enabled !== undefined ? enabled : 1,
      req.session.username
    ]);

    logger.info('Certificate config created', { id: result.lastID, eai_name, url });
    res.json({ message: 'Certificate created successfully', id: result.lastID });

  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'URL already exists' });
    }
    logger.error('Create certificate error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update certificate config
app.put('/api/certificates/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      eai_number,
      eai_name,
      url,
      environment,
      alert_threshold_days,
      email_recipients,
      teams_webhook_url,
      check_frequency_hours,
      enabled
    } = req.body;

    await query(`
      UPDATE certificate_configs
      SET eai_number = ?, eai_name = ?, url = ?, environment = ?,
          alert_threshold_days = ?, email_recipients = ?, teams_webhook_url = ?,
          check_frequency_hours = ?, enabled = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `, [
      eai_number,
      eai_name,
      url,
      environment,
      alert_threshold_days,
      email_recipients,
      teams_webhook_url,
      check_frequency_hours,
      enabled,
      id
    ]);

    logger.info('Certificate config updated', { id, eai_name });
    res.json({ message: 'Certificate updated successfully' });

  } catch (error) {
    logger.error('Update certificate error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete certificate config
app.delete('/api/certificates/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM certificate_configs WHERE id = ?', [id]);
    logger.info('Certificate config deleted', { id });
    res.json({ message: 'Certificate deleted successfully' });
  } catch (error) {
    logger.error('Delete certificate error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test Teams webhook
app.post('/api/certificates/test-webhook', requireAuth, async (req, res) => {
  try {
    const { webhook_url } = req.body;

    if (!webhook_url) {
      return res.status(400).json({ error: 'Webhook URL required' });
    }

    const result = await testWebhook(webhook_url);
    res.json(result);

  } catch (error) {
    logger.error('Test webhook error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// CERTIFICATE CHECK ENDPOINTS (SSE)
// ============================================================================

// Stream check all certificates
app.get('/api/stream/certificates/check-all', requireAuth, async (req, res) => {
  const { configIds } = req.query;

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    let sql = 'SELECT * FROM certificate_configs WHERE enabled = 1';
    let params = [];

    if (configIds) {
      const ids = configIds.split(',').map(id => parseInt(id));
      sql += ` AND id IN (${ids.map(() => '?').join(',')})`;
      params = ids;
    }

    const { rows: configs } = await query(sql, params);

    for (const config of configs) {
      try {
        const result = await checkCertificate(config.url);

        // Save to database
        await query(`
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

        // Update last_checked
        await query(
          'UPDATE certificate_configs SET last_checked = ? WHERE id = ?',
          [new Date().toISOString(), config.id]
        );

        // Stream result
        const streamData = {
          config_id: config.id,
          eai_number: config.eai_number,
          eai_name: config.eai_name,
          url: config.url,
          environment: config.environment,
          ...result
        };

        res.write(`data: ${JSON.stringify(streamData)}\n\n`);

      } catch (error) {
        const errorData = {
          config_id: config.id,
          eai_name: config.eai_name,
          url: config.url,
          status: 'error',
          error: error.message
        };

        res.write(`data: ${JSON.stringify(errorData)}\n\n`);

        await query(`
          INSERT INTO certificate_results
          (config_id, hostname, certificate_valid, status, error_message)
          VALUES (?, ?, ?, ?, ?)
        `, [config.id, config.url, 0, 'error', error.message]);
      }
    }

    res.write('event: done\ndata: {}\n\n');
    res.end();

  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Stream check single certificate
app.get('/api/stream/certificates/check/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { rows } = await query('SELECT * FROM certificate_configs WHERE id = ?', [id]);

    if (rows.length === 0) {
      res.write(`data: ${JSON.stringify({ error: 'Certificate not found' })}\n\n`);
      res.end();
      return;
    }

    const config = rows[0];
    const result = await checkCertificate(config.url);

    // Save to database
    await query(`
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
      ...result
    };

    res.write(`data: ${JSON.stringify(streamData)}\n\n`);
    res.write('event: done\ndata: {}\n\n');
    res.end();

  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// ============================================================================
// RESULTS ENDPOINTS
// ============================================================================

// Get results with filters
app.get('/api/results', requireAuth, async (req, res) => {
  try {
    const { eai_name, environment, status, days_max, days_min, limit = 100 } = req.query;

    let sql = `
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
      sql += ' AND cc.eai_name LIKE ?';
      params.push(`%${eai_name}%`);
    }

    if (environment) {
      sql += ' AND cc.environment = ?';
      params.push(environment);
    }

    if (status) {
      sql += ' AND cr.status = ?';
      params.push(status);
    }

    if (days_max) {
      sql += ' AND cr.days_until_expiry <= ?';
      params.push(parseInt(days_max));
    }

    if (days_min) {
      sql += ' AND cr.days_until_expiry >= ?';
      params.push(parseInt(days_min));
    }

    sql += ' ORDER BY cr.checked_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const { rows } = await query(sql, params);
    res.json({ results: rows });

  } catch (error) {
    logger.error('Get results error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get latest result per certificate
app.get('/api/results/latest', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(`
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
    `);

    res.json({ results: rows });

  } catch (error) {
    logger.error('Get latest results error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard stats
app.get('/api/dashboard-stats', requireAuth, async (req, res) => {
  try {
    const stats = {
      total: 0,
      valid: 0,
      expiring_soon: 0,
      expired: 0,
      error: 0
    };

    const { rows } = await query(`
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

  } catch (error) {
    logger.error('Get dashboard stats error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// SYSTEM SETTINGS ENDPOINTS
// ============================================================================

// Get system settings
app.get('/api/settings', requireAdmin, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM system_settings ORDER BY key');
    res.json({ settings: rows });
  } catch (error) {
    logger.error('Get settings error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update system setting
app.put('/api/settings/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    await query(
      `UPDATE system_settings SET value = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key = ?`,
      [value, key]
    );

    logger.info('Setting updated', { key, value });
    res.json({ message: 'Setting updated successfully' });

  } catch (error) {
    logger.error('Update setting error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  logger.info(`Certificate Expiry Monitor server started on port ${PORT}`);
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);

  // Start schedulers
  startScheduler();
  startRetentionScheduler();

  console.log('\n✅ Ready to monitor certificates!\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Server shutting down...');
  process.exit(0);
});
