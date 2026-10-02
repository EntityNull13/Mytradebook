// server/vercel.ts
import express from "express";
import cookieParser from "cookie-parser";

// server/api.ts
import { Router } from "express";

// server/storage.ts
import fs from "fs";
import path from "path";
var DATA_DIR = path.join(process.cwd(), "data");
var JOURNAL_FILE = path.join(DATA_DIR, "published-journal.json");
var cachedJournal = null;
var isCacheLoaded = false;
function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("Failed to create data directory:", err);
  }
}
ensureDataDir();
async function getPublishedJournal() {
  if (isCacheLoaded && cachedJournal) {
    return cachedJournal;
  }
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      const res = await fetch(`${kvUrl}/get/published_journal`, {
        headers: { Authorization: `Bearer ${kvToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.result) {
          const parsed = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
          cachedJournal = parsed;
          isCacheLoaded = true;
          return cachedJournal;
        }
      }
    } catch (err) {
      console.warn("Failed to read from Vercel KV, falling back to local file:", err);
    }
  }
  try {
    if (fs.existsSync(JOURNAL_FILE)) {
      const raw = fs.readFileSync(JOURNAL_FILE, "utf-8");
      cachedJournal = JSON.parse(raw);
      isCacheLoaded = true;
      return cachedJournal;
    }
  } catch (err) {
    console.error("Failed to read published journal file:", err);
  }
  isCacheLoaded = true;
  return null;
}
async function savePublishedJournal(journal) {
  cachedJournal = journal;
  isCacheLoaded = true;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      await fetch(`${kvUrl}/set/published_journal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kvToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(JSON.stringify(journal))
      });
    } catch (err) {
      console.warn("Failed to write to Vercel KV:", err);
    }
  }
  try {
    ensureDataDir();
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(journal, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write published journal file:", err);
  }
}
async function unpublishJournal() {
  const current = await getPublishedJournal();
  if (current) {
    current.isPublished = false;
    current.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await savePublishedJournal(current);
  }
}

// server/csrf.ts
function isAllowedHost(candidateHostname, candidateHost, expectedHosts) {
  const normHostname = candidateHostname.toLowerCase();
  const normHost = candidateHost.toLowerCase();
  if (normHostname === "localhost" || normHostname === "127.0.0.1" || normHostname === "0.0.0.0") {
    return true;
  }
  if (normHostname.endsWith(".run.app") || normHostname.endsWith(".google.com") || normHostname.endsWith(".googleusercontent.com") || normHostname === "ai.studio" || normHostname.endsWith(".ai.studio") || normHostname.endsWith(".vercel.app")) {
    return true;
  }
  for (const h of expectedHosts) {
    if (!h) continue;
    const cleanExpected = h.toLowerCase().trim();
    if (normHost === cleanExpected || normHostname === cleanExpected.split(":")[0]) {
      return true;
    }
  }
  return false;
}
function validateOrigin(req, res, next) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const forwardedHost = req.headers["x-forwarded-host"] || "";
  const host = req.headers.host || "";
  const secFetchSite = req.headers["sec-fetch-site"];
  const expectedHosts = [forwardedHost, host].filter(Boolean);
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (!isAllowedHost(originUrl.hostname, originUrl.host, expectedHosts)) {
        console.warn(`[CSRF] Rejected origin: ${origin}, expected hosts: ${expectedHosts.join(", ")}`);
        res.status(400).json({ error: "Forbidden: Request origin does not match application host" });
        return;
      }
    } catch {
      res.status(400).json({ error: "Forbidden: Malformed Origin header" });
      return;
    }
  } else if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (!isAllowedHost(refererUrl.hostname, refererUrl.host, expectedHosts)) {
        console.warn(`[CSRF] Rejected referer: ${referer}, expected hosts: ${expectedHosts.join(", ")}`);
        res.status(400).json({ error: "Forbidden: Request referer does not match application host" });
        return;
      }
    } catch {
      res.status(400).json({ error: "Forbidden: Malformed Referer header" });
      return;
    }
  }
  if (secFetchSite === "cross-site" && !origin && !referer) {
    res.status(400).json({ error: "Forbidden: Cross-site request rejected" });
    return;
  }
  next();
}

// server/validator.ts
function isNonEmptyString(val, maxLen = 100) {
  return typeof val === "string" && val.trim().length > 0 && val.length <= maxLen;
}
function isOptionalString(val, maxLen = 2e3) {
  return val === void 0 || typeof val === "string" && val.length <= maxLen;
}
function isFiniteNumber(val) {
  return typeof val === "number" && Number.isFinite(val);
}
function isOptionalFiniteNumber(val) {
  return val === void 0 || typeof val === "number" && Number.isFinite(val);
}
function isValidIsoDate(val) {
  if (typeof val !== "string" || val.length > 50) return false;
  const time = Date.parse(val);
  return !Number.isNaN(time);
}
function sanitizeString(str) {
  return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}
function validatePublishedJournalPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, error: "Payload must be a JSON object" };
  }
  const raw = payload;
  if (!isNonEmptyString(raw.journalName, 100)) {
    return { valid: false, error: "journalName must be a non-empty string under 100 characters" };
  }
  if (!isOptionalString(raw.bio, 1e3)) {
    return { valid: false, error: "bio must be a string under 1000 characters" };
  }
  if (typeof raw.showBalances !== "boolean") {
    return { valid: false, error: "showBalances must be a boolean" };
  }
  if (typeof raw.showPositionSizes !== "boolean") {
    return { valid: false, error: "showPositionSizes must be a boolean" };
  }
  if (typeof raw.includeReviews !== "boolean") {
    return { valid: false, error: "includeReviews must be a boolean" };
  }
  if (!Array.isArray(raw.accounts)) {
    return { valid: false, error: "accounts must be an array" };
  }
  if (raw.accounts.length > 100) {
    return { valid: false, error: "accounts array exceeds maximum limit of 100 items" };
  }
  const accounts = [];
  for (let i = 0; i < raw.accounts.length; i++) {
    const acc = raw.accounts[i];
    if (!acc || typeof acc !== "object") {
      return { valid: false, error: `accounts[${i}] must be an object` };
    }
    if (!isNonEmptyString(acc.id, 100)) {
      return { valid: false, error: `accounts[${i}].id must be a valid string` };
    }
    if (!isNonEmptyString(acc.name, 100)) {
      return { valid: false, error: `accounts[${i}].name must be a valid string` };
    }
    if (!isNonEmptyString(acc.currency, 10)) {
      return { valid: false, error: `accounts[${i}].currency must be a valid string` };
    }
    if (!isOptionalFiniteNumber(acc.initialBalance) || !isOptionalFiniteNumber(acc.currentBalance)) {
      return { valid: false, error: `accounts[${i}] balance numbers must be finite` };
    }
    accounts.push({
      id: sanitizeString(acc.id),
      name: sanitizeString(acc.name),
      currency: sanitizeString(acc.currency),
      initialBalance: acc.initialBalance,
      currentBalance: acc.currentBalance
    });
  }
  if (!Array.isArray(raw.plans)) {
    return { valid: false, error: "plans must be an array" };
  }
  if (raw.plans.length > 5e3) {
    return { valid: false, error: "plans array exceeds maximum limit of 5000 items" };
  }
  const validPlanStatuses = /* @__PURE__ */ new Set(["PLANNED", "TRIGGERED", "NOT_TRIGGERED", "INVALID", "ARCHIVED"]);
  const plans = [];
  for (let i = 0; i < raw.plans.length; i++) {
    const p = raw.plans[i];
    if (!p || typeof p !== "object") {
      return { valid: false, error: `plans[${i}] must be an object` };
    }
    if (!isNonEmptyString(p.id, 100) || !isNonEmptyString(p.accountId, 100) || !isNonEmptyString(p.symbol, 50)) {
      return { valid: false, error: `plans[${i}] requires valid id, accountId, and symbol` };
    }
    if (p.direction !== "BUY" && p.direction !== "SELL") {
      return { valid: false, error: `plans[${i}].direction must be BUY or SELL` };
    }
    if (!isFiniteNumber(p.plannedEntry)) {
      return { valid: false, error: `plans[${i}].plannedEntry must be a finite number` };
    }
    if (!isOptionalFiniteNumber(p.sl) || !isOptionalFiniteNumber(p.tp) || !isOptionalFiniteNumber(p.plannedRiskReward)) {
      return { valid: false, error: `plans[${i}] price targets must be finite numbers` };
    }
    if (!validPlanStatuses.has(p.status)) {
      return { valid: false, error: `plans[${i}].status is invalid` };
    }
    if (!isValidIsoDate(p.createdAt)) {
      return { valid: false, error: `plans[${i}].createdAt must be a valid date` };
    }
    plans.push({
      id: sanitizeString(p.id),
      accountId: sanitizeString(p.accountId),
      symbol: sanitizeString(p.symbol),
      direction: p.direction,
      plannedEntry: p.plannedEntry,
      sl: p.sl,
      tp: p.tp,
      plannedRiskReward: p.plannedRiskReward,
      timeframe: p.timeframe ? sanitizeString(String(p.timeframe).slice(0, 50)) : void 0,
      setupName: p.setupName ? sanitizeString(String(p.setupName).slice(0, 100)) : void 0,
      marketBias: ["BULLISH", "BEARISH", "NEUTRAL"].includes(p.marketBias) ? p.marketBias : void 0,
      entryReason: p.entryReason ? sanitizeString(String(p.entryReason).slice(0, 2e3)) : void 0,
      invalidReason: p.invalidReason ? sanitizeString(String(p.invalidReason).slice(0, 2e3)) : void 0,
      status: p.status,
      createdAt: p.createdAt
    });
  }
  if (!Array.isArray(raw.trades)) {
    return { valid: false, error: "trades must be an array" };
  }
  if (raw.trades.length > 1e4) {
    return { valid: false, error: "trades array exceeds maximum limit of 10000 items" };
  }
  const validTradeStatuses = /* @__PURE__ */ new Set(["ACTIVE", "COMPLETED"]);
  const validTradeResults = /* @__PURE__ */ new Set(["PROFIT", "LOSS", "BEP"]);
  const trades = [];
  for (let i = 0; i < raw.trades.length; i++) {
    const t = raw.trades[i];
    if (!t || typeof t !== "object") {
      return { valid: false, error: `trades[${i}] must be an object` };
    }
    if (!isNonEmptyString(t.id, 100) || !isNonEmptyString(t.accountId, 100) || !isNonEmptyString(t.symbol, 50)) {
      return { valid: false, error: `trades[${i}] requires valid id, accountId, and symbol` };
    }
    if (t.direction !== "BUY" && t.direction !== "SELL") {
      return { valid: false, error: `trades[${i}].direction must be BUY or SELL` };
    }
    if (!isFiniteNumber(t.actualEntry) || !isFiniteNumber(t.realizedPnL)) {
      return { valid: false, error: `trades[${i}] actualEntry and realizedPnL must be finite numbers` };
    }
    if (!isOptionalFiniteNumber(t.actualPositionSize) || !isOptionalFiniteNumber(t.initialStopLoss) || !isOptionalFiniteNumber(t.takeProfit) || !isOptionalFiniteNumber(t.realizedRMultiple)) {
      return { valid: false, error: `trades[${i}] optional numeric values must be finite` };
    }
    if (!validTradeStatuses.has(t.status)) {
      return { valid: false, error: `trades[${i}].status must be ACTIVE or COMPLETED` };
    }
    if (t.result !== void 0 && !validTradeResults.has(t.result)) {
      return { valid: false, error: `trades[${i}].result must be PROFIT, LOSS, or BEP` };
    }
    if (!isValidIsoDate(t.actualEntryTime)) {
      return { valid: false, error: `trades[${i}].actualEntryTime must be a valid date` };
    }
    if (t.completedAt !== void 0 && !isValidIsoDate(t.completedAt)) {
      return { valid: false, error: `trades[${i}].completedAt must be a valid date` };
    }
    const exits = [];
    if (Array.isArray(t.exits)) {
      if (t.exits.length > 50) {
        return { valid: false, error: `trades[${i}].exits exceeds limit of 50 exits` };
      }
      for (let j = 0; j < t.exits.length; j++) {
        const ex = t.exits[j];
        if (!ex || typeof ex !== "object") {
          return { valid: false, error: `trades[${i}].exits[${j}] must be an object` };
        }
        if (!isNonEmptyString(ex.id, 100) || !isNonEmptyString(ex.exitType, 50)) {
          return { valid: false, error: `trades[${i}].exits[${j}] invalid id or exitType` };
        }
        if (!isFiniteNumber(ex.price) || !isFiniteNumber(ex.realizedPnL)) {
          return { valid: false, error: `trades[${i}].exits[${j}] price and realizedPnL must be finite numbers` };
        }
        if (!isOptionalFiniteNumber(ex.closedSize)) {
          return { valid: false, error: `trades[${i}].exits[${j}].closedSize must be finite` };
        }
        if (!isValidIsoDate(ex.executedAt)) {
          return { valid: false, error: `trades[${i}].exits[${j}].executedAt must be a valid date` };
        }
        exits.push({
          id: sanitizeString(ex.id),
          exitType: sanitizeString(ex.exitType),
          price: ex.price,
          closedSize: ex.closedSize,
          realizedPnL: ex.realizedPnL,
          executedAt: ex.executedAt,
          notes: ex.notes ? sanitizeString(String(ex.notes).slice(0, 1e3)) : void 0
        });
      }
    }
    let review = void 0;
    if (t.review && typeof t.review === "object") {
      const rev = t.review;
      const followedPlan = ["YES", "PARTIALLY", "NO"].includes(rev.followedPlan) ? rev.followedPlan : void 0;
      review = {
        followedPlan,
        whatHappened: rev.whatHappened ? sanitizeString(String(rev.whatHappened).slice(0, 2e3)) : void 0,
        whatWentWell: rev.whatWentWell ? sanitizeString(String(rev.whatWentWell).slice(0, 2e3)) : void 0,
        whatCouldImprove: rev.whatCouldImprove ? sanitizeString(String(rev.whatCouldImprove).slice(0, 2e3)) : void 0,
        lessonLearned: rev.lessonLearned ? sanitizeString(String(rev.lessonLearned).slice(0, 2e3)) : void 0,
        notes: rev.notes ? sanitizeString(String(rev.notes).slice(0, 2e3)) : void 0
      };
    }
    trades.push({
      id: sanitizeString(t.id),
      accountId: sanitizeString(t.accountId),
      planId: t.planId ? sanitizeString(String(t.planId).slice(0, 100)) : void 0,
      symbol: sanitizeString(t.symbol),
      direction: t.direction,
      actualEntry: t.actualEntry,
      actualEntryTime: t.actualEntryTime,
      actualPositionSize: t.actualPositionSize,
      initialStopLoss: t.initialStopLoss,
      takeProfit: t.takeProfit,
      plannedRiskReward: t.plannedRiskReward,
      status: t.status,
      result: t.result,
      realizedPnL: t.realizedPnL,
      realizedRMultiple: t.realizedRMultiple,
      completedAt: t.completedAt,
      setupName: t.setupName ? sanitizeString(String(t.setupName).slice(0, 100)) : void 0,
      exits,
      review
    });
  }
  if (!raw.analytics || typeof raw.analytics !== "object") {
    return { valid: false, error: "analytics must be an object" };
  }
  const an = raw.analytics;
  const analyticsNumFields = [
    "totalTrades",
    "winningTrades",
    "losingTrades",
    "bepTrades",
    "winRate",
    "netPnL",
    "profitFactor",
    "averageWin",
    "averageLoss",
    "expectancy",
    "averageR",
    "maxDrawdown"
  ];
  for (const field of analyticsNumFields) {
    if (!isFiniteNumber(an[field])) {
      return { valid: false, error: `analytics.${field} must be a finite number` };
    }
  }
  const analytics = {
    totalTrades: Math.max(0, Math.round(Number(an.totalTrades))),
    winningTrades: Math.max(0, Math.round(Number(an.winningTrades))),
    losingTrades: Math.max(0, Math.round(Number(an.losingTrades))),
    bepTrades: Math.max(0, Math.round(Number(an.bepTrades))),
    winRate: Math.min(100, Math.max(0, Number(an.winRate))),
    netPnL: Number(an.netPnL),
    profitFactor: Math.max(0, Number(an.profitFactor)),
    averageWin: Number(an.averageWin),
    averageLoss: Number(an.averageLoss),
    expectancy: Number(an.expectancy),
    averageR: Number(an.averageR),
    maxDrawdown: Number(an.maxDrawdown)
  };
  const id = isNonEmptyString(raw.id, 100) ? sanitizeString(raw.id) : `pub_${Date.now()}`;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const publishedAt = isValidIsoDate(raw.publishedAt) ? String(raw.publishedAt) : nowIso;
  const updatedAt = nowIso;
  const sanitizedJournal = {
    id,
    isPublished: true,
    publishedAt,
    updatedAt,
    journalName: sanitizeString(raw.journalName),
    bio: raw.bio ? sanitizeString(raw.bio) : void 0,
    showBalances: raw.showBalances,
    showPositionSizes: raw.showPositionSizes,
    includeReviews: raw.includeReviews,
    accounts,
    plans,
    trades,
    analytics
  };
  return { valid: true, data: sanitizedJournal };
}

// server/api.ts
var apiRouter = Router();
apiRouter.get("/public/journal", async (req, res) => {
  try {
    const journal = await getPublishedJournal();
    if (!journal || !journal.isPublished) {
      res.json({
        isPublished: false,
        message: "No public journal published yet."
      });
      return;
    }
    res.json({
      isPublished: true,
      journal
    });
  } catch (err) {
    console.error("Failed to retrieve public journal:", err);
    res.status(500).json({ error: "Failed to load public journal" });
  }
});
apiRouter.post(
  "/admin/publish",
  validateOrigin,
  async (req, res) => {
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
        plansCount: journalPayload.plans.length
      });
    } catch (err) {
      console.error("Failed to publish journal:", err);
      res.status(500).json({ error: "Failed to publish journal" });
    }
  }
);
apiRouter.post(
  "/admin/unpublish",
  validateOrigin,
  async (req, res) => {
    try {
      await unpublishJournal();
      res.json({ success: true, message: "Journal has been unpublished" });
    } catch (err) {
      console.error("Failed to unpublish journal:", err);
      res.status(500).json({ error: "Failed to unpublish journal" });
    }
  }
);
apiRouter.get("/health", (req, res) => {
  res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
});
apiRouter.get("/auth/me", (req, res) => {
  res.json({ authenticated: false });
});
apiRouter.post("/auth/logout", (req, res) => {
  res.json({ success: true });
});

// server/vercel.ts
var app = express();
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use("/api/admin/publish", express.json({ limit: "5mb" }));
app.use("/admin/publish", express.json({ limit: "5mb" }));
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());
app.use("/api", apiRouter);
app.use(apiRouter);
app.use((req, res) => {
  res.status(404).json({ error: "API route not found" });
});
var vercel_default = app;
export {
  vercel_default as default
};
