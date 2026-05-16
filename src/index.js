const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// ── Security & Utility Middleware ─────────────────────────────
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',          require('./modules/auth/auth.routes'));
app.use('/api/organizations', require('./modules/organizations/organizations.routes'));
app.use('/api/users',         require('./modules/users/users.routes'));
app.use('/api/workers',       require('./modules/workers/workers.routes'));
app.use('/api/jobs',          require('./modules/jobs/jobs.routes'));
app.use('/api/gigs',          require('./modules/gigs/gigs.routes'));
app.use('/api/matching',      require('./modules/matching/matching.routes'));
app.use('/api/tracking',      require('./modules/tracking/tracking.routes'));
app.use('/api/escrow',        require('./modules/escrow/escrow.routes'));
app.use('/api/reviews',       require('./modules/reviews/reviews.routes'));
app.use('/api/contracts',     require('./modules/contracts/contracts.routes'));

// ── Health & Root ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to ISPANI API', version: '2.0.0', status: 'Running', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ISPANI ERROR]', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`ISPANI API v2.0 listening on http://0.0.0.0:${port}`);
});
