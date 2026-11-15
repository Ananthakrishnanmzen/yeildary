import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudRain,
  Code2,
  Compass,
  Copy,
  Crosshair,
  Droplets,
  Layers,
  Leaf,
  Radio,
  Satellite,
  Send,
  ShieldAlert,
  Sprout,
  Thermometer,
  TrendingUp,
  Wind,
  X,
} from 'lucide-react';
import { dashboardService, profilerService } from '../../services/api';

interface FpoCommandViewProps {
  initialCoord?: { lat: number; lon: number };
  onInspectFarmerInCrm?: (farmerId: number) => void;
}

export default function FpoCommandView({
  initialCoord,
  onInspectFarmerInCrm,
}: FpoCommandViewProps) {
  const [selectedCoord, setSelectedCoord] = useState<{ lat: number; lon: number }>(
    initialCoord || { lat: 9.8959, lon: 76.7184 },
  );
  const [latInput, setLatInput] = useState(String((initialCoord?.lat ?? 9.8959).toFixed(4)));
  const [lonInput, setLonInput] = useState(String((initialCoord?.lon ?? 76.7184).toFixed(4)));
  const [macroMetrics, setMacroMetrics] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [plots, setPlots] = useState<any[]>([]);
  const [selectedPlot, setSelectedPlot] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState(
    'FPO High Alert: High fungal blast conditions active. Spray Pseudomonas (20g/L) and clear field drainage channels immediately.',
  );
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);
  const [splineData, setSplineData] = useState<any>(null);

  // One-Tap Satellite Field Profiler state
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [scanStep, setScanStep] = useState(1);
  const [showProfilerDrawer, setShowProfilerDrawer] = useState(true);
  const [activeClimateTab, setActiveClimateTab] = useState<'rain' | 'temp' | 'solar'>('rain');
  const [rawJsonOpen, setRawJsonOpen] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    if (initialCoord) {
      setSelectedCoord(initialCoord);
      setLatInput(initialCoord.lat.toFixed(4));
      setLonInput(initialCoord.lon.toFixed(4));
      fetchFieldProfile(initialCoord.lat, initialCoord.lon);
    }
  }, [initialCoord?.lat, initialCoord?.lon]);

  useEffect(() => {
    dashboardService.getMetrics().then((res) => setMacroMetrics(res.data)).catch(() => {});
    dashboardService.getWeatherForecast().then((res) => setWeatherData(res.data)).catch(() => {});
    dashboardService
      .getPlotsHeatmap()
      .then((res) => {
        const list = res.data?.plots || [];
        setPlots(list);
        if (list.length > 0) setSelectedPlot(list[0]);
      })
      .catch(() => {});
    dashboardService.getAlerts().then((res) => setAlerts(res.data || [])).catch(() => {});
    dashboardService.getYieldSpline().then((res) => setSplineData(res.data)).catch(() => {});
    fetchFieldProfile(selectedCoord.lat, selectedCoord.lon);
  }, []);

  const fetchFieldProfile = async (lat: number, lon: number, customLabel?: string) => {
    setSelectedCoord({ lat, lon });
    setLatInput(lat.toFixed(4));
    setLonInput(lon.toFixed(4));
    setIsLoadingProfile(true);
    setScanStep(1);
    const timer = setInterval(() => {
      setScanStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 350);

    try {
      const res = await profilerService.getFieldProfile(lat, lon);
      clearInterval(timer);
      const data = res.data;
      if (customLabel && data?.location) {
        data.location.name = customLabel;
      }
      setProfileData(data);
      setScanStep(4);
    } catch {
      clearInterval(timer);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleBroadcast = async () => {
    try {
      const res = await dashboardService.broadcastWarning({
        title: 'Urgent Microclimate Blast Warning',
        message: broadcastMsg,
        severity: 'High',
        category: 'Pest Outbreak',
        suggested_action: 'Apply bio-fungicide Pseudomonas or Propiconazole 1ml/L',
      });
      setBroadcastSuccess(res.data?.message || 'Broadcast dispatched to cluster farmers!');
      setShowBroadcastModal(false);
      const updated = await dashboardService.getAlerts();
      setAlerts(updated.data || []);
      setTimeout(() => setBroadcastSuccess(null), 5000);
    } catch {
      // ignore
    }
  };

  const currentWeather = weatherData?.current || {};
  const forecast48h: any[] = weatherData?.forecast_48h || [];
  const activeSlot = forecast48h[selectedSlotIndex] || forecast48h[0] || {};
  const isBlastRisk = weatherData?.blast_risk_status === 'CRITICAL' || currentWeather.blast_risk;

  // Map embed around selectedCoord
  const delta = 0.018;
  const minLon = (selectedCoord.lon - delta).toFixed(6);
  const minLat = (selectedCoord.lat - delta).toFixed(6);
  const maxLon = (selectedCoord.lon + delta).toFixed(6);
  const maxLat = (selectedCoord.lat + delta).toFixed(6);
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${selectedCoord.lat}%2C${selectedCoord.lon}`;

  // Yield Spline SVG geometry
  const splineItems: any[] = splineData?.data || [];
  const svgW = 680;
  const svgH = 180;
  const maxQ = 110;
  const actPts = splineItems.map((d, i) => ({
    x: 36 + (splineItems.length > 1 ? (i / (splineItems.length - 1)) * (svgW - 56) : 0),
    y: 16 + (svgH - 42) - ((d.previous_actual_quintals || 0) / maxQ) * (svgH - 42),
  }));
  const predPts = splineItems.map((d, i) => ({
    x: 36 + (splineItems.length > 1 ? (i / (splineItems.length - 1)) * (svgW - 56) : 0),
    y: 16 + (svgH - 42) - ((d.ai_predicted_quintals || 0) / maxQ) * (svgH - 42),
  }));
  const toLine = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const soil = profileData?.soil_profile;
  const climate = profileData?.climate_data;
  const recs = profileData?.crop_recommendations;

  return (
    <div className="space-y-5">
      {/* 1. Macro FPO Command Header Banner */}
      <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#84CC16] uppercase tracking-wider">
              <Activity className="w-4 h-4 text-[#84CC16] animate-pulse" />
              <span>{macroMetrics?.district || 'Idukki & Ernakulam Border Zone, Kerala'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {macroMetrics?.cluster_name || 'Thodupuzha High-Ranges FPO Command Center'}
            </h2>
            <p className="text-xs text-slate-400">
              Real-time agroclimatology, fungal blast epidemic risk, village plot monitoring &amp; One-Tap Satellite Field Profiler
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-[#07090D] border border-white/10 text-xs">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Monitored Farmers</div>
              <div className="text-base font-extrabold text-white font-mono mt-0.5">
                {macroMetrics?.total_registered_farmers || '1,290'}
              </div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-[#07090D] border border-white/10 text-xs">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Registered Acreage</div>
              <div className="text-base font-extrabold text-[#84CC16] font-mono mt-0.5">
                {macroMetrics?.monitored_acreage || '3,448.5'} Ac
              </div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-[#07090D] border border-red-500/30 text-xs">
              <div className="text-[10px] text-red-300 uppercase font-semibold">Critical Plots</div>
              <div className="text-base font-extrabold text-red-400 font-mono mt-0.5">
                {macroMetrics?.critical_risk_plots ?? 2} Plots
              </div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-[#07090D] border border-white/10 text-xs">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Cluster Avg NDVI</div>
              <div className="text-base font-extrabold text-[#38BDF8] font-mono mt-0.5">
                {macroMetrics?.cluster_avg_ndvi || '0.71'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 48-Hour Microclimate & Fungal Blast Risk Card */}
      {weatherData && (
        <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#84CC16] uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                <span>48-Hour Microclimate &amp; Blast Risk</span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">{weatherData.location}</h3>
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-xs font-bold ${
                isBlastRisk
                  ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                  : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
              }`}
            >
              {isBlastRisk ? (
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              )}
              <span>
                {isBlastRisk
                  ? 'Blast Risk Active (RH > 85% & Temp 22-28°C)'
                  : 'Optimal Conditions (Low Fungal Blast Risk)'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#07090D] border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <Thermometer className="w-5 h-5 text-orange-400 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-400">Temperature</div>
                <div className="text-lg font-bold text-white font-mono">
                  {activeSlot.temperature_c ?? currentWeather.temp_c}°C
                </div>
              </div>
            </div>
            <div className="bg-[#07090D] border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <Droplets className="w-5 h-5 text-[#38BDF8] shrink-0" />
              <div>
                <div className="text-[11px] text-slate-400">Relative Humidity</div>
                <div className="text-lg font-bold text-white font-mono">
                  {activeSlot.humidity_percent ?? currentWeather.humidity}%
                </div>
              </div>
            </div>
            <div className="bg-[#07090D] border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <CloudRain className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-400">Rain Probability</div>
                <div className="text-lg font-bold text-white font-mono">
                  {activeSlot.rain_probability ?? 75}%
                </div>
              </div>
            </div>
            <div className="bg-[#07090D] border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <Wind className="w-5 h-5 text-teal-400 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-400">Wind Speed</div>
                <div className="text-lg font-bold text-white font-mono">
                  {activeSlot.wind_speed_kmh ?? 12.4} km/h
                </div>
              </div>
            </div>
          </div>

          {/* 48h timeline selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {forecast48h.slice(0, 10).map((slot, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedSlotIndex(idx)}
                className={`px-3 py-2 rounded-xl border text-left shrink-0 transition cursor-pointer ${
                  selectedSlotIndex === idx
                    ? 'bg-[#84CC16]/15 border-[#84CC16] text-white'
                    : 'bg-[#07090D] border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-[10px] font-mono">{slot.time}</div>
                <div className="text-xs font-bold text-white mt-0.5">{slot.temperature_c}°C</div>
                <div className="text-[10px] text-[#38BDF8] font-mono">{slot.humidity_percent}% RH</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Village Risk Heatmap (7 Cols) + Live Alert Feed & Broadcast (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#84CC16]" />
              <span>Village Risk Heatmap &amp; One-Tap Coordinate Profiler</span>
            </h3>
            <span className="text-xs font-mono text-[#84CC16]">
              Active: {selectedCoord.lat.toFixed(4)}°N, {selectedCoord.lon.toFixed(4)}°E
            </span>
          </div>

          {/* Coordinate Search / Jump Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#07090D] border border-white/10 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-slate-400 font-mono">Lat:</span>
              <input
                type="number"
                step="0.001"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                className="w-20 bg-transparent text-white font-mono focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-[#07090D] border border-white/10 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-slate-400 font-mono">Lon:</span>
              <input
                type="number"
                step="0.001"
                value={lonInput}
                onChange={(e) => setLonInput(e.target.value)}
                className="w-20 bg-transparent text-white font-mono focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const lat = parseFloat(latInput);
                const lon = parseFloat(lonInput);
                if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                  fetchFieldProfile(lat, lon);
                }
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#84CC16] hover:bg-[#84CC16]/90 text-[#07090D] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Run Satellite Scan</span>
            </button>
          </div>

          {/* Interactive Map Canvas */}
          <div className="relative h-64 rounded-xl overflow-hidden border border-white/10 bg-[#07090D]">
            <iframe
              title="FPO Village Risk Heatmap"
              src={osmUrl}
              className="w-full h-full border-0"
              style={{ filter: 'invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)' }}
            />
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 bg-[#07090D]/90 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 text-[11px]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Healthy (NDVI &gt; 0.65)
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Moderate Stress
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-400" /> Critical Alert
                </span>
              </div>
              <span className="font-mono text-slate-400">{plots.length} Registered Cadastral Plots</span>
            </div>
          </div>

          {/* Clickable Village Plot Chips */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">
              Select a Cadastral Plot to Inspect &amp; Run One-Tap Satellite Profiler:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {plots.map((plot) => {
                const isSelected = selectedPlot?.id === plot.id;
                const isCrit = plot.risk_status === 'Critical';
                const isMod = plot.risk_status === 'Moderate';
                return (
                  <button
                    key={plot.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlot(plot);
                      fetchFieldProfile(plot.lat, plot.lon, `${plot.plot_name} (${plot.village})`);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#84CC16]/15 border-[#84CC16]'
                        : 'bg-[#07090D] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold text-white truncate">{plot.farmer_name}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {plot.village} &bull; {plot.crop_type} ({plot.size_acres} Ac)
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isCrit
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : isMod
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        NDVI {plot.ndvi_score}
                      </span>
                      {onInspectFarmerInCrm && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectFarmerInCrm(plot.id);
                          }}
                          className="text-[10px] text-[#38BDF8] hover:underline mt-0.5"
                        >
                          CRM Dossier &rarr;
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Alert Feed & Broadcast Drawer */}
        <div className="lg:col-span-5 rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Live Alert Feed &amp; Broadcast</h3>
                  <p className="text-[11px] text-slate-400">Cluster Automated Monitoring Feed</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/60 font-mono text-[10px] font-bold">
                LIVE STREAM
              </span>
            </div>

            {broadcastSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{broadcastSuccess}</span>
              </div>
            )}

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {alerts.map((alert, idx) => {
                const isHigh = alert.severity === 'High';
                return (
                  <div
                    key={alert.id || idx}
                    className={`rounded-xl p-3.5 border ${
                      isHigh
                        ? 'bg-red-950/25 border-red-800/70'
                        : 'bg-amber-950/20 border-amber-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-white">{alert.title}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-amber-300">
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
                    {alert.suggested_action && (
                      <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-[#84CC16]">
                        <strong>Action:</strong> {alert.suggested_action}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowBroadcastModal(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Broadcast Warning to Cluster Farmers</span>
          </button>
        </div>
      </div>

      {/* 4. Predictive Harvest Yield Spline Chart */}
      {splineData && (
        <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#84CC16] uppercase tracking-wider">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Predictive Harvest Yield Spline</span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">
                {splineData.cluster} &bull; {splineData.crop_group}
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-[#38BDF8]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" /> 2025 Actual ({splineData.annual_actual_total} q)
              </span>
              <span className="flex items-center gap-1.5 text-[#84CC16]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#84CC16]" /> 2026 AI Forecast ({splineData.annual_predicted_total} q)
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 font-bold flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> +4.2% Net Surge
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-44 overflow-visible">
              {[25, 50, 75, 100].map((val) => {
                const y = 16 + (svgH - 42) - (val / maxQ) * (svgH - 42);
                return (
                  <g key={val}>
                    <line x1={32} y1={y} x2={svgW - 16} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                    <text x={4} y={y + 3} fill="#64748b" fontSize="10" fontFamily="monospace">
                      {val}q
                    </text>
                  </g>
                );
              })}
              {actPts.length > 1 && (
                <path d={toLine(actPts)} fill="none" stroke="#38BDF8" strokeWidth="2.5" />
              )}
              {predPts.length > 1 && (
                <path d={toLine(predPts)} fill="none" stroke="#84CC16" strokeWidth="2.5" />
              )}
              {splineItems.map((d, i) => {
                const x = actPts[i]?.x ?? 0;
                return (
                  <g key={d.month}>
                    <circle cx={x} cy={actPts[i]?.y ?? 0} r={3.5} fill="#38BDF8" />
                    <circle cx={x} cy={predPts[i]?.y ?? 0} r={3.5} fill="#84CC16" />
                    <text x={x} y={svgH - 6} textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                      {d.month}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="text-xs text-slate-400">{splineData.trend_insight}</p>
        </div>
      )}

      {/* 5. One-Tap Field Satellite Profiler Drawer */}
      <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#84CC16]/15 text-[#84CC16] border border-[#84CC16]/30">
              <Satellite className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">One-Tap Field Satellite Profiler</h3>
              <p className="text-xs text-slate-400">
                10-Year NASA Agroclimatology &bull; ISRIC SoilGrids 0-5cm Topsoil &bull; Deterministic Random Forest ML Crop Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-mono text-[#84CC16] bg-[#84CC16]/10 px-3 py-1.5 rounded-xl border border-[#84CC16]/30">
              {profileData?.location?.name || `${selectedCoord.lat.toFixed(4)}°N, ${selectedCoord.lon.toFixed(4)}°E`}
            </span>
            <button
              type="button"
              onClick={() => setShowProfilerDrawer(!showProfilerDrawer)}
              className="p-2 rounded-xl bg-[#07090D] border border-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              {showProfilerDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showProfilerDrawer && (
          <div className="space-y-5">
            {isLoadingProfile && (
              <div className="rounded-xl bg-[#07090D] border border-[#84CC16]/30 p-6 text-center space-y-3 animate-pulse">
                <Satellite className="w-7 h-7 text-[#84CC16] mx-auto animate-spin" />
                <div className="text-sm font-bold text-white">
                  Capturing Satellite Streams for ({selectedCoord.lat.toFixed(4)}, {selectedCoord.lon.toFixed(4)})...
                </div>
                <div className="max-w-md mx-auto grid grid-cols-4 gap-2 text-[10px] font-mono">
                  <div className={`p-1.5 rounded border ${scanStep >= 1 ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'border-white/10 text-slate-500'}`}>1. GPS</div>
                  <div className={`p-1.5 rounded border ${scanStep >= 2 ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'border-white/10 text-slate-500'}`}>2. NASA</div>
                  <div className={`p-1.5 rounded border ${scanStep >= 3 ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'border-white/10 text-slate-500'}`}>3. SoilGrids</div>
                  <div className={`p-1.5 rounded border ${scanStep >= 4 ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'border-white/10 text-slate-500'}`}>4. ML Engine</div>
                </div>
              </div>
            )}

            {profileData && !isLoadingProfile && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Card A: ISRIC SoilGrids Baseline */}
                {soil && (
                  <div className="rounded-xl bg-[#07090D] border border-white/10 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#FACC15]" />
                        <span className="text-sm font-bold text-white">SoilGrids v2.0 Topsoil Baseline</span>
                      </div>
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-[#FACC15] border border-amber-500/30">
                        {soil.depth_layer}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-[#0E1015] border border-white/10">
                        <div className="text-[10px] text-amber-300 uppercase font-semibold">Soil pH</div>
                        <div className="text-xl font-extrabold text-white font-mono mt-1">{soil.ph.value}</div>
                        <div className="text-[10px] text-amber-400 mt-1">{soil.ph.classification}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#0E1015] border border-white/10">
                        <div className="text-[10px] text-emerald-300 uppercase font-semibold">Organic Carbon</div>
                        <div className="text-xl font-extrabold text-white font-mono mt-1">
                          {soil.organic_carbon.value} <span className="text-xs font-normal">g/kg</span>
                        </div>
                        <div className="text-[10px] text-emerald-400 mt-1">{soil.organic_carbon.classification}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#0E1015] border border-white/10">
                        <div className="text-[10px] text-sky-300 uppercase font-semibold">Clay Content</div>
                        <div className="text-xl font-extrabold text-white font-mono mt-1">
                          {soil.clay_content.value}%
                        </div>
                        <div className="text-[10px] text-sky-400 mt-1">{soil.clay_content.texture_label}</div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">{soil.ph.agronomic_note}</p>
                  </div>
                )}

                {/* Card B: 10-Year NASA POWER Climate Baseline */}
                {climate && (
                  <div className="rounded-xl bg-[#07090D] border border-white/10 p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CloudRain className="w-4 h-4 text-[#38BDF8]" />
                        <span className="text-sm font-bold text-white">NASA POWER 10-Yr Climatology</span>
                      </div>
                      <div className="flex items-center gap-1 bg-[#0E1015] p-1 rounded-lg border border-white/10 text-[11px]">
                        {(['rain', 'temp', 'solar'] as const).map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveClimateTab(tab)}
                            className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                              activeClimateTab === tab ? 'bg-[#38BDF8]/20 text-[#38BDF8]' : 'text-slate-400'
                            }`}
                          >
                            {tab === 'rain' ? 'Rain' : tab === 'temp' ? 'Temp' : 'Solar'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#0E1015] border border-white/10">
                        <div className="text-[10px] text-slate-400">Annual Mean Temp</div>
                        <div className="text-base font-bold text-white font-mono">
                          {climate.summary.annual_average_temperature_c}°C
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0E1015] border border-white/10">
                        <div className="text-[10px] text-slate-400">Annual Rainfall</div>
                        <div className="text-base font-bold text-[#38BDF8] font-mono">
                          {climate.summary.annual_total_precipitation_mm} mm
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0E1015] border border-white/10">
                        <div className="text-[10px] text-slate-400">Solar Radiation</div>
                        <div className="text-base font-bold text-[#FACC15] font-mono">
                          {climate.summary.annual_average_solar_radiation_mj} MJ
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-1 items-end h-20 pt-2">
                      {climate.monthly_averages?.map((m: any) => {
                        const val =
                          activeClimateTab === 'rain'
                            ? m.precipitation_total_mm
                            : activeClimateTab === 'temp'
                            ? m.temperature_c
                            : m.solar_radiation_mj;
                        const maxV = activeClimateTab === 'rain' ? 320 : activeClimateTab === 'temp' ? 35 : 25;
                        const pct = Math.max(12, Math.min(100, Math.round((val / maxV) * 100)));
                        return (
                          <div key={m.month} className="flex flex-col items-center gap-1 h-full justify-end">
                            <div
                              className={`w-full rounded-t ${
                                activeClimateTab === 'rain'
                                  ? 'bg-[#38BDF8]'
                                  : activeClimateTab === 'temp'
                                  ? 'bg-[#FACC15]'
                                  : 'bg-[#84CC16]'
                              }`}
                              style={{ height: `${pct}%` }}
                              title={`${m.month}: ${val}`}
                            />
                            <span className="text-[9px] font-mono text-slate-400">{m.month}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Card C: Deterministic ML Crop Suitability Engine */}
                {recs && (
                  <div className="lg:col-span-2 rounded-xl bg-[#07090D] border border-[#84CC16]/30 p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <BrainCircuit className="w-5 h-5 text-[#84CC16]" />
                        <div>
                          <h4 className="text-sm font-bold text-white">Deterministic ML Crop Suitability Engine</h4>
                          <p className="text-[11px] text-slate-400">
                            Scikit-Learn Random Forest Classifier (99.55% Test Accuracy) across 22 crop classes
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-[#84CC16]/15 border border-[#84CC16]/40 text-[#84CC16] font-mono text-[11px]">
                        RandomForest (predict_proba)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3.5 rounded-xl bg-[#0E1015] border border-white/10 space-y-2">
                        <div className="text-xs font-bold text-[#84CC16] uppercase font-mono flex items-center gap-1.5">
                          <Sprout className="w-4 h-4" /> Primary Cash Crops
                        </div>
                        <div className="space-y-2">
                          {(recs.primary_cash_crops_detailed || []).map((c: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[#07090D] border border-white/10 text-xs">
                              <span className="font-bold text-white capitalize">{c.crop}</span>
                              <span className="font-mono text-[#84CC16]">{Math.round(c.confidence_score * 100)}% Match</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#0E1015] border border-white/10 space-y-2">
                        <div className="text-xs font-bold text-[#38BDF8] uppercase font-mono flex items-center gap-1.5">
                          <Leaf className="w-4 h-4" /> Nitrogen-Fixing Rotation Cover Crops
                        </div>
                        <div className="space-y-2">
                          {(recs.rotation_cover_crops_detailed || []).map((c: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[#07090D] border border-white/10 text-xs">
                              <span className="font-bold text-white capitalize">{c.crop}</span>
                              <span className="font-mono text-[#38BDF8]">{Math.round(c.confidence_score * 100)}% Match</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed bg-[#0E1015] p-3 rounded-xl border border-white/10">
                      {recs.agronomic_reasoning}
                    </p>
                  </div>
                )}

                {/* Unified API JSON Inspector */}
                <div className="lg:col-span-2 rounded-xl bg-[#07090D] border border-white/10 overflow-hidden">
                  <div
                    onClick={() => setRawJsonOpen(!rawJsonOpen)}
                    className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <Code2 className="w-4 h-4 text-[#84CC16]" />
                      <span className="font-bold text-white">Unified API Response Inspector</span>
                      <span className="font-mono text-slate-400">
                        GET /api/profile?lat={selectedCoord.lat.toFixed(4)}&amp;lon={selectedCoord.lon.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(JSON.stringify(profileData, null, 2));
                          setCopiedJson(true);
                          setTimeout(() => setCopiedJson(false), 2000);
                        }}
                        className="px-2.5 py-1 rounded bg-[#0E1015] border border-white/10 text-xs text-slate-300 flex items-center gap-1"
                      >
                        {copiedJson ? <Check className="w-3 h-3 text-[#84CC16]" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
                      </button>
                      {rawJsonOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                  {rawJsonOpen && (
                    <pre className="p-4 border-t border-white/10 text-[11px] font-mono text-[#84CC16] overflow-x-auto max-h-72">
                      {JSON.stringify(profileData, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0E1015] border border-white/15 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-red-400" />
                <span>Dispatch Cluster SMS &amp; Voice IVR Alert</span>
              </h4>
              <button type="button" onClick={() => setShowBroadcastModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              rows={4}
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              className="w-full rounded-xl bg-[#07090D] border border-white/10 p-3 text-xs text-white focus:outline-none focus:border-[#84CC16]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBroadcast}
                className="px-4 py-2 rounded-xl bg-[#84CC16] text-[#07090D] font-bold text-xs cursor-pointer"
              >
                Confirm Broadcast (1,280 Farmers)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
