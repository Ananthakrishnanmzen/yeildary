"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { OverlayKey } from "@/types";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const SENTINEL2_TILES =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg";

const OVERLAY_TILES: Record<OverlayKey, string> = {
  ecostress:
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/ECOSTRESS_L2_LSTE/default/2024-01-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png",
  smap:
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/SMAP_L3_Passive_Day_Soil_Moisture/default/2024-01-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png",
  srtm:
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/SRTM_Color_Index/default/2000-02-11/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png",
};

const OVERLAY_COLORS: Record<OverlayKey, string> = {
  ecostress: "#F97316",
  smap: "#38BDF8",
  srtm: "#FACC15",
};

const OVERLAY_LABEL: Record<OverlayKey, string> = {
  ecostress: "ECOSTRESS · heat",
  smap: "SMAP · moisture",
  srtm: "SRTM · slope",
};

export type HeroMapProps = {
  lat: number;
  lon: number;
  overlays: Record<OverlayKey, boolean>;
  onOverlayToggle: (k: OverlayKey) => void;
};

export default function HeroMap({ lat, lon, overlays }: HeroMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    try {
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [lon, lat],
        zoom: 10,
        pitch: 45,
        attributionControl: true,
      });
      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;
        map.addSource("sentinel2", {
          type: "raster",
          tiles: [SENTINEL2_TILES],
          tileSize: 256,
          attribution: "Sentinel-2 cloudless © EOX",
        });
        map.addLayer({
          id: "sentinel2-layer",
          type: "raster",
          source: "sentinel2",
          paint: { "raster-opacity": 0.85 },
        });

        (Object.keys(OVERLAY_TILES) as OverlayKey[]).forEach((k) => {
          map.addSource(`overlay-${k}`, {
            type: "raster",
            tiles: [OVERLAY_TILES[k]],
            tileSize: 256,
          });
          map.addLayer({
            id: `overlay-${k}`,
            type: "raster",
            source: `overlay-${k}`,
            paint: { "raster-opacity": 0.55 },
            layout: { visibility: overlays[k] ? "visible" : "none" },
          });
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");
        setReady(true);
      });

      map.on("error", (e) => {
        if (cancelled) return;
        setError(e?.error?.message ?? "Map failed to load");
      });

      return () => {
        cancelled = true;
        map.remove();
        mapRef.current = null;
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Map init failed";
      setTimeout(() => setError(msg), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (Object.keys(overlays) as OverlayKey[]).forEach((k) => {
      if (map.getLayer(`overlay-${k}`)) {
        map.setLayoutProperty(
          `overlay-${k}`,
          "visibility",
          overlays[k] ? "visible" : "none"
        );
      }
    });
  }, [overlays, ready]);

  if (!TOKEN) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-line bg-panel p-6 text-center">
        <p className="font-display text-lg text-amber">Map offline</p>
        <p className="max-w-sm font-data text-xs leading-relaxed text-muted">
          Set <code className="rounded bg-ink px-1.5 py-0.5 text-text">NEXT_PUBLIC_MAPBOX_TOKEN</code> in
          .env.local to acquire the Hero Map.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-rose/40 bg-rose/10 p-6 text-center">
        <p className="font-display text-lg text-rose">Map unavailable</p>
        <p className="max-w-sm font-data text-xs leading-relaxed text-muted">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-panel">
      <div ref={containerRef} className="h-full w-full" />
      {/* vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 100% at 50% 50%, transparent 55%, rgba(7,9,13,0.55) 100%)",
        }}
      />
      {/* scan line */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-x-0 h-12 bg-gradient-to-b from-violet/20 via-violet/5 to-transparent animate-scan" />
      </div>
      {/* legend */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5" aria-hidden>
        {(Object.keys(OVERLAY_LABEL) as OverlayKey[]).map((k) => (
          <span
            key={k}
            className="glass rounded-full px-2.5 py-1 font-data text-[9px] uppercase tracking-wider text-text/80"
            style={{ opacity: overlays[k] ? 1 : 0.45 }}
          >
            <span
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: OVERLAY_COLORS[k], boxShadow: `0 0 6px ${OVERLAY_COLORS[k]}` }}
            />
            {OVERLAY_LABEL[k]}
          </span>
        ))}
      </div>
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-lime" />
          <p className="font-data text-xs text-muted">Acquiring Sentinel-2 pass…</p>
        </div>
      )}
    </div>
  );
}

export { OVERLAY_COLORS };
