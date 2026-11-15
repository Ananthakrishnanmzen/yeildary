"use client";

import { OVERLAY_COLORS } from "@/components/map/HeroMap";
import type { OverlayKey } from "@/types";

const LABELS: Record<OverlayKey, { title: string; sensor: string; desc: string }> = {
  ecostress: { title: "ECOSTRESS", sensor: "LST", desc: "Heat stress · Red/Orange" },
  smap: { title: "SMAP", sensor: "SM", desc: "Soil moisture · Blue" },
  srtm: { title: "SRTM", sensor: "SLOPE", desc: "Erosion risk · Yellow" },
};

export default function OverlayTogglePanel({
  overlays,
  onToggle,
}: {
  overlays: Record<OverlayKey, boolean>;
  onToggle: (k: OverlayKey) => void;
}) {
  const active = Object.values(overlays).filter(Boolean).length;
  return (
    <section
      aria-labelledby="overlay-panel-title"
      className="glass-strong rounded-lg p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3
          id="overlay-panel-title"
          className="font-data text-[10px] uppercase tracking-[0.2em] text-muted"
        >
          Neon Overlays
        </h3>
        <span className="font-data text-[10px] text-muted tabular">
          {active}/3 active
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {(Object.keys(LABELS) as OverlayKey[]).map((k) => {
          const on = overlays[k];
          const color = OVERLAY_COLORS[k];
          return (
            <button
              key={k}
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`${LABELS[k].title} overlay ${on ? "on" : "off"}`}
              onClick={() => onToggle(k)}
              className="group flex items-center justify-between rounded-md border px-3 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
              style={{
                borderColor: on ? `${color}66` : "var(--line)",
                background: on ? `${color}10` : "rgba(7,9,13,0.5)",
                boxShadow: on ? `0 0 16px ${color}22` : "none",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full transition"
                  style={{
                    backgroundColor: color,
                    boxShadow: on ? `0 0 12px ${color}` : "none",
                    opacity: on ? 1 : 0.3,
                  }}
                  aria-hidden
                />
                <div>
                  <p className="font-data text-xs font-bold text-text">{LABELS[k].title}</p>
                  <p className="font-data text-[10px] text-muted">
                    {LABELS[k].sensor} · {LABELS[k].desc}
                  </p>
                </div>
              </div>
              <span
                className="relative inline-flex h-5 w-9 items-center rounded-full transition"
                style={{
                  backgroundColor: on ? color : "var(--line)",
                  boxShadow: on ? `0 0 8px ${color}88` : "none",
                }}
                aria-hidden
              >
                <span
                  className="inline-block h-3.5 w-3.5 transform rounded-full bg-ink transition"
                  style={{ transform: on ? "translateX(18px)" : "translateX(3px)" }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
