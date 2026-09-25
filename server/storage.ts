import fs from 'fs';
import path from 'path';
import type { PublishedJournal } from '../src/types/public';

const DATA_DIR = path.join(process.cwd(), 'data');
const JOURNAL_FILE = path.join(DATA_DIR, 'published-journal.json');

// Memory cache
let cachedJournal: PublishedJournal | null = null;
let isCacheLoaded = false;

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

// Ensure data directory exists on startup
ensureDataDir();

/**
 * Retrieves the currently published journal.
 * If no journal file exists yet on initial installation, initializes with default published records.
 * Returns null or { isPublished: false } if explicitly unpublished.
 */
export async function getPublishedJournal(): Promise<PublishedJournal | null> {
  // If memory cache is fresh, return it
  if (isCacheLoaded && cachedJournal) {
    return cachedJournal;
  }

  // Check optional Redis / Vercel KV if available
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      const res = await fetch(`${kvUrl}/get/published_journal`, {
        headers: { Authorization: `Bearer ${kvToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.result) {
          const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
          cachedJournal = parsed;
          isCacheLoaded = true;
          return cachedJournal;
        }
      }
    } catch (err) {
      console.warn('Failed to read from Vercel KV, falling back to local file:', err);
    }
  }

  // Read from local file system
  try {
    if (fs.existsSync(JOURNAL_FILE)) {
      const raw = fs.readFileSync(JOURNAL_FILE, 'utf-8');
      cachedJournal = JSON.parse(raw);
      isCacheLoaded = true;
      return cachedJournal;
    }
  } catch (err) {
    console.error('Failed to read published journal file:', err);
  }

  isCacheLoaded = true;
  return null;
}

/**
 * Saves a new published journal snapshot.
 */
export async function savePublishedJournal(journal: PublishedJournal): Promise<void> {
  cachedJournal = journal;
  isCacheLoaded = true;

  // Optional Vercel KV / Redis
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      await fetch(`${kvUrl}/set/published_journal`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(JSON.stringify(journal)),
      });
    } catch (err) {
      console.warn('Failed to write to Vercel KV:', err);
    }
  }

  // Write to local file system
  try {
    ensureDataDir();
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(journal, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write published journal file:', err);
    // In serverless / read-only filesystem environments, in-memory cache still holds the data
  }
}

/**
 * Unpublishes the journal (sets isPublished = false).
 */
export async function unpublishJournal(): Promise<void> {
  const current = await getPublishedJournal();
  if (current) {
    current.isPublished = false;
    current.updatedAt = new Date().toISOString();
    await savePublishedJournal(current);
  }
}
