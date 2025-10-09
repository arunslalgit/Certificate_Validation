require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { logger } = require('./logger');
const { query } = require('./db');
const { authRouter, createSessionMiddleware, requireAuth, requireAdmin } = require('./auth');
const { checkCertificate } = require('./cert-checker');
const { startScheduler } = require('./scheduler');
const { startRetentionJob } = require('./data-retention');
const { sendTeamsAlert } = require('./notifications');

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(logger);

const sessionMiddleware = createSessionMiddleware();
sessionMiddleware.forEach((mw) => app.use(mw));

app.use('/api/auth', authRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/certificates', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM certificate_configs ORDER BY eai_name');
  res.json({ certificates: rows });
});

app.post('/api/certificates', requireAuth, async (req, res) => {
  const {
    eai_number,
    eai_name,
    url,
    environment,
    email_recipients,
    teams_webhook_url,
    alert_threshold_days = 50,
    check_frequency_hours = 4,
    enabled = true
  } = req.body;

  const { lastID } = await query(
    `INSERT INTO certificate_configs
     (eai_number, eai_name, url, environment, email_recipients, teams_webhook_url,
      alert_threshold_days, check_frequency_hours, enabled, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      , [
        eai_number,
        eai_name,
        url,
        environment,
        email_recipients,
        teams_webhook_url,
        alert_threshold_days,
        check_frequency_hours,
        enabled ? 1 : 0,
        req.session.user.username
      ]
  );

  const { rows } = await query('SELECT * FROM certificate_configs WHERE id = ?', [lastID]);
  res.status(201).json(rows[0]);
});

app.put('/api/certificates/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const {
    eai_number,
    eai_name,
    url,
    environment,
    email_recipients,
    teams_webhook_url,
    alert_threshold_days,
    check_frequency_hours,
    enabled
  } = req.body;

  await query(
    `UPDATE certificate_configs
     SET eai_number = ?, eai_name = ?, url = ?, environment = ?,
         email_recipients = ?, teams_webhook_url = ?, alert_threshold_days = ?,
         check_frequency_hours = ?, enabled = ?, updated_at = ?
     WHERE id = ?`,
    [
      eai_number,
      eai_name,
      url,
      environment,
      email_recipients,
      teams_webhook_url,
      alert_threshold_days,
      check_frequency_hours,
      enabled ? 1 : 0,
      new Date().toISOString(),
      id
    ]
  );

  const { rows } = await query('SELECT * FROM certificate_configs WHERE id = ?', [id]);
  res.json(rows[0]);
});

app.delete('/api/certificates/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  await query('DELETE FROM certificate_configs WHERE id = ?', [id]);
  res.json({ success: true });
});

app.post('/api/certificates/:id/check', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { rows } = await query('SELECT * FROM certificate_configs WHERE id = ?', [id]);
  const config = rows[0];
  if (!config) {
    return res.status(404).json({ error: 'Certificate configuration not found' });
  }

  try {
    const result = await checkCertificate(config.url);
    await query(
      `INSERT INTO certificate_results
       (config_id, hostname, certificate_valid, expiry_date, days_until_expiry,
        issuer, subject_alternate_names, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      , [
        config.id,
        result.hostname,
        result.valid ? 1 : 0,
        result.validTo,
        result.daysUntilExpiry,
        result.issuer,
        JSON.stringify(result.sans || []),
        result.status
      ]
    );

    await query('UPDATE certificate_configs SET last_checked = ? WHERE id = ?', [
      new Date().toISOString(),
      config.id
    ]);

    res.json(result);
  } catch (error) {
    await query(
      `INSERT INTO certificate_results
       (config_id, hostname, certificate_valid, status, error_message)
       VALUES (?, ?, 0, 'error', ?)`
      , [config.id, config.url, error.message]
    );
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stream/certificates/check-all', requireAuth, async (req, res) => {
  const idsParam = req.query.configIds;
  let configsQuery = 'SELECT * FROM certificate_configs WHERE enabled = 1';
  const params = [];

  if (idsParam) {
    const ids = idsParam.split(',').map((id) => parseInt(id, 10)).filter(Boolean);
    if (ids.length) {
      configsQuery += ` AND id IN (${ids.map(() => '?').join(',')})`;
      params.push(...ids);
    }
  }

  const { rows: configs } = await query(configsQuery, params);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  for (const config of configs) {
    try {
      const result = await checkCertificate(config.url);
      await query(
        `INSERT INTO certificate_results
         (config_id, hostname, certificate_valid, expiry_date, days_until_expiry,
          issuer, subject_alternate_names, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        , [
          config.id,
          result.hostname,
          result.valid ? 1 : 0,
          result.validTo,
          result.daysUntilExpiry,
          result.issuer,
          JSON.stringify(result.sans || []),
          result.status
        ]
      );

      await query('UPDATE certificate_configs SET last_checked = ? WHERE id = ?', [
        new Date().toISOString(),
        config.id
      ]);

      const payload = {
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

      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (error) {
      await query(
        `INSERT INTO certificate_results
         (config_id, hostname, certificate_valid, status, error_message)
         VALUES (?, ?, 0, 'error', ?)`
        , [config.id, config.url, error.message]
      );

      res.write(`data: ${JSON.stringify({
        config_id: config.id,
        eai_name: config.eai_name,
        url: config.url,
        status: 'error',
        error: error.message
      })}\n\n`);
    }
  }

  res.write('event: done\ndata: {}\n\n');
  res.end();
});

app.get('/api/stream/certificates/check/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { rows } = await query('SELECT * FROM certificate_configs WHERE id = ?', [id]);
  const config = rows[0];
  if (!config) {
    res.status(404).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const result = await checkCertificate(config.url);
    await query(
      `INSERT INTO certificate_results
       (config_id, hostname, certificate_valid, expiry_date, days_until_expiry,
        issuer, subject_alternate_names, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      , [
        config.id,
        result.hostname,
        result.valid ? 1 : 0,
        result.validTo,
        result.daysUntilExpiry,
        result.issuer,
        JSON.stringify(result.sans || []),
        result.status
      ]
    );

    const payload = {
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

    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
  }

  res.write('event: done\ndata: {}\n\n');
  res.end();
});

app.post('/api/certificates/test-webhook', requireAuth, async (req, res) => {
  const { webhookUrl } = req.body;
  if (!webhookUrl) {
    return res.status(400).json({ error: 'Webhook URL required' });
  }

  try {
    await sendTeamsAlert(webhookUrl, {
      title: 'Test Certificate Alert',
      summary: 'This is a test webhook from Certificate Monitor',
      details: {
        eaiNumber: 'TEST-000',
        eaiName: 'Test Certificate',
        url: 'https://example.com',
        environment: 'test',
        expiryDate: new Date().toLocaleString(),
        daysRemaining: 42,
        issuer: 'Test Issuer',
        sans: ['test.example.com'],
        threshold: 50
      }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/results', requireAuth, async (req, res) => {
  const {
    eai_name,
    environment,
    status,
    days_max,
    days_min,
    limit = 100
  } = req.query;

  let sql = `
    SELECT cr.*, cc.eai_number, cc.eai_name, cc.url, cc.environment
    FROM certificate_results cr
    JOIN certificate_configs cc ON cr.config_id = cc.id
    WHERE 1 = 1`;
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
    params.push(Number(days_max));
  }

  if (days_min) {
    sql += ' AND cr.days_until_expiry >= ?';
    params.push(Number(days_min));
  }

  sql += ' ORDER BY cr.checked_at DESC LIMIT ?';
  params.push(Number(limit));

  const { rows } = await query(sql, params);
  res.json({ results: rows });
});

app.get('/api/results/latest', requireAuth, async (req, res) => {
  const {
    eai_name,
    environment,
    status,
    days_max,
    days_min,
    limit = 100
  } = req.query;

  let sql = `
    SELECT cr.*, cc.eai_number, cc.eai_name, cc.url, cc.environment, cc.alert_threshold_days
    FROM certificate_results cr
    JOIN certificate_configs cc ON cr.config_id = cc.id
    WHERE cr.id IN (SELECT MAX(id) FROM certificate_results GROUP BY config_id)
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
    params.push(Number(days_max));
  }
  if (days_min) {
    sql += ' AND cr.days_until_expiry >= ?';
    params.push(Number(days_min));
  }

  sql += ' ORDER BY cr.days_until_expiry ASC LIMIT ?';
  params.push(Number(limit));

  const { rows } = await query(sql, params);
  res.json({ results: rows });
});

app.get('/api/dashboard-stats', requireAuth, async (req, res) => {
  const stats = { total: 0, valid: 0, expiring_soon: 0, expired: 0, error: 0 };
  const { rows } = await query(`
    SELECT status, COUNT(*) as count
    FROM certificate_results
    WHERE id IN (SELECT MAX(id) FROM certificate_results GROUP BY config_id)
    GROUP BY status
  `);
  rows.forEach((row) => {
    stats.total += row.count;
    stats[row.status] = row.count;
  });
  res.json(stats);
});

app.get('/api/users', requireAdmin, async (req, res) => {
  const { rows } = await query('SELECT id, username, role, email, created_at FROM users ORDER BY username');
  res.json({ users: rows });
});

app.post('/api/users', requireAdmin, async (req, res) => {
  const { username, password, role = 'user', email } = req.body;
  const bcrypt = require('bcryptjs');
  const password_hash = await bcrypt.hash(password, 10);
  const { lastID } = await query(
    'INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)',
    [username, password_hash, role, email]
  );
  const { rows } = await query('SELECT id, username, role, email, created_at FROM users WHERE id = ?', [lastID]);
  res.status(201).json(rows[0]);
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  await query('DELETE FROM users WHERE id = ?', [id]);
  res.json({ success: true });
});

app.get('/api/settings', requireAdmin, async (req, res) => {
  const { rows } = await query('SELECT key, value, description FROM system_settings');
  res.json({ settings: rows });
});

app.put('/api/settings', requireAdmin, async (req, res) => {
  const settings = req.body || {};
  for (const [key, value] of Object.entries(settings)) {
    await query(
      'INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = ?',
      [key, value, new Date().toISOString()]
    );
  }
  res.json({ success: true });
});

startScheduler();
startRetentionJob();

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Certificate monitor server listening on port ${PORT}`);
  });
}

module.exports = { app };
