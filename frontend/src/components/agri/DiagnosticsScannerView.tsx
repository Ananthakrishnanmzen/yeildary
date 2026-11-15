import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileWarning,
  FlaskConical,
  Layers,
  Leaf,
  RotateCcw,
  Scan,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import { diagnosticsService } from '../../services/api';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/pjpeg'];

// Instant samples strictly contain Crop Leaf Specimens (Soil Report is removed from samples as requested)
const SAMPLE_CASES = [
  {
    id: 'banana_sigatoka',
    name: 'Banana Leaf Spot',
    tag: 'Sigatoka Necrosis',
    image: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'rice_bacterial_blight',
    name: 'Paddy Foliage Blight',
    tag: 'Bacterial Sheath',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'pepper_leaf_wilt',
    name: 'Pepper Leaf Rot',
    tag: 'Phytophthora Foliar Blight',
    image: 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'cardamom_leaf_blight',
    name: 'Cardamom Leaf Blotch',
    tag: 'Colletotrichum Foliar Spot',
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=700&q=80',
  },
];

export default function DiagnosticsScannerView() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<string>('organic');

  const validateFile = (file: File): string | null => {
    const fileName = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
    const hasValidMime =
      !file.type || ALLOWED_MIME_TYPES.includes(file.type.toLowerCase()) || hasValidExt;

    if (!hasValidExt || !hasValidMime) {
      const ext = fileName.includes('.') ? `.${fileName.split('.').pop()}` : 'unknown';
      return `Unsupported file format (${ext}). The vision scanner only accepts high-resolution .JPG and .PNG files up to 25MB.`;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `File size (${sizeMB} MB) exceeds the 25MB limit. Please upload an image under 25MB.`;
    }

    return null;
  };

  const processSelectedFile = (file: File) => {
    setErrorMessage(null);
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      setImagePreview(base64Data);
      runScannerInference(file, null, base64Data);
    };
    reader.onerror = () => {
      setErrorMessage('Could not read image file. Please verify file integrity and try again.');
    };
    reader.readAsDataURL(file);
  };

  const selectSample = (sample: (typeof SAMPLE_CASES)[number]) => {
    setErrorMessage(null);
    setImagePreview(sample.image);
    runScannerInference(null, sample.id);
  };

  const runScannerInference = async (
    fileObj: File | null,
    sampleKey: string | null,
    base64Data?: string | null,
  ) => {
    setIsScanning(true);
    setScanResult(null);
    setErrorMessage(null);

    const formData = new FormData();
    if (fileObj) {
      formData.append('file', fileObj);
      formData.append('file_name', fileObj.name);
      if (base64Data) {
        formData.append('image_base64', base64Data);
      }
    } else if (sampleKey) {
      formData.append('sample_key', sampleKey);
    }

    try {
      await new Promise((r) => setTimeout(r, 600));
      const res = await diagnosticsService.scanImage(formData);
      const data = res.data;

      if (data.status === 'invalid_specimen' || data.is_valid_specimen === false) {
        setScanResult(data);
        setErrorMessage(
          data.rejection_reason ||
            'The uploaded image is invalid. The scanner strictly accepts Soil Reports and Crop Leaf Images only.',
        );
      } else {
        setScanResult(data);
        setErrorMessage(null);
      }
    } catch (err: any) {
      const serverMessage =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.message ||
        'Failed to process image through Neural Agro-Vision Engine. Please check file format and try again.';
      setErrorMessage(serverMessage);
    } finally {
      setIsScanning(false);
    }
  };

  const resetScanner = () => {
    setImagePreview(null);
    setScanResult(null);
    setErrorMessage(null);
    setIsScanning(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#84CC16] uppercase tracking-wider">
            <Scan className="w-4 h-4" />
            <span>Precision Vision Diagnostic Engine</span>
          </div>
          <h2 className="text-xl font-bold text-white">Crop Leaf Diagnostics &amp; Soil Report Vision OCR</h2>
          <p className="text-xs text-slate-400">
            Dedicated neural analyzer strictly for Soil Test Reports and Crop Leaf Pathology with 3-tier agronomic remediations
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Instant Leaf Samples:</div>
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

      {/* Upload Zone & Error Banner */}
      {!imagePreview ? (
        <div className="space-y-4">
          {errorMessage && (
            <div className="rounded-2xl bg-red-950/80 border border-red-500/50 p-4 shadow-xl flex items-start justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs font-bold text-red-200 uppercase tracking-wide">
                    Upload Validation Error
                  </div>
                  <p className="text-xs text-red-300 leading-relaxed">{errorMessage}</p>
                  <p className="text-[11px] text-red-400/90 font-mono">
                    Strict Policy: Only Soil Reports &amp; Crop Leaf Images accepted • High-res .JPG, .PNG up to 25MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-white p-1 rounded-lg transition"
                title="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files?.[0]) {
                processSelectedFile(e.dataTransfer.files[0]);
              }
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
              accept=".jpg, .jpeg, .png, image/jpeg, image/png"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  processSelectedFile(e.target.files[0]);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />
            <label htmlFor="leaf-file-upload" className="cursor-pointer space-y-4 inline-block">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#84CC16]/15 border border-[#84CC16]/40 flex items-center justify-center text-[#84CC16]">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">
                  Drag &amp; Drop Crop Leaf Specimen or Soil Report
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Supports high-res .JPG, .PNG up to 25MB, or click any Instant Leaf Sample Test above.
                </p>
                <p className="text-[11px] text-[#84CC16]/90 font-mono pt-1">
                  Strictly accepts Crop Leaf Images &amp; Soil Reports. All other images are detected as invalid.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#84CC16] text-[#07090D] font-bold text-xs">
                <Scan className="w-4 h-4" />
                <span>Browse Image File</span>
              </div>
            </label>
          </div>
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
                className="flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Upload New</span>
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-[#07090D] border border-white/10">
              <img src={imagePreview} alt="Specimen" className="w-full h-full object-cover" />

              {/* Scanning Active Laser Sweep */}
              {isScanning && (
                <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="bg-[#07090D]/90 border border-[#84CC16] rounded-xl px-4 py-2 text-xs font-mono text-[#84CC16] flex items-center gap-2 shadow-2xl">
                    <span className="w-2 h-2 rounded-full bg-[#84CC16] animate-ping" />
                    <span>Radar Laser Sweep &amp; Neural Inference Active...</span>
                  </div>
                </div>
              )}

              {/* Invalid Specimen Rejection Overlay */}
              {!isScanning && scanResult?.is_valid_specimen === false && (
                <div className="absolute inset-0 bg-red-950/60 backdrop-blur-[1px] flex items-center justify-center p-4">
                  <div className="bg-[#07090D]/95 border border-red-500 rounded-xl px-4 py-3 text-center text-xs space-y-1 shadow-2xl max-w-sm">
                    <div className="text-red-400 font-bold flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span>Invalid Specimen Detected</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Only Soil Test Reports and Crop Leaf Images are supported.
                    </p>
                  </div>
                </div>
              )}

              {/* Bounding Boxes for Valid Detections */}
              {!isScanning &&
                scanResult?.is_valid_specimen !== false &&
                scanResult?.bounding_boxes && (
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
                            {box.label} ({Math.round((box.confidence || 0.9) * 100)}%)
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Specimen: {scanResult?.affected_crop || 'Crop Leaf / Soil Report'}</span>
              <span>Engine: {scanResult?.model_name || 'Neural Agro-Vision Engine'}</span>
            </div>
          </div>

          {/* Right Panel: Diagnosis & Remediations OR Rejection Notice */}
          <div className="lg:col-span-6 space-y-4">
            {isScanning && (
              <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-6 animate-pulse space-y-4">
                <div className="h-6 bg-white/10 rounded w-2/3" />
                <div className="h-16 bg-white/5 rounded-xl" />
                <div className="h-24 bg-white/5 rounded-xl" />
              </div>
            )}

            {/* Specimen Rejected Notice */}
            {!isScanning && scanResult?.is_valid_specimen === false && (
              <div className="rounded-2xl bg-[#0E1015]/90 border border-red-500/40 p-5 space-y-4 shadow-2xl animate-in fade-in">
                <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
                  <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-400">
                    <FileWarning className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Specimen Verification Alert</h3>
                    <p className="text-[11px] text-red-400 font-mono">Invalid Image Type Detected</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 space-y-1.5 text-xs">
                  <div className="font-semibold text-red-300">Analysis Feedback:</div>
                  <p className="text-slate-300 leading-relaxed">
                    {scanResult.rejection_reason ||
                      errorMessage ||
                      'The vision scanner only scans Soil Reports and Crop Leaf Images. Any other image uploaded is detected as invalid.'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#07090D] border border-white/10 space-y-2 text-xs">
                  <div className="font-bold text-slate-200">Exclusively Accepted Items:</div>
                  <div className="space-y-1.5 text-slate-300 text-[11px]">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#84CC16] shrink-0 mt-0.5" />
                      <span><strong>Crop Leaf Images:</strong> Diseased or healthy foliage of crops (banana, rice/paddy, pepper, cardamom, vegetables, etc.) showing leaves, foliar lesions, blights, spots, or chlorosis.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#84CC16] shrink-0 mt-0.5" />
                      <span><strong>Soil Reports:</strong> Certified laboratory soil health cards or testing sheets with pH, N-P-K, OC, EC, or micronutrient values.</span>
                    </div>
                  </div>
                  <div className="pt-1 text-[11px] text-red-400 font-mono">
                    ❌ People, selfies, animals, vehicles, buildings, food, and non-leaf plant parts are strictly rejected.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetScanner}
                    className="px-4 py-2 rounded-xl bg-[#84CC16] text-[#07090D] font-bold text-xs flex items-center gap-1.5 hover:opacity-90 transition cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload Leaf or Soil Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectSample(SAMPLE_CASES[0])}
                    className="px-3 py-2 rounded-xl bg-[#07090D] border border-white/10 hover:border-[#84CC16]/50 text-xs text-slate-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#84CC16]" />
                    <span>Try Banana Leaf Sample</span>
                  </button>
                </div>
              </div>
            )}

            {/* Error Message with No Result */}
            {!isScanning && !scanResult && errorMessage && (
              <div className="rounded-2xl bg-red-950/80 border border-red-500/50 p-5 space-y-3 shadow-xl">
                <div className="flex items-center gap-2 text-red-300 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span>Scanner Error</span>
                </div>
                <p className="text-xs text-red-200">{errorMessage}</p>
                <button
                  type="button"
                  onClick={resetScanner}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Valid Diagnosis Result & 3 Remediation Accordions */}
            {!isScanning && scanResult && scanResult.is_valid_specimen !== false && (
              <>
                <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-xl bg-red-950/80 border border-red-800 text-red-300 font-bold text-xs">
                      {scanResult.diagnosis_badge}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-mono text-xs font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{Math.round(scanResult.confidence_score || 92)}% Confidence</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{scanResult.detected_issue}</p>
                </div>

                {/* Accordion 1: Organic Remediation */}
                <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveAccordion(activeAccordion === 'organic' ? '' : 'organic')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 cursor-pointer transition"
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

                {/* Accordion 2: Chemical Schedule & Withdrawal */}
                <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveAccordion(activeAccordion === 'chemical' ? '' : 'chemical')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 cursor-pointer transition"
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
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 cursor-pointer transition"
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
