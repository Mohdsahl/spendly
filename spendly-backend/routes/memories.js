const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, img, caption, date, created_at FROM memories WHERE user_id = ? ORDER BY date DESC, id DESC',
      [req.user.id]
    );
    return res.json({
      memories: rows.map((row) => ({
        ...row,
        id: Number(row.id),
        date: row.date instanceof Date ? row.date.toISOString() : String(row.date).replace(' ', 'T')
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  const { img, caption } = req.body;
  if (typeof img !== 'string' ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(img) ||
      img.length > 2_000_000 || typeof caption !== 'string' ||
      !caption.trim() || caption.trim().length > 255) {
    return res.status(400).json({ error: 'Memory image or caption is invalid.' });
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO memories (user_id, img, caption, date) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [req.user.id, img, caption.trim()]
    );
    const [rows] = await db.execute(
      'SELECT id, img, caption, date, created_at FROM memories WHERE id = ? AND user_id = ?',
      [result.insertId, req.user.id]
    );
    const row = rows[0];
    return res.status(201).json({
      memory: {
        ...row,
        id: Number(row.id),
        date: row.date instanceof Date ? row.date.toISOString() : String(row.date).replace(' ', 'T')
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Memory ID is invalid.' });
  }
  try {
    const [result] = await db.execute(
      'DELETE FROM memories WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Memory not found.' });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
