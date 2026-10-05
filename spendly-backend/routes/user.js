const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

function normalizeCurrency(currency) {
  return currency === '\u00d4\u00e9\u2563' ? '₹' : currency;
}

router.get('/settings', async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.name, u.email, u.avatar, s.budget, s.income, s.currency,
              s.last_login, s.updated_at
       FROM users u JOIN user_settings s ON s.user_id = u.id
       WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User settings not found.' });
    const row = rows[0];
    return res.json({
      user: { id: row.id, name: row.name, email: row.email, avatar: row.avatar },
      settings: {
        budget: Number(row.budget),
        income: Number(row.income),
        currency: normalizeCurrency(row.currency),
        last_login: row.last_login,
        updated_at: row.updated_at
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/settings', async (req, res, next) => {
  const budget = Number(req.body.budget);
  const income = Number(req.body.income);
  const currency = typeof req.body.currency === 'string' ? req.body.currency : '';
  const supportedCurrencies = ['₹', '$', '€', '£', '¥'];
  if (!Number.isFinite(budget) || budget < 0 || budget > 9999999999.99 ||
      !Number.isFinite(income) || income < 0 || income > 9999999999.99 ||
      !supportedCurrencies.includes(currency)) {
    return res.status(400).json({ error: 'Settings data is invalid.' });
  }
  const conversionRate = req.body.conversionRate === undefined
    ? null
    : Number(req.body.conversionRate);
  if (conversionRate !== null &&
      (!Number.isFinite(conversionRate) || conversionRate <= 0 || conversionRate > 10000)) {
    return res.status(400).json({ error: 'Expense conversion rate is invalid.' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [settingsRows] = await connection.execute(
      'SELECT user_id FROM user_settings WHERE user_id = ? FOR UPDATE',
      [req.user.id]
    );
    if (!settingsRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'User settings not found.' });
    }
    if (conversionRate !== null) {
      await connection.execute(
        'UPDATE expenses SET amt = ROUND(amt * ?, 2) WHERE user_id = ?',
        [conversionRate, req.user.id]
      );
    }
    await connection.execute(
      'UPDATE user_settings SET budget = ?, income = ?, currency = ? WHERE user_id = ?',
      [budget, income, currency, req.user.id]
    );
    await connection.commit();
    return res.json({ settings: { budget, income, currency } });
  } catch (error) {
    if (connection) await connection.rollback();
    return next(error);
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
