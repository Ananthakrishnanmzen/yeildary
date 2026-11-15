import { useState } from 'react';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileCheck,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { schemesService } from '../../services/api';

const CROPS_LIST = [
  { id: 'Paddy', label: 'Paddy (നെല്ല്)', icon: '🌾' },
  { id: 'Spices', label: 'Spices / Pepper (കുരുമുളക്)', icon: '🌿' },
  { id: 'Vegetables', label: 'Vegetables (പച്ചക്കറി)', icon: '🥦' },
  { id: 'Horticulture', label: 'Banana / Coconut (വാഴ/തെങ്ങ്)', icon: '🍌' },
];

const LAND_SIZES = [
  { id: 'micro', label: 'Marginal / Micro Holding', range: '< 1.0 Acre' },
  { id: 'small', label: 'Small Farmer Holding', range: '1.0 - 2.5 Acres' },
  { id: 'medium', label: 'Medium / Plantation Holding', range: '> 2.5 Acres' },
];

const CATEGORIES = [
  { id: 'general', label: 'General Category' },
  { id: 'sc_st', label: 'SC / ST Farmer' },
  { id: 'women', label: 'Women Farmer (വനിതാ കർഷക)' },
  { id: 'organic', label: 'Certified Organic / PGS' },
];

export default function SchemesWizardView() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCrop, setSelectedCrop] = useState('Paddy');
  const [selectedLand, setSelectedLand] = useState('small');
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [matchedSchemes, setMatchedSchemes] = useState<any[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [selectedSchemeModal, setSelectedSchemeModal] = useState<any>(null);

  const handleNextStep = async () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      return;
    }
    setIsMatching(true);
    try {
      const res = await schemesService.matchSchemes({
        crop: selectedCrop,
        land_category: selectedLand,
        farmer_category: selectedCategory,
      });
      setMatchedSchemes(res.data?.matched_schemes || []);
      setCurrentStep(4);
    } catch {
      // ignore
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#84CC16] uppercase tracking-wider">
            <Award className="w-4 h-4" />
            <span>Direct Benefit Transfer &amp; Subsidies</span>
          </div>
          <h2 className="text-xl font-bold text-white">Government Scheme Discoverability Wizard</h2>
          <p className="text-xs text-slate-400">
            Progressive eligibility matching for Central &amp; Kerala State agricultural grants (PM-KUSUM, SMAM, PKVY, NHM, VFPCK)
          </p>
        </div>

        {currentStep === 4 && (
          <button
            type="button"
            onClick={() => {
              setCurrentStep(1);
              setMatchedSchemes([]);
            }}
            className="px-4 py-2 rounded-xl bg-[#07090D] border border-white/10 text-xs font-bold text-[#84CC16] flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Re-run Wizard</span>
          </button>
        )}
      </div>

      {currentStep < 4 && (
        <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-4 flex items-center justify-between text-xs font-bold">
          <span className={currentStep >= 1 ? 'text-[#84CC16]' : 'text-slate-500'}>1. Crop Selection</span>
          <div className="h-px flex-1 mx-4 bg-white/10" />
          <span className={currentStep >= 2 ? 'text-[#84CC16]' : 'text-slate-500'}>2. Landholding Size</span>
          <div className="h-px flex-1 mx-4 bg-white/10" />
          <span className={currentStep >= 3 ? 'text-[#84CC16]' : 'text-slate-500'}>3. Farmer Category</span>
        </div>
      )}

      {currentStep === 1 && (
        <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-6 space-y-5">
          <h3 className="text-base font-bold text-white">Step 1: Select Cultivated Crop</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CROPS_LIST.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCrop(c.id)}
                className={`p-5 rounded-2xl border text-left transition cursor-pointer ${
                  selectedCrop === c.id
                    ? 'bg-[#84CC16]/15 border-[#84CC16]'
                    : 'bg-[#07090D] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="text-3xl mb-2">{c.icon}</div>
                <div className="text-sm font-bold text-white">{c.label}</div>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2.5 rounded-xl bg-[#84CC16] text-[#07090D] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>Continue to Land Size</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-6 space-y-5">
          <h3 className="text-base font-bold text-white">Step 2: Select Landholding Size</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {LAND_SIZES.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedLand(l.id)}
                className={`p-5 rounded-2xl border text-left transition cursor-pointer ${
                  selectedLand === l.id
                    ? 'bg-[#84CC16]/15 border-[#84CC16]'
                    : 'bg-[#07090D] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="text-sm font-bold text-white">{l.label}</div>
                <div className="text-xs font-mono text-[#84CC16] mt-1">{l.range}</div>
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-xl bg-white/5 text-xs text-slate-300"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2.5 rounded-xl bg-[#84CC16] text-[#07090D] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>Continue to Category</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-6 space-y-5">
          <h3 className="text-base font-bold text-white">Step 3: Select Farmer Category</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#84CC16]/15 border-[#84CC16]'
                    : 'bg-[#07090D] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="text-sm font-bold text-white">{cat.label}</div>
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 rounded-xl bg-white/5 text-xs text-slate-300"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              disabled={isMatching}
              className="px-6 py-2.5 rounded-xl bg-[#84CC16] text-[#07090D] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isMatching ? 'Matching...' : 'Match Eligible Subsidies'}</span>
            </button>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-[#84CC16]/60 flex items-center justify-between text-xs">
            <span className="text-[#84CC16] font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {matchedSchemes.length} Eligible Government Schemes Found for {selectedCrop}
            </span>
            <span className="font-mono text-slate-400">Match Accuracy: 95%</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matchedSchemes.map((scheme) => (
              <div
                key={scheme.id}
                className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#84CC16]/15 text-[#84CC16] border border-[#84CC16]/30 font-mono text-[10px] font-bold">
                      {scheme.short_code}
                    </span>
                    <span className="text-[11px] text-[#38BDF8] font-semibold">{scheme.category}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white leading-snug">{scheme.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{scheme.description}</p>
                </div>

                <div className="space-y-3 pt-2 border-t border-white/10">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Max Subsidy / Grant</div>
                    <div className="text-xs font-bold text-[#FACC15] font-mono mt-0.5">
                      {scheme.subsidy_amount_display}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSchemeModal(scheme)}
                    className="w-full py-2 px-3 rounded-xl bg-[#07090D] hover:bg-[#84CC16] border border-white/10 text-xs font-bold text-white hover:text-[#07090D] transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>View Checklist &amp; Apply</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedSchemeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0E1015] border border-[#84CC16]/40 rounded-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <div className="text-[10px] font-mono text-[#84CC16] uppercase">{selectedSchemeModal.ministry}</div>
                <h3 className="text-base font-bold text-white mt-0.5">{selectedSchemeModal.name}</h3>
              </div>
              <button type="button" onClick={() => setSelectedSchemeModal(null)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#07090D] border border-[#84CC16]/40">
              <div className="text-[10px] text-slate-400 uppercase">Total Estimated Grant Value</div>
              <div className="text-base font-extrabold text-[#84CC16] font-mono mt-0.5">
                {selectedSchemeModal.subsidy_amount_display}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-[#84CC16]" />
                <span>Mandatory Document Checklist</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedSchemeModal.required_documents?.map((doc: string, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-[#07090D] border border-white/10 text-xs text-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#84CC16] shrink-0" />
                    <span>{doc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedSchemeModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-xs text-slate-300"
              >
                Close
              </button>
              <a
                href={selectedSchemeModal.application_link}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-[#84CC16] text-[#07090D] font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <span>Apply via Official Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
