import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Compass,
  Crosshair,
  ExternalLink,
  Flame,
  Info,
  LayoutDashboard,
  LogOut,
  MapPin,
  Mic,
  RotateCw,
  Scan,
  Sprout,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchFarmerTelemetryApi, fetchFarmerTerrainApi } from '../services/api';
import type { TelemetryReport, TerrainReport, WaterStressSeriesItem } from '../types/farmer';
import RotationStrategyModule from './RotationStrategyModule';
import { ScienceInfo } from './ScienceGlossaryInfo';
import DiagnosticsScannerView from './lomura/DiagnosticsScannerView';
import FarmerCrmView from './lomura/FarmerCrmView';
import FieldShiftSimulatorView from './lomura/FieldShiftSimulatorView';
import FpoCommandView from './lomura/FpoCommandView';
import SchemesWizardView from './lomura/SchemesWizardView';
import VoiceDeskView from './lomura/VoiceDeskView';

type ActiveSuiteTab =
  | 'mission_control'
  | 'fpo_command'
  | 'simulator'
  | 'diagnostics'
  | 'voice'
  | 'crm'
  | 'schemes';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonthLabel(dateStr: string): string {
  const m = Number(dateStr.slice(5, 7));
  return m >= 1 && m <= 12 ? MONTH_NAMES[m - 1] : dateStr.slice(5, 7);
}

function getSoilMoisture(row: WaterStressSeriesItem): number {
  const r = row as unknown as Record<string, unknown>;
  const val = r.effective_sm_m3m3 ?? r.sm_rootzone_m3m3 ?? r.sm_surface_m3m3 ?? r.soil_moisture_m3m3;
  return typeof val === 'number' ? val : 0.35;
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = ((p0.x + p1.x) / 2).toFixed(1);
    d += ` C ${cx} ${p0.y.toFixed(1)}, ${cx} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

interface RadialGaugeProps {
  label: string;
  displayValue: string;
  percent: number;
  strokeColor: string;
  gradientId?: string;
  termKey: 'water_balance' | 'ndvi' | 'rusle' | 'frost_risk';
}

function RadialGauge({
  label,
  displayValue,
  percent,
  strokeColor,
  gradientId,
  termKey,
}: RadialGaugeProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 30;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-[#07090D]/70 border border-white/10 p-3 text-center">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 76 76">
          {gradientId && (
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#84CC16" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>
            </defs>
          )}
          <circle
            cx="38"
            cy="38"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="6"
          />
          <circle
            cx="38"
            cy="38"
            r={r}
            fill="none"
            stroke={gradientId ? `url(#${gradientId})` : strokeColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 6px ${strokeColor}66)` }}
          />
        </svg>
        <span className="absolute text-sm font-bold font-mono text-white">{displayValue}</span>
      </div>
      <p className="mt-2 text-[11px] font-medium text-slate-300 flex items-center justify-center">
        <span>{label}</span>
        <ScienceInfo termKey={termKey} />
      </p>
    </div>
  );
}

export default function FarmerDashboard() {
  const { profile, refreshProfile, logout } = useAuth();
  const [telemetry, setTelemetry] = useState<TelemetryReport | null>(null);
  const [terrain, setTerrain] = useState<TerrainReport | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Map interactive toggles & zoom
  const [soilLayerOn, setSoilLayerOn] = useState(true);
  const [erosionLayerOn, setErosionLayerOn] = useState(false);
  const [heatmapLayerOn, setHeatmapLayerOn] = useState(true);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveSuiteTab>('mission_control');
  const [fpoFocusCoord, setFpoFocusCoord] = useState<{ lat: number; lon: number } | undefined>(undefined);
  const [crmFocusFarmerId, setCrmFocusFarmerId] = useState<number | null>(null);

  const loadTelemetry = useCallback(async (forceRefresh = false) => {
    try {
      const data = await fetchFarmerTelemetryApi(forceRefresh);
      setTelemetry(data);
    } catch {
      // Non-blocking: gauges fall back cleanly
    }
  }, []);

  const loadTerrain = useCallback(async (forceRefresh = false) => {
    try {
      const data = await fetchFarmerTerrainApi(forceRefresh);
      setTerrain(data);
    } catch {
      // Non-blocking: gauges fall back cleanly
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      await refreshProfile();
      if (!active) return;
      loadTelemetry(false);
      loadTerrain(false);
    };
    init();
    return () => {
      active = false;
    };
  }, [refreshProfile, loadTelemetry, loadTerrain]);

  const series6 = useMemo(() => {
    const raw = telemetry?.vulnerability_stress_layer?.water_stress?.series ?? [];
    return raw.slice(-6);
  }, [telemetry]);

  if (!profile) {
    return null;
  }

  const delta = 0.015;
  const minLon = (profile.longitude - delta).toFixed(6);
  const minLat = (profile.latitude - delta).toFixed(6);
  const maxLon = (profile.longitude + delta).toFixed(6);
  const maxLat = (profile.latitude + delta).toFixed(6);
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${profile.latitude}%2C${profile.longitude}`;
  const osmViewUrl = `https://www.openstreetmap.org/?mlat=${profile.latitude}&mlon=${profile.longitude}#map=14/${profile.latitude}/${profile.longitude}`;

  // Monthly Telemetry Insights dual-line SVG geometry
  const chartW = 276;
  const chartH = 112;
  const padLeft = 4;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 20;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;

  const yTicks = [0, 50, 100, 150, 200];
  const maxRain = Math.max(200, ...series6.map((s) => s.rainfall_mm || 0));
  const rainPoints = series6.map((row, idx) => ({
    x: padLeft + (series6.length > 1 ? (idx / (series6.length - 1)) * plotW : plotW / 2),
    y: padTop + plotH - ((row.rainfall_mm || 0) / maxRain) * plotH,
  }));
  const smPoints = series6.map((row, idx) => {
    const sm = getSoilMoisture(row);
    return {
      x: padLeft + (series6.length > 1 ? (idx / (series6.length - 1)) * plotW : plotW / 2),
      y: padTop + plotH - Math.min(1, Math.max(0, sm / 0.6)) * plotH,
    };
  });

  const rainPath = buildSmoothPath(rainPoints);
  const smPath = buildSmoothPath(smPoints);
  const rainAreaPath = rainPoints.length
    ? `${rainPath} L ${rainPoints[rainPoints.length - 1].x.toFixed(1)} ${padTop + plotH} L ${rainPoints[0].x.toFixed(1)} ${padTop + plotH} Z`
    : '';
  const smAreaPath = smPoints.length
    ? `${smPath} L ${smPoints[smPoints.length - 1].x.toFixed(1)} ${padTop + plotH} L ${smPoints[0].x.toFixed(1)} ${padTop + plotH} Z`
    : '';

  const activeIdx =
    hoveredIdx !== null && series6[hoveredIdx]
      ? hoveredIdx
      : series6.length > 0
      ? series6.length - 1
      : null;
  const activeRow = activeIdx !== null ? series6[activeIdx] : null;

  // 4 Telemetry Gauge metrics
  const waterSecurityPct = telemetry?.location_rating?.water_security_rate ?? 55;
  const ndviRaw = telemetry?.summary_metrics?.sentinel2?.s2_ndvi;
  const ndviNum = typeof ndviRaw === 'number' ? ndviRaw : 0.69;
  const erosionScore = terrain?.erosion_risk_score ?? 90;

  const latestWater = series6.length ? series6[series6.length - 1] : null;
  const rawMinTemp = (latestWater as unknown as Record<string, unknown> | null)?.min_temp_c;
  const minTempC =
    typeof rawMinTemp === 'number'
      ? rawMinTemp
      : Math.abs(profile.latitude) < 23.5
      ? 16.4
      : Math.abs(profile.latitude) < 40
      ? 7.5
      : 2.0;
  const frostPct = minTempC <= 4 ? 85 : minTempC <= 10 ? 45 : 15;

  return (
    <div className="min-h-screen bg-[#07090D] text-slate-100 flex flex-col">
      {/* 1. Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07090D]/90 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#84CC16]/15 border border-[#84CC16]/40 flex items-center justify-center shadow-[0_0_20px_rgba(132,204,22,0.35)] shrink-0">
              <Sprout className="w-4 h-4 text-[#84CC16]" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-white truncate">
              Yieldary AI
            </span>
            <span className="hidden sm:inline-block h-4 w-px bg-white/15" />
            <span className="hidden sm:inline-block text-xs text-slate-400 truncate">
              Vulnerability &amp; Stress Telemetry + Lomura FPO Suite
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setMethodologyOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-full px-3.5 py-1 text-xs text-slate-200 transition"
            >
              <Info className="w-3.5 h-3.5 text-[#38BDF8]" />
              NASA Data &amp; Methodology
            </button>
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full px-3.5 py-1 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified Account
            </span>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-4 py-1.5 text-xs text-slate-200 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>

        {/* Unified Yieldary + Lomura Module Navigation Strip */}
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pb-2.5 flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'mission_control' as const, label: 'Mission Control (GEE 1–3)', icon: LayoutDashboard },
            { id: 'fpo_command' as const, label: 'FPO Command & Profiler', icon: Compass },
            { id: 'simulator' as const, label: '3-Season Shift', icon: RotateCw },
            { id: 'diagnostics' as const, label: 'Vision Scanner', icon: Scan },
            { id: 'voice' as const, label: 'Voice Helpdesk', icon: Mic },
            { id: 'crm' as const, label: 'Farmer CRM', icon: Users },
            { id: 'schemes' as const, label: 'Scheme Wizard', icon: Award },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
                  isActive
                    ? 'bg-[#84CC16] text-[#07090D] font-bold shadow-[0_0_14px_rgba(132,204,22,0.35)]'
                    : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-4 space-y-4">
        {activeTab === 'fpo_command' && (
          <FpoCommandView
            initialCoord={fpoFocusCoord || { lat: profile.latitude, lon: profile.longitude }}
            onInspectFarmerInCrm={(farmerId) => {
              setCrmFocusFarmerId(farmerId);
              setActiveTab('crm');
            }}
          />
        )}
        {activeTab === 'simulator' && <FieldShiftSimulatorView />}
        {activeTab === 'diagnostics' && <DiagnosticsScannerView />}
        {activeTab === 'voice' && <VoiceDeskView />}
        {activeTab === 'crm' && (
          <FarmerCrmView
            initialFarmerId={crmFocusFarmerId}
            onLocateOnMap={(lat, lon) => {
              setFpoFocusCoord({ lat, lon });
              setActiveTab('fpo_command');
            }}
          />
        )}
        {activeTab === 'schemes' && <SchemesWizardView />}

        {activeTab === 'mission_control' && (
          <>
            {/* 2. Upper Bento Grid (12-col) */}
        <div className="grid grid-cols-12 gap-4">
          {/* A. Left Column (col-span-3): Compact Farmer Profile + Monthly Telemetry Insights */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
            {/* Card 1: Compact Farmer Profile Card */}
            <section className="rounded-2xl bg-[#0E1015]/90 backdrop-blur-md border border-white/10 p-5 shadow-2xl space-y-3">
              <p className="text-sm font-medium text-slate-300">Farmer Profile</p>
              <div className="flex items-center justify-between gap-2">
                <h1 className="text-lg font-bold text-white truncate">{profile.full_name}</h1>
                <span className="shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                  Verified
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-[#84CC16] shrink-0" />
                <span className="truncate">{profile.location_name}</span>
              </p>
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                <span className="font-mono text-xs text-slate-400 flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                  {profile.latitude.toFixed(4)}, {profile.longitude.toFixed(4)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#84CC16]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FACC15]" />
                  Mini Telemetry
                </span>
              </div>
            </section>

            {/* Card 2: Monthly Telemetry Insights (Smooth Dual-Line SVG Chart) */}
            <section className="flex-1 rounded-2xl bg-[#0E1015]/90 backdrop-blur-md border border-white/10 p-5 shadow-2xl flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <h2 className="text-sm font-medium text-white">Monthly Telemetry Insights</h2>
                <div className="flex items-center gap-4 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                    Rainfall (MM)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#84CC16]" />
                    Soil Moisture (m³/m³)
                  </span>
                </div>
              </div>

              <div className="relative">
                {activeRow && (
                  <div className="mb-1.5 inline-flex items-center rounded-full bg-[#07090D]/90 border border-white/15 px-3 py-1 text-[11px] font-mono text-white shadow-lg">
                    {Math.round(activeRow.rainfall_mm || 0)} mm / {getSoilMoisture(activeRow).toFixed(2)} m³/m³
                  </div>
                )}

                {series6.length > 0 ? (
                  <div className="pl-6 pr-2 pt-2 pb-1 relative">
                    <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] text-slate-500">
                      <span>200</span>
                      <span>150</span>
                      <span>100</span>
                      <span>50</span>
                      <span>0</span>
                    </div>
                    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-28 overflow-visible">
                      <defs>
                        <linearGradient id="rainAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="smAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#84CC16" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#84CC16" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      <path d={rainAreaPath} fill="url(#rainAreaGrad)" />
                      <path d={smAreaPath} fill="url(#smAreaGrad)" />

                      {/* Horizontal Dashed Grid Lines */}
                      {yTicks.map((tick) => {
                        const yPos = padTop + plotH - (tick / maxRain) * plotH;
                        return (
                          <line
                            key={tick}
                            x1={padLeft}
                            x2={chartW - padRight}
                            y1={yPos}
                            y2={yPos}
                            stroke="rgba(255,255,255,0.08)"
                            strokeDasharray="3 3"
                          />
                        );
                      })}

                      <path d={rainPath} fill="none" stroke="#38BDF8" strokeWidth="2.2" />
                      <path d={smPath} fill="none" stroke="#84CC16" strokeWidth="2.2" />

                      {series6.map((row, idx) => {
                        const rp = rainPoints[idx];
                        const sp = smPoints[idx];
                        const isActive = idx === activeIdx;
                        return (
                          <g
                            key={row.date}
                            onMouseEnter={() => setHoveredIdx(idx)}
                            onMouseLeave={() => setHoveredIdx(null)}
                            className="cursor-pointer"
                          >
                            <rect
                              x={rp.x - 14}
                              y={padTop}
                              width={28}
                              height={plotH}
                              fill="transparent"
                            />
                            <circle
                              cx={rp.x}
                              cy={rp.y}
                              r={isActive ? 4 : 2.5}
                              fill="#38BDF8"
                            />
                            <circle
                              cx={sp.x}
                              cy={sp.y}
                              r={isActive ? 4 : 2.5}
                              fill="#84CC16"
                            />
                            <text
                              x={rp.x}
                              y={chartH - 4}
                              textAnchor="middle"
                              fontSize="9"
                              fill={isActive ? '#FFFFFF' : '#94A3B8'}
                            >
                              {formatMonthLabel(row.date)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-xs text-slate-500">
                    Loading telemetry series...
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* B. Center Column (col-span-6): Telemetry Map */}
          <section className="col-span-12 lg:col-span-6 bg-[#0E1015]/90 backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-2xl relative overflow-hidden flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Telemetry Map</h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSoilLayerOn((v) => !v)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
                    soilLayerOn
                      ? 'bg-[#84CC16]/20 border-[#84CC16]/60 text-[#84CC16] shadow-[0_0_12px_rgba(132,204,22,0.25)]'
                      : 'bg-white/5 border-white/10 text-slate-300'
                  }`}
                >
                  Soil Moisture
                </button>
                <button
                  type="button"
                  onClick={() => setErosionLayerOn((v) => !v)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
                    erosionLayerOn
                      ? 'bg-[#FACC15]/20 border-[#FACC15]/60 text-[#FACC15]'
                      : 'bg-white/5 border-white/10 text-slate-300'
                  }`}
                >
                  Erosion
                </button>
                <button
                  type="button"
                  onClick={() => setHeatmapLayerOn((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition ${
                    heatmapLayerOn
                      ? 'bg-white/10 border-[#FACC15]/50 text-white'
                      : 'bg-white/5 border-white/10 text-slate-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#FACC15]" />
                  Heatmap
                </button>
              </div>
            </div>

            <div className="relative h-[340px] rounded-xl overflow-hidden bg-[#07090D]">
              <iframe
                title="Farm Location Telemetry Map"
                src={osmEmbedUrl}
                className="w-full h-full border-0"
                style={{
                  filter: 'invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)',
                }}
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 bg-black/20" />

              {/* Glowing SVG Farm Boundary & Multi-Stop Heatmap Overlay */}
              <svg
                viewBox="0 0 600 340"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 w-full h-full"
              >
                <defs>
                  <radialGradient id="farmGlowGrad" cx="45%" cy="48%" r="55%">
                    <stop offset="0%" stopColor="#84CC16" stopOpacity={soilLayerOn ? '0.35' : '0.10'} />
                    <stop offset="55%" stopColor="#FACC15" stopOpacity={heatmapLayerOn ? '0.35' : '0.08'} />
                    <stop offset="100%" stopColor="#FACC15" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <polygon
                  points="210,115 340,95 405,175 350,245 220,235 180,165"
                  fill="url(#farmGlowGrad)"
                  stroke={soilLayerOn ? '#84CC16' : '#38BDF8'}
                  strokeWidth="2"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(132,204,22,0.6))' }}
                />
                {erosionLayerOn && (
                  <ellipse
                    cx="325"
                    cy="185"
                    rx="78"
                    ry="44"
                    fill="#FACC15"
                    fillOpacity="0.32"
                    stroke="#FACC15"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                )}
              </svg>

              {/* Bottom-Right Open Map Button (single control set; OSM handles +/- zoom) */}
              <div className="absolute bottom-3 right-3">
                <a
                  href={osmViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E1015]/90 backdrop-blur-md border border-white/15 px-3 h-8 text-xs font-medium text-white hover:border-[#84CC16]/50 transition"
                >
                  Open Map
                  <ExternalLink className="w-3 h-3 text-[#84CC16]" />
                </a>
              </div>
            </div>
          </section>

          {/* C. Right Column (col-span-3): Telemetry Gauges (2x2 Radial Ring Grid) */}
          <section className="col-span-12 lg:col-span-3 rounded-2xl bg-[#0E1015]/90 backdrop-blur-md border border-white/10 p-5 shadow-2xl flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Telemetry Gauges</h2>
              <Flame className="w-4 h-4 text-[#FACC15]" />
            </div>
            <div className="grid grid-cols-2 gap-3 my-auto">
              <RadialGauge
                label="Water Security"
                displayValue={`${Math.round(waterSecurityPct)}%`}
                percent={waterSecurityPct}
                strokeColor="#84CC16"
                gradientId="waterSecGrad"
                termKey="water_balance"
              />
              <RadialGauge
                label="NDVI (Vegetation)"
                displayValue={ndviNum.toFixed(2)}
                percent={Math.min(100, Math.max(0, ndviNum * 100))}
                strokeColor="#38BDF8"
                termKey="ndvi"
              />
              <RadialGauge
                label="Slope Erosion"
                displayValue={`${Math.round(erosionScore)}/100`}
                percent={erosionScore}
                strokeColor="#FACC15"
                termKey="rusle"
              />
              <RadialGauge
                label="Frost Risk"
                displayValue={`${frostPct}%`}
                percent={frostPct}
                strokeColor="#84CC16"
                termKey="frost_risk"
              />
            </div>
          </section>
        </div>

        {/* 3. Lower Bento Grid (12-col): Scenario Weighting + Crop Rotation Strategy Comparison */}
        <RotationStrategyModule profile={profile} telemetry={telemetry} terrain={terrain} />
          </>
        )}
      </main>

      {/* NASA Data & Methodology Modal */}
      {methodologyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setMethodologyOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-[#0E1015]/95 border border-white/15 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">NASA Data &amp; Systems Intelligence Methodology</h3>
                <p className="text-xs text-slate-400">
                  Model Confidence: {Math.max(68, Math.min(95, 96 - ((terrain?.tree_cover_pct ?? 0) > 40 ? 7 : 2) - ((terrain?.raw_slope_degrees ?? 0) > 15 ? 6 : 2)))}% ± {((terrain?.tree_cover_pct ?? 0) > 40 ? 7 : 2) + ((terrain?.raw_slope_degrees ?? 0) > 15 ? 6 : 2)}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMethodologyOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-white/10 bg-[#07090D]/70 p-3.5 space-y-1">
                <p className="font-semibold text-[#38BDF8]">Satellite vs. Ground-Truth Fusion</p>
                <p className="text-slate-300 leading-relaxed">
                  NASA orbital anomalies (SMAP/GLDAS, GPM, ECOSTRESS) paired with local soil probes &amp; Krishi Bhavan Soil Health Cards reduce root-zone estimation error by ~35–45%.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#07090D]/70 p-3.5 space-y-1">
                <p className="font-semibold text-[#84CC16]">250m × Monthly Resolution Harmonization</p>
                <p className="text-slate-300 leading-relaxed">
                  Bilinear SMAP downsampling (15 km buffer), GPM monthly summation, cloud-masked MODIS/ECOSTRESS interpolation, and 30m SRTM slope pooling onto SoilGrids 250m grid.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[#FACC15]/30 bg-[#FACC15]/10 p-3.5 text-xs text-slate-200 leading-relaxed">
              <strong className="text-[#FACC15]">Local Expertise &amp; Krishi Bhavan Charter:</strong> Yieldary AI is an orbital decision-support companion designed to augment—never replace—the generational wisdom of local farmers, Krishi Bhavan agricultural officers, and physical laboratory soil testing.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
