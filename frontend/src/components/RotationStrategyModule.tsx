import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Info,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  fetchModule3StrategyApi,
  recalculateModule3StrategyApi,
} from '../services/api';
import type {
  ClimateScenario,
  ConstraintWeights,
  FarmerProfile,
  Module3StrategyData,
  Module3StrategyResponse,
  StrategyDetail,
  TelemetryReport,
  TerrainReport,
} from '../types/farmer';

interface RotationStrategyModuleProps {
  profile: FarmerProfile;
  telemetry: TelemetryReport | null;
  terrain: TerrainReport | null;
}

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English (US)', bcp47: 'en-US' },
  { code: 'ml', label: 'Malayalam', bcp47: 'ml-IN' },
  { code: 'ta', label: 'Tamil', bcp47: 'ta-IN' },
  { code: 'hi', label: 'Hindi', bcp47: 'hi-IN' },
];

function getCropIcon(crop: string): string {
  const lower = crop.toLowerCase();
  if (lower.includes('pepper') || lower.includes('കുരുമുളക്') || lower.includes('மிளகு')) return '🌶️';
  if (lower.includes('cardamom') || lower.includes('ഏലം') || lower.includes('ஏல')) return '🌾';
  if (lower.includes('cowpea') || lower.includes('pulse') || lower.includes('പയർ') || lower.includes('chickpea')) return '🌱';
  if (lower.includes('vetiver') || lower.includes('രാമച്ചം') || lower.includes('வெட்டிவேர்')) return '🌿';
  if (lower.includes('ginger') || lower.includes('turmeric') || lower.includes('ഇഞ്ചി') || lower.includes('മഞ്ഞൾ')) return '🫚';
  if (lower.includes('banana') || lower.includes('വാഴ') || lower.includes('வாழை')) return '🍌';
  if (lower.includes('millet') || lower.includes('maize') || lower.includes('rice')) return '🌾';
  return '🌿';
}

function buildLocalFallback(
  profile: FarmerProfile,
  telemetry: TelemetryReport | null,
  terrain: TerrainReport | null,
  weights: ConstraintWeights,
): Module3StrategyData {
  const water = telemetry?.vulnerability_stress_layer?.water_stress;
  const series = water?.series ?? [];
  const latest = series.length ? series[series.length - 1] : null;
  const stress = latest?.water_stress_index ?? 35;
  const erosion = terrain?.erosion_risk_score ?? 90;
  const slope = terrain?.raw_slope_degrees ?? 24.8;
  const isHumidSloped = (terrain?.raw_rainfall_mm ?? 0) > 150 || slope > 12;

  const baselineCrops = profile.crops_grown?.length
    ? profile.crops_grown.slice(0, 3)
    : isHumidSloped
    ? ['Cardamom', 'Black Pepper']
    : ['Rice (Paddy)', 'Maize'];
  const resilienceCrops = isHumidSloped
    ? ['Black Pepper', 'Cowpea Cover', 'Vetiver']
    : ['Green Gram', 'Sunn Hemp Cover', 'Maize'];
  const waterSaverCrops = isHumidSloped
    ? ['Ginger', 'Turmeric', 'Dwarf Banana']
    : ['Pearl Millet', 'Chickpea', 'Sesame'];

  return {
    realtime_alerts: [
      {
        alert_title: `Telemetry Advisory (${profile.location_name})`,
        alert_message: `Water Stress Index ${stress.toFixed(1)}, RUSLE Erosion Risk ${erosion.toFixed(1)}/100.`,
        severity: erosion >= 65 || stress >= 65 ? 'HIGH' : 'MEDIUM',
      },
    ],
    baseline: {
      strategy_name: 'Baseline',
      recommended_crop_sequence: baselineCrops,
      suitability_score: Math.max(25, Math.min(92, Math.round(78 - erosion * 0.28 - stress * 0.18))),
      water_efficiency_score: Math.max(20, Math.min(90, Math.round(72 - stress * 0.4))),
      soil_health_impact_pct: Math.max(-60, Math.min(40, Math.round(10 - erosion * 0.35))),
      market_viability_score: Math.max(30, Math.min(95, Math.round(55 + weights.market_demand * 0.25))),
      market_demand_status: 'Moderate',
      agronomic_reasoning: `Evaluates continuing ${baselineCrops.join(', ')} under ${erosion.toFixed(0)}/100 RUSLE slope erosion risk.`,
    },
    resilience_build: {
      strategy_name: 'Resilience Build',
      recommended_crop_sequence: resilienceCrops,
      suitability_score: Math.max(45, Math.min(96, Math.round(76 + (weights.budget - 50) * 0.12 - erosion * 0.08))),
      water_efficiency_score: Math.max(40, Math.min(95, Math.round(74 + (100 - stress) * 0.12))),
      soil_health_impact_pct: Math.max(10, Math.min(85, Math.round(32 + Math.min(25, erosion * 0.25)))),
      market_viability_score: Math.max(35, Math.min(95, Math.round(62 + weights.market_demand * 0.24))),
      market_demand_status: weights.market_demand >= 65 ? 'High' : 'Moderate',
      agronomic_reasoning: `Pairs ${resilienceCrops.join(' + ')} to anchor topsoil on ${slope.toFixed(1)}° slopes and boost organic carbon.`,
    },
    water_saver: {
      strategy_name: 'Water-Saver',
      recommended_crop_sequence: waterSaverCrops,
      suitability_score: Math.max(45, Math.min(95, Math.round(74 + (100 - weights.water_availability) * 0.15))),
      water_efficiency_score: Math.max(55, Math.min(98, Math.round(84 + (100 - weights.water_availability) * 0.1))),
      soil_health_impact_pct: 22,
      market_viability_score: Math.max(35, Math.min(94, Math.round(58 + weights.market_demand * 0.25))),
      market_demand_status: 'Moderate',
      agronomic_reasoning: `Combines ${waterSaverCrops.join(' + ')} to minimize evapotranspiration under ${stress.toFixed(1)} Water Stress.`,
    },
  };
}

function CompactMetricBar({
  label,
  value,
  barColor,
}: {
  label: string;
  value: number;
  barColor: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono font-semibold text-white">{clamped}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

export default function RotationStrategyModule({
  profile,
  telemetry,
  terrain,
}: RotationStrategyModuleProps) {
  const [report, setReport] = useState<Module3StrategyResponse | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [openReasoningKey, setOpenReasoningKey] = useState<string | null>(null);

  const [weights, setWeights] = useState<ConstraintWeights>({
    water_availability: 69,
    budget: 88,
    market_demand: 50,
    equipment_access: 50,
  });
  const [climate, setClimate] = useState<ClimateScenario>({
    rainfall_delta_pct: 0,
    temp_delta_c: 0,
  });
  const [weightTab, setWeightTab] = useState<'priorities' | 'climate'>('priorities');
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    profile.preferred_language || 'en',
  );
  const debounceRef = useRef<number | null>(null);
  const hasLoadedRef = useRef(false);

  const loadStrategy = useCallback(async () => {
    try {
      const res = await fetchModule3StrategyApi(false);
      setReport(res);
      if (res.constraint_weights) {
        setWeights({ equipment_access: 50, ...res.constraint_weights });
      }
      if (res.climate_scenario) {
        setClimate(res.climate_scenario);
      }
      if (res.preferred_language_code) {
        setSelectedLanguage(res.preferred_language_code);
      }
    } catch {
      // Fallback matrix renders cleanly
    } finally {
      hasLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    loadStrategy();
  }, [loadStrategy]);

  const triggerRecalculate = useCallback(
    async (nextWeights: ConstraintWeights, lang: string, nextClimate: ClimateScenario) => {
      setRecalculating(true);
      try {
        const res = await recalculateModule3StrategyApi(nextWeights, lang, nextClimate);
        setReport(res);
      } catch {
        // Keep responsive client fallback
      } finally {
        setRecalculating(false);
      }
    },
    [],
  );

  const scheduleRecalculate = (nextWeights: ConstraintWeights, nextClimate: ClimateScenario) => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      triggerRecalculate(nextWeights, selectedLanguage, nextClimate);
    }, 400);
  };

  const handleSliderChange = (
    key: 'water_availability' | 'budget' | 'market_demand' | 'equipment_access',
    val: number,
  ) => {
    const updated = { ...weights, [key]: val };
    setWeights(updated);
    scheduleRecalculate(updated, climate);
  };

  const handleClimateChange = (key: 'rainfall_delta_pct' | 'temp_delta_c', val: number) => {
    const updated = { ...climate, [key]: val };
    setClimate(updated);
    scheduleRecalculate(weights, updated);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const activeData: Module3StrategyData = useMemo(() => {
    if (report?.data && report.data.baseline?.strategy_name) {
      return report.data;
    }
    return buildLocalFallback(profile, telemetry, terrain, weights);
  }, [report, profile, telemetry, terrain, weights]);

  const handleReadAloud = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const langMeta = LANGUAGE_OPTIONS.find((l) => l.code === selectedLanguage) || LANGUAGE_OPTIONS[0];
    const alertText = activeData.realtime_alerts.map((a) => `${a.alert_title}. ${a.alert_message}`).join(' ');
    const strategyText = `${activeData.resilience_build.strategy_name}: ${activeData.resilience_build.agronomic_reasoning}`;
    const utterance = new SpeechSynthesisUtterance(`${alertText} ${strategyText}`.trim());
    utterance.lang = langMeta.bcp47;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const columns: Array<{
    key: 'baseline' | 'resilience_build' | 'water_saver';
    subtitle: string;
    detail: StrategyDetail;
    barColor: string;
  }> = [
    {
      key: 'baseline',
      subtitle: 'Current Baseline',
      detail: activeData.baseline,
      barColor: 'bg-[#FACC15]',
    },
    {
      key: 'resilience_build',
      subtitle: 'Soil Resilience & Cover Rotation',
      detail: activeData.resilience_build,
      barColor: 'bg-[#84CC16]',
    },
    {
      key: 'water_saver',
      subtitle: 'Drought-Tolerant Water-Saver',
      detail: activeData.water_saver,
      barColor: 'bg-[#38BDF8]',
    },
  ];

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* A. Bottom-Left Card: Scenario & Climate Weighting (col-span-3) */}
      <section className="col-span-12 lg:col-span-3 rounded-2xl bg-[#0E1015]/90 backdrop-blur-md border border-white/10 p-5 shadow-2xl flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Scenario &amp; Climate Weighting</h2>
            <button
              type="button"
              onClick={() => triggerRecalculate(weights, selectedLanguage, climate)}
              disabled={recalculating}
              aria-label="Recalculate strategies"
              className="rounded-lg p-1.5 text-slate-400 hover:text-[#84CC16] hover:bg-white/5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin text-[#84CC16]' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#07090D] p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setWeightTab('priorities')}
              className={`rounded-lg py-1 text-[11px] font-medium transition ${
                weightTab === 'priorities'
                  ? 'bg-[#84CC16]/20 text-[#84CC16] border border-[#84CC16]/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Priorities
            </button>
            <button
              type="button"
              onClick={() => setWeightTab('climate')}
              className={`rounded-lg py-1 text-[11px] font-medium transition ${
                weightTab === 'climate'
                  ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Climate Sim
            </button>
          </div>
        </div>

        <div className="space-y-4 my-auto">
          {weightTab === 'priorities' ? (
            [
              {
                key: 'water_availability' as const,
                label: 'Water Availability',
                accent: 'accent-[#38BDF8]',
                valColor: 'text-[#38BDF8]',
              },
              {
                key: 'budget' as const,
                label: 'Input Budget',
                accent: 'accent-[#84CC16]',
                valColor: 'text-[#84CC16]',
              },
              {
                key: 'market_demand' as const,
                label: 'Market Demand',
                accent: 'accent-[#FACC15]',
                valColor: 'text-[#FACC15]',
              },
            ].map((slider) => (
              <label key={slider.key} className="block space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">{slider.label}</span>
                  <span className={`font-mono font-bold ${slider.valColor}`}>
                    {weights[slider.key] ?? 50}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weights[slider.key] ?? 50}
                  onChange={(e) => handleSliderChange(slider.key, Number(e.target.value))}
                  className={`w-full h-1.5 cursor-pointer rounded-lg bg-white/10 ${slider.accent}`}
                />
              </label>
            ))
          ) : (
            <>
              <label className="block space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Rainfall Anomaly</span>
                  <span className="font-mono font-bold text-[#38BDF8]">
                    {climate.rainfall_delta_pct > 0 ? '+' : ''}
                    {climate.rainfall_delta_pct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={-30}
                  max={30}
                  step={5}
                  value={climate.rainfall_delta_pct}
                  onChange={(e) => handleClimateChange('rainfall_delta_pct', Number(e.target.value))}
                  className="w-full h-1.5 cursor-pointer rounded-lg bg-white/10 accent-[#38BDF8]"
                />
              </label>
              <label className="block space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Temperature Shift</span>
                  <span className="font-mono font-bold text-[#FACC15]">
                    +{climate.temp_delta_c.toFixed(1)}°C
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.5}
                  value={climate.temp_delta_c}
                  onChange={(e) => handleClimateChange('temp_delta_c', Number(e.target.value))}
                  className="w-full h-1.5 cursor-pointer rounded-lg bg-white/10 accent-[#FACC15]"
                />
              </label>
              <label className="block space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Equipment Access</span>
                  <span className="font-mono font-bold text-[#84CC16]">
                    {weights.equipment_access ?? 50}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weights.equipment_access ?? 50}
                  onChange={(e) => handleSliderChange('equipment_access', Number(e.target.value))}
                  className="w-full h-1.5 cursor-pointer rounded-lg bg-white/10 accent-[#84CC16]"
                />
              </label>
            </>
          )}
        </div>
      </section>

      {/* B. Bottom-Right Card: Crop Rotation Strategy Comparison (col-span-9) */}
      <section className="col-span-12 lg:col-span-9 rounded-2xl bg-[#0E1015]/90 backdrop-blur-md border border-white/10 p-5 shadow-2xl flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">
            Crop Rotation Strategy Comparison
          </h2>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <span>Language:</span>
              <select
                aria-label="Strategy Language"
                value={selectedLanguage}
                onChange={(e) => {
                  const nextLang = e.target.value;
                  setSelectedLanguage(nextLang);
                  triggerRecalculate(weights, nextLang, climate);
                }}
                className="rounded-lg border border-white/10 bg-[#07090D] px-2.5 py-1 text-xs text-white outline-none cursor-pointer"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleReadAloud}
              className="inline-flex items-center gap-1.5 bg-[#EAB308]/90 hover:bg-[#EAB308] text-black font-semibold px-3.5 py-1 rounded-lg text-xs transition"
            >
              {speaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {speaking ? 'Stop' : 'Read Aloud'}
            </button>
          </div>
        </div>

        <div
          className={`grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10 transition-opacity ${
            recalculating ? 'opacity-65' : ''
          }`}
        >
          {columns.map(({ key, subtitle, detail, barColor }) => {
            const impact = Math.round(detail.soil_health_impact_pct ?? 0);
            const isReasoningOpen = openReasoningKey === key;

            return (
              <div
                key={key}
                className="relative py-3 md:py-0 md:px-5 first:pt-0 first:md:pl-0 last:pb-0 last:md:pr-0 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-white leading-snug">{detail.strategy_name}</h3>
                    <button
                      type="button"
                      onClick={() => setOpenReasoningKey(isReasoningOpen ? null : key)}
                      onMouseEnter={() => setOpenReasoningKey(key)}
                      onMouseLeave={() => setOpenReasoningKey(null)}
                      aria-label={`View reasoning for ${detail.strategy_name}`}
                      className="text-slate-400 hover:text-[#38BDF8] transition shrink-0"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{subtitle}</p>

                  {isReasoningOpen && detail.agronomic_reasoning && (
                    <div className="absolute left-2 right-2 top-8 z-30 rounded-xl bg-[#07090D]/95 backdrop-blur-md border border-white/15 p-3 text-[11px] leading-relaxed text-slate-200 shadow-2xl">
                      {detail.agronomic_reasoning}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(detail.recommended_crop_sequence || []).map((crop, idx) => (
                      <span
                        key={`${crop}-${idx}`}
                        className="bg-white/5 border border-white/10 rounded-full px-2.5 py-1 text-xs text-slate-200 inline-flex items-center gap-1.5"
                      >
                        <span>{getCropIcon(crop)}</span>
                        <span>{crop}</span>
                      </span>
                    ))}
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <CompactMetricBar label="Suitability" value={detail.suitability_score} barColor={barColor} />
                    <CompactMetricBar label="Water Efficiency" value={detail.water_efficiency_score} barColor="bg-[#38BDF8]" />
                    <CompactMetricBar label="Market Viability" value={detail.market_viability_score} barColor="bg-[#FACC15]" />
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center gap-1.5 text-xs font-medium">
                  {impact < 0 ? (
                    <>
                      <MinusCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="text-rose-400">{impact}% Soil Health</span>
                    </>
                  ) : key === 'resilience_build' ? (
                    <>
                      <PlusCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-emerald-400">+{impact}% Soil Health</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-emerald-400">+{impact}% Soil Health</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
