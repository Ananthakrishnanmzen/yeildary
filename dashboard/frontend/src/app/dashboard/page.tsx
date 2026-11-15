"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { fetchDashboard } from "@/lib/api";
import { MOCK_DASHBOARD } from "@/lib/mockData";
import type { DashboardPayload, OverlayKey } from "@/types";
import OverlayTogglePanel from "@/components/panels/OverlayTogglePanel";
import TelemetryWidget from "@/components/dashboard/TelemetryWidget";
import RiskMetrics from "@/components/dashboard/RiskMetrics";
import AdvisoryTicker from "@/components/dashboard/AdvisoryTicker";
import RotationStrategyPanel from "@/components/rotation/RotationStrategyPanel";
import WhyCardsPanel from "@/components/cards/WhyCardsPanel";
import DatasetExplorer from "@/components/dashboard/DatasetExplorer";

const HeroMap = dynamic(() => import("@/components/map/HeroMap"), { ssr: false });

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload>(MOCK_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<Record<OverlayKey, boolean>>({
    ecostress: true,
    smap: true,
    srtm: false,
  });

  const load = useCallback(async () => {
    const farmId = process.env.NEXT_PUBLIC_FARM_ID ?? "farm-idukki-01";
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchDashboard(farmId);
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const farmId = process.env.NEXT_PUBLIC_FARM_ID ?? "farm-idukki-01";
    let active = true;
    fetchDashboard(farmId)
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Failed to load dashboard");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggle = (k: OverlayKey) =>
    setOverlays((o) => ({ ...o, [k]: !o[k] }));

  const { farm, telemetry, impact } = data;

  const formattedTime = new Date(telemetry.timestamp).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <main className="min-h-screen bg-ink text-text">
      {/* Instrument strip */}
      <header className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-lime" aria-hidden />
            <span className="font-display text-lg tracking-tight text-text">Yieldary AI</span>
            <span className="hidden font-data text-[10px] uppercase tracking-[0.2em] text-muted sm:inline">
              Orbital Field Notebook
            </span>
          </div>
          <div className="flex items-center gap-4 font-data text-[10px] uppercase tracking-wider text-muted">
            <span className="hidden md:inline">{farm.name}</span>
            <span className="hidden md:inline">{farm.district}</span>
            <span className="text-text">{farm.crop_type}</span>
            <span className="hidden lg:inline tabular">
              {farm.lat.toFixed(3)}°N {farm.lon.toFixed(3)}°E
            </span>
            <span className="hidden sm:inline tabular" suppressHydrationWarning>
              {formattedTime}
            </span>
            {loading && (
              <span className="flex items-center gap-1.5 text-amber" aria-live="polite">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber" aria-hidden />
                syncing…
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-6">
        {error && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-rose/40 bg-rose/10 px-4 py-3"
          >
            <p className="font-data text-xs text-rose">
              Live data unavailable — showing cached field notebook. {error}
            </p>
            <button
              onClick={load}
              className="rounded border border-rose/40 px-3 py-1.5 font-data text-[10px] font-bold uppercase tracking-wider text-rose transition hover:bg-rose/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
            >
              Retry
            </button>
          </div>
        )}

        {/* Hero map */}
        <section className="relative mb-6 overflow-hidden rounded-lg border border-line bg-panel shadow-panel">
          <div className="h-[62vh] min-h-[420px]">
            <HeroMap lat={farm.lat} lon={farm.lon} overlays={overlays} onOverlayToggle={toggle} />
          </div>
          {/* Floating overlay toggle */}
          <div className="static mt-4 w-full animate-fade-up md:absolute md:bottom-4 md:left-4 md:mt-0 md:w-72">
            <OverlayTogglePanel overlays={overlays} onToggle={toggle} />
          </div>
          {/* Floating Why card */}
          <div
            className="static mt-4 w-full animate-fade-up md:absolute md:bottom-4 md:right-4 md:mt-0 md:w-80"
            style={{ animationDelay: "0.15s" }}
          >
            <WhyCardsPanel
              crop="Plant Cowpea"
              rationale={`Suggested because FAO GAEZ confirms soil suitability, and ECOSTRESS shows high heat vulnerability that Cowpea can withstand. Market demand (USDA AMS) is stable. Drought risk ${impact.drought_risk_score}/100, thermal stress ${impact.thermal_stress_index}/100.`}
            />
          </div>
        </section>

        {/* Instrument panel */}
        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {loading ? (
            <>
              <div className="skeleton h-40 rounded-lg" />
              <div className="skeleton h-40 rounded-lg" />
              <div className="skeleton h-40 rounded-lg" />
            </>
          ) : (
            <>
              <TelemetryWidget telemetry={telemetry} />
              <RiskMetrics impact={impact} />
              <AdvisoryTicker text={impact.recommendation_text} />
            </>
          )}
        </section>

        {/* Rotation engine */}
        <section className="mb-6">
          <RotationStrategyPanel />
        </section>

        {/* Progressive disclosure: 25 datasets */}
        <section>
          <DatasetExplorer />
        </section>
      </div>
    </main>
  );
}
