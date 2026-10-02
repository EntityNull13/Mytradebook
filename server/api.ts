import { Router, type Request, type Response } from 'express';
import { getPublishedJournal, savePublishedJournal, unpublishJournal } from './storage';
import { validateOrigin } from './csrf';
import { validatePublishedJournalPayload } from './validator';

export const apiRouter = Router();

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
// ADMIN PUBLISHING ENDPOINTS
// ==========================================

/**
 * POST /api/admin/publish
 * Publishes a new snapshot of selected journal data to the public view.
 * Protected by origin validation (CSRF) and strict payload validation.
 */
apiRouter.post(
  '/admin/publish',
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
 * Protected by origin validation.
 */
apiRouter.post(
  '/admin/unpublish',
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

/**
 * GET /api/auth/me
 * Compatibility endpoint returning JSON status.
 */
apiRouter.get('/auth/me', (req: Request, res: Response): void => {
  res.json({ authenticated: false });
});

/**
 * POST /api/auth/logout
 * Compatibility endpoint returning JSON success.
 */
apiRouter.post('/auth/logout', (req: Request, res: Response): void => {
  res.json({ success: true });
});
