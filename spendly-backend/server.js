require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./config/db');
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const userRoutes = require('./routes/user');
const memoryRoutes = require('./routes/memories');
const aiRoutes = require('./routes/ai');

const app = express();
const port = Number(process.env.PORT) || 3000;
const allowedOrigins = new Set([
  process.env.FRONTEND_ORIGIN,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
].filter(Boolean));

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '3mb' }));
app.use((req, res, next) => {
  if (!req.body) req.body = {};
  next();
});

app.get('/api/health', async (req, res, next) => {
  try {
    await db.query('SELECT 1');
    return res.json({ status: 'ok' });
  } catch (error) {
    return next(error);
  }
});
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/user', userRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/ai', aiRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(error);
  const status = error.message === 'Origin is not allowed by CORS.'
    ? 403
    : error.status === 400 || error.status === 413 || error.status === 502 ||
      error.status === 503 || error.status === 504 ? error.status : 500;
  return res.status(status).json({
    error: status === 403
      ? error.message
      : status === 400 ? 'Request body is invalid.'
        : status === 413 ? 'Request body is too large.'
          : status >= 500 && error.status >= 502 ? error.message
            : 'An unexpected server error occurred.'
  });
});

async function start() {
  await db.query('SELECT 1');
  const server = app.listen(port, () => console.log(`Spendly API listening on port ${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      server.close(async (error) => {
        if (error) console.error('Error while closing the HTTP server:', error);
        await db.end();
        process.exit(error ? 1 : 0);
      });
    });
  }
}

start().catch((error) => {
  console.error('Unable to start Spendly API:', error);
  process.exitCode = 1;
});
