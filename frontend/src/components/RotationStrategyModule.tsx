import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  Droplets,
  Globe,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sprout,
  TrendingDown,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  fetchModule3StrategyApi,
  recalculateModule3StrategyApi,
} from '../services/api';
import type {
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
  { code: 'en', label: 'English', bcp47: 'en-US' },
  { code: 'ml', label: 'Malayalam', bcp47: 'ml-IN' },
  { code: 'hi', label: 'Hindi', bcp47: 'hi-IN' },
  { code: 'ta', label: 'Tamil', bcp47: 'ta-IN' },
  { code: 'kn', label: 'Kannada', bcp47: 'kn-IN' },
  { code: 'te', label: 'Telugu', bcp47: 'te-IN' },
];

function buildLocalFallback(
  profile: FarmerProfile,
  telemetry: TelemetryReport | null,
  terrain: TerrainReport | null,
  weights: ConstraintWeights,
): Module3StrategyData {
  const water = telemetry?.vulnerability_stress_layer?.water_stress;
  const series = water?.series ?? [];
  let smap: number | undefined;
  let stressVal: number | undefined;
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const row = series[i] as unknown as Record<string, unknown>;
    if (smap == null) {
      const candidate =
        row.effective_sm_m3m3 ??
        row.sm_rootzone_m3m3 ??
        row.sm_surface_m3m3 ??
        row.soil_moisture_m3m3 ??
        row.soil_moisture_m3_m3;
      if (typeof candidate === 'number') smap = candidate;
    }
    if (stressVal == null && typeof row.water_stress_index === 'number') {
      stressVal = row.water_stress_index;
    }
    if (smap != null && stressVal != null) break;
  }
  if (smap == null && typeof water?.baseline_stats?.mean_soil_moisture_m3m3 === 'number') {
    smap = water.baseline_stats.mean_soil_moisture_m3m3;
  }
  const stress = stressVal ?? 35;
  const erosion = terrain?.erosion_risk_score ?? 30;
  const slope = terrain?.raw_slope_degrees ?? 4;
  const soil = terrain?.soil_type || 'local soil';
  const isHumidSloped = (terrain?.raw_rainfall_mm ?? 0) > 150 || slope > 12;
  const baselineCrops = profile.crops_grown?.length
    ? profile.crops_grown.slice(0, 3)
    : isHumidSloped
    ? ['Black Pepper', 'Cardamom']
    : ['Rice (Paddy)', 'Maize'];
  const resilienceCrops = isHumidSloped
    ? ['Black Pepper', 'Cowpea (Legume Cover)', 'Vetiver Grass (Slope Stabilizer)']
    : ['Green Gram (Moong)', 'Sunn Hemp Cover', 'Maize'];
  const waterSaverCrops = isHumidSloped
    ? ['Ginger (Mulched)', 'Turmeric', 'Dwarf Banana']
    : ['Pearl Millet (Bajra)', 'Chickpea', 'Sesame'];

  return {
    realtime_alerts: [
      {
        alert_title: `Telemetry Advisory (${profile.location_name})`,
        alert_message: `Soil moisture is ${smap != null ? `${smap.toFixed(3)} m³/m³` : 'N/A'}, Water Stress Index is ${stress.toFixed(1)}, and RUSLE Erosion Risk is ${erosion.toFixed(1)}/100.`,
        severity: erosion >= 65 || stress >= 65 ? 'HIGH' : 'MEDIUM',
      },
    ],
    baseline: {
      strategy_name: 'Baseline Continuation',
      recommended_crop_sequence: baselineCrops,
      suitability_score: Math.max(25, Math.min(92, Math.round(78 - erosion * 0.28 - stress * 0.18))),
      water_efficiency_score: Math.max(20, Math.min(90, Math.round(72 - stress * 0.4))),
      soil_health_impact_pct: Math.max(-60, Math.min(40, Math.round(10 - erosion * 0.35))),
      market_viability_score: Math.max(30, Math.min(95, Math.round(55 + weights.market_demand * 0.25))),
      market_demand_status: 'Moderate',
      agronomic_reasoning: `Evaluates continuing ${baselineCrops.join(', ')} on ${soil} (${slope.toFixed(1)}° slope) under current telemetry.`,
    },
    resilience_build: {
      strategy_name: 'Soil Resilience & Cover Rotation',
      recommended_crop_sequence: resilienceCrops,
      suitability_score: Math.max(45, Math.min(96, Math.round(76 + (weights.budget - 50) * 0.12 - erosion * 0.08))),
      water_efficiency_score: Math.max(40, Math.min(95, Math.round(74 + (100 - stress) * 0.12))),
      soil_health_impact_pct: Math.max(10, Math.min(85, Math.round(32 + Math.min(25, erosion * 0.25)))),
      market_viability_score: Math.max(35, Math.min(95, Math.round(62 + weights.market_demand * 0.24))),
      market_demand_status: weights.market_demand >= 65 ? 'High' : 'Moderate',
      agronomic_reasoning: `Pairs ${resilienceCrops.join(', ')} to stabilize ${soil} and reduce RUSLE erosion risk.`,
    },
    water_saver: {
      strategy_name: 'Low-ET Water-Saver Rotation',
      recommended_crop_sequence: waterSaverCrops,
      suitability_score: Math.max(45, Math.min(95, Math.round(74 + (100 - weights.water_availability) * 0.15))),
      water_efficiency_score: Math.max(55, Math.min(98, Math.round(84 + (100 - weights.water_availability) * 0.1))),
      soil_health_impact_pct: 22,
      market_viability_score: Math.max(35, Math.min(94, Math.round(58 + weights.market_demand * 0.25))),
      market_demand_status: 'Moderate',
      agronomic_reasoning: `Prioritizes low-evapotranspiration crops to buffer against ${stress.toFixed(1)} Water Stress Index.`,
    },
  };
}

function MetricBar({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono font-semibold text-white">{clamped}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${clamped}%` }} />
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
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const [weights, setWeights] = useState<ConstraintWeights>({
    water_availability: 50,
    budget: 50,
    market_demand: 50,
  });
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    profile.preferred_language || 'en',
  );

  const loadStrategy = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setApiNotice(null);
    try {
      const res = await fetchModule3StrategyApi(forceRefresh);
      setReport(res);
      if (res.constraint_weights) {
        setWeights(res.constraint_weights);
      }
      if (res.preferred_language_code) {
        setSelectedLanguage(res.preferred_language_code);
      }
    } catch {
      setApiNotice('Live Module 3 endpoint unreachable; showing telemetry-grounded fallback strategies.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStrategy(false);
  }, [loadStrategy]);

  useEffect(() => {
    if (!report || report.status !== 'processing') return;
    const timer = window.setInterval(() => {
      loadStrategy(false);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [report, loadStrategy]);

  const handleRecalculate = async (overrideLang?: string) => {
    const langToUse = overrideLang ?? selectedLanguage;
    setRecalculating(true);
    setApiNotice(null);
    try {
      const res = await recalculateModule3StrategyApi(weights, langToUse);
      setReport(res);
    } catch {
      setApiNotice('Recalculation endpoint unavailable; showing updated local fallback strategies.');
    } finally {
      setRecalculating(false);
    }
  };

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

  const strategyCards: Array<{
    key: 'baseline' | 'resilience_build' | 'water_saver';
    badge: string;
    detail: StrategyDetail;
    accentBorder: string;
    accentText: string;
    barClass: string;
    pillClass: string;
  }> = [
    {
      key: 'baseline',
      badge: 'Strategy 1 • Baseline',
      detail: activeData.baseline,
      accentBorder: 'border-[#FACC15]/30',
      accentText: 'text-[#FACC15]',
      barClass: 'bg-[#FACC15]',
      pillClass: 'border-[#FACC15]/30 bg-[#FACC15]/10 text-[#FACC15]',
    },
    {
      key: 'resilience_build',
      badge: 'Strategy 2 • Resilience Build',
      detail: activeData.resilience_build,
      accentBorder: 'border-[#84CC16]/35',
      accentText: 'text-[#84CC16]',
      barClass: 'bg-[#84CC16]',
      pillClass: 'border-[#84CC16]/30 bg-[#84CC16]/10 text-[#84CC16]',
    },
    {
      key: 'water_saver',
      badge: 'Strategy 3 • Water-Saver',
      detail: activeData.water_saver,
      accentBorder: 'border-[#38BDF8]/35',
      accentText: 'text-[#38BDF8]',
      barClass: 'bg-[#38BDF8]',
      pillClass: 'border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#38BDF8]',
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#84CC16]" />
          <h2 className="text-lg font-bold tracking-tight text-white">
            Module 3: Global Rotation Strategy &amp; AI Decision Engine
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0E1015]/80 px-3 py-1.5 text-xs text-slate-300">
            <Globe className="w-3.5 h-3.5 text-[#38BDF8]" />
            <select
              aria-label="Preferred Strategy Language"
              value={selectedLanguage}
              onChange={(e) => {
                const nextLang = e.target.value;
                setSelectedLanguage(nextLang);
                handleRecalculate(nextLang);
              }}
              className="bg-transparent text-xs text-white outline-none cursor-pointer"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code} className="bg-[#0E1015] text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleReadAloud}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0E1015]/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-[#84CC16]/40 hover:text-white transition"
          >
            {speaking ? <VolumeX className="w-3.5 h-3.5 text-[#FACC15]" /> : <Volume2 className="w-3.5 h-3.5 text-[#84CC16]" />}
            {speaking ? 'Stop Audio' : 'Read Aloud'}
          </button>
        </div>
      </div>

      {loading && !report && (
        <div className="rounded-2xl bg-[#0E1015]/80 backdrop-blur-md border border-white/10 p-6 flex items-center gap-4 text-sm text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-[#84CC16] shrink-0" />
          <div>
            <p className="font-medium text-white">
              Synthesizing Module 3 rotation intelligence for {profile.location_name}
            </p>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Coordinates: ({profile.latitude.toFixed(4)}, {profile.longitude.toFixed(4)})
            </p>
          </div>
        </div>
      )}

      {apiNotice && (
        <div className="rounded-xl border border-[#FACC15]/30 bg-[#FACC15]/10 px-4 py-2.5 text-xs text-[#FACC15] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{apiNotice}</span>
        </div>
      )}

      {/* Localized Telemetry Advisory Banner */}
      <div className="space-y-2">
        {activeData.realtime_alerts.map((alert, idx) => (
          <div
            key={`${alert.alert_title}-${idx}`}
            className={`rounded-2xl bg-[#0E1015]/80 backdrop-blur-md border p-4 flex items-start gap-3 ${
              alert.severity === 'HIGH'
                ? 'border-[#FACC15]/40'
                : alert.severity === 'MEDIUM'
                ? 'border-[#38BDF8]/30'
                : 'border-[#84CC16]/30'
            }`}
          >
            <AlertTriangle
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                alert.severity === 'HIGH' ? 'text-[#FACC15]' : 'text-[#38BDF8]'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{alert.alert_title}</p>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-300">
                  {alert.severity}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{alert.alert_message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Farmer Constraint Weighting Sliders */}
      <div className="rounded-2xl bg-[#0E1015]/80 backdrop-blur-md border border-white/10 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#84CC16]" />
            <h3 className="text-sm font-semibold text-white">Farmer Constraint Weighting</h3>
          </div>
          <button
            type="button"
            onClick={() => handleRecalculate()}
            disabled={recalculating}
            className="inline-flex items-center gap-2 rounded-xl border border-[#84CC16]/40 bg-[#84CC16]/15 px-3.5 py-1.5 text-xs font-semibold text-[#84CC16] hover:bg-[#84CC16]/25 transition disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Recalculating...' : 'Recalculate Strategies'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { key: 'water_availability' as const, label: 'Water Availability', accent: 'accent-[#38BDF8]' },
            { key: 'budget' as const, label: 'Budget', accent: 'accent-[#84CC16]' },
            { key: 'market_demand' as const, label: 'Market Demand', accent: 'accent-[#FACC15]' },
          ].map((slider) => (
            <label key={slider.key} className="block space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{slider.label}</span>
                <span className="font-mono font-semibold text-white">{weights[slider.key]}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={weights[slider.key]}
                onChange={(e) =>
                  setWeights((prev) => ({ ...prev, [slider.key]: Number(e.target.value) }))
                }
                className={`w-full cursor-pointer ${slider.accent}`}
              />
            </label>
          ))}
        </div>
      </div>

      {/* 3-Strategy Comparison Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {strategyCards.map(({ key, badge, detail, accentBorder, accentText, barClass, pillClass }) => (
          <div
            key={key}
            className={`rounded-2xl bg-[#0E1015]/80 backdrop-blur-md border ${accentBorder} p-5 flex flex-col justify-between space-y-4 ${
              recalculating ? 'opacity-60' : ''
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${accentText}`}>
                  {badge}
                </span>
                {detail.market_demand_status === 'Crashing' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-rose-300">
                    <TrendingDown className="w-3 h-3" />
                    Market Crashing
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-slate-300">
                    Demand: {detail.market_demand_status}
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {key === 'resilience_build' && <ShieldCheck className="w-4 h-4 text-[#84CC16] shrink-0" />}
                {key === 'water_saver' && <Droplets className="w-4 h-4 text-[#38BDF8] shrink-0" />}
                {key === 'baseline' && <Sprout className="w-4 h-4 text-[#FACC15] shrink-0" />}
                <span>{detail.strategy_name}</span>
              </h3>

              <div className="flex flex-wrap gap-1.5">
                {(detail.recommended_crop_sequence || []).map((crop, i) => (
                  <span
                    key={`${crop}-${i}`}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${pillClass}`}
                  >
                    {i + 1}. {crop}
                  </span>
                ))}
              </div>

              <div className="space-y-2.5 pt-1">
                <MetricBar label="Suitability" value={detail.suitability_score} colorClass={barClass} />
                <MetricBar label="Water Efficiency" value={detail.water_efficiency_score} colorClass="bg-[#38BDF8]" />
                <MetricBar label="Market Viability" value={detail.market_viability_score} colorClass="bg-[#FACC15]" />
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-slate-400">Soil Health Impact</span>
                  <span
                    className={`font-mono font-semibold ${
                      detail.soil_health_impact_pct >= 0 ? 'text-[#84CC16]' : 'text-rose-400'
                    }`}
                  >
                    {detail.soil_health_impact_pct >= 0 ? '+' : ''}
                    {detail.soil_health_impact_pct}%
                  </span>
                </div>
              </div>
            </div>

            <p className="border-t border-white/10 pt-3 text-xs leading-relaxed text-slate-300">
              {detail.agronomic_reasoning}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
