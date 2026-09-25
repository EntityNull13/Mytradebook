import type { Request, Response, NextFunction } from 'express';

interface AttemptRecord {
  count: number;
  firstAttemptTime: number;
  blockedUntil?: number;
}

const loginAttempts = new Map<string, AttemptRecord>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.socket.remoteAddress || req.ip || 'unknown';
}

/**
 * Rate limiter middleware for POST /api/auth/login
 * Enforces maximum 5 failed attempts per IP within a 15-minute window.
 */
export function checkLoginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record) {
    // If currently blocked
    if (record.blockedUntil && now < record.blockedUntil) {
      const retryAfterSec = Math.ceil((record.blockedUntil - now) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Too many failed login attempts. Please try again in 15 minutes.',
      });
      return;
    }

    // If window has passed, reset record
    if (now - record.firstAttemptTime > WINDOW_MS) {
      loginAttempts.delete(ip);
    }
  }

  next();
}

/**
 * Records a failed login attempt for the client IP.
 */
export function recordFailedLogin(req: Request): void {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now - record.firstAttemptTime > WINDOW_MS) {
    loginAttempts.set(ip, {
      count: 1,
      firstAttemptTime: now,
    });
  } else {
    record.count += 1;
    if (record.count >= MAX_ATTEMPTS) {
      record.blockedUntil = now + BLOCK_DURATION_MS;
    }
  }
}

/**
 * Resets failed login attempt counter upon successful login.
 */
export function recordSuccessfulLogin(req: Request): void {
  const ip = getClientIp(req);
  loginAttempts.delete(ip);
}

// Periodic cleanup every 10 minutes to prevent memory accumulation
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts.entries()) {
    if (record.blockedUntil && now > record.blockedUntil) {
      loginAttempts.delete(ip);
    } else if (now - record.firstAttemptTime > WINDOW_MS) {
      loginAttempts.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();
