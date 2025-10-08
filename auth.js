const bcrypt = require('bcryptjs');
const { query } = require('./db');

// Middleware to require authentication
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Middleware to require admin role
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Verify username and password
async function verifyCredentials(username, password) {
  const result = await query('SELECT * FROM users WHERE username = ?', [username]);

  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];
  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email
  };
}

// Hash password
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

module.exports = {
  requireAuth,
  requireAdmin,
  verifyCredentials,
  hashPassword
};
