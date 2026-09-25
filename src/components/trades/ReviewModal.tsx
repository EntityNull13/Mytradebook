import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { compressImage } from '../../services/image';
import { db } from '../../db/database';
import type { Trade, Plan, TradeReview, FollowedPlan } from '../../types';
import { Upload, X } from 'lucide-react';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  trade: Trade | null;
  plan: Plan | null;
  existingReview?: TradeReview | null;
  onSaved: () => void;
}

export function ReviewModal({
  isOpen,
  onClose,
  trade,
  plan,
  existingReview,
  onSaved,
}: ReviewModalProps) {
  if (!trade || !plan) return null;

  const [followedPlan, setFollowedPlan] = useState<FollowedPlan>(existingReview?.followedPlan || 'YES');
  const [whatHappened, setWhatHappened] = useState(existingReview?.whatHappened || '');
  const [whatWentWell, setWhatWentWell] = useState(existingReview?.whatWentWell || '');
  const [whatCouldImprove, setWhatCouldImprove] = useState(existingReview?.whatCouldImprove || '');
  const [lessonLearned, setLessonLearned] = useState(existingReview?.lessonLearned || '');
  const [notes, setNotes] = useState(existingReview?.notes || '');

  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const compressed = await compressImage(file);
      setScreenshotData(compressed);
    } catch {
      setErrorMsg('Failed to process post-trade screenshot');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let evidenceId = existingReview?.screenshotId;
      if (screenshotData) {
        evidenceId = `ev-review-${Date.now()}`;
        await db.evidence.put({
          id: evidenceId,
          name: `${plan.symbol} After-Trade Review`,
          dataUrl: screenshotData,
          type: 'AFTER_TRADE',
          createdAt: new Date().toISOString(),
        });
      }

      const review: TradeReview = {
        id: existingReview?.id || `rev-${Date.now()}`,
        tradeId: trade.id,
        followedPlan,
        whatHappened: whatHappened.trim() || undefined,
        whatWentWell: whatWentWell.trim() || undefined,
        whatCouldImprove: whatCouldImprove.trim() || undefined,
        lessonLearned: lessonLearned.trim() || undefined,
        notes: notes.trim() || undefined,
        screenshotId: evidenceId,
        createdAt: existingReview?.createdAt || new Date().toISOString(),
      };

      await db.reviews.put(review);
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to save trade review');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Post-Trade Review & Evaluation"
      subtitle={`${plan.symbol} (${plan.direction}) · Realized P&L: $${trade.realizedPnL}`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 text-xs bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg">
            {errorMsg}
          </div>
        )}

        {/* Followed Plan Choice */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
            Did you execute strictly according to your plan? *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['YES', 'PARTIALLY', 'NO'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setFollowedPlan(opt)}
                className={`py-2 text-xs font-mono font-semibold rounded-lg border transition-all ${
                  followedPlan === opt
                    ? opt === 'YES'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : opt === 'PARTIALLY'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">What Happened?</label>
          <textarea
            rows={2}
            value={whatHappened}
            onChange={(e) => setWhatHappened(e.target.value)}
            placeholder="Market behavior, price action delivery, or news during trade execution"
            className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">What Went Well?</label>
            <textarea
              rows={2}
              value={whatWentWell}
              onChange={(e) => setWhatWentWell(e.target.value)}
              placeholder="Disciplined risk, patient entry, good partials..."
              className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">What Could Improve?</label>
            <textarea
              rows={2}
              value={whatCouldImprove}
              onChange={(e) => setWhatCouldImprove(e.target.value)}
              placeholder="Emotional management, early exits, hesitation..."
              className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Key Lesson Learned</label>
          <textarea
            rows={2}
            value={lessonLearned}
            onChange={(e) => setLessonLearned(e.target.value)}
            placeholder="Actionable takeaway for future executions"
            className="w-full bg-zinc-950 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-500 focus:outline-none resize-none"
          />
        </div>

        {/* Screenshot / Evidence */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">
            After-Trade Chart Evidence (Optional)
          </label>
          {screenshotData ? (
            <div className="relative rounded-lg border border-zinc-700 bg-zinc-950 p-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={screenshotData} alt="Review" className="w-10 h-10 object-cover rounded" />
                <span className="text-xs text-zinc-300">Attached after-trade chart</span>
              </div>
              <button
                type="button"
                onClick={() => setScreenshotData(null)}
                className="p-1 text-zinc-400 hover:text-zinc-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 border border-dashed border-zinc-700 rounded-lg p-2.5 hover:border-zinc-500 cursor-pointer bg-zinc-950/60 transition-colors">
              <Upload className="w-4 h-4 text-zinc-400" />
              <span className="text-xs text-zinc-400">
                {isUploading ? 'Compressing...' : 'Upload post-exit chart screenshot'}
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

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg border border-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white rounded-lg transition-colors font-mono"
          >
            Save Review
          </button>
        </div>
      </form>
    </Modal>
  );
}
