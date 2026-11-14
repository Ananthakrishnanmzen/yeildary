import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Compass,
  Droplets,
  ExternalLink,
  Flame,
  Leaf,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sprout,
  User,
  Wind,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchFarmerTelemetryApi } from '../services/api';
import type { TelemetryReport } from '../types/farmer';

export default function FarmerDashboard() {
  const { profile, refreshProfile, logout } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryReport | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(true);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);

  const loadTelemetry = useCallback(async (forceRefresh = false) => {
    setTelemetryLoading(true);
    setTelemetryError(null);
    try {
      const data = await fetchFarmerTelemetryApi(forceRefresh);
      setTelemetry(data);
    } catch (err) {
      setTelemetryError(
        err instanceof Error
          ? err.message
          : 'Failed to calculate Module 1 vulnerability & stress telemetry.',
      );
    } finally {
      setTelemetryLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setIsRefreshing(true);
    refreshProfile()
      .catch(() => {
        // Handled by AuthContext if token expired
      })
      .finally(() => {
        if (active) setIsRefreshing(false);
      });
    loadTelemetry(false);
    return () => {
      active = false;
    };
  }, [refreshProfile, loadTelemetry]);

  if (!profile) {
    return null;
  }

  const delta = 0.02;
  const minLon = (profile.longitude - delta).toFixed(6);
  const minLat = (profile.latitude - delta).toFixed(6);
  const maxLon = (profile.longitude + delta).toFixed(6);
  const maxLat = (profile.latitude + delta).toFixed(6);

  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${profile.latitude}%2C${profile.longitude}`;
  const osmViewUrl = `https://www.openstreetmap.org/?mlat=${profile.latitude}&mlon=${profile.longitude}#map=14/${profile.latitude}/${profile.longitude}`;

  const rating = telemetry?.location_rating;
  const water = telemetry?.vulnerability_stress_layer?.water_stress;
  const veg = telemetry?.vulnerability_stress_layer?.vegetation_health;
  const micro = telemetry?.vulnerability_stress_layer?.microclimate;
  const latestWater = water?.series?.length ? water.series[water.series.length - 1] : null;
  const recentSeries = water?.series ? water.series.slice(-6).reverse() : [];
  const pearsonR =
    veg?.heatwave_ndvi_correlation?.pearson_r_max_temp_vs_ndvi ??
    veg?.correlation?.pearson_r_max_temp_vs_ndvi;

  return (
    <div className="relative min-h-screen bg-[#07090D] text-slate-100 overflow-hidden">
      <div className="pointer-events-none absolute -top-40 right-0 w-[28rem] h-[28rem] rounded-full bg-[#84CC16]/8 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -left-32 w-96 h-96 rounded-full bg-[#38BDF8]/8 blur-3xl" />

      {/* Top Navigation */}
      <header className="sticky top-0 z-20 bg-[#0E1015]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#84CC16]/15 border border-[#84CC16]/30 flex items-center justify-center text-[#84CC16]">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg text-white tracking-tight">
                Yieldary AI
              </span>
              <span className="hidden sm:inline-block ml-2.5 text-xs text-slate-400">
                Vulnerability &amp; Stress Telemetry
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#84CC16]/10 text-[#84CC16] border border-[#84CC16]/25">
              <ShieldCheck className="w-3.5 h-3.5" />
              JWT Authenticated
            </span>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-[#FACC15]" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Grid */}
      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#84CC16]">
              Protected Farmer Route
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-white">
              {profile.full_name}&apos;s Farm Telemetry
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setIsRefreshing(true);
                refreshProfile().finally(() => setIsRefreshing(false));
                loadTelemetry(true);
              }}
              disabled={isRefreshing || telemetryLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0E1015]/80 border border-white/10 hover:border-[#38BDF8]/40 px-3.5 py-2 text-xs font-semibold text-[#38BDF8] transition-colors cursor-pointer disabled:opacity-60"
            >
              {isRefreshing || telemetryLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Recalculate Module 1</span>
            </button>
          </div>
        </div>

        {/* Row 1: Profile Card + Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-5 rounded-2xl bg-[#0E1015]/75 backdrop-blur-xl border border-white/10 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <h2 className="text-base font-bold text-white">Registered Details</h2>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#84CC16]/15 text-[#84CC16] border border-[#84CC16]/30">
                  Verified
                </span>
              </div>

              <dl className="mt-5 space-y-4">
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-[#84CC16] mt-1 shrink-0" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Name
                    </dt>
                    <dd className="text-sm sm:text-base font-semibold text-white">
                      {profile.full_name}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#38BDF8] mt-1 shrink-0" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Email
                    </dt>
                    <dd className="text-sm font-medium text-slate-200 break-all">
                      {profile.email}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#FACC15] mt-1 shrink-0" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Registered Location
                    </dt>
                    <dd className="text-sm sm:text-base font-semibold text-white">
                      {profile.location_name}
                    </dd>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-xl bg-[#07090D]/90 border border-white/10 p-3.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-[#84CC16]" />
                      Latitude
                    </dt>
                    <dd className="mt-1 font-mono text-base font-bold text-[#84CC16]">
                      {profile.latitude.toFixed(6)}
                    </dd>
                  </div>

                  <div className="rounded-xl bg-[#07090D]/90 border border-white/10 p-3.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-[#38BDF8]" />
                      Longitude
                    </dt>
                    <dd className="mt-1 font-mono text-base font-bold text-[#38BDF8]">
                      {profile.longitude.toFixed(6)}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          </section>

          <section className="lg:col-span-7 rounded-2xl bg-[#0E1015]/75 backdrop-blur-xl border border-white/10 shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Geolocation Preview</h2>
                <p className="text-xs text-slate-400">
                  OpenStreetMap Pin ({profile.latitude.toFixed(4)}, {profile.longitude.toFixed(4)})
                </p>
              </div>
              <a
                href={osmViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#84CC16] hover:underline"
              >
                <span>Open OSM</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex-1 min-h-[300px] bg-[#07090D]">
              <iframe
                title="Farm Location OpenStreetMap"
                src={osmEmbedUrl}
                className="w-full h-full min-h-[300px] border-0"
                loading="lazy"
              />
            </div>
          </section>
        </div>

        {/* Row 2: Module 1 Vulnerability & Stress Layer */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#84CC16]" />
                Module 1: Vulnerability &amp; Stress Telemetry
              </h2>
              {telemetry && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {telemetry.territory_mode} &bull; Window: {telemetry.window.start_date} to{' '}
                  {telemetry.window.end_date}
                </p>
              )}
            </div>
          </div>

          {telemetryLoading && !telemetry && (
            <div className="rounded-2xl bg-[#0E1015]/75 backdrop-blur-xl border border-white/10 p-10 flex flex-col items-center justify-center gap-3 text-slate-300">
              <Loader2 className="w-7 h-7 animate-spin text-[#84CC16]" />
              <p className="text-sm font-medium">
                Calculating Module 1 GEE &amp; climate telemetry for ({profile.latitude.toFixed(4)},{' '}
                {profile.longitude.toFixed(4)})...
              </p>
            </div>
          )}

          {telemetryError && (
            <div className="rounded-2xl border border-[#FACC15]/30 bg-[#FACC15]/10 p-4 flex items-start gap-3 text-sm text-[#FACC15]">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Module 1 Telemetry Error</p>
                <p className="text-xs opacity-90 mt-0.5">{telemetryError}</p>
              </div>
            </div>
          )}

          {telemetry && rating && (
            <>
              {/* Location Rating + 4 Resilience Sub-Scores */}
              <div className="rounded-2xl bg-[#0E1015]/75 backdrop-blur-xl border border-white/10 p-6 shadow-xl">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-4 flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-[#84CC16]/15 border border-[#84CC16]/40 flex flex-col items-center justify-center shrink-0">
                      <span className="text-2xl font-extrabold text-[#84CC16]">
                        {rating.letter_grade}
                      </span>
                      <span className="text-[11px] font-mono text-slate-300">
                        {rating.overall_score}/100
                      </span>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                        Agro-Climate Rating
                      </p>
                      <p className="text-sm font-bold text-white mt-0.5">{rating.risk_tier}</p>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {rating.recommendation}
                      </p>
                    </div>
                  </div>

                  <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Water Security', val: rating.water_security_rate, color: '#38BDF8' },
                      {
                        label: 'Thermal Resilience',
                        val: rating.thermal_resilience_rate,
                        color: '#FACC15',
                      },
                      {
                        label: 'Vegetative Vitality',
                        val: rating.vegetation_vitality_rate,
                        color: '#84CC16',
                      },
                      {
                        label: 'Microclimate Stability',
                        val: rating.microclimate_stability_rate,
                        color: '#A78BFA',
                      },
                    ].map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-xl bg-[#07090D]/90 border border-white/10 p-3.5"
                      >
                        <p className="text-[11px] font-medium text-slate-400">{metric.label}</p>
                        <p className="mt-1 text-xl font-bold font-mono text-white">
                          {metric.val}%
                        </p>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(100, metric.val)}%`, backgroundColor: metric.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3 Analytics Cards: Water Stress, Vegetation/Heatwave, Microclimate */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rounded-2xl bg-[#0E1015]/75 backdrop-blur-xl border border-white/10 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Water Stress
                    </span>
                    <Droplets className="w-4 h-4 text-[#38BDF8]" />
                  </div>
                  <p className="mt-3 text-2xl font-bold font-mono text-[#38BDF8]">
                    {latestWater ? `${latestWater.water_stress_index}/100` : 'N/A'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Drought Warnings:{' '}
                    <span className="text-white font-semibold">
                      {water?.drought_warnings_count ?? 0}
                    </span>{' '}
                    &bull; Active:{' '}
                    <span
                      className={
                        water?.active_drought_warning
                          ? 'text-[#FACC15] font-semibold'
                          : 'text-[#84CC16] font-semibold'
                      }
                    >
                      {water?.active_drought_warning ? 'YES' : 'NO'}
                    </span>
                  </p>
                </div>

                <div className="rounded-2xl bg-[#0E1015]/75 backdrop-blur-xl border border-white/10 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Vegetation &amp; Heatwaves
                    </span>
                    <Leaf className="w-4 h-4 text-[#84CC16]" />
                  </div>
                  <p className="mt-3 text-2xl font-bold font-mono text-[#84CC16]">
                    NDVI {telemetry.summary_metrics?.sentinel2?.s2_ndvi ?? 'N/A'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Heatwave Correlation (r):{' '}
                    <span className="text-white font-mono font-semibold">
                      {pearsonR !== null && pearsonR !== undefined ? pearsonR : 'N/A'}
                    </span>{' '}
                    &bull; Events:{' '}
                    <span className="text-white font-semibold">
                      {veg?.vulnerability_events?.length ?? 0}
                    </span>
                  </p>
                </div>

                <div className="rounded-2xl bg-[#0E1015]/75 backdrop-blur-xl border border-white/10 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Microclimate Stress
                    </span>
                    <Wind className="w-4 h-4 text-[#FACC15]" />
                  </div>
                  <p className="mt-3 text-2xl font-bold font-mono text-[#FACC15]">
                    {micro?.stress_summary?.stomatal_vpd_stress_steps ?? 0} VPD Steps
                  </p>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-slate-400" />
                    Fungal Risk Steps:{' '}
                    <span className="text-white font-semibold">
                      {micro?.stress_summary?.fungal_humidity_risk_steps ?? 0}
                    </span>
                  </p>
                </div>
              </div>

              {/* Recent Monthly Water Stress Series */}
              {recentSeries.length > 0 && (
                <div className="rounded-2xl bg-[#0E1015]/75 backdrop-blur-xl border border-white/10 overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10">
                    <h3 className="text-sm font-bold text-white">
                      Recent Monthly Telemetry (Module 1 Series)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#07090D]/60 text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-3">Month</th>
                          <th className="px-6 py-3">Water Stress</th>
                          <th className="px-6 py-3">Soil Moisture</th>
                          <th className="px-6 py-3">ET (mm)</th>
                          <th className="px-6 py-3">Rainfall (mm)</th>
                          <th className="px-6 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-200">
                        {recentSeries.map((row) => (
                          <tr key={row.date} className="hover:bg-white/[0.02]">
                            <td className="px-6 py-3 font-mono">{row.date}</td>
                            <td className="px-6 py-3 font-mono text-[#38BDF8] font-semibold">
                              {row.water_stress_index}
                            </td>
                            <td className="px-6 py-3 font-mono">
                              {row.soil_moisture_m3m3 ?? '—'}
                            </td>
                            <td className="px-6 py-3 font-mono">{row.et_mm}</td>
                            <td className="px-6 py-3 font-mono">{row.rainfall_mm}</td>
                            <td className="px-6 py-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  row.drought_warning
                                    ? 'bg-[#FACC15]/15 text-[#FACC15]'
                                    : 'bg-[#84CC16]/15 text-[#84CC16]'
                                }`}
                              >
                                {row.drought_severity}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
