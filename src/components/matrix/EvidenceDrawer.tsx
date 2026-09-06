'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Scale,
  DollarSign,
  ChevronRight,
  Calculator,
  RefreshCw,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';

export interface ProvenanceData {
  quote_id: string;
  rfx_line_item_id: string;
  line_number: number;
  sku_name: string;
  spec_category: string;
  dimensions: string;
  spec_weight_kg: number;
  target_volume: number;
  vendor_id: string;
  vendor_name: string;
  inbound_modality: string;
  document_name: string;
  document_url: string;
  document_sha256: string;
  bounding_box: { page?: number; x: number; y: number; w: number; h: number } | null;
  raw_ocr_transcript: string;
  conversion_audit_trail: string[];
  certainty_metrics: {
    signal_confidence: number;
    sanity_confidence: number;
    spec_confidence: number;
    composite_certainty: number;
  };
  financial_exposure: 'HIGH' | 'MEDIUM' | 'LOW';
  review_status: string;
  is_confirmed_by_buyer: boolean;
  human_override_reason?: string | null;
  reviewed_at?: string | null;
}

interface EvidenceDrawerProps {
  quoteId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmQuote: (quoteId: string, confirmedRate?: number, reason?: string) => Promise<void>;
  onNextFlagged?: () => void;
  hasMoreFlagged?: boolean;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  quoteId,
  isOpen,
  onClose,
  onConfirmQuote,
  onNextFlagged,
  hasMoreFlagged,
}) => {
  const [data, setData] = useState<ProvenanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  // Override Form State
  const [showOverride, setShowOverride] = useState<boolean>(false);
  const [overrideRate, setOverrideRate] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const boundingBoxRef = useRef<HTMLDivElement>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);

  // Fetch provenance metadata when quoteId changes
  useEffect(() => {
    if (!quoteId || !isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setImageError(false);
    setShowOverride(false);
    setOverrideRate('');
    setOverrideReason('');

    fetch(`/api/quotes/${quoteId}/provenance`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch provenance (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then((payload: ProvenanceData) => {
        if (isMounted) {
          setData(payload);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [quoteId, isOpen]);

  // CRITICAL GUARDRAIL: Auto-scroll simulated document canvas to center bounding box
  useEffect(() => {
    if (data?.bounding_box && boundingBoxRef.current && canvasScrollRef.current) {
      setTimeout(() => {
        boundingBoxRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
      }, 200);
    }
  }, [data]);

  // Keyboard escape listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopyHash = () => {
    if (!data?.document_sha256) return;
    navigator.clipboard.writeText(data.document_sha256);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleConfirm = async () => {
    if (!data) return;
    setIsSubmitting(true);
    try {
      const rateNum = overrideRate ? parseFloat(overrideRate) : undefined;
      await onConfirmQuote(data.quote_id, rateNum, overrideReason);
      // Update local state to reflect confirmation
      setData((prev) =>
        prev
          ? {
              ...prev,
              review_status: 'BUYER_CONFIRMED',
              is_confirmed_by_buyer: true,
              human_override_reason: overrideReason || 'Buyer approved extraction.',
              reviewed_at: new Date().toISOString(),
            }
          : null
      );
    } catch (err: any) {
      alert(`Confirmation failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isImage = Boolean(
    !imageError &&
    data?.document_url &&
    /\.(png|jpe?g|webp|gif|svg)($|\?)/i.test(data.document_url)
  );

  const getFileModalityBadge = (url?: string, modality?: string) => {
    if (!url && !modality) return null;
    const ext = url ? url.split('.').pop()?.toLowerCase() : '';
    if (['xlsx', 'xls', 'csv'].includes(ext || '') || modality?.includes('Excel')) {
      return { label: 'Spreadsheet (.xlsx)', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800' };
    }
    if (['pdf'].includes(ext || '') || modality?.includes('PDF')) {
      return { label: 'PDF Document (.pdf)', color: 'text-rose-400 bg-rose-950/60 border-rose-800' };
    }
    if (['docx', 'doc'].includes(ext || '') || modality?.includes('Word')) {
      return { label: 'Word Document (.docx)', color: 'text-violet-400 bg-violet-950/60 border-violet-800' };
    }
    if (['txt', 'eml'].includes(ext || '') || modality?.includes('Email')) {
      return { label: 'Email Stream / Text', color: 'text-purple-400 bg-purple-950/60 border-purple-800' };
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext || '') || modality?.includes('Photo') || modality?.includes('OCR')) {
      return { label: 'Image Scan / Asset', color: 'text-amber-400 bg-amber-950/60 border-amber-800' };
    }
    return { label: modality || 'Uploaded Source', color: 'text-slate-400 bg-slate-800 border-slate-700' };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full text-slate-100 animate-in slide-in-from-right duration-300">
          {/* 1. Drawer Header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-950 text-violet-400 border border-violet-800/60">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-tight">Click-to-Source Provenance</h2>
                  <span className="font-mono text-xs text-violet-400 bg-violet-950/80 px-2 py-0.5 rounded border border-violet-800">
                    {data?.quote_id || quoteId}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Audit trail & coordinate verification for defensible award decisions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasMoreFlagged && onNextFlagged && (
                <button
                  onClick={onNextFlagged}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 transition-colors font-medium"
                  title="Cycle to next pending review line"
                >
                  Next Flagged
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Close Drawer (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 2. Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {loading && (
              <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
                <RefreshCw className="w-7 h-7 animate-spin text-violet-400" />
                <span className="text-sm font-medium">Resolving immutable source provenance...</span>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm">
                <p className="font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" /> Error Loading Provenance
                </p>
                <p className="text-xs mt-1 text-rose-400/90">{error}</p>
              </div>
            )}

            {!loading && data && (
              <>
                {/* Status & Exposure Hero Card */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-mono tracking-wider">Line Item</span>
                    <h3 className="text-sm font-bold text-white mt-0.5">{data.sku_name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {data.dimensions} · {data.spec_weight_kg}kg · Vol: {data.target_volume.toLocaleString()} boxes
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 uppercase font-mono tracking-wider">Review State</span>
                    <div className="mt-1">
                      {data.review_status === 'MANDATORY_BUYER_REVIEW' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          MANDATORY REVIEW
                        </span>
                      )}
                      {data.review_status === 'BUYER_CONFIRMED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          BUYER CONFIRMED
                        </span>
                      )}
                      {data.review_status === 'AUTO_VERIFIED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                          AUTO VERIFIED
                        </span>
                      )}
                      {data.review_status === 'EXCLUDED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-800">
                          EXCLUDED
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Simulated Document Canvas with Relative Bounding Box Scaling */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-violet-400" />
                      Visual Bounding Box Extraction
                    </span>
                    <span className="text-slate-400 font-mono">
                      {data.document_name} {data.bounding_box?.page ? `(Page ${data.bounding_box.page})` : ''}
                    </span>
                  </div>

                  {/* Canvas Viewport with Auto-Scroll to Highlighted Bounding Box */}
                  <div
                    ref={canvasScrollRef}
                    className="relative w-full max-h-80 bg-slate-950 rounded-xl border border-slate-800 overflow-y-auto p-3 shadow-inner select-none"
                  >
                    {isImage ? (
                      <div className="relative w-full rounded-lg overflow-hidden border border-slate-700 bg-slate-900/95 shadow-xl flex flex-col items-center">
                        <div className="relative w-full overflow-hidden bg-slate-950/90 flex items-center justify-center p-2 min-h-[220px]">
                          <img
                            src={data.document_url}
                            alt={data.document_name || 'Uploaded Source Document'}
                            onError={() => setImageError(true)}
                            className="max-w-full h-auto max-h-72 object-contain rounded-md shadow-md"
                          />

                          {/* Overlaid Highlight Bounding Box (Percentage coordinates relative to original sheet dimensions) */}
                          {data.bounding_box ? (
                            (() => {
                              const originalWidth = 500;
                              const originalHeight = 1000;
                              const leftPct = (data.bounding_box.x / originalWidth) * 100;
                              const topPct = (data.bounding_box.y / originalHeight) * 100;
                              const widthPct = (data.bounding_box.w / originalWidth) * 100;
                              const heightPct = (data.bounding_box.h / originalHeight) * 100;

                              return (
                                <div
                                  ref={boundingBoxRef}
                                  className="absolute border-2 border-amber-400 bg-amber-400/25 rounded-md shadow-lg shadow-amber-400/30 flex items-center justify-between px-2 py-1 transition-all duration-300 z-10 animate-pulse"
                                  style={{
                                    left: `${leftPct}%`,
                                    top: `${topPct}%`,
                                    width: `${widthPct}%`,
                                    height: `${heightPct}%`,
                                  }}
                                >
                                  <span className="text-[11px] font-mono font-bold text-amber-200 truncate drop-shadow">
                                    {data.raw_ocr_transcript}
                                  </span>
                                  <span className="text-[9px] font-mono px-1 rounded bg-amber-950/90 text-amber-300 border border-amber-500/50 shrink-0 ml-1">
                                    [{data.bounding_box.x},{data.bounding_box.y}]
                                  </span>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-900/80 text-[10px] text-slate-400 border border-slate-800 font-mono">
                              Full visual capture
                            </div>
                          )}
                        </div>

                        <div className="w-full px-3 py-1.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Uploaded Source Image
                          </span>
                          <a
                            href={data.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 hover:text-violet-300 underline flex items-center gap-1 font-mono text-[10px]"
                          >
                            Open Full Image <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      /* Simulated standard A4 document sheet (aspect-[1/1.414]) */
                      <div className="relative w-full aspect-[1/1.414] bg-slate-900/95 rounded-lg border border-slate-800 p-5 shadow-lg flex flex-col justify-between overflow-hidden">
                        {/* Background grid representing printed lines */}
                        <div className="space-y-3 opacity-20 pointer-events-none">
                          <div className="h-2 bg-slate-400 rounded w-1/3" />
                          <div className="h-1.5 bg-slate-500 rounded w-full" />
                          <div className="h-1.5 bg-slate-500 rounded w-5/6" />
                          <div className="h-1.5 bg-slate-500 rounded w-4/6" />
                          <div className="h-1.5 bg-slate-500 rounded w-full" />
                          <div className="h-1.5 bg-slate-500 rounded w-3/4" />
                          <div className="h-1.5 bg-slate-500 rounded w-full" />
                          <div className="h-1.5 bg-slate-500 rounded w-4/5" />
                          <div className="h-1.5 bg-slate-500 rounded w-2/3" />
                        </div>

                        {data.bounding_box ? (
                          (() => {
                            const originalWidth = 500;
                            const originalHeight = 1000;
                            const leftPct = (data.bounding_box.x / originalWidth) * 100;
                            const topPct = (data.bounding_box.y / originalHeight) * 100;
                            const widthPct = (data.bounding_box.w / originalWidth) * 100;
                            const heightPct = (data.bounding_box.h / originalHeight) * 100;

                            return (
                              <div
                                ref={boundingBoxRef}
                                className="absolute border-2 border-amber-400 bg-amber-400/20 rounded-md shadow-lg shadow-amber-400/30 flex items-center justify-between px-2 py-1 transition-all duration-300 z-10"
                                style={{
                                  left: `${leftPct}%`,
                                  top: `${topPct}%`,
                                  width: `${widthPct}%`,
                                  height: `${heightPct}%`,
                                }}
                              >
                                <span className="text-[11px] font-mono font-bold text-amber-200 truncate drop-shadow">
                                  {data.raw_ocr_transcript}
                                </span>
                                <span className="text-[9px] font-mono px-1 rounded bg-amber-950/80 text-amber-300 border border-amber-500/50 shrink-0 ml-1">
                                  [{data.bounding_box.x},{data.bounding_box.y}]
                                </span>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 italic">
                            No direct spatial coordinates (Parsed from structured spreadsheet/email stream)
                          </div>
                        )}

                        <div className="space-y-2 opacity-20 pointer-events-none mt-6">
                          <div className="h-1.5 bg-slate-500 rounded w-full" />
                          <div className="h-1.5 bg-slate-500 rounded w-2/3" />
                          <div className="h-1.5 bg-slate-500 rounded w-4/5" />
                          <div className="h-1.5 bg-slate-500 rounded w-full" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Raw OCR Text Snippet Card */}
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono uppercase">Raw Extraction Snippet</span>
                      <p className="font-mono text-slate-200 mt-0.5">{data.raw_ocr_transcript}</p>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-violet-400 border border-slate-700 shrink-0">
                      Modality: {data.inbound_modality}
                    </span>
                  </div>
                </div>

                {/* Zero-Hallucination Arithmetic Derivation Trail */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-emerald-400" />
                    Deterministic Conversion Trail
                  </h4>

                  <div className="space-y-2 border-l-2 border-slate-800 pl-4 ml-1">
                    {data.conversion_audit_trail.map((step, idx) => (
                      <div key={idx} className="relative group">
                        <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-slate-700 group-hover:bg-emerald-400 transition-colors" />
                        <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 font-mono hover:border-slate-700 transition-colors">
                          {step}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Governance Matrix Gauges (C x E) */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-violet-400" />
                    Governance Matrix Sub-Scores (C × E)
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-mono">Signal (S_sig)</span>
                      <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                        {(data.certainty_metrics.signal_confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-mono">Sanity (S_san)</span>
                      <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                        {(data.certainty_metrics.sanity_confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-mono">Spec (S_spec)</span>
                      <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                        {(data.certainty_metrics.spec_confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-mono">Certainty (C)</span>
                      <span
                        className={`text-sm font-extrabold font-mono mt-0.5 block ${
                          data.certainty_metrics.composite_certainty >= 0.9
                            ? 'text-emerald-400'
                            : data.certainty_metrics.composite_certainty >= 0.75
                            ? 'text-amber-300'
                            : 'text-rose-400'
                        }`}
                      >
                        {(data.certainty_metrics.composite_certainty * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Audit Provenance & SHA-256 Hash Card */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Document Source:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-200 font-semibold">{data.document_name}</span>
                      {(() => {
                        const badge = getFileModalityBadge(data.document_url, data.inbound_modality);
                        return badge ? (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badge.color}`}>
                            {badge.label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* High-res image preview when the document is an image */}
                  {isImage && (
                    <div className="mt-1 p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-violet-400" />
                          Image Asset Preview
                        </span>
                        <a
                          href={data.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-400 hover:text-violet-300 underline text-[10px] flex items-center gap-1"
                        >
                          Open original <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <div className="overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950 flex items-center justify-center p-1">
                        <img
                          src={data.document_url}
                          alt={data.document_name || 'Document preview'}
                          onError={() => setImageError(true)}
                          className="max-w-full max-h-56 object-contain rounded-md shadow-md transition-all hover:scale-[1.01]"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 shrink-0">SHA-256 Hash:</span>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono text-[11px] text-slate-400 truncate max-w-[280px]">
                        {data.document_sha256}
                      </span>
                      <button
                        onClick={handleCopyHash}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                        title="Copy SHA-256 for audit ledger"
                      >
                        {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  {data.human_override_reason && (
                    <div className="pt-2 border-t border-slate-800 text-emerald-300">
                      <span className="font-semibold">Buyer Audit Note:</span> {data.human_override_reason}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 3. Drawer Sticky Footer: Buyer Actions */}
          {!loading && data && data.review_status !== 'EXCLUDED' && (
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/95 sticky bottom-0 space-y-3">
              {showOverride ? (
                <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200">Manual Base Rate Override (₹)</label>
                    <button
                      onClick={() => setShowOverride(false)}
                      className="text-[11px] text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 42.00"
                      value={overrideRate}
                      onChange={(e) => setOverrideRate(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                    />
                    <input
                      type="text"
                      placeholder="Audit justification..."
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Will atomically recalculate True Landed Cost with freight/tooling ancillaries.
                  </p>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                {!showOverride && !data.is_confirmed_by_buyer && (
                  <button
                    onClick={() => setShowOverride(true)}
                    className="text-xs text-slate-400 hover:text-white underline underline-offset-4"
                  >
                    Adjust Rate / Flag Correction
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={onClose}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Close
                  </button>

                  <button
                    onClick={handleConfirm}
                    disabled={isSubmitting}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold shadow-lg transition-all ${
                      data.is_confirmed_by_buyer
                        ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40 cursor-default'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50 hover:shadow-emerald-900/60 active:scale-95'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isSubmitting
                      ? 'Confirming...'
                      : data.is_confirmed_by_buyer
                      ? 'Confirmed & Locked'
                      : 'Confirm Rate'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
