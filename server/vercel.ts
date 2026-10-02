import express from 'express';
import cookieParser from 'cookie-parser';
import { apiRouter } from './api';

const app = express();

// Trust proxy in Vercel serverless environment (for req.secure and IP resolution)
app.set('trust proxy', 1);

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
});

// Tailored Request Body Limits
app.use('/api/admin/publish', express.json({ limit: '5mb' }));
app.use('/admin/publish', express.json({ limit: '5mb' }));
app.use(express.json({ limit: '64kb' }));

app.use(cookieParser());

// Mount API router under both '/api' and '/' root paths.
// This ensures routes match regardless of whether Vercel rewrites preserve '/api/*' or strip to '/*'
app.use('/api', apiRouter);
app.use(apiRouter);

// Strict 404 handler for API routes: NEVER fall through or return HTML
app.use((req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

export default app;
