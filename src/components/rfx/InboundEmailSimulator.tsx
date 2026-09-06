'use client';

import React, { useState } from 'react';
import {
  Inbox,
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Sparkles,
  FileSpreadsheet,
  Image as ImageIcon,
  DollarSign,
  Mail,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface InboundEmailSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  onIngestionComplete: () => void;
}

const PRESET_VENDORS = [
  {
    id: 'VEND-01',
    name: 'Packaging World Ltd',
    modality: 'Multi-Tab Excel (.xlsx)',
    icon: FileSpreadsheet,
    color: 'emerald',
    description: 'Line Item Rates Tab + Cell D34 buried ₹25,000 tooling plate charge',
  },
  {
    id: 'VEND-02',
    name: 'Apex Cartons & Containers',
    modality: 'Angled Photo Scan (OCR)',
    icon: ImageIcon,
    color: 'amber',
    description: 'Mobile photo tilted -4.2° quoted in ₹/100 pcs unit scale',
  },
  {
    id: 'VEND-03',
    name: 'National Paper & Board Mills',
    modality: 'Partial Bid Word Doc (.docx)',
    icon: AlertTriangle,
    color: 'rose',
    description: 'Omitted 7 die-cut lines (21-27) & failed ISO 9001 audit gate (52%)',
  },
  {
    id: 'VEND-04',
    name: 'Global Packaging Export LLC',
    modality: 'Foreign Export PDF',
    icon: DollarSign,
    color: 'violet',
    description: 'Quoted in USD ($0.12–$0.58) subject to ₹84.00 baseline FX peg',
  },
  {
    id: 'VEND-05',
    name: 'Balaji Traders',
    modality: 'Freeform Email Text',
    icon: Mail,
    color: 'violet',
    description: 'Weight-based clause (5-ply @ ₹44/kg, 3-ply @ ₹39/kg) + 4% freight surcharge',
  },
];

const SAMPLE_CUSTOM_EMAIL = `Dear Procurement Team,

Please find our revised commercial submission for the annual packaging contract:
- All 5-ply heavy duty master shippers @ Rs 43.50/kg base.
- All 3-ply universal cartons @ Rs 38.00/kg base.
- Die-cut e-commerce mailers @ Rs 54.00/kg base.
- Edge protectors @ Rs 14.00/pc.
- Honeycomb buffer sheets @ Rs 80.00/pc.
- Reinforced kraft tape @ Rs 38.00/roll.

Terms & Notes:
- Freight extra at 3.50% on total invoice value.
- Payment terms: Net 60 days.
- Tooling plate charge: ₹20,000 one-time fee.

Best regards,
Commercial Sales Directorate`;

export const InboundEmailSimulator: React.FC<InboundEmailSimulatorProps> = ({
  isOpen,
  onClose,
  onIngestionComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'PRESETS' | 'CUSTOM'>('PRESETS');
  const [ingesting, setIngesting] = useState(false);
  const [ingestStep, setIngestStep] = useState<string | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState('VEND-05');
  const [customText, setCustomText] = useState(SAMPLE_CUSTOM_EMAIL);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [resultSummary, setResultSummary] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Batch ingest all 5 preset submissions
  const handleBatchIngest = async () => {
    setIngesting(true);
    setResultSummary(null);
    setError(null);
    setIngestStep('Dispatching multi-modal parser for all 5 vendors...');

    try {
      const res = await fetch('/api/webhooks/email-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_presets: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Batch ingestion failed');

      setIngestStep('Executing deterministic normalization and governance matrix...');
      setResultSummary(data);
      onIngestionComplete();
    } catch (err: any) {
      setError(err.message || 'Ingestion error');
    } finally {
      setIngesting(false);
      setIngestStep(null);
    }
  };

  // Ingest custom upload or custom email text
  const handleCustomIngest = async () => {
    setIngesting(true);
    setResultSummary(null);
    setError(null);
    setIngestStep('Reading buffer & computing SHA-256 cryptographic digest...');

    try {
      const formData = new FormData();
      formData.append('vendor_id', selectedVendorId);
      formData.append('raw_text', customText);
      if (attachedFile) {
        formData.append('attachment', attachedFile);
      }

      setIngestStep('Running live AI extraction loop & parsing rate clauses...');

      const res = await fetch('/api/webhooks/email-inbound', {
        method: 'POST',
        body: formData,
      });

      setIngestStep('Normalizing line items into atomic SQLite transaction...');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Custom submission ingestion failed');

      setResultSummary(data);
      onIngestionComplete();
    } catch (err: any) {
      setError(err.message || 'Custom submission failed');
    } finally {
      setIngesting(false);
      setIngestStep(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-400">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Inbound Mailbox & Attachment Ingestion Simulator
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Webhook / Extraction
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Simulate inbound quotes across 5 heterogeneous modalities or attach custom supplier files and emails.
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('PRESETS')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'PRESETS'
                ? 'border-violet-500 text-violet-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>⚡ 5 Multi-Modal Presets</span>
          </button>
          <button
            onClick={() => setActiveTab('CUSTOM')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'CUSTOM'
                ? 'border-violet-500 text-violet-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Attach File / Custom Email</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* TAB 1: PRESETS */}
          {activeTab === 'PRESETS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Heterogeneous Supplier Submission Modalities
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Processes raw Excel, angled camera photos, partial bids, USD PDFs, and freeform email text.
                  </p>
                </div>
                <button
                  onClick={handleBatchIngest}
                  disabled={ingesting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 text-white text-xs font-bold shadow-lg shadow-violet-950 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {ingesting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-violet-200" />
                      <span>{ingestStep || 'Ingesting Presets...'}</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 text-violet-200" />
                      <span>Batch Ingest All 5 Presets</span>
                    </>
                  )}
                </button>
              </div>

              {/* Vendor Cards List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PRESET_VENDORS.map((v) => {
                  const Icon = v.icon;
                  return (
                    <div
                      key={v.id}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3"
                    >
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white truncate">{v.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {v.id}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-violet-300 block mt-0.5">
                          {v.modality}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                          {v.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOM SUBMISSION */}
          {activeTab === 'CUSTOM' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Vendor Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Target Supplier</label>
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    {PRESET_VENDORS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.id}: {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* File Attachment Upload */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>File Attachment (Optional)</span>
                    <span className="text-[10px] text-slate-500">.xlsx, .pdf, .jpg, .png, .docx, .txt</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="custom-file-upload"
                      onChange={(e) => setAttachedFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label
                      htmlFor="custom-file-upload"
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-300 hover:border-slate-600 cursor-pointer flex items-center justify-between"
                    >
                      <span className="truncate">
                        {attachedFile ? attachedFile.name : 'Select or drop rate sheet document...'}
                      </span>
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                    </label>
                    {attachedFile && (
                      <button
                        onClick={() => setAttachedFile(null)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
                        title="Remove attachment"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Custom Email Text */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Inbound Email Body / Quotation Notes
                  </label>
                  <button
                    onClick={() => setCustomText(SAMPLE_CUSTOM_EMAIL)}
                    className="text-[11px] text-violet-400 hover:text-violet-300 underline font-medium"
                  >
                    Insert Sample Quote Email
                  </button>
                </div>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  rows={8}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                  placeholder="Paste unstructured supplier quotation email..."
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-slate-400">
                  Runs AI rate extraction (Gemini / regex fallback) + deterministic unit normalization.
                </p>
                <button
                  onClick={handleCustomIngest}
                  disabled={ingesting || (!customText.trim() && !attachedFile)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 text-white text-xs font-bold shadow-lg shadow-violet-950 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {ingesting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-violet-200" />
                      <span>{ingestStep || 'Processing Submission...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-violet-200" />
                      <span>Ingest Submission & Update Grid</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Result Feedback Banner */}
          {resultSummary && (
            <div className="p-4 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-200 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white">
                    {resultSummary.message || 'Ingestion completed successfully!'}
                  </span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-emerald-300 border border-emerald-700">
                  {resultSummary.quotes_ingested} Quotes Normalized
                </span>
              </div>

              {resultSummary.doc_sha256 && (
                <div className="text-[11px] text-slate-300 font-mono flex items-center gap-2 pt-1">
                  <span className="text-slate-500">SHA-256:</span>
                  <span className="truncate">{resultSummary.doc_sha256}</span>
                </div>
              )}

              <div className="flex items-center justify-end pt-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold border border-slate-700 transition-colors"
                >
                  Close & View Comparison Matrix
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
