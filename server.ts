import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/api';
import { getSessionSecret } from './server/auth';

async function startServer() {
  // Fail-secure validation on startup: ensure SESSION_SECRET is set and >= 32 chars
  try {
    getSessionSecret();
  } catch (err) {
    console.error('FATAL: Failed to initialize server securely:', err);
    process.exit(1);
  }

  const app = express();
  const httpServer = http.createServer(app);
  const PORT = 3000;

  // Trust first proxy hop in cloud containers (for req.secure and IP resolution)
  app.set('trust proxy', 1);

  // Security Headers Middleware
  app.use((req, res, next) => {
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Strict-Transport-Security (production / HTTPS)
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Content-Security-Policy
    // Provides strict resource isolation while enabling Vite/React development & AI Studio preview
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' ws: wss:",
        "frame-ancestors 'self' https://ai.studio https://*.google.com https://*.googleusercontent.com",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );

    next();
  });

  // Tailored Request Body Limits:
  // 1. Publishing endpoint: bounded 5MB limit for rich historical trade snapshots
  app.use('/api/admin/publish', express.json({ limit: '5mb' }));
  // 2. Auth endpoints: small 16KB limit (passwords should never be megabytes)
  app.use('/api/auth', express.json({ limit: '16kb' }));
  // 3. Global default for other JSON endpoints: 64KB
  app.use(express.json({ limit: '64kb' }));

  app.use(cookieParser());

  // API routes first
  app.use('/api', apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: !isHmrDisabled,
        ws: isHmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
      } else {
        next();
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Tradebook server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Tradebook server:', err);
  process.exit(1);
});
