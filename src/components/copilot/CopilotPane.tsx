'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Layers,
  DollarSign,
  TrendingDown,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  XCircle,
  Eye,
  FileSpreadsheet,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { formatINR, formatINRExecutive } from '@/lib/formatters';

export interface ScenarioMetrics {
  total_spend_inr: number;
  baseline_spend_inr: number;
  savings_vs_baseline_inr: number;
  savings_vs_baseline_pct: number;
  savings_vs_single_source_inr?: number;
  best_single_source_vendor?: string;
  best_single_source_spend_inr?: number;
  award_distribution: {
    vendor_id: string;
    vendor_name: string;
    inbound_modality: string;
    lines_won: number;
    allocated_spend_inr: number;
    share_of_total_pct: number;
  }[];
  disqualified_vendors?: {
    vendor_id: string;
    vendor_name: string;
    reason: string;
    audit_score_pct: number;
  }[];
}

export interface CopilotMessage {
  id: string;
  sender: 'USER' | 'COPILOT';
  text: string;
  timestamp: string;
  queryAst?: any;
  scenarioMetrics?: ScenarioMetrics;
  highlightCells?: { line_id: string; winning_vendor_id: string }[];
  summaryMarkdown?: string;
  fxSensitivityDetails?: any;
  is_fallback?: boolean;
}

interface CopilotPaneProps {
  onApplyScenario: (
    highlights: { line_id: string; winning_vendor_id: string }[],
    scenarioTitle?: string,
    disqualifiedVendors?: string[]
  ) => void;
  onClearScenario: () => void;
  isScenarioActive: boolean;
  activeScenarioTitle?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const QUICK_PROMPTS = [
  'Split cheapest per line, excluding failed quality questionnaire',
  'Identify hidden ancillary fees across all vendors',
  'Compare landed spend if USD strengthens to 87.00 INR',
  'Who is the cheapest single-source vendor across all lines?',
];

const getFormattedTime = () => {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

export function CopilotPane({
  onApplyScenario,
  onClearScenario,
  isScenarioActive,
  activeScenarioTitle,
  isCollapsed,
  onToggleCollapse,
}: CopilotPaneProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      sender: 'COPILOT',
      text: 'I am the Aerchain Enterprise Sourcing Copilot. All scenario computations, split-awards, and landed cost recalculations execute deterministically via SQL/TS solvers with zero token arithmetic drift.\n\nAsk any scenario interrogation or pick a standard audit prompt below.',
      timestamp: 'System',
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Populate client local time post-hydration
    setMessages((prev) =>
      prev.map((m) => (m.id === 'welcome' ? { ...m, timestamp: getFormattedTime() } : m))
    );
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendQuery = async (queryText: string) => {
    if (!queryText.trim() || loading) return;

    const userMsg: CopilotMessage = {
      id: `usr-${Date.now()}`,
      sender: 'USER',
      text: queryText,
      timestamp: getFormattedTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/copilot/interrogate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      const copilotMsg: CopilotMessage = {
        id: `cop-${Date.now()}`,
        sender: 'COPILOT',
        text: data.summary_markdown || 'Scenario analyzed successfully.',
        timestamp: getFormattedTime(),
        queryAst: data.query_ast,
        scenarioMetrics: data.scenario_metrics,
        highlightCells: data.highlight_cells,
        summaryMarkdown: data.summary_markdown,
        fxSensitivityDetails: data.fx_sensitivity_details,
        is_fallback: data.is_fallback,
      };

      setMessages((prev) => [...prev, copilotMsg]);

      // Automatically apply scenario highlights and disqualified vendors to the matrix
      const disqIds = data.scenario_metrics?.disqualified_vendors?.map((d: any) => d.vendor_id) || [];
      if (data.highlight_cells && data.highlight_cells.length > 0) {
        onApplyScenario(data.highlight_cells, queryText, disqIds);
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg: CopilotMessage = {
        id: `err-${Date.now()}`,
        sender: 'COPILOT',
        text: `⚠️ **Interrogation Error:** ${err.message || 'Unable to execute scenario.'}`,
        timestamp: getFormattedTime(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Minimal Collapsed Tab Bar
  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-slate-900 border-l border-slate-800 flex flex-col items-center py-4 justify-between select-none">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg bg-violet-950/80 text-violet-400 border border-violet-800 hover:bg-violet-900 transition-colors"
          title="Expand Procurement Copilot (35% Width)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="rotate-90 origin-center text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 whitespace-nowrap">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span>Procurement Copilot</span>
        </div>

        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden text-slate-100">
      {/* 1. Header */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">Procurement Copilot</h2>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                0 LLM Arithmetic
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Deterministic scenario solver & legally defensible awards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isScenarioActive && (
            <button
              onClick={onClearScenario}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-800 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 transition-colors"
              title="Clear active highlights and restore matrix"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear</span>
            </button>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Collapse Copilot Pane (Maximize Matrix View)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Active Scenario Indicator */}
      {isScenarioActive && (
        <div className="px-4 py-2 bg-emerald-950/50 border-b border-emerald-800/50 flex items-center justify-between text-xs text-emerald-300 animate-in fade-in duration-200">
          <span className="flex items-center gap-1.5 font-medium truncate max-w-[280px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            Active Matrix Highlighting: <span className="text-white italic">"{activeScenarioTitle}"</span>
          </span>
          <button
            onClick={onClearScenario}
            className="text-[11px] font-mono text-emerald-400 underline hover:text-white ml-2"
          >
            Reset Matrix
          </button>
        </div>
      )}

      {/* 2.5 Pinned Question Guide */}
      <div className="border-b border-slate-800 shrink-0">
        <button
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="w-full flex items-center justify-between px-4 py-2 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 transition-colors"
        >
          <div className="flex items-center gap-1.5 font-semibold text-amber-400">
            💡 Questions Copilot Can Answer
          </div>
          {isGuideOpen ? <ChevronLeft className="w-4 h-4 -rotate-90" /> : <ChevronRight className="w-4 h-4 rotate-90" />}
        </button>
        {isGuideOpen && (
          <div className="px-4 py-3 bg-slate-950 text-xs space-y-3 shadow-inner overflow-y-auto max-h-[30vh]">
            <div>
              <h4 className="font-bold text-slate-400 mb-1.5">🏆 Award & Allocation</h4>
              <div className="flex flex-col gap-1.5 items-start">
                <button onClick={() => handleSendQuery('Split cheapest per line, excluding failed quality questionnaire')} className="text-left px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors w-full">Split cheapest per line, excluding failed quality questionnaire</button>
                <button onClick={() => handleSendQuery('Who is the cheapest single-source vendor across all lines?')} className="text-left px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors w-full">Who is the cheapest single-source vendor across all lines?</button>
                <button onClick={() => handleSendQuery('Award each packaging category to a single best vendor')} className="text-left px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors w-full">Award each packaging category to a single best vendor</button>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-400 mb-1.5">🛡️ Vendor Coverage & Compliance</h4>
              <div className="flex flex-col gap-1.5 items-start">
                <button onClick={() => handleSendQuery('Is Vendor 3 providing all materials?')} className="text-left px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors w-full">Is Vendor 3 providing all materials?</button>
                <button onClick={() => handleSendQuery('Which vendors failed the mandatory ISO 9001 quality audit?')} className="text-left px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors w-full">Which vendors failed the mandatory ISO 9001 quality audit?</button>
                <button onClick={() => handleSendQuery('Which vendors deviated from our baseline Net 60 commercial terms?')} className="text-left px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors w-full">Which vendors deviated from our baseline Net 60 commercial terms?</button>
                <button onClick={() => handleSendQuery('Which vendors quoted ex-works versus delivered (DDP)?')} className="text-left px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors w-full">Which vendors quoted ex-works versus delivered (DDP)?</button>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-400 mb-1.5">🔍 Hidden Fees & Normalization</h4>
              <div className="flex flex-col gap-1.5 items-start">
                <button onClick={() => handleSendQuery('Identify all hidden ancillary fees and surcharges across all suppliers')} className="text-left px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors w-full">Identify all hidden ancillary fees and surcharges across all suppliers</button>
                <button onClick={() => handleSendQuery('How much does Vendor 1\'s one-time tooling charge add to the per-box price?')} className="text-left px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors w-full">How much does Vendor 1's one-time tooling charge add to the per-box price?</button>
                <button onClick={() => handleSendQuery('How was Vendor 2\'s rate for PKG-001 normalized from the photo scan?')} className="text-left px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors w-full">How was Vendor 2's rate for PKG-001 normalized from the photo scan?</button>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-400 mb-1.5">📈 Macro & Currency Sensitivity</h4>
              <div className="flex flex-col gap-1.5 items-start">
                <button onClick={() => handleSendQuery('Compare landed spend if USD strengthens to 87.00 INR')} className="text-left px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors w-full">Compare landed spend if USD strengthens to 87.00 INR</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Messages Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'USER' ? 'items-end' : 'items-start'
            }`}
          >
            {/* Sender Label */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
              <span className="font-semibold">
                {msg.sender === 'USER' ? 'You (Category Buyer)' : 'Aerchain Copilot'}
              </span>
              <span suppressHydrationWarning>· {msg.timestamp}</span>
              {msg.queryAst && (
                <span className="font-mono text-[9px] px-1 rounded bg-violet-950 text-violet-300 border border-violet-800">
                  {msg.queryAst.intent}
                </span>
              )}
            </div>

            {/* Bubble Content */}
            <div
              className={`rounded-2xl p-3.5 text-xs max-w-[95%] space-y-3 leading-relaxed shadow-lg ${
                msg.sender === 'USER'
                  ? 'bg-violet-600 text-white rounded-br-xs'
                  : 'bg-slate-950 border border-slate-800/90 text-slate-200 rounded-bl-xs'
              }`}
            >
              {/* Scenario Metrics Cards (If Present) */}
              {msg.scenarioMetrics && msg.scenarioMetrics.total_spend_inr > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                      Landed Contract Spend
                    </span>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {formatINR(msg.scenarioMetrics.total_spend_inr)}
                    </div>
                    <span className="text-[10px] text-violet-400 font-mono">
                      {formatINRExecutive(msg.scenarioMetrics.total_spend_inr)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                      Savings vs Budget
                    </span>
                    <div className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5" />
                      {formatINR(msg.scenarioMetrics.savings_vs_baseline_inr)}
                    </div>
                    <span className="text-[10px] text-emerald-300 font-mono">
                      {msg.scenarioMetrics.savings_vs_baseline_pct.toFixed(2)}% below ₹4.0 Cr
                    </span>
                  </div>
                </div>
              )}

              {/* Render Structured Text / Markdown */}
              <div className="prose prose-invert prose-xs max-w-none text-slate-200">
                <div
                  className="space-y-2 whitespace-pre-wrap leading-relaxed text-xs [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-white [&>h4]:text-xs [&>h4]:font-bold [&>h4]:text-violet-300 [&>table]:w-full [&>table]:text-left [&>table]:border-collapse [&>table]:my-2 [&>table]:text-[11px] [&_th]:border-b [&_th]:border-slate-800 [&_th]:p-1.5 [&_th]:text-slate-400 [&_th]:font-mono [&_td]:border-b [&_td]:border-slate-800/60 [&_td]:p-1.5 [&_blockquote]:border-l-2 [&_blockquote]:border-amber-500 [&_blockquote]:bg-amber-950/20 [&_blockquote]:p-2 [&_blockquote]:rounded-r [&_blockquote]:my-2 [&_blockquote]:text-amber-200"
                  dangerouslySetInnerHTML={{
                    __html: formatMarkdownHtml(msg.text),
                  }}
                />
              </div>

              {/* Fallback Guardrail */}
              {(msg.is_fallback || msg.queryAst?.intent === 'UNKNOWN') && (
                <div className="mt-3 p-3 bg-amber-950/30 border border-amber-500/40 text-amber-200 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div className="font-medium">
                      <div className="text-amber-300 font-bold mb-1">⚠️ I cannot answer this yet.</div>
                      <div className="text-[11px] leading-relaxed opacity-90">I am specialized in deterministic commercial analysis, landed costs, and compliance gates for this RFx.</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5 border-t border-amber-900/50 pt-2">
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2">Try asking:</p>
                    <button onClick={() => handleSendQuery('Split cheapest per line, excluding failed quality questionnaire')} className="w-full text-left px-2 py-1.5 rounded bg-amber-900/40 hover:bg-amber-800/60 text-amber-100 text-[11px] transition-colors border border-amber-800/50 block">Split cheapest (ISO-filtered)</button>
                    <button onClick={() => handleSendQuery('Is Vendor 3 providing all materials?')} className="w-full text-left px-2 py-1.5 rounded bg-amber-900/40 hover:bg-amber-800/60 text-amber-100 text-[11px] transition-colors border border-amber-800/50 block">Is Vendor 3 providing all materials?</button>
                    <button onClick={() => handleSendQuery('Identify hidden ancillary fees across all vendors')} className="w-full text-left px-2 py-1.5 rounded bg-amber-900/40 hover:bg-amber-800/60 text-amber-100 text-[11px] transition-colors border border-amber-800/50 block">Identify hidden ancillary fees across all vendors</button>
                    <button onClick={() => handleSendQuery('Compare landed spend if USD strengthens to 87.00 INR')} className="w-full text-left px-2 py-1.5 rounded bg-amber-900/40 hover:bg-amber-800/60 text-amber-100 text-[11px] transition-colors border border-amber-800/50 block">Compare landed spend if USD strengthens to 87.00 INR</button>
                  </div>
                </div>
              )}

              {/* Interactive Scenario Action Bar */}
              {msg.highlightCells && msg.highlightCells.length > 0 && (
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 mt-2">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {msg.highlightCells.length} Awarded Lines
                  </span>
                  <button
                    onClick={() => {
                      const disqIds = msg.scenarioMetrics?.disqualified_vendors?.map((d: any) => d.vendor_id) || [];
                      onApplyScenario(
                        msg.highlightCells!,
                        msg.queryAst?.raw_query || 'Copilot Scenario',
                        disqIds
                      );
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-950 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Apply Scenario to Matrix
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 p-3 rounded-xl bg-slate-950 border border-slate-800 max-w-[80%] animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-violet-400" />
            <span>Parsing intent & executing deterministic optimization solver...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Quick-Prompt Chips */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/60 shrink-0">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
          Benchmark Procurement Inquiries:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              disabled={loading}
              onClick={() => handleSendQuery(prompt)}
              className="text-[11px] text-left px-2.5 py-1 rounded-md bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-violet-700/60 transition-colors truncate max-w-[340px]"
              title={prompt}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Input Bar */}
      <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuery(inputQuery);
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            placeholder="Ask scenario (e.g. 'Split award excluding ISO failed vendors')..."
            value={inputQuery}
            disabled={loading}
            onChange={(e) => setInputQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors shadow-inner"
          />
          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            className="absolute right-1.5 p-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 text-white transition-colors"
            title="Send query"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 px-1 font-mono">
          <span>Deterministic linear solver</span>
          <span>Zero LLM arithmetic tokens</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Lightweight helper to convert markdown syntax to clean HTML for the chat pane
 */
function formatMarkdownHtml(text: string): string {
  if (!text) return '';

  let html = text
    // Replace Alert blocks
    .replace(/> \[!WARNING\]\n> (.*)/g, '<blockquote>⚠️ <strong>Warning:</strong> $1</blockquote>')
    .replace(/> \[!NOTE\]\n> (.*)/g, '<blockquote>ℹ️ <strong>Audit Note:</strong> $1</blockquote>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="font-mono text-violet-300 bg-slate-900 px-1 py-0.2 rounded border border-slate-800">$1</code>')
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-white mt-2 mb-1">$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4 class="text-xs font-bold text-violet-300 mt-2 mb-1">$1</h4>')
    // Markdown tables
    .replace(/\|(.+)\|/g, (match) => {
      // Basic table row conversion
      const cells = match.split('|').filter((c, i, a) => i > 0 && i < a.length - 1);
      if (cells.some((c) => c.includes('---'))) {
        return ''; // delimiter row
      }
      const isHeader = match.includes('Vendor') || match.includes('Line ID') || match.includes('Supplier') || match.includes('Rank');
      const tag = isHeader ? 'th' : 'td';
      const cellHtml = cells.map((c) => `<${tag}>${c.trim()}</${tag}>`).join('');
      return `<tr>${cellHtml}</tr>`;
    });

  return html;
}
