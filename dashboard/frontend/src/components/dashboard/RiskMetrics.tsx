function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  const tone =
    value >= 70 ? "High" : value >= 40 ? "Moderate" : "Low";
  return (
    <div role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="mb-1 flex justify-between font-data text-[10px] uppercase tracking-wider text-muted">
        <span>{label}</span>
        <span className="flex items-center gap-2 text-text tabular">
          {value}
          <span className="text-[9px] text-muted">{tone}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-sm bg-line">
        <div
          className="h-full rounded-sm transition-all duration-700 ease-out"
          style={{ width: `${value}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
    </div>
  );
}

export default function RiskMetrics({
  impact,
}: {
  impact: { drought_risk_score: number; thermal_stress_index: number; run_off_vulnerability: number };
}) {
  return (
    <section aria-labelledby="risk-title" className="glass rounded-lg p-4 contour-bg">
      <h3 id="risk-title" className="mb-3 font-data text-[10px] uppercase tracking-[0.2em] text-muted">
        Impact Analysis
      </h3>
      <div className="flex flex-col gap-3">
        <Bar label="Drought Risk" value={impact.drought_risk_score} color="var(--ember)" />
        <Bar label="Thermal Stress" value={impact.thermal_stress_index} color="var(--amber)" />
        <Bar label="Runoff Vuln." value={impact.run_off_vulnerability} color="var(--sky)" />
      </div>
    </section>
  );
}
