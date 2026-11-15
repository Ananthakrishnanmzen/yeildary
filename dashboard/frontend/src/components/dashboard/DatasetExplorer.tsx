"use client";

import { useMemo, useState } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";

const GROUPS: { title: string; accent: string; items: string[] }[] = [
  {
    title: "A · Vulnerability & Stress",
    accent: "var(--ember)",
    items: [
      "SMAP Soil Moisture",
      "GPM Precipitation",
      "OpenET Evapotranspiration",
      "ECOSTRESS Thermal",
      "Sentinel-2 NDVI",
      "Landsat NDVI",
      "ERA5 Heatwaves",
      "NASA POWER Temp",
      "NLDAS/GLDAS Microclimate",
    ],
  },
  {
    title: "B · Terrain & Soil Health",
    accent: "var(--amber)",
    items: [
      "SRTM Elevation/Slope",
      "SSURGO / FAO GAEZ Soil",
      "GEDI Canopy Biomass",
      "LANDFIRE / NLCD Context",
      "GPM Extreme Rain",
    ],
  },
  {
    title: "C · Rotation Strategy",
    accent: "var(--violet)",
    items: [
      "CDL Crop History",
      "FAO GAEZ Suitability",
      "PRISM / ERA5 Climate",
      "USDA AMS Market News",
      "NASS QuickStats",
      "Soil Organic Matter",
      "Infiltration Index",
      "Market Demand Trend",
      "Nitrogen-Fixing Cover",
      "Deep-Rooting Varieties",
      "Drought-Tolerant Crops",
    ],
  },
];

const TOTAL = GROUPS.reduce((n, g) => n + g.items.length, 0);

export default function DatasetExplorer() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>("A · Vulnerability & Stress");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((it) => it.toLowerCase().includes(q) || g.title.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0 || g.title.toLowerCase().includes(q));
  }, [query]);

  const visibleCount = filtered.reduce((n, g) => n + g.items.length, 0);

  const toggleAll = () => {
    if (open === null) setOpen(filtered[0]?.title ?? null);
    else setOpen(null);
  };

  return (
    <section aria-labelledby="dataset-title" className="glass rounded-lg p-5 contour-bg">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="dataset-title" className="font-data text-[10px] uppercase tracking-[0.2em] text-muted">
            Dataset Explorer · {TOTAL} sources
          </h3>
          <p className="mt-1 font-data text-[11px] text-text/80">
            Progressive disclosure · {visibleCount} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter datasets…"
              aria-label="Filter datasets"
              className="w-44 rounded-md border border-line bg-ink/60 py-1.5 pl-8 pr-3 font-data text-xs text-text placeholder:text-muted/60 focus:border-lime/50 focus:outline-none focus:ring-1 focus:ring-lime/40"
            />
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-md border border-line px-3 py-1.5 font-data text-[10px] font-bold uppercase tracking-wider text-muted transition hover:border-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          >
            {open === null ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <p className="py-6 text-center font-data text-xs text-muted">No datasets match “{query}”.</p>
        )}
        {filtered.map((g) => {
          const isOpen = open === g.title;
          return (
            <div key={g.title} className="overflow-hidden rounded-md border border-line bg-ink/50">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : g.title)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left transition hover:bg-panel/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: g.accent, boxShadow: `0 0 8px ${g.accent}` }}
                    aria-hidden
                  />
                  <span className="font-data text-xs font-bold text-text">{g.title}</span>
                </span>
                <span className="flex items-center gap-2 font-data text-[10px] text-muted">
                  {g.items.length}
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </span>
              </button>
              {isOpen && (
                <div className="flex flex-wrap gap-1.5 border-t border-line px-3 py-3">
                  {g.items.map((it) => (
                    <span
                      key={it}
                      className="rounded-md border border-line bg-panel px-2 py-1 font-data text-[10px] text-muted transition hover:border-muted hover:text-text"
                    >
                      {it}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
