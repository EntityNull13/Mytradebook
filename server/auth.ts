import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || '';
}

/**
 * Returns the cryptographically secure SESSION_SECRET.
 * Strict fail-secure behavior: NEVER use a default or fallback secret.
 * Minimum 32 characters required.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length < 32) {
    throw new Error(
      'CRITICAL SECURITY ERROR: SESSION_SECRET environment variable is missing or too short. A minimum of 32 cryptographically random characters is strictly required.'
    );
  }
  return secret.trim();
}

/**
 * Constant-time comparison between user input and actual password to prevent timing attacks.
 */
export function verifyPassword(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    // Perform dummy timing-safe equal to mitigate timing leakage
    crypto.timingSafeEqual(providedBuffer, providedBuffer);
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Creates a signed session token: <payloadBase64Url>.<signatureBase64Url>
 */
export function createSessionToken(expiresInDays: number = 7): string {
  const secret = getSessionSecret();
  const payload = {
    role: 'admin',
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    iat: Date.now(),
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

/**
 * Verifies that a session token was signed by our secret and has not expired.
 */
export function verifySessionToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadStr, signature] = parts;
  let secret: string;
  try {
    secret = getSessionSecret();
  } catch {
    return false;
  }

  const expectedSignature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
    if (!payload.exp || Date.now() > payload.exp) {
      return false; // Expired
    }
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

/**
 * Extracts session token strictly from the HttpOnly session cookie.
 * Raw token headers or client-side storage are forbidden.
 */
export function extractToken(req: Request): string | null {
  if (req.cookies && typeof req.cookies.tb_admin_session === 'string') {
    return req.cookies.tb_admin_session;
  }
  return null;
}

/**
 * Express middleware to ensure request is from an authenticated admin via HttpOnly cookie.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token || !verifySessionToken(token)) {
    res.status(401).json({
      error: 'Unauthorized: Admin authentication required',
    });
    return;
  }
  next();
}
