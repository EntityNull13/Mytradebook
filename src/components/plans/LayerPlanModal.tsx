import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { db } from '../../db/database';
import type { Account, TradeDirection, Plan } from '../../types';
import { Layers, Plus, Trash2 } from 'lucide-react';

interface LayerPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onSaved: () => void;
}

interface LayerItem {
  id: string;
  name: string;
  plannedEntry: string;
  positionSize: string;
  sl: string;
  tp: string;
}

export function LayerPlanModal({
  isOpen,
  onClose,
  accounts,
  onSaved,
}: LayerPlanModalProps) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<TradeDirection | ''>('');
  const [groupName, setGroupName] = useState('');
  
  const [layers, setLayers] = useState<LayerItem[]>([
    { id: '1', name: 'Layer 1 (Primary)', plannedEntry: '', positionSize: '', sl: '', tp: '' },
    { id: '2', name: 'Layer 2 (Dip/Pullback)', plannedEntry: '', positionSize: '', sl: '', tp: '' },
  ]);

  const [errorMsg, setErrorMsg] = useState('');

  const addLayer = () => {
    const nextIdx = layers.length + 1;
    setLayers([
      ...layers,
      {
        id: String(Date.now()),
        name: `Layer ${nextIdx}`,
        plannedEntry: '',
        positionSize: '',
        sl: layers[0]?.sl || '',
        tp: layers[0]?.tp || '',
      },
    ]);
  };

  const removeLayer = (index: number) => {
    if (layers.length <= 1) return;
    setLayers(layers.filter((_, i) => i !== index));
  };

  const updateLayer = (index: number, field: keyof LayerItem, val: string) => {
    const updated = [...layers];
    updated[index] = { ...updated[index], [field]: val };
    setLayers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!accountId) {
      setErrorMsg('Please select an account');
      return;
    }
    if (!symbol.trim()) {
      setErrorMsg('Please specify symbol');
      return;
    }
    if (!direction) {
      setErrorMsg('Please select trade direction (BUY or SELL)');
      return;
    }

    // Validate entries
    for (let i = 0; i < layers.length; i++) {
      const entry = parseFloat(layers[i].plannedEntry);
      if (isNaN(entry) || entry <= 0) {
        setErrorMsg(`Please enter valid planned entry for ${layers[i].name}`);
        return;
      }
    }

    try {
      const groupId = `group-${Date.now()}`;
      const now = new Date().toISOString();

      await db.planGroups.put({
        id: groupId,
        name: groupName.trim() || `${symbol} Layers`,
        symbol: symbol.toUpperCase().trim(),
        createdAt: now,
      });

      const plansToAdd: Plan[] = layers.map((layer, idx) => ({
        id: `plan-${Date.now()}-${idx}`,
        planGroupId: groupId,
        accountId,
        symbol: symbol.toUpperCase().trim(),
        direction: direction as TradeDirection,
        plannedEntry: parseFloat(layer.plannedEntry),
        sl: layer.sl ? parseFloat(layer.sl) : undefined,
        tp: layer.tp ? parseFloat(layer.tp) : undefined,
        positionSize: layer.positionSize ? parseFloat(layer.positionSize) : undefined,
        notes: `${layer.name} in group ${groupName}`,
        status: 'PLANNED',
        createdAt: now,
        updatedAt: now,
      }));

      await db.plans.bulkAdd(plansToAdd);
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to create layer group. Existing data safe.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Layered Plan Group"
      subtitle="Define multiple independent entry orders under one strategy group"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <div className="p-3 text-xs bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg">
            {errorMsg}
          </div>
        )}

        {/* Global Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Account *</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-200 text-xs px-2.5 py-1.5 rounded border border-zinc-800"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-200 text-xs px-2.5 py-1.5 rounded border border-zinc-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Symbol *</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-200 text-xs font-mono px-2.5 py-1.5 rounded border border-zinc-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Direction</label>
            <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-0.5 rounded border border-zinc-800">
              <button
                type="button"
                onClick={() => setDirection('BUY')}
                className={`py-1 text-xs font-mono font-semibold rounded ${
                  direction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400'
                }`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => setDirection('SELL')}
                className={`py-1 text-xs font-mono font-semibold rounded ${
                  direction === 'SELL' ? 'bg-rose-500/20 text-rose-400' : 'text-zinc-400'
                }`}
              >
                SELL
              </button>
            </div>
          </div>
        </div>

        {/* Layer list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-zinc-400" />
              <span>Layers ({layers.length})</span>
            </span>
            <button
              type="button"
              onClick={addLayer}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-300 hover:text-white px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Layer</span>
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {layers.map((layer, idx) => (
              <div
                key={layer.id}
                className="grid grid-cols-12 gap-2 p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800/80 items-center text-xs"
              >
                <div className="col-span-3">
                  <input
                    type="text"
                    value={layer.name}
                    onChange={(e) => updateLayer(idx, 'name', e.target.value)}
                    placeholder="Layer Label"
                    className="w-full bg-zinc-900 text-zinc-300 px-2 py-1 rounded border border-zinc-800 font-mono text-xs"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    step="any"
                    value={layer.plannedEntry}
                    onChange={(e) => updateLayer(idx, 'plannedEntry', e.target.value)}
                    placeholder="Entry Price *"
                    required
                    className="w-full bg-zinc-900 text-zinc-200 px-2 py-1 rounded border border-zinc-800 font-mono text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    step="any"
                    value={layer.positionSize}
                    onChange={(e) => updateLayer(idx, 'positionSize', e.target.value)}
                    placeholder="Size"
                    className="w-full bg-zinc-900 text-zinc-200 px-2 py-1 rounded border border-zinc-800 font-mono text-xs"
                  />
                </div>
                <div className="col-span-3 grid grid-cols-2 gap-1">
                  <input
                    type="number"
                    step="any"
                    value={layer.sl}
                    onChange={(e) => updateLayer(idx, 'sl', e.target.value)}
                    placeholder="SL"
                    className="w-full bg-zinc-900 text-zinc-300 px-2 py-1 rounded border border-zinc-800 font-mono text-xs"
                  />
                  <input
                    type="number"
                    step="any"
                    value={layer.tp}
                    onChange={(e) => updateLayer(idx, 'tp', e.target.value)}
                    placeholder="TP"
                    className="w-full bg-zinc-900 text-zinc-300 px-2 py-1 rounded border border-zinc-800 font-mono text-xs"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  {layers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLayer(idx)}
                      className="p-1 text-zinc-500 hover:text-rose-400 rounded transition-colors"
                      title="Delete layer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
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
            className="px-5 py-2 text-xs font-medium text-zinc-950 bg-zinc-100 hover:bg-white rounded-lg transition-colors font-mono font-semibold"
          >
            Create {layers.length} Layers
          </button>
        </div>
      </form>
    </Modal>
  );
}
