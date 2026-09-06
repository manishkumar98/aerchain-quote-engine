'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  X,
  CheckCircle2,
  FileSpreadsheet,
  ShieldCheck,
  Package,
  Layers,
  Clock,
  Loader2,
  ArrowRight,
  Mail,
} from 'lucide-react';
import { formatINR } from '@/lib/formatters';

interface RfxAuthoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDispatched?: () => void;
}

const PRESET_CHIPS = [
  'Draft annual contract for 30 corrugated packaging SKUs with ₹4.0 Cr budget, ISO 9001 gate, Net 60 terms.',
  'Create sourcing RFx for e-commerce mailers and 5-ply cartons with sustainable FSC criteria and ₹3.8 Cr target.',
];

export const RfxAuthoringModal: React.FC<RfxAuthoringModalProps> = ({
  isOpen,
  onClose,
  onDispatched,
}) => {
  const [prompt, setPrompt] = useState(PRESET_CHIPS[0]);
  const [generating, setGenerating] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [specification, setSpecification] = useState<any | null>(null);
  const [dispatchResult, setDispatchResult] = useState<any | null>(null);
  const [parsedLineItems, setParsedLineItems] = useState<any[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setDispatchResult(null);
    setApplySuccess(false);

    try {
      const res = await fetch('/api/rfx/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate specification');
      setSpecification(data.specification);
      if (data.parsed_line_items && data.parsed_line_items.length > 0) {
        setParsedLineItems(data.parsed_line_items);
      } else {
        setParsedLineItems(null);
      }
    } catch (err: any) {
      setError(err.message || 'Generation error');
    } finally {
      setGenerating(false);
    }
  };

  const handleApplyLineItems = async () => {
    if (!parsedLineItems || parsedLineItems.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch('/api/rfx/line-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_items: parsedLineItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply line items');
      setApplySuccess(true);
      if (onDispatched) onDispatched();
    } catch (err: any) {
      setError(err.message || 'Failed to apply line items');
    } finally {
      setApplying(false);
    }
  };

  const handleResetCatalog = async () => {
    setResetting(true);
    setError(null);
    try {
      const res = await fetch('/api/rfx/line-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset catalog');
      setParsedLineItems(null);
      setSpecification(null);
      setApplySuccess(false);
      if (onDispatched) onDispatched();
    } catch (err: any) {
      setError(err.message || 'Failed to reset catalog');
    } finally {
      setResetting(false);
    }
  };

  const handleDispatch = async () => {
    setDispatching(true);
    setError(null);

    try {
      if (parsedLineItems && parsedLineItems.length > 0) {
        await fetch('/api/rfx/line-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ line_items: parsedLineItems }),
        });
      }

      const res = await fetch('/api/rfx/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfx_id: specification?.rfx_id || 'RFX-2026-CORR' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch RFx');
      setDispatchResult(data);
      if (onDispatched) onDispatched();
    } catch (err: any) {
      setError(err.message || 'Dispatch error');
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Conversational RFx Authoring Co-Pilot
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  AI-Powered
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Describe packaging requirements to generate structured specifications and dispatch tokenized supplier invites.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Prompt Input Section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Buyer Sourcing Instructions</span>
              <span className="text-[11px] text-slate-500 font-normal">Supports natural language scope & commercial parameters</span>
            </label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="e.g. Draft an annual contract for 30 packaging SKUs with ₹4.0 Cr budget and ISO 9001 mandatory gate..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none font-sans"
              />
            </div>

            {/* Prompt Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[11px] text-slate-400 self-center">Quick Prompts:</span>
              {PRESET_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => setPrompt(chip)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors text-left"
                >
                  {chip}
                </button>
              ))}
              <button
                onClick={handleResetCatalog}
                disabled={resetting}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-violet-950/70 hover:bg-violet-900/70 text-violet-300 hover:text-white border border-violet-800 transition-colors flex items-center gap-1 font-medium ml-auto"
                title="Reset database back to the 30 canonical packaging SKUs"
              >
                {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                <span>{resetting ? 'Restoring...' : '🔄 Restore 30 Default SKUs'}</span>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 text-white text-xs font-semibold shadow-lg shadow-violet-950 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-violet-200" />
                    <span>Synthesizing RFx Specification...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-violet-200" />
                    <span>Generate Structured RFx</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Generated Specification Preview */}
          {specification && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{specification.title}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800">
                        {specification.rfx_id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Category: <strong className="text-slate-200">{specification.category}</strong> · Baseline: <strong className="text-slate-200">{specification.baseline_currency}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Total Target Budget</span>
                    <p className="text-base font-black text-emerald-400 font-mono">
                      {formatINR(specification.total_target_budget_inr)}
                    </p>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <Package className="w-3 h-3 text-violet-400" /> Basket Volume
                    </span>
                    <p className="text-xs font-bold text-white font-mono mt-0.5">
                      {specification.total_basket_volume.toLocaleString()} units
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <Layers className="w-3 h-3 text-violet-400" /> Line Items
                    </span>
                    <p className="text-xs font-bold text-white font-mono mt-0.5">
                      {specification.custom_lines_count || 30} Packaging SKUs
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" /> Payment Terms
                    </span>
                    <p className="text-xs font-bold text-white font-mono mt-0.5">
                      {specification.payment_terms}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" /> Mandatory Gate
                    </span>
                    <p className="text-xs font-bold text-emerald-300 font-mono mt-0.5">
                      ISO 9001:2015
                    </p>
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="space-y-1.5 pt-2">
                  <h4 className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    Specification Category Breakdown
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {specification.spec_categories.map((cat: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-semibold text-white">{cat.category}</span>
                          <span className="text-[10px] text-slate-400 block">{cat.description}</span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-bold text-slate-200">{cat.lines_count} lines</span>
                          <span className="text-[10px] text-slate-500 block">{cat.target_volume.toLocaleString()} pcs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Extracted Custom Line Items Catalog Table & Overwrite Action */}
                {parsedLineItems && parsedLineItems.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-slate-800 animate-in fade-in duration-300">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-emerald-400" />
                          Parsed Line Items Catalog ({parsedLineItems.length} SKUs)
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                          Ready to Overwrite
                        </span>
                      </div>
                      <button
                        onClick={handleApplyLineItems}
                        disabled={applying}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-950 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                      >
                        {applying ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Overwriting Matrix...</span>
                          </>
                        ) : applySuccess ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                            <span>Overwrote Matrix with {parsedLineItems.length} Lines!</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Apply & Overwrite Matrix ({parsedLineItems.length} Lines)</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80">
                      <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead className="sticky top-0 bg-slate-900 text-[10px] uppercase text-slate-400 font-semibold border-b border-slate-800">
                          <tr>
                            <th className="py-2 px-3">ID</th>
                            <th className="py-2 px-3">SKU Description</th>
                            <th className="py-2 px-3">Category</th>
                            <th className="py-2 px-3">Dimensions</th>
                            <th className="py-2 px-3 text-right">Weight</th>
                            <th className="py-2 px-3 text-right">Volume</th>
                            <th className="py-2 px-3 text-right">Benchmark</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                          {parsedLineItems.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                              <td className="py-2 px-3 font-bold text-violet-400">{item.id}</td>
                              <td className="py-2 px-3 font-sans text-slate-200 font-medium">{item.sku_name}</td>
                              <td className="py-2 px-3 font-sans text-slate-400">{item.spec_category}</td>
                              <td className="py-2 px-3 text-slate-300">{item.dimensions}</td>
                              <td className="py-2 px-3 text-right text-slate-300">{item.spec_weight_kg} kg</td>
                              <td className="py-2 px-3 text-right text-white font-bold">{item.target_volume.toLocaleString()}</td>
                              <td className="py-2 px-3 text-right text-emerald-400 font-bold">₹{parseFloat(item.baseline_benchmark_price).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Compliance Questionnaire Criteria */}
                <div className="space-y-1.5 pt-2">
                  <h4 className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    Vendor Evaluation Gates
                  </h4>
                  <div className="space-y-1.5">
                    {specification.questionnaire_criteria.map((q: any) => (
                      <div key={q.id} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {q.mandatory ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 text-[10px] font-bold border border-rose-800">
                              MANDATORY GATE
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-medium border border-slate-700">
                              OPTIONAL
                            </span>
                          )}
                          <span className="text-slate-200 font-medium">{q.name}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">{q.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Asymmetric Outbound Email Dispatch Preview */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-950 to-violet-950/40 border border-violet-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-violet-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Asymmetric Tokenized Email Dispatch Routes
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400">5 Target Suppliers Registered</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-200">VEND-01: Packaging World</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                        Excel
                      </span>
                    </div>
                    <span className="text-[11px] text-violet-300 font-mono block mt-0.5">
                      Reply-To: rfx-corr-2026-v1@ingest.aerchain.ai
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-200">VEND-02: Apex Cartons</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                        Angled Photo
                      </span>
                    </div>
                    <span className="text-[11px] text-violet-300 font-mono block mt-0.5">
                      Reply-To: rfx-corr-2026-v2@ingest.aerchain.ai
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-200">VEND-03: National Paper</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-mono">
                        Partial Word (ISO Fail)
                      </span>
                    </div>
                    <span className="text-[11px] text-violet-300 font-mono block mt-0.5">
                      Reply-To: rfx-corr-2026-v3@ingest.aerchain.ai
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-200">VEND-04: Global Packaging</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800 font-mono">
                        USD PDF
                      </span>
                    </div>
                    <span className="text-[11px] text-violet-300 font-mono block mt-0.5">
                      Reply-To: rfx-corr-2026-v4@ingest.aerchain.ai
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 md:col-span-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-200">VEND-05: Balaji Traders</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                        Freeform Email
                      </span>
                    </div>
                    <span className="text-[11px] text-violet-300 font-mono block mt-0.5">
                      Reply-To: rfx-corr-2026-v5@ingest.aerchain.ai
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-400">
                    Simulates outbound transmission via Aerchain Asymmetric Mail Router
                  </span>
                  <button
                    onClick={handleDispatch}
                    disabled={dispatching || !!dispatchResult}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-950/60 disabled:text-emerald-400/60 text-white text-xs font-bold shadow-lg shadow-emerald-950 transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    {dispatching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Dispatching Outbound Invitations...</span>
                      </>
                    ) : dispatchResult ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        <span>Dispatched to 5 Vendors!</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Dispatch RFx via Email</span>
                      </>
                    )}
                  </button>
                </div>

                {dispatchResult && (
                  <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between">
                    <span>
                      ✅ RFx package successfully transmitted to 5 supplier inboxes with unique cryptographic reply tokens!
                    </span>
                    <button
                      onClick={onClose}
                      className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-medium border border-slate-700"
                    >
                      Close & View Workspace
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
