"use client";

function Ring({
  value,
  max,
  label,
  color,
  unit,
}: {
  value: number;
  max: number;
  label: string;
  color: string;
  unit: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const r = 30;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden>
        <circle cx="38" cy="38" r={r} stroke="var(--line)" strokeWidth="6" fill="none" />
        <circle
          cx="38"
          cy="38"
          r={r}
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 38 38)"
          style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: "stroke-dasharray 700ms cubic-bezier(.2,.8,.2,1)" }}
        />
        <text x="38" y="36" textAnchor="middle" fill="var(--text)" fontSize="13" fontFamily="var(--font-data)" fontWeight="700">
          {value.toFixed(1)}
        </text>
        <text x="38" y="50" textAnchor="middle" fill="var(--muted)" fontSize="8" fontFamily="var(--font-data)">
          {unit}
        </text>
      </svg>
      <span className="font-data text-[10px] uppercase tracking-wider text-muted">{label}</span>
    </div>
  );
}

export default function TelemetryWidget({
  telemetry,
}: {
  telemetry: {
    nasa_power_temp: number;
    gpm_precip: number;
    smap_soil_moisture: number;
  };
}) {
  return (
    <section aria-labelledby="telemetry-title" className="glass rounded-lg p-4 contour-bg">
      <h3 id="telemetry-title" className="mb-3 font-data text-[10px] uppercase tracking-[0.2em] text-muted">
        Telemetry · Live
      </h3>
      <div className="flex flex-wrap items-center justify-around gap-3">
        <Ring value={telemetry.nasa_power_temp} max={45} label="POWER Temp" color="var(--amber)" unit="°C" />
        <Ring value={telemetry.gpm_precip} max={40} label="GPM Precip" color="var(--sky)" unit="mm" />
        <Ring value={telemetry.smap_soil_moisture * 100} max={100} label="SMAP Moisture" color="var(--lime)" unit="%" />
      </div>
    </section>
  );
}
