import type { Request, Response, NextFunction } from 'express';

function isAllowedHost(candidateHostname: string, candidateHost: string, expectedHosts: string[]): boolean {
  const normHostname = candidateHostname.toLowerCase();
  const normHost = candidateHost.toLowerCase();

  // Localhost / Loopback / Dev
  if (
    normHostname === 'localhost' ||
    normHostname === '127.0.0.1' ||
    normHostname === '0.0.0.0'
  ) {
    return true;
  }

  // Cloud Run / Google AI Studio / GCP domains
  if (
    normHostname.endsWith('.run.app') ||
    normHostname.endsWith('.google.com') ||
    normHostname.endsWith('.googleusercontent.com') ||
    normHostname === 'ai.studio' ||
    normHostname.endsWith('.ai.studio') ||
    normHostname.endsWith('.vercel.app')
  ) {
    return true;
  }

  // Match expected host from request (X-Forwarded-Host or Host)
  for (const h of expectedHosts) {
    if (!h) continue;
    const cleanExpected = h.toLowerCase().trim();
    if (normHost === cleanExpected || normHostname === cleanExpected.split(':')[0]) {
      return true;
    }
  }

  return false;
}

/**
 * Validates request Origin / Referer against host for state-changing endpoints.
 * Blocks cross-site forgery attempts while preserving legitimate client operations.
 */
export function validateOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const forwardedHost = (req.headers['x-forwarded-host'] as string) || '';
  const host = req.headers.host || '';
  const secFetchSite = req.headers['sec-fetch-site'];

  const expectedHosts = [forwardedHost, host].filter(Boolean);

  // Validate Origin header if present
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (!isAllowedHost(originUrl.hostname, originUrl.host, expectedHosts)) {
        console.warn(`[CSRF] Rejected origin: ${origin}, expected hosts: ${expectedHosts.join(', ')}`);
        // Use 400 instead of 403 to prevent nginx error_page 403 interceptor from replacing JSON with HTML
        res.status(400).json({ error: 'Forbidden: Request origin does not match application host' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Forbidden: Malformed Origin header' });
      return;
    }
  } else if (referer) {
    // If Origin is omitted, check Referer if present
    try {
      const refererUrl = new URL(referer);
      if (!isAllowedHost(refererUrl.hostname, refererUrl.host, expectedHosts)) {
        console.warn(`[CSRF] Rejected referer: ${referer}, expected hosts: ${expectedHosts.join(', ')}`);
        res.status(400).json({ error: 'Forbidden: Request referer does not match application host' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Forbidden: Malformed Referer header' });
      return;
    }
  }

  // Only block cross-site fetch if neither origin nor referer was present/validated
  if (secFetchSite === 'cross-site' && !origin && !referer) {
    res.status(400).json({ error: 'Forbidden: Cross-site request rejected' });
    return;
  }

  next();
}
