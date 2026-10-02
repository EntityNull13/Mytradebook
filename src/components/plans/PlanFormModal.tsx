import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { processEvidenceImage, type ImageProcessResult } from '../../services/image';
import { db } from '../../db/database';
import type { Plan, Account, Setup, TradeDirection } from '../../types';
import { Upload, X } from 'lucide-react';

interface PlanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  setups: Setup[];
  initialPlan?: Plan | null;
  onSaved: () => void;
}

export function PlanFormModal({
  isOpen,
  onClose,
  accounts,
  setups,
  initialPlan,
  onSaved,
}: PlanFormModalProps) {
  const defaultAccount = accounts[0]?.id || '';

  const [accountId, setAccountId] = useState(initialPlan?.accountId || defaultAccount);
  const [symbol, setSymbol] = useState(initialPlan?.symbol || '');
  const [direction, setDirection] = useState<TradeDirection | ''>(initialPlan?.direction || '');
  const [plannedEntry, setPlannedEntry] = useState(initialPlan?.plannedEntry?.toString() || '');
  
  // Risk plan (optional)
  const [sl, setSl] = useState(initialPlan?.sl?.toString() || '');
  const [tp, setTp] = useState(initialPlan?.tp?.toString() || '');
  const [positionSize, setPositionSize] = useState(initialPlan?.positionSize?.toString() || '');
  const [risk, setRisk] = useState(initialPlan?.risk?.toString() || '');

  // Setup & analysis (optional)
  const [setupId, setSetupId] = useState(initialPlan?.setupId || '');
  const [timeframe, setTimeframe] = useState(initialPlan?.timeframe || '');
  const [marketBias, setMarketBias] = useState<'BULLISH' | 'BEARISH' | 'NEUTRAL' | ''>(initialPlan?.marketBias || '');
  const [entryReason, setEntryReason] = useState(initialPlan?.entryReason || '');
  const [confidence, setConfidence] = useState<number | undefined>(initialPlan?.confidence);
  const [notes, setNotes] = useState(initialPlan?.notes || '');

  // Screenshot / Evidence
  const [processedEvidence, setProcessedEvidence] = useState<ImageProcessResult | null>(null);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      setErrorMsg('');
      const processed = await processEvidenceImage(file);
      setProcessedEvidence(processed);
      setScreenshotData(processed.dataUrl);
      setScreenshotName(processed.fileName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process screenshot';
      setErrorMsg(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!accountId) {
      setErrorMsg('Please select an account');
      return;
    }
    if (!symbol.trim()) {
      setErrorMsg('Please enter a trading symbol');
      return;
    }
    if (!direction) {
      setErrorMsg('Please select a trade direction (BUY or SELL)');
      return;
    }
    const parsedEntry = parseFloat(plannedEntry);
    if (isNaN(parsedEntry) || parsedEntry <= 0) {
      setErrorMsg('Please enter a valid planned entry price');
      return;
    }

    try {
      const planId = initialPlan?.id || `plan-${Date.now()}`;
      let evidenceId: string | undefined = initialPlan?.screenshotId;

      if (screenshotData) {
        evidenceId = `ev-${Date.now()}`;
        await db.evidence.put({
          id: evidenceId,
          name: screenshotName || `${symbol} Plan Analysis`,
          dataUrl: screenshotData,
          type: 'BEFORE_ENTRY',
          planId,
          fileName: processedEvidence?.fileName || screenshotName,
          fileSize: processedEvidence?.fileSize,
          mimeType: processedEvidence?.mimeType || 'image/jpeg',
          createdAt: new Date().toISOString(),
        });
      }

      const now = new Date().toISOString();
      const planData: Plan = {
        id: planId,
        planGroupId: initialPlan?.planGroupId,
        accountId,
        symbol: symbol.toUpperCase().trim(),
        direction: direction as TradeDirection,
        plannedEntry: parsedEntry,
        sl: sl ? parseFloat(sl) : undefined,
        tp: tp ? parseFloat(tp) : undefined,
        positionSize: positionSize ? parseFloat(positionSize) : undefined,
        risk: risk ? parseFloat(risk) : undefined,
        setupId: setupId || undefined,
        timeframe: timeframe.trim() || undefined,
        marketBias: (marketBias as 'BULLISH' | 'BEARISH' | 'NEUTRAL') || undefined,
        entryReason: entryReason.trim() || undefined,
        confidence: confidence || undefined,
        notes: notes.trim() || undefined,
        screenshotId: evidenceId,
        status: initialPlan?.status || 'PLANNED',
        invalidReason: initialPlan?.invalidReason,
        notTriggeredReason: initialPlan?.notTriggeredReason,
        duplicatedFromPlanId: initialPlan?.duplicatedFromPlanId,
        createdAt: initialPlan?.createdAt || now,
        updatedAt: now,
      };

      await db.plans.put(planData);
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('The journal could not save this change. Your existing data has not been deleted.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialPlan ? 'Edit Trading Plan' : 'New Trading Plan'}
      subtitle="Define your parameters clearly prior to execution"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMsg && (
          <div className="p-3 text-xs bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg">
            {errorMsg}
          </div>
        )}

        {/* Section 1: Basic (Required) */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
            <span>1. Basic Setup</span>
            <span className="text-[10px] text-zinc-500 lowercase">(Required)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Account *</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Symbol *</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="e.g. XAUUSD, EURUSD"
                required
                className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Direction *</label>
              <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setDirection('BUY')}
                  className={`py-1 text-xs font-mono font-semibold rounded ${
                    direction === 'BUY'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('SELL')}
                  className={`py-1 text-xs font-mono font-semibold rounded ${
                    direction === 'SELL'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  SELL
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Planned Entry *</label>
              <input
                type="number"
                step="any"
                value={plannedEntry}
                onChange={(e) => setPlannedEntry(e.target.value)}
                placeholder="0.00"
                required
                className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Risk Plan (Optional) */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
            2. Risk & Target Plan
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Stop Loss (SL)</label>
              <input
                type="number"
                step="any"
                value={sl}
                onChange={(e) => setSl(e.target.value)}
                placeholder="Optional SL"
                className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Take Profit (TP)</label>
              <input
                type="number"
                step="any"
                value={tp}
                onChange={(e) => setTp(e.target.value)}
                placeholder="Optional TP"
                className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Planned Size</label>
              <input
                type="number"
                step="any"
                value={positionSize}
                onChange={(e) => setPositionSize(e.target.value)}
                placeholder="e.g. 1.0"
                className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Risk Amount ({accounts.find((a) => a.id === accountId)?.currency || 'USD'})
              </label>
              <input
                type="number"
                step="any"
                value={risk}
                onChange={(e) => setRisk(e.target.value)}
                placeholder="e.g. 500"
                className="w-full bg-zinc-950 text-zinc-200 text-xs font-mono px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Setup & Market Context */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
            3. Setup & Confluence
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Strategy / Setup</label>
              <select
                value={setupId}
                onChange={(e) => setSetupId(e.target.value)}
                className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
              >
                <option value="">Select setup (optional)</option>
                {setups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Timeframe</label>
              <input
                type="text"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                placeholder="e.g. M15, H1, H4"
                className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Market Bias</label>
              <select
                value={marketBias}
                onChange={(e) => setMarketBias(e.target.value as 'BULLISH' | 'BEARISH' | 'NEUTRAL' | '')}
                className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none"
              >
                <option value="">Select market bias (optional)</option>
                <option value="BULLISH">Bullish</option>
                <option value="BEARISH">Bearish</option>
                <option value="NEUTRAL">Neutral / Range</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Confidence Level (Optional 1-5)
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setConfidence(confidence === lvl ? undefined : lvl)}
                    className={`flex-1 py-1.5 rounded text-xs font-mono font-medium transition-colors ${
                      confidence === lvl
                        ? 'bg-zinc-100 text-zinc-950 font-bold'
                        : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {lvl}★
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Entry Reason & Logic</label>
            <textarea
              rows={2}
              value={entryReason}
              onChange={(e) => setEntryReason(e.target.value)}
              placeholder="What specific triggers, liquidity sweeps, or structural shifts justify this entry?"
              className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Section 4: Screenshot Evidence & Notes */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
            4. Chart Evidence & Notes
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Attach Screenshot (Documentation only)
              </label>
              {screenshotData ? (
                <div className="relative rounded-lg border border-zinc-700 bg-zinc-950 p-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <img src={screenshotData} alt="Preview" className="w-10 h-10 object-cover rounded" />
                    <span className="text-xs text-zinc-300 truncate">{screenshotName || 'Attached chart'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setScreenshotData(null);
                      setScreenshotName('');
                    }}
                    className="p-1 text-zinc-400 hover:text-zinc-100 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border border-dashed border-zinc-700 rounded-lg p-3 hover:border-zinc-500 cursor-pointer bg-zinc-950/60 transition-colors">
                  <Upload className="w-5 h-5 text-zinc-400 mb-1" />
                  <span className="text-xs text-zinc-400">
                    {isUploading ? 'Compressing...' : 'Upload chart screenshot'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Execution Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or invalidation criteria"
                className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg border border-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-medium text-zinc-950 bg-zinc-100 hover:bg-white rounded-lg transition-colors font-mono font-semibold"
          >
            {initialPlan ? 'Update Plan' : 'Save Plan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
