const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const express = require('express');
const session = require('express-session');
const { query } = require('./db');

const router = express.Router();

function createSessionMiddleware() {
  const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

  return [
    cookieParser(),
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
      }
    })
  ];
}

async function findUserByUsername(username) {
  const { rows } = await query('SELECT * FROM users WHERE username = ?', [username]);
  return rows[0];
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = await findUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email
  };

  res.json({ user: req.session.user });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.session.user });
});

router.post('/change-password', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }

  const user = await findUserByUsername(req.session.user.username);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Current password incorrect' });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hashed, user.id]);

  res.json({ success: true });
});

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authRouter: router, createSessionMiddleware, requireAuth, requireAdmin };
