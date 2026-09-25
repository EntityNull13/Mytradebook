import type { Request, Response, NextFunction } from 'express';

/**
 * Validates request Origin / Referer against host for state-changing endpoints.
 * Blocks cross-site forgery attempts while preserving legitimate client operations.
 */
export function validateOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  const secFetchSite = req.headers['sec-fetch-site'];

  // Block explicit cross-site fetch requests
  if (secFetchSite === 'cross-site') {
    res.status(403).json({ error: 'Forbidden: Cross-site request rejected' });
    return;
  }

  // Validate Origin header if present
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const isLocalhost = originUrl.hostname === 'localhost' && (!host || host.startsWith('localhost'));
      const hostMatch = host && originUrl.host.toLowerCase() === host.toLowerCase();

      if (!hostMatch && !isLocalhost) {
        res.status(403).json({ error: 'Forbidden: Request origin does not match application host' });
        return;
      }
    } catch {
      res.status(403).json({ error: 'Forbidden: Malformed Origin header' });
      return;
    }
  } else if (referer) {
    // If Origin is omitted, check Referer if present
    try {
      const refererUrl = new URL(referer);
      const isLocalhost = refererUrl.hostname === 'localhost' && (!host || host.startsWith('localhost'));
      const hostMatch = host && refererUrl.host.toLowerCase() === host.toLowerCase();

      if (!hostMatch && !isLocalhost) {
        res.status(403).json({ error: 'Forbidden: Request referer does not match application host' });
        return;
      }
    } catch {
      res.status(403).json({ error: 'Forbidden: Malformed Referer header' });
      return;
    }
  }

  next();
}
