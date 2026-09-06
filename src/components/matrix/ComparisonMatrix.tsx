'use client';

import React, { useState, useMemo } from 'react';
import { MatrixCell, QuoteCellData } from './MatrixCell';
import {
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Camera,
  FileText,
  FileCode,
  Mail,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

export interface VendorMeta {
  id: string;
  name: string;
  inbound_modality: 'MULTI_TAB_EXCEL' | 'ANGLED_PHOTO' | 'PARTIAL_WORD' | 'FOREIGN_USD_PDF' | 'RAW_EMAIL';
  iso_9001_certified: boolean;
  fsc_certified: boolean;
  credit_terms: string;
  quality_audit_score: number;
}

export interface LineItemRow {
  line_id: string;
  line_number: number;
  sku_name: string;
  spec_category: '5-Ply Master' | '3-Ply Universal' | 'Die-Cut Mailer' | 'Protective';
  dimensions: string;
  spec_weight_kg: number;
  target_volume: number;
  baseline_benchmark_price: number;
  quotes: Record<string, QuoteCellData>;
}

interface ComparisonMatrixProps {
  vendors: VendorMeta[];
  lines: LineItemRow[];
  selectedQuoteId: string | null;
  onSelectQuote: (quoteId: string) => void;
  highlightMap?: Record<string, string>;
  disqualifiedVendorIds?: string[];
}

export const ComparisonMatrix: React.FC<ComparisonMatrixProps> = ({
  vendors,
  lines,
  selectedQuoteId,
  onSelectQuote,
  highlightMap,
  disqualifiedVendorIds,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [onlyNeedsReview, setOnlyNeedsReview] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter line items based on category, search, and review flags
  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      // Category filter
      if (selectedCategory !== 'ALL' && line.spec_category !== selectedCategory) {
        return false;
      }

      // Needs review filter
      if (onlyNeedsReview) {
        const hasFlag = Object.values(line.quotes).some(
          (q) => q.review_status === 'MANDATORY_BUYER_REVIEW'
        );
        if (!hasFlag) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = line.sku_name.toLowerCase().includes(query);
        const matchesId = line.line_id.toLowerCase().includes(query);
        const matchesCategory = line.spec_category.toLowerCase().includes(query);
        if (!matchesName && !matchesId && !matchesCategory) return false;
      }

      return true;
    });
  }, [lines, selectedCategory, onlyNeedsReview, searchQuery]);

  const getModalityIcon = (modality: string) => {
    switch (modality) {
      case 'MULTI_TAB_EXCEL':
        return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />;
      case 'ANGLED_PHOTO':
        return <Camera className="w-3.5 h-3.5 text-amber-400" />;
      case 'PARTIAL_WORD':
        return <FileText className="w-3.5 h-3.5 text-blue-400" />;
      case 'FOREIGN_USD_PDF':
        return <FileCode className="w-3.5 h-3.5 text-indigo-400" />;
      case 'RAW_EMAIL':
        return <Mail className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getCategoryPillColor = (cat: string) => {
    switch (cat) {
      case '5-Ply Master':
        return 'bg-amber-950/40 text-amber-300 border-amber-800/40';
      case '3-Ply Universal':
        return 'bg-violet-950/40 text-violet-300 border-violet-800/40';
      case 'Die-Cut Mailer':
        return 'bg-purple-950/40 text-purple-300 border-purple-800/40';
      case 'Protective':
        return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. Quick Filters & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => {
              setSelectedCategory('ALL');
              setOnlyNeedsReview(false);
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              selectedCategory === 'ALL' && !onlyNeedsReview
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Lines ({lines.length})
          </button>

          <button
            onClick={() => {
              setSelectedCategory('5-Ply Master');
              setOnlyNeedsReview(false);
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              selectedCategory === '5-Ply Master' && !onlyNeedsReview
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            5-Ply Master (10)
          </button>

          <button
            onClick={() => {
              setSelectedCategory('3-Ply Universal');
              setOnlyNeedsReview(false);
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              selectedCategory === '3-Ply Universal' && !onlyNeedsReview
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            3-Ply Universal (10)
          </button>

          <button
            onClick={() => {
              setSelectedCategory('Die-Cut Mailer');
              setOnlyNeedsReview(false);
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              selectedCategory === 'Die-Cut Mailer' && !onlyNeedsReview
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Die-Cut Mailers (7)
          </button>

          <button
            onClick={() => {
              setSelectedCategory('Protective');
              setOnlyNeedsReview(false);
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              selectedCategory === 'Protective' && !onlyNeedsReview
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Protective (3)
          </button>

          <button
            onClick={() => {
              setOnlyNeedsReview(!onlyNeedsReview);
              setSelectedCategory('ALL');
            }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors ${
              onlyNeedsReview
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow'
                : 'text-amber-400/80 border-amber-800/40 hover:bg-amber-950/40'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Needs Review (⚠️)
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search SKU or specs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>
      </div>

      {/* 2. High-Density Scrollable Comparison Grid */}
      <div className="relative rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-230px)]">
          <table className="w-full border-collapse text-left border-spacing-0">
            {/* Table Header: Vendors and Column Labels */}
            <thead className="sticky top-0 z-30 bg-slate-900 text-slate-300 shadow-md">
              <tr className="border-b border-slate-800">
                {/* Intersection 1: Sticky Top-Left 1 (Line Item ID & Specs) */}
                <th className="sticky top-0 left-0 z-40 bg-slate-900 p-3 w-[240px] min-w-[240px] border-r border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">
                    Line Item Specs
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    Dimensions · Category · Box Weight
                  </div>
                </th>

                {/* Intersection 2: Sticky Top-Left 2 (Target Volume & Benchmark) */}
                <th className="sticky top-0 left-[240px] z-40 bg-slate-900 p-3 w-[150px] min-w-[150px] border-r border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] text-right">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">
                    Volume & Target
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    Target Boxes · Benchmark
                  </div>
                </th>

                {/* 5 Vendor Headers */}
                {vendors.map((vendor) => (
                  <th
                    key={vendor.id}
                    className="p-3 w-[220px] min-w-[220px] border-r border-slate-800/80 bg-slate-900"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-violet-400">
                          {vendor.id}
                        </span>
                        {vendor.iso_9001_certified ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-semibold">
                            <ShieldCheck className="w-2.5 h-2.5" /> ISO Pass
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-rose-950 text-rose-400 border border-rose-800/60 font-semibold">
                            <ShieldAlert className="w-2.5 h-2.5" /> ISO Fail ({vendor.quality_audit_score}%)
                          </span>
                        )}
                      </div>

                      <div className="font-semibold text-xs text-white truncate" title={vendor.name}>
                        {vendor.name}
                      </div>

                      {/* Explicit Disqualification Tag for Active Exclusion Scenarios */}
                      {disqualifiedVendorIds?.includes(vendor.id) && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-extrabold text-[10px] animate-pulse">
                          <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                          <span>DISQUALIFIED (ISO Fail)</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                        <span className="inline-flex items-center gap-1">
                          {getModalityIcon(vendor.inbound_modality)}
                          {vendor.inbound_modality.replace(/_/g, ' ')}
                        </span>
                        <span>{vendor.credit_terms}</span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body: 30 Line Item Rows */}
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {filteredLines.map((line) => (
                <tr key={line.line_id} className="hover:bg-slate-800/30 transition-colors group">
                  {/* Sticky Column 1: Line Item ID & Specs */}
                  <td className="sticky left-0 z-20 bg-slate-900 p-2.5 border-r border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] group-hover:bg-slate-850">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-violet-400 text-xs">
                          {line.line_id}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded border font-medium ${getCategoryPillColor(
                            line.spec_category
                          )}`}
                        >
                          {line.spec_category}
                        </span>
                      </div>
                      <div className="font-medium text-white truncate max-w-[210px]" title={line.sku_name}>
                        {line.sku_name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {line.dimensions} · {line.spec_weight_kg}kg
                      </div>
                    </div>
                  </td>

                  {/* Sticky Column 2: Volume & Baseline Benchmark */}
                  <td className="sticky left-[240px] z-20 bg-slate-900 p-2.5 border-r border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] text-right group-hover:bg-slate-850">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono font-bold text-slate-200">
                        {line.target_volume.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400">Target boxes</span>
                      <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                        Bench: ₹{line.baseline_benchmark_price.toFixed(2)}
                      </span>
                    </div>
                  </td>

                  {/* 5 Vendor Quote Cells */}
                  {vendors.map((vendor) => {
                    const quote = line.quotes[vendor.id];
                    const winningVendorId = highlightMap ? highlightMap[line.line_id] : undefined;
                    const isWinner = !!(winningVendorId && winningVendorId === vendor.id);
                    const isDimmed = !!(winningVendorId && !isWinner);
                    const isDisqualified = !!(disqualifiedVendorIds && disqualifiedVendorIds.includes(vendor.id));

                    return (
                      <MatrixCell
                        key={vendor.id}
                        quote={quote}
                        isSelected={selectedQuoteId === quote?.quote_id}
                        isWinner={isWinner}
                        isDimmed={isDimmed}
                        isDisqualified={isDisqualified}
                        onClick={() => quote?.quote_id && onSelectQuote(quote.quote_id)}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
