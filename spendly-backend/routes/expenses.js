const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

function normalizeExpense(row) {
  return {
    ...row,
    id: Number(row.id),
    amt: Number(row.amt),
    recurring: Boolean(row.recurring),
    date: row.date instanceof Date ? row.date.toISOString() : `${row.date}T00:00:00`
  };
}

function validateExpense(body) {
  const desc = typeof body.desc === 'string' ? body.desc.trim() : '';
  const amt = Number(body.amt);
  const cat = typeof body.cat === 'string' ? body.cat.trim() : '';
  const date = typeof body.date === 'string' ? body.date.slice(0, 10) : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const recurring = Boolean(body.recurring);
  const recurFreq = body.recur_freq || null;
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;

  if (!desc || desc.length > 255 || !Number.isFinite(amt) || amt <= 0 || amt > 9999999999.99 ||
      !cat || cat.length > 100 || !isValidDate ||
      notes.length > 2000 ||
      (body.recurring !== undefined && typeof body.recurring !== 'boolean') ||
      (recurFreq !== null && !['daily', 'weekly', 'monthly', 'yearly'].includes(recurFreq)) ||
      (recurring && recurFreq === null) || (!recurring && recurFreq !== null)) {
    return null;
  }

  return { desc, amt, cat, date, notes, recurring, recurFreq };
}

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, \`desc\`, amt, cat, date, notes, recurring, recur_freq, created_at
       FROM expenses WHERE user_id = ? ORDER BY id DESC`,
      [req.user.id]
    );
    return res.json({ expenses: rows.map(normalizeExpense) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    await db.execute('DELETE FROM expenses WHERE user_id = ?', [req.user.id]);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  const expense = validateExpense(req.body);
  if (!expense) return res.status(400).json({ error: 'Expense data is invalid.' });

  try {
    const [result] = await db.execute(
      `INSERT INTO expenses
       (user_id, \`desc\`, amt, cat, date, notes, recurring, recur_freq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, expense.desc, expense.amt, expense.cat, expense.date,
        expense.notes, expense.recurring, expense.recurFreq]
    );
    const [rows] = await db.execute(
      `SELECT id, \`desc\`, amt, cat, date, notes, recurring, recur_freq, created_at
       FROM expenses WHERE id = ? AND user_id = ?`,
      [result.insertId, req.user.id]
    );
    return res.status(201).json({ expense: normalizeExpense(rows[0]) });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  const expense = validateExpense(req.body);
  if (!Number.isSafeInteger(id) || id < 1 || !expense) {
    return res.status(400).json({ error: 'Expense ID or data is invalid.' });
  }

  try {
    await db.execute(
      `UPDATE expenses
       SET \`desc\` = ?, amt = ?, cat = ?, date = ?, notes = ?, recurring = ?, recur_freq = ?
       WHERE id = ? AND user_id = ?`,
      [expense.desc, expense.amt, expense.cat, expense.date, expense.notes,
        expense.recurring, expense.recurFreq, id, req.user.id]
    );
    const [rows] = await db.execute(
      `SELECT id, \`desc\`, amt, cat, date, notes, recurring, recur_freq, created_at
       FROM expenses WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Expense not found.' });
    return res.json({ expense: normalizeExpense(rows[0]) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Expense ID is invalid.' });
  }

  try {
    const [result] = await db.execute(
      'DELETE FROM expenses WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Expense not found.' });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
