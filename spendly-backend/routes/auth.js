const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
    process.env.JWT_SECRET,
    { expiresIn: '7d', issuer: 'spendly-api', audience: 'spendly-client' }
  );
}

router.post('/register', authLimiter, async (req, res, next) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const avatar = req.body.avatar === 'male' ? 'male' : 'female';

  if (!name || name.length > 100 || !validEmail.test(email) || email.length > 254 ||
      password.length < 8 || Buffer.byteLength(password, 'utf8') > 72 ||
      (req.body.avatar !== undefined && !['female', 'male'].includes(req.body.avatar))) {
    return res.status(400).json({
      error: 'Provide a name, valid email, password of at least 8 characters (maximum 72 UTF-8 bytes), and a supported avatar.'
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const connection = await db.getConnection();
    let userId;
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        'INSERT INTO users (name, email, password, avatar) VALUES (?, ?, ?, ?)',
        [name, email, passwordHash, avatar]
      );
      userId = result.insertId;
      await connection.execute(
        'INSERT INTO user_settings (user_id, currency) VALUES (?, ?)',
        [userId, '₹']
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      throw error;
    } finally {
      connection.release();
    }

    const user = { id: userId, name, email, avatar };
    return res.status(201).json({ token: createToken(user), user });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!validEmail.test(email) || !password) {
    return res.status(400).json({ error: 'Provide a valid email and password.' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.name, u.email, u.password, u.avatar,
              TIMESTAMPDIFF(DAY, s.last_login, CURRENT_TIMESTAMP) AS days_since_login
       FROM users u JOIN user_settings s ON s.user_id = u.id
       WHERE u.email = ? LIMIT 1`,
      [email]
    );
    const row = rows[0];
    if (!row || !(await bcrypt.compare(password, row.password))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }

    const daysSinceLastLogin = row.days_since_login === null
      ? null
      : Number(row.days_since_login);
    await db.execute('UPDATE user_settings SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?', [row.id]);

    const user = { id: row.id, name: row.name, email: row.email, avatar: row.avatar };
    return res.json({ token: createToken(user), user, daysSinceLastLogin });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar
    }
  });
});

module.exports = router;
