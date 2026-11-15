import { useEffect, useState } from 'react';
import {
  Droplets,
  Leaf,
  RotateCw,
  Satellite,
  Sliders,
  TrendingUp,
  Users,
} from 'lucide-react';
import { simulatorService } from '../../services/api';

export default function FieldShiftSimulatorView() {
  const [waterWeight, setWaterWeight] = useState(0.6);
  const [profitWeight, setProfitWeight] = useState(0.8);
  const [soilWeight, setSoilWeight] = useState(0.85);
  const [laborWeight, setLaborWeight] = useState(0.4);
  const [simulationData, setSimulationData] = useState<any>(null);
  const [ndviData, setNdviData] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      simulatorService.simulateRotation({
        water_weight: waterWeight,
        profit_weight: profitWeight,
        soil_recovery_weight: soilWeight,
        labor_weight: laborWeight,
        current_crop: 'Paddy (Kharif)',
        cluster_soil_ph: 5.6,
      }),
      simulatorService.checkNdvi(9.8959, 76.7184),
    ])
      .then(([simRes, ndviRes]) => {
        setSimulationData(simRes.data);
        setNdviData(ndviRes.data);
      })
      .catch(() => {});
  }, [waterWeight, profitWeight, soilWeight, laborWeight]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#84CC16] uppercase tracking-wider">
          <RotateCw className="w-4 h-4" />
          <span>Module 2: 3-Season Field Shift Multi-Cropping Simulator</span>
        </div>
        <h2 className="text-xl font-bold text-white mt-1">
          3-Season Kharif &rarr; Rabi &rarr; Zaid Rotation Simulator
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Interactive multi-objective optimization balancing water conservation, net margin, nitrogen recovery &amp; labor intensity
        </p>
      </div>

      {ndviData && (
        <div
          className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${
            ndviData.alert_triggered
              ? 'bg-amber-950/30 border-amber-700/70 text-amber-200'
              : 'bg-emerald-950/30 border-emerald-700/70 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#07090D] border border-white/10 text-[#84CC16]">
              <Satellite className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">{ndviData.satellite}</div>
              <div className="text-xs opacity-90 mt-0.5">{ndviData.advisory}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span>
              Peak NDVI: <strong>{ndviData.peak_ndvi}</strong>
            </span>
            <span>
              Current: <strong>{ndviData.current_ndvi}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-amber-950 border border-amber-800 text-amber-300 font-bold">
              -{ndviData.decline_percentage}% Decline
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-white/10">
            <Sliders className="w-4 h-4 text-[#84CC16]" />
            <h3 className="text-sm font-bold text-white">Agronomic Constraint Weights</h3>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Water Conservation Priority</span>
              </span>
              <span className="font-mono text-[#38BDF8] font-bold">{Math.round(waterWeight * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={waterWeight}
              onChange={(e) => setWaterWeight(parseFloat(e.target.value))}
              className="w-full accent-[#38BDF8] cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#84CC16]" />
                <span>Market Profit Priority</span>
              </span>
              <span className="font-mono text-[#84CC16] font-bold">{Math.round(profitWeight * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={profitWeight}
              onChange={(e) => setProfitWeight(parseFloat(e.target.value))}
              className="w-full accent-[#84CC16] cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5 text-teal-400" />
                <span>Soil Nitrogen Recovery</span>
              </span>
              <span className="font-mono text-teal-400 font-bold">{Math.round(soilWeight * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={soilWeight}
              onChange={(e) => setSoilWeight(parseFloat(e.target.value))}
              className="w-full accent-teal-400 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#FACC15]" />
                <span>Low Labor Simplicity</span>
              </span>
              <span className="font-mono text-[#FACC15] font-bold">{Math.round(laborWeight * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={laborWeight}
              onChange={(e) => setLaborWeight(parseFloat(e.target.value))}
              className="w-full accent-[#FACC15] cursor-pointer"
            />
          </div>
        </div>

        <div className="lg:col-span-7 space-y-4">
          {simulationData?.all_rotations?.map((rot: any, idx: number) => {
            const isTop = idx === 0;
            return (
              <div
                key={idx}
                className={`rounded-2xl p-5 border shadow-2xl space-y-4 ${
                  isTop
                    ? 'bg-[#84CC16]/10 border-[#84CC16]/60'
                    : 'bg-[#0E1015]/90 border-white/10'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isTop && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#84CC16] text-[#07090D] font-extrabold text-[10px] uppercase">
                        ★ TOP REGIME
                      </span>
                    )}
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      {rot.kharif} &rarr; {rot.rabi} &rarr; {rot.zaid}
                    </h3>
                  </div>
                  <div className="px-3 py-1 rounded-xl bg-[#07090D] border border-white/10 text-xs font-mono">
                    <span className="text-slate-400">Fitness Score: </span>
                    <span className="text-[#84CC16] font-bold">{rot.composite_fitness_score}%</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{rot.description}</p>

                <div className="grid grid-cols-3 gap-2">
                  {rot.seasonal_timeline?.map((step: any, sIdx: number) => (
                    <div key={sIdx} className="p-3 rounded-xl bg-[#07090D] border border-white/10 space-y-1">
                      <div className="text-[10px] font-mono text-[#84CC16] uppercase">{step.season}</div>
                      <div className="text-xs font-bold text-white">{step.crop}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{step.months}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-[11px] font-mono">
                  <div className="text-slate-400">
                    Est. Margin: <strong className="text-[#84CC16]">₹{rot.estimated_net_margin_inr_acre.toLocaleString()}/ac</strong>
                  </div>
                  <div className="text-slate-400">
                    N Fixation: <strong className="text-[#38BDF8]">+{rot.nitrogen_fixation_kg_ha} kg/ha</strong>
                  </div>
                  <div className="text-slate-400">
                    Water Saved: <strong className="text-[#FACC15]">{rot.water_saving_percent}%</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
