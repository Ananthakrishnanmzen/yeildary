import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Layers,
  Leaf,
  RotateCcw,
  Scan,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { diagnosticsService } from '../../services/api';

const SAMPLE_CASES = [
  {
    id: 'banana_sigatoka',
    name: 'Banana Leaf Spot',
    tag: 'Sigatoka Necrosis',
    image: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'rice_bacterial_blight',
    name: 'Paddy Blight',
    tag: 'Bacterial Sheath',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'soil_health_card',
    name: 'Soil Health Card',
    tag: 'Acidic Topsoil OCR',
    image: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'coconut_stem_bleeding',
    name: 'Coconut Palm',
    tag: 'Stem Gummosis',
    image: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=700&q=80',
  },
];

export default function DiagnosticsScannerView() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<string>('organic');

  const processSelectedFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      runScannerInference(file, null);
    };
    reader.readAsDataURL(file);
  };

  const selectSample = (sample: (typeof SAMPLE_CASES)[number]) => {
    setImagePreview(sample.image);
    runScannerInference(null, sample.id);
  };

  const runScannerInference = async (fileObj: File | null, sampleKey: string | null) => {
    setIsScanning(true);
    setScanResult(null);

    const formData = new FormData();
    if (fileObj) {
      formData.append('file', fileObj);
    } else if (sampleKey) {
      formData.append('sample_key', sampleKey);
    }

    try {
      await new Promise((r) => setTimeout(r, 900));
      const res = await diagnosticsService.scanImage(formData);
      setScanResult(res.data);
    } catch {
      // ignore
    } finally {
      setIsScanning(false);
    }
  };

  const resetScanner = () => {
    setImagePreview(null);
    setScanResult(null);
    setIsScanning(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#84CC16] uppercase tracking-wider">
            <Scan className="w-4 h-4" />
            <span>Diagnostic Computer Vision Engine</span>
          </div>
          <h2 className="text-xl font-bold text-white">AI Visual Diagnostics &amp; Soil Card OCR</h2>
          <p className="text-xs text-slate-400">
            Sub-meter leaf necrosis detection, explainable bounding boxes &amp; 3-tier agronomic remediation schedules
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Instant Sample Tests:</div>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_CASES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSample(s)}
                className="px-3 py-1.5 rounded-xl bg-[#07090D] hover:bg-[#84CC16]/15 border border-white/10 hover:border-[#84CC16]/50 text-xs font-semibold text-slate-200 hover:text-[#84CC16] transition flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-[#84CC16]" />
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {!imagePreview ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files?.[0]) processSelectedFile(e.dataTransfer.files[0]);
          }}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition ${
            isDragOver
              ? 'border-[#84CC16] bg-[#84CC16]/10'
              : 'border-white/15 bg-[#0E1015]/80 hover:border-[#84CC16]/50'
          }`}
        >
          <input
            type="file"
            id="leaf-file-upload"
            accept="image/png, image/jpeg, image/jpg"
            onChange={(e) => {
              if (e.target.files?.[0]) processSelectedFile(e.target.files[0]);
            }}
            className="hidden"
          />
          <label htmlFor="leaf-file-upload" className="cursor-pointer space-y-4 inline-block">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#84CC16]/15 border border-[#84CC16]/40 flex items-center justify-center text-[#84CC16]">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">
                Drag &amp; Drop Field Leaf Specimen or Soil Health Card
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Supports high-res .JPG, .PNG up to 25MB, or click any Instant Sample Test above.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#84CC16] text-[#07090D] font-bold text-xs">
              <Scan className="w-4 h-4" />
              <span>Browse Image File</span>
            </div>
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Panel: Image & Bounding Boxes */}
          <div className="lg:col-span-6 rounded-2xl bg-[#0E1015]/90 border border-white/10 p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
              <span className="font-mono text-[#84CC16] font-semibold flex items-center gap-1.5">
                <Scan className="w-4 h-4" />
                <span>Sub-Pixel Neural Inspection</span>
              </span>
              <button
                type="button"
                onClick={resetScanner}
                className="flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Upload New</span>
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-[#07090D] border border-white/10">
              <img src={imagePreview} alt="Specimen" className="w-full h-full object-cover" />
              {isScanning && (
                <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="bg-[#07090D]/90 border border-[#84CC16] rounded-xl px-4 py-2 text-xs font-mono text-[#84CC16] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#84CC16] animate-ping" />
                    <span>Radar Laser Sweep &amp; Neural Inference Active...</span>
                  </div>
                </div>
              )}

              {!isScanning && scanResult?.bounding_boxes && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {scanResult.bounding_boxes.map((box: any, idx: number) => {
                    const top = `${box.ymin * 100}%`;
                    const left = `${box.xmin * 100}%`;
                    const width = `${(box.xmax - box.xmin) * 100}%`;
                    const height = `${(box.ymax - box.ymin) * 100}%`;
                    return (
                      <g key={idx}>
                        <rect
                          x={left}
                          y={top}
                          width={width}
                          height={height}
                          fill="rgba(239, 68, 68, 0.22)"
                          stroke="#ef4444"
                          strokeWidth="2.5"
                          strokeDasharray="4 2"
                        />
                        <text
                          x={left}
                          y={`${Math.max(4, box.ymin * 100 - 1.5)}%`}
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="bold"
                        >
                          {box.label} ({Math.round(box.confidence * 100)}%)
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Specimen: {scanResult?.affected_crop || 'Plant Foliage'}</span>
              <span>Model: LLaVA-Agro-1.5 Multi-modal</span>
            </div>
          </div>

          {/* Right Panel: Diagnosis & 3 Remediation Accordions */}
          <div className="lg:col-span-6 space-y-4">
            {isScanning && (
              <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-6 animate-pulse space-y-4">
                <div className="h-6 bg-white/10 rounded w-2/3" />
                <div className="h-16 bg-white/5 rounded-xl" />
                <div className="h-24 bg-white/5 rounded-xl" />
              </div>
            )}

            {!isScanning && scanResult && (
              <>
                <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-xl bg-red-950/80 border border-red-800 text-red-300 font-bold text-xs">
                      {scanResult.diagnosis_badge}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-mono text-xs font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{scanResult.confidence_score}% Confidence</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{scanResult.detected_issue}</p>
                </div>

                {/* Accordion 1: Organic Remediation */}
                <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveAccordion(activeAccordion === 'organic' ? '' : 'organic')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Leaf className="w-4 h-4 text-[#84CC16]" />
                      <span className="text-xs sm:text-sm font-bold text-white">
                        Immediate Organic Remediation
                      </span>
                    </div>
                    {activeAccordion === 'organic' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {activeAccordion === 'organic' && (
                    <div className="p-4 pt-1 border-t border-white/10 space-y-2 text-xs text-slate-300">
                      {scanResult.organic_remediation?.map((item: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#84CC16] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Accordion 2: Chemical Schedule */}
                <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveAccordion(activeAccordion === 'chemical' ? '' : 'chemical')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <FlaskConical className="w-4 h-4 text-[#38BDF8]" />
                      <span className="text-xs sm:text-sm font-bold text-white">
                        Chemical Treatment Schedule &amp; Withdrawal
                      </span>
                    </div>
                    {activeAccordion === 'chemical' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {activeAccordion === 'chemical' && (
                    <div className="p-4 pt-2 border-t border-white/10 space-y-2.5 text-xs">
                      {scanResult.chemical_schedule?.map((item: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-[#07090D] border border-white/10 space-y-1">
                          <div className="font-bold text-[#38BDF8]">{item.stage}</div>
                          <div className="text-slate-300">{item.dosage}</div>
                          {item.withdrawal && (
                            <div className="text-[11px] text-[#FACC15] font-mono pt-1">⚠️ {item.withdrawal}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Accordion 3: Soil Amendment */}
                <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveAccordion(activeAccordion === 'soil' ? '' : 'soil')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-4 h-4 text-[#FACC15]" />
                      <span className="text-xs sm:text-sm font-bold text-white">
                        Soil Amendment &amp; Acidity Correction
                      </span>
                    </div>
                    {activeAccordion === 'soil' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {activeAccordion === 'soil' && (
                    <div className="p-4 pt-2 border-t border-white/10 space-y-2 text-xs text-slate-300">
                      {scanResult.soil_amendment?.map((item: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FACC15] shrink-0 mt-1.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
