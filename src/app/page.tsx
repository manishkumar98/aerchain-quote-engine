'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ComparisonMatrix, LineItemRow, VendorMeta } from '@/components/matrix/ComparisonMatrix';
import { EvidenceDrawer } from '@/components/matrix/EvidenceDrawer';
import { CopilotPane } from '@/components/copilot/CopilotPane';
import { RfxAuthoringModal } from '@/components/rfx/RfxAuthoringModal';
import { InboundEmailSimulator } from '@/components/rfx/InboundEmailSimulator';
import {
  Layers,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Info,
  XCircle,
  Inbox,
  FilePlus,
} from 'lucide-react';
import { formatINR } from '@/lib/formatters';

export default function WorkspacePage() {
  const [matrixData, setMatrixData] = useState<{
    rfx_id: string;
    title: string;
    category: string;
    baseline_currency: string;
    usd_peg_rate: number;
    total_budget_inr: number;
    vendors: VendorMeta[];
    lines: LineItemRow[];
    review_summary: {
      total_quotes: number;
      auto_verified: number;
      mandatory_buyer_review: number;
      buyer_confirmed: number;
      excluded: number;
    };
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Scenario Highlighting State for Copilot Interrogation
  const [highlightMap, setHighlightMap] = useState<Record<string, string> | null>(null);
  const [activeScenarioTitle, setActiveScenarioTitle] = useState<string>('');
  const [disqualifiedVendorIds, setDisqualifiedVendorIds] = useState<string[]>([]);
  const [isCopilotCollapsed, setIsCopilotCollapsed] = useState<boolean>(false);

  // Upstream Conversational RFx Authoring & Inbound Mailbox Modals
  const [isRfxAuthoringOpen, setIsRfxAuthoringOpen] = useState<boolean>(false);
  const [isInboundMailboxOpen, setIsInboundMailboxOpen] = useState<boolean>(false);

  // Fetch unified grid data from GET /api/matrix
  const fetchMatrix = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/matrix');
      if (!res.ok) {
        throw new Error(`Failed to load comparison matrix (HTTP ${res.status})`);
      }
      const data = await res.json();
      setMatrixData(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading matrix');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  // Checkpoint 4: Reset lingering cell click focus while preserving active category filter
  const handleIngestionComplete = useCallback(() => {
    setSelectedQuoteId(null);
    setDrawerOpen(false);
    fetchMatrix();
  }, [fetchMatrix]);

  // Reset to canonical 30-SKU catalog
  const handleResetToDefault = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/rfx/line-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      if (res.ok) {
        await fetchMatrix();
      }
    } catch (err) {
      console.error('Failed to reset catalog:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchMatrix]);

  // Compute live review summary counts dynamically from lines
  const reviewStats = useMemo(() => {
    if (!matrixData?.lines) {
      return { mandatory: 0, confirmed: 0, auto: 0, excluded: 0, total: 0 };
    }

    let mandatory = 0;
    let confirmed = 0;
    let auto = 0;
    let excluded = 0;
    let total = 0;

    for (const line of matrixData.lines) {
      for (const q of Object.values(line.quotes)) {
        total++;
        if (q.review_status === 'MANDATORY_BUYER_REVIEW') mandatory++;
        else if (q.review_status === 'BUYER_CONFIRMED') confirmed++;
        else if (q.review_status === 'AUTO_VERIFIED') auto++;
        else if (q.review_status === 'EXCLUDED' || !q.is_quoted) excluded++;
      }
    }

    return { mandatory, confirmed, auto, excluded, total };
  }, [matrixData?.lines]);

  // Find all quote IDs currently needing mandatory buyer review
  const flaggedQuoteIds = useMemo(() => {
    if (!matrixData?.lines) return [];
    const ids: string[] = [];
    for (const line of matrixData.lines) {
      for (const q of Object.values(line.quotes)) {
        if (q.review_status === 'MANDATORY_BUYER_REVIEW' && q.quote_id) {
          ids.push(q.quote_id);
        }
      }
    }
    return ids;
  }, [matrixData?.lines]);

  // Cycle to next flagged quote in the drawer without closing
  const handleNextFlagged = useCallback(() => {
    if (flaggedQuoteIds.length === 0) return;
    const currentIndex = selectedQuoteId ? flaggedQuoteIds.indexOf(selectedQuoteId) : -1;
    const nextIndex = (currentIndex + 1) % flaggedQuoteIds.length;
    setSelectedQuoteId(flaggedQuoteIds[nextIndex]);
    setDrawerOpen(true);
  }, [flaggedQuoteIds, selectedQuoteId]);

  // Handle opening drawer on quote cell click
  const handleSelectQuote = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    setDrawerOpen(true);
  };

  // Optimistic rate confirmation handler
  const handleConfirmQuote = async (
    quoteId: string,
    confirmedRate?: number,
    reason?: string
  ): Promise<void> => {
    if (!matrixData) return;

    // 1. Snapshot previous state for rollback if server request fails
    const prevLines = matrixData.lines;

    // 2. Optimistically update local state immediately
    const updatedLines = matrixData.lines.map((line) => {
      const updatedQuotes = { ...line.quotes };
      for (const [vendorId, quote] of Object.entries(updatedQuotes)) {
        if (quote.quote_id === quoteId) {
          let newLandedCost = quote.landed_cost_inr;
          let newBaseInr = quote.normalized_base_inr;

          if (confirmedRate !== undefined) {
            newBaseInr = confirmedRate;
            // Apply vendor freight and tooling if applicable
            let freightPct = 0;
            let amortizedTooling = 0;
            if (vendorId === 'VEND-05') freightPct = 0.04;
            if (vendorId === 'VEND-01') amortizedTooling = 25000 / 1458000;
            newLandedCost = confirmedRate * (1 + freightPct) + amortizedTooling;
          }

          updatedQuotes[vendorId] = {
            ...quote,
            review_status: 'BUYER_CONFIRMED',
            normalized_base_inr: newBaseInr,
            landed_cost_inr: newLandedCost,
            flag_reason: null,
          };
        }
      }
      return { ...line, quotes: updatedQuotes };
    });

    setMatrixData({
      ...matrixData,
      lines: updatedLines,
    });

    // 3. Fire API update in the background
    try {
      const res = await fetch(`/api/quotes/${quoteId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed_rate_inr: confirmedRate,
          override_reason: reason,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      // Rollback on failure
      setMatrixData({
        ...matrixData,
        lines: prevLines,
      });
      throw err;
    }
  };

  // Copilot Scenario Handlers (Nuance 3: Drawer state is completely isolated from scenario state)
  const handleApplyScenario = (
    highlights: { line_id: string; winning_vendor_id: string }[],
    scenarioTitle?: string,
    disqualifiedVendors?: string[]
  ) => {
    const map: Record<string, string> = {};
    for (const h of highlights) {
      map[h.line_id] = h.winning_vendor_id;
    }
    setHighlightMap(map);
    setActiveScenarioTitle(scenarioTitle || 'Lowest Cost (ISO Filtered)');
    setDisqualifiedVendorIds(disqualifiedVendors || []);
  };

  const handleClearScenario = () => {
    setHighlightMap(null);
    setActiveScenarioTitle('');
    setDisqualifiedVendorIds([]);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* 1. Top Enterprise Control Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-5 py-3 shadow-sm">
        <div className="max-w-[1800px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Contract Context */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-b from-[#3D05C6] to-[#9937FB] text-white shadow-lg shadow-violet-700/30 font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-extrabold text-white tracking-tight">
                  Aerchain QuoteEngine
                </h1>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-950 text-violet-400 border border-violet-800">
                  {matrixData?.rfx_id || 'RFX-2026-CORR'}
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Corrugated Packaging Annual Procurement ({matrixData?.lines?.length || 0} SKUs)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Total Budget Exposure: <strong className="text-white">{matrixData?.total_budget_inr ? formatINR(matrixData.total_budget_inr) : '₹4.00 Cr'}</strong></span>
                <span>·</span>
                <span>FX Benchmark Peg: <strong className="text-white">₹{matrixData?.usd_peg_rate?.toFixed(2) || '84.00'}/$</strong></span>
                {highlightMap && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                      <Sparkles className="w-3 h-3 text-emerald-400" /> Scenario Active
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Real-time Governance Tally Badges & Nuance 4 Top Nav Active Scenario Banner */}
          <div className="flex items-center gap-2 text-xs">
            {/* Custom Scope Indicator Pill & 1-Click Reset */}
            {matrixData?.lines && matrixData.lines.length !== 30 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-950/80 border border-violet-700/70 text-violet-200 shadow-sm animate-in fade-in">
                <span className="flex items-center gap-1 font-bold text-violet-300 text-[11px]">
                  <Layers className="w-3.5 h-3.5 text-violet-400" /> Custom Scope:
                </span>
                <span className="text-white font-semibold text-[11px]">
                  {matrixData.lines.length} Lines
                </span>
                <button
                  onClick={handleResetToDefault}
                  disabled={loading}
                  className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors font-medium cursor-pointer"
                  title="Restore default 30-SKU canonical catalog"
                >
                  Reset to 30 SKUs
                </button>
              </div>
            )}
            {/* Nuance 4: Clean Scenario Teardown in Top Nav */}
            {highlightMap && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-700/70 text-emerald-200 shadow-md shadow-emerald-950 animate-in fade-in">
                <span className="flex items-center gap-1 font-bold text-emerald-300 text-[11px]">
                  <span>⚡</span> Active Scenario:
                </span>
                <span className="text-white truncate max-w-[200px] font-semibold text-[11px]" title={activeScenarioTitle}>
                  {activeScenarioTitle || 'Lowest Cost (ISO Filtered)'}
                </span>
                <button
                  onClick={handleClearScenario}
                  className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700 transition-colors font-medium"
                  title="Clear active scenario highlighting and restore comparison matrix"
                >
                  ✕ Clear Scenario
                </button>
              </div>
            )}

            {/* Mandatory Reviews Pill */}
            <div
              onClick={() => flaggedQuoteIds.length > 0 && handleSelectQuote(flaggedQuoteIds[0])}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold cursor-pointer transition-all ${
                reviewStats.mandatory > 0
                  ? 'bg-amber-950/40 text-amber-300 border-amber-500/50 hover:bg-amber-900/40 shadow-sm shadow-amber-950'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
              title={
                reviewStats.mandatory > 0
                  ? 'Click to jump to first pending review in Evidence Drawer'
                  : 'All flagged line items have been confirmed'
              }
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${reviewStats.mandatory > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
              <span>{reviewStats.mandatory} Mandatory Reviews</span>
            </div>

            {/* Confirmed Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-800/60 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{reviewStats.confirmed} Confirmed</span>
            </div>

            {/* Auto-Verified Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 font-medium hidden md:flex">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>{reviewStats.auto} Auto-Verified</span>
            </div>

            {/* New RFx Setup Button */}
            <button
              onClick={() => setIsRfxAuthoringOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-md shadow-violet-950 border border-violet-500 transition-all text-xs"
              title="Open Conversational RFx Authoring Co-Pilot"
            >
              <FilePlus className="w-3.5 h-3.5 text-violet-200" />
              <span>New RFx Setup</span>
            </button>

            {/* Inbound Mailbox Simulator Button */}
            <button
              onClick={() => setIsInboundMailboxOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-950/60 hover:bg-violet-900/60 text-violet-200 border border-violet-800/80 font-semibold transition-all text-xs"
              title="Open Inbound Mailbox & Attachment Ingestion Simulator"
            >
              <Inbox className="w-3.5 h-3.5 text-violet-400" />
              <span>Inbound Mailbox</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={fetchMatrix}
              disabled={loading}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh Grid Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-400' : ''}`} />
            </button>

            {/* Copilot Toggle Button */}
            <button
              onClick={() => setIsCopilotCollapsed(!isCopilotCollapsed)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                !isCopilotCollapsed
                  ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-950'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
              }`}
              title="Toggle Procurement Copilot Pane"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-300" />
              <span>Copilot</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Workspace Body: Dual-Pane Split Layout */}
      <div className="flex-1 w-full max-w-[1850px] mx-auto px-4 py-3 flex gap-4 overflow-hidden">
        {/* Left Pane: High-Density Comparison Matrix (with min-w-0 overflow-x-auto wrapper) */}
        <div
          className={`transition-all duration-300 min-w-0 flex flex-col overflow-hidden ${
            isCopilotCollapsed ? 'flex-1' : 'flex-1 lg:max-w-[65%]'
          }`}
        >
          {loading && !matrixData ? (
            <div className="flex flex-col items-center justify-center py-40 text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-violet-400" />
              <p className="text-sm font-medium">Loading Aerchain 30-Line Evaluation Matrix...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-sm">
              <h3 className="font-bold text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" /> Error Loading Comparison Matrix
              </h3>
              <p className="mt-1">{error}</p>
              <button
                onClick={fetchMatrix}
                className="mt-3 px-4 py-1.5 rounded-lg bg-rose-900 text-white font-semibold hover:bg-rose-800 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : matrixData ? (
            <div className="w-full min-w-0 overflow-x-auto">
              <ComparisonMatrix
                vendors={matrixData.vendors}
                lines={matrixData.lines}
                selectedQuoteId={selectedQuoteId}
                onSelectQuote={handleSelectQuote}
                highlightMap={highlightMap || undefined}
                disqualifiedVendorIds={disqualifiedVendorIds}
              />
            </div>
          ) : null}
        </div>

        {/* Right Pane: Natural Language Procurement Copilot */}
        <div
          className={`transition-all duration-300 shrink-0 h-[calc(100vh-80px)] ${
            isCopilotCollapsed ? 'w-12' : 'w-full lg:w-[35%]'
          }`}
        >
          <CopilotPane
            onApplyScenario={handleApplyScenario}
            onClearScenario={handleClearScenario}
            isScenarioActive={!!highlightMap}
            activeScenarioTitle={activeScenarioTitle}
            isCollapsed={isCopilotCollapsed}
            onToggleCollapse={() => setIsCopilotCollapsed(!isCopilotCollapsed)}
          />
        </div>
      </div>

      {/* 3. Slide-over Evidence Drawer */}
      <EvidenceDrawer
        quoteId={selectedQuoteId}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onConfirmQuote={handleConfirmQuote}
        onNextFlagged={handleNextFlagged}
        hasMoreFlagged={flaggedQuoteIds.length > 0}
      />

      {/* 4. Upstream Sourcing Modals */}
      <RfxAuthoringModal
        isOpen={isRfxAuthoringOpen}
        onClose={() => setIsRfxAuthoringOpen(false)}
        onDispatched={handleIngestionComplete}
      />

      <InboundEmailSimulator
        isOpen={isInboundMailboxOpen}
        onClose={() => setIsInboundMailboxOpen(false)}
        onIngestionComplete={handleIngestionComplete}
      />
    </main>
  );
}
