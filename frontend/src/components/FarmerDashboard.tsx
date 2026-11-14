import { useEffect, useState } from 'react';
import {
  Compass,
  ExternalLink,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sprout,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function FarmerDashboard() {
  const { profile, refreshProfile, logout } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    return () => {
      active = false;
    };
  }, [refreshProfile]);

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
                Farmer Telemetry Console
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
              {profile.full_name}&apos;s Farm Profile
            </h1>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              refreshProfile().finally(() => setIsRefreshing(false));
            }}
            disabled={isRefreshing}
            className="self-start sm:self-auto inline-flex items-center gap-2 rounded-xl bg-[#0E1015]/80 border border-white/10 hover:border-[#38BDF8]/40 px-3.5 py-2 text-xs font-semibold text-[#38BDF8] transition-colors cursor-pointer"
          >
            {isRefreshing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Sync Profile</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Glassmorphic Profile Card */}
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

          {/* OSM Map Confirmation Card */}
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

            <div className="flex-1 min-h-[320px] sm:min-h-[380px] bg-[#07090D]">
              <iframe
                title="Farm Location OpenStreetMap"
                src={osmEmbedUrl}
                className="w-full h-full min-h-[320px] sm:min-h-[380px] border-0"
                loading="lazy"
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
