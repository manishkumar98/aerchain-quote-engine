'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, FileText, Ban } from 'lucide-react';

export interface QuoteCellData {
  quote_id: string;
  vendor_id: string;
  is_quoted: boolean;
  raw_display: string;
  raw_numeric_value: number | null;
  raw_unit: string | null;
  raw_currency: string;
  normalized_base_inr: number | null;
  landed_cost_inr: number | null;
  has_footnotes: boolean;
  footnote_detail: string | null;
  review_status: 'AUTO_VERIFIED' | 'MANDATORY_BUYER_REVIEW' | 'BUYER_CONFIRMED' | 'EXCLUDED' | 'FLAG_REVIEW_RECOMMENDED';
  certainty_score: number;
  financial_exposure?: 'HIGH' | 'MEDIUM' | 'LOW';
  flag_reason?: string | null;
  surcharge_chips?: { type: string; label: string }[];
  source_bounding_box?: { page: number; x: number; y: number; w: number; h: number } | null;
}

interface MatrixCellProps {
  quote: QuoteCellData;
  isSelected: boolean;
  onClick: () => void;
  isWinner?: boolean;
  isDimmed?: boolean;
  isDisqualified?: boolean;
}

export const MatrixCell: React.FC<MatrixCellProps> = ({
  quote,
  isSelected,
  onClick,
  isWinner = false,
  isDimmed = false,
  isDisqualified = false,
}) => {
  // 1. Omitted / Unquoted Cell Representation (Vendor 3 on lines 21-27)
  // Nuance 2: Unquoted cells stay cleanly marked as Incomplete / Not Quoted
  if (!quote.is_quoted) {
    return (
      <td
        className={`p-2.5 text-center transition-all duration-200 border-b border-r border-slate-800/80 bg-slate-950/40 cursor-pointer hover:bg-slate-900/60 ${
          isSelected ? 'ring-2 ring-amber-500/50 bg-amber-950/20' : ''
        } ${isDimmed || isDisqualified ? 'opacity-30 grayscale-[50%]' : ''}`}
        onClick={onClick}
        title="Supplier omitted this line item from submitted bid"
      >
        <div className="flex flex-col items-center justify-center gap-1 py-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/50 shadow-sm">
            <Ban className="w-3 h-3 text-amber-400" />
            Incomplete / Not Quoted
          </span>
          <span className="text-[10px] text-slate-500 font-mono tracking-tight">
            {isDisqualified ? 'Omitted · ISO Excluded' : 'Excluded from single-source'}
          </span>
        </div>
      </td>
    );
  }

  // 2. Quoted Cell States
  const isMandatoryReview = quote.review_status === 'MANDATORY_BUYER_REVIEW';
  const isConfirmed = quote.review_status === 'BUYER_CONFIRMED';
  const isAutoVerified = quote.review_status === 'AUTO_VERIFIED';

  return (
    <td
      onClick={onClick}
      className={`p-2.5 border-b border-r border-slate-800/80 cursor-pointer transition-all duration-200 group relative ${
        isWinner
          ? 'ring-2 ring-emerald-400 bg-emerald-500/15 shadow-lg shadow-emerald-500/20 z-10'
          : isDisqualified
          ? 'bg-rose-950/20 hover:bg-rose-950/30'
          : isSelected
          ? 'bg-violet-950/40 ring-2 ring-violet-500 shadow-lg shadow-violet-950/50 z-10'
          : isMandatoryReview
          ? 'bg-amber-950/15 hover:bg-amber-950/30'
          : isConfirmed
          ? 'bg-emerald-950/15 hover:bg-emerald-950/30'
          : 'hover:bg-slate-800/50'
      } ${
        isWinner
          ? 'opacity-100'
          : isDisqualified
          ? 'opacity-35 grayscale-[20%]'
          : isDimmed
          ? 'opacity-35 grayscale-[30%]'
          : 'opacity-100'
      }`}
    >
      <div className="flex flex-col gap-1.5">
        {/* Top Line: Landed Unit Cost & Review Status Badge */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-baseline gap-1">
            <span
              className={`text-sm tracking-tight ${
                isWinner
                  ? 'text-emerald-300 font-extrabold text-[15px]'
                  : isDisqualified
                  ? 'text-slate-400 line-through font-semibold'
                  : isConfirmed
                  ? 'text-emerald-300 font-extrabold'
                  : isMandatoryReview
                  ? 'text-amber-200 font-bold'
                  : 'text-white font-bold'
              }`}
            >
              ₹{quote.landed_cost_inr !== null ? quote.landed_cost_inr.toFixed(2) : '—'}
            </span>
            <span className="text-[10px] text-slate-400">/box</span>
          </div>

          {/* Winner Award Chip OR Disqualified Tag OR Review Status Indicator */}
          {isWinner ? (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500 text-slate-950 shadow-sm animate-pulse">
              🏆 Award
            </span>
          ) : isDisqualified ? (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
              <AlertTriangle className="w-2.5 h-2.5 text-rose-400 shrink-0" />
              Disqualified
            </span>
          ) : isMandatoryReview ? (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
              title="Extraction requires buyer confirmation before award finalization"
            >
              <AlertTriangle className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              Review
            </span>
          ) : isConfirmed ? (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              Confirmed
            </span>
          ) : isAutoVerified ? (
            <span className="text-[9px] font-mono text-slate-500 bg-slate-800/80 px-1 rounded">
              {(quote.certainty_score * 100).toFixed(0)}% C
            </span>
          ) : null}
        </div>

        {/* Second Line: Muted Raw Price Display */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="truncate max-w-[130px]" title={quote.raw_display}>
            Raw: {quote.raw_display}
          </span>
          {quote.source_bounding_box && (
            <FileText className="w-3 h-3 text-slate-500 group-hover:text-violet-400 transition-colors shrink-0" />
          )}
        </div>

        {/* Surcharge & Feature Chips */}
        {quote.surcharge_chips && quote.surcharge_chips.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {quote.surcharge_chips.map((chip, idx) => {
              let chipStyle = 'bg-slate-800 text-slate-300 border-slate-700';
              if (chip.type === 'FREIGHT') chipStyle = 'bg-violet-950/80 text-violet-300 border-violet-800/60';
              if (chip.type === 'TOOLING') chipStyle = 'bg-purple-950/80 text-purple-300 border-purple-800/60';
              if (chip.type === 'FX_PEG') chipStyle = 'bg-violet-900/80 text-violet-200 border-violet-700/60';
              if (chip.type === 'UNIT_SCALE') chipStyle = 'bg-amber-950/80 text-amber-300 border-amber-800/60';
              if (chip.type === 'DERIVED_WEIGHT') chipStyle = 'bg-teal-950/80 text-teal-300 border-teal-800/60';

              return (
                <span
                  key={idx}
                  className={`text-[9px] px-1.5 py-0.2 rounded border font-medium leading-tight ${chipStyle}`}
                >
                  {chip.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </td>
  );
};
