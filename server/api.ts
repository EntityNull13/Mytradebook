import { Router, type Request, type Response } from 'express';
import {
  getAdminPassword,
  verifyPassword,
  createSessionToken,
  extractToken,
  verifySessionToken,
  requireAdminAuth,
} from './auth';
import { getPublishedJournal, savePublishedJournal, unpublishJournal } from './storage';
import { checkLoginRateLimit, recordFailedLogin, recordSuccessfulLogin } from './rateLimiter';
import { validateOrigin } from './csrf';
import { validatePublishedJournalPayload } from './validator';

export const apiRouter = Router();

// ==========================================
// AUTH ENDPOINTS
// ==========================================

/**
 * POST /api/auth/login
 * Validates password server-side, enforces rate limiting, sets HttpOnly cookie.
 * NEVER returns the raw session token in the response body.
 */
apiRouter.post('/auth/login', checkLoginRateLimit, (req: Request, res: Response): void => {
  const { password } = req.body || {};

  if (!password || typeof password !== 'string') {
    recordFailedLogin(req);
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  const expectedPassword = getAdminPassword();
  const isValid = verifyPassword(password, expectedPassword);

  if (!isValid) {
    recordFailedLogin(req);
    res.status(401).json({ error: 'Invalid admin credentials' });
    return;
  }

  // Reset failed login rate limit counter on success
  recordSuccessfulLogin(req);

  const token = createSessionToken(7); // 7 days session

  const isSecure = Boolean(
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    (process.env.NODE_ENV === 'production' && !req.headers.host?.startsWith('localhost'))
  );

  // Set secure HttpOnly cookie - raw token is never exposed to client JS
  res.cookie('tb_admin_session', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  // Strict: DO NOT return the session token in the JSON response
  res.json({
    success: true,
    role: 'admin',
    expiresInDays: 7,
  });
});

/**
 * POST /api/auth/logout
 * Validates request Origin and clears admin session cookie.
 */
apiRouter.post('/auth/logout', validateOrigin, (req: Request, res: Response): void => {
  res.clearCookie('tb_admin_session', { path: '/' });
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Returns current admin authentication status via HttpOnly cookie verification.
 */
apiRouter.get('/auth/me', (req: Request, res: Response): void => {
  const token = extractToken(req);
  if (!token || !verifySessionToken(token)) {
    res.json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, role: 'admin' });
});

// ==========================================
// PUBLIC ENDPOINTS (Read-Only)
// ==========================================

/**
 * GET /api/public/journal
 * Publicly accessible endpoint to retrieve the latest published journal snapshot.
 * Requires NO login.
 */
apiRouter.get('/public/journal', async (req: Request, res: Response): Promise<void> => {
  try {
    const journal = await getPublishedJournal();

    if (!journal || !journal.isPublished) {
      res.json({
        isPublished: false,
        message: 'No public journal published yet.',
      });
      return;
    }

    // Return the sanitized public journal
    res.json({
      isPublished: true,
      journal,
    });
  } catch (err) {
    console.error('Failed to retrieve public journal:', err);
    res.status(500).json({ error: 'Failed to load public journal' });
  }
});

// ==========================================
// ADMIN PUBLISHING ENDPOINTS (Protected)
// ==========================================

/**
 * POST /api/admin/publish
 * Publishes a new snapshot of selected journal data to the public view.
 * Requires admin authentication via HttpOnly cookie, origin verification, and strict payload validation.
 */
apiRouter.post(
  '/admin/publish',
  requireAdminAuth,
  validateOrigin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const validation = validatePublishedJournalPayload(req.body);

      if (!validation.valid) {
        res.status(400).json({ error: `Malformed journal payload: ${validation.error}` });
        return;
      }

      const journalPayload = validation.data;

      await savePublishedJournal(journalPayload);

      res.json({
        success: true,
        publishedAt: journalPayload.publishedAt,
        accountsCount: journalPayload.accounts.length,
        tradesCount: journalPayload.trades.length,
        plansCount: journalPayload.plans.length,
      });
    } catch (err) {
      console.error('Failed to publish journal:', err);
      res.status(500).json({ error: 'Failed to publish journal' });
    }
  }
);

/**
 * POST /api/admin/unpublish
 * Reverts public journal to unpublished state.
 * Requires admin authentication and origin verification.
 */
apiRouter.post(
  '/admin/unpublish',
  requireAdminAuth,
  validateOrigin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await unpublishJournal();
      res.json({ success: true, message: 'Journal has been unpublished' });
    } catch (err) {
      console.error('Failed to unpublish journal:', err);
      res.status(500).json({ error: 'Failed to unpublish journal' });
    }
  }
);

/**
 * GET /api/health
 */
apiRouter.get('/health', (req: Request, res: Response): void => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});
