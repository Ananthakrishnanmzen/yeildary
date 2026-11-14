import { useState } from 'react';
import { BookOpen, ChevronDown, Info, X } from 'lucide-react';

export type GlossaryKey =
  | 'et'
  | 'soil_moisture'
  | 'ndvi'
  | 'vpd'
  | 'rusle'
  | 'frost_risk'
  | 'water_balance';

interface GlossaryEntry {
  term: string;
  short: string;
  impact: string;
}

export const SCIENCE_GLOSSARY: Record<GlossaryKey, GlossaryEntry> = {
  et: {
    term: 'Evapotranspiration (ET)',
    short: 'Combined water lost from soil evaporation and plant leaf transpiration (mm/month).',
    impact: 'High ET drains root-zone moisture quickly; pairing mulch or shade crops reduces evaporative loss.',
  },
  soil_moisture: {
    term: 'Soil Moisture Anomaly',
    short: 'How wet or dry the top 0–100 cm root zone (m³/m³) is compared to the multi-year baseline.',
    impact: 'Negative anomalies signal early root-zone drought stress before leaves visibly wilt.',
  },
  ndvi: {
    term: 'NDVI (Normalized Difference Vegetation Index)',
    short: 'Satellite greenness index (-1 to +1) measuring chlorophyll density and canopy vigor.',
    impact: 'Drops in NDVI indicate heatwave stress, nutrient deficiency, or bare-soil exposure.',
  },
  vpd: {
    term: 'VPD (Vapor Pressure Deficit)',
    short: 'Drying power of the air—the gap between moisture the air holds and what it could hold.',
    impact: 'High VPD forces plant stomata to close, slowing photosynthesis; very low VPD raises fungal risk.',
  },
  rusle: {
    term: 'RUSLE (Revised Universal Soil Loss Equation)',
    short: 'Physics-based topsoil erosion score (0–100) combining rainfall, slope steepness, soil erodibility, and cover.',
    impact: 'Scores above 60 mean heavy rain can strip fertile topsoil unless contour cover crops are planted.',
  },
  frost_risk: {
    term: 'Frost & Cold-Snap Risk',
    short: 'Nighttime/early-morning thermal risk derived from minimum land-surface and air temperatures (Tmin).',
    impact: 'Tmin <= 4°C can rupture tender leaf cells and blossoms; 4–10°C slows tropical root uptake.',
  },
  water_balance: {
    term: 'Water-Balance Index',
    short: 'Net monthly water surplus or deficit (Precipitation minus Evapotranspiration, in mm).',
    impact: 'Positive values recharge soil moisture (and runoff on slopes); negative values require irrigation or low-ET crops.',
  },
};

export function ScienceInfo({ termKey }: { termKey: GlossaryKey }) {
  const [open, setOpen] = useState(false);
  const entry = SCIENCE_GLOSSARY[termKey];

  return (
    <span className="relative inline-flex items-center align-middle ml-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label={`Explain ${entry.term}`}
        className="inline-flex items-center justify-center rounded-full text-slate-400 hover:text-[#38BDF8] focus:outline-none transition"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute left-0 top-6 z-40 w-72 rounded-xl bg-[#0E1015]/95 backdrop-blur-md border border-white/15 p-3 shadow-2xl text-left"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-[#38BDF8]">{entry.term}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-white"
              aria-label="Close glossary tooltip"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-200">{entry.short}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#84CC16]">{entry.impact}</p>
        </div>
      )}
    </span>
  );
}

export function FieldScienceGlossaryDrawer() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl bg-[#0E1015]/90 backdrop-blur-md border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#38BDF8]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Field Science Glossary (7 NASA &amp; Soil Metrics)
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="border-t border-white/10 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(SCIENCE_GLOSSARY).map(([key, item]) => (
            <div key={key} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-xs font-semibold text-[#38BDF8]">{item.term}</p>
              <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">{item.short}</p>
              <p className="mt-1.5 text-[11px] text-[#84CC16] leading-relaxed">{item.impact}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
