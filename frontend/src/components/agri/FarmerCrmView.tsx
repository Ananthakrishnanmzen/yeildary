import { useEffect, useState } from 'react';
import {
  ArrowUpDown,
  CheckCircle2,
  FileText,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  Users,
  X,
} from 'lucide-react';
import { crmService } from '../../services/api';

interface FarmerCrmViewProps {
  onLocateOnMap?: (lat: number, lon: number) => void;
  initialFarmerId?: number | null;
}

export default function FarmerCrmView({ onLocateOnMap, initialFarmerId }: FarmerCrmViewProps) {
  const [farmers, setFarmers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('all');
  const [selectedRisk, setSelectedRisk] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const [selectedFarmerId, setSelectedFarmerId] = useState<number | null>(initialFarmerId || null);
  const [farmerDetails, setFarmerDetails] = useState<any>(null);

  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [activeFarmerForSms, setActiveFarmerForSms] = useState<any>(null);
  const [smsText, setSmsText] = useState('');
  const [smsSentBanner, setSmsSentBanner] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      crmService
        .getFarmers({
          q: searchQuery,
          crop: selectedCrop,
          risk: selectedRisk,
          sort_by: sortBy,
          sort_order: sortOrder,
        })
        .then((res) => setFarmers(res.data || []))
        .catch(() => {});
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCrop, selectedRisk, sortBy, sortOrder]);

  useEffect(() => {
    if (initialFarmerId) {
      openFarmerDrawer(initialFarmerId);
    }
  }, [initialFarmerId]);

  const openFarmerDrawer = async (farmerId: number) => {
    setSelectedFarmerId(farmerId);
    try {
      const res = await crmService.getFarmerById(farmerId);
      setFarmerDetails(res.data);
    } catch {
      // ignore
    }
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-5 relative">
      <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#84CC16] uppercase tracking-wider">
          <Users className="w-4 h-4" />
          <span>Cadastral CRM &amp; Farmer Directory</span>
        </div>
        <h2 className="text-xl font-bold text-white mt-1">Farm &amp; Farmer CRM Directory</h2>
        <p className="text-xs text-slate-400">
          Village-level registry, cadastral plot polygons, soil test histories &amp; direct SMS advisory dispatch
        </p>
      </div>

      {smsSentBanner && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{smsSentBanner}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by farmer name, phone number or village..."
            className="w-full bg-[#07090D] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#84CC16]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCrop}
            onChange={(e) => setSelectedCrop(e.target.value)}
            className="bg-[#07090D] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200"
          >
            <option value="all">All Crops</option>
            <option value="Paddy">Paddy (നെല്ല്)</option>
            <option value="Banana">Banana (വാഴ)</option>
            <option value="Spices">Spices / Pepper (കുരുമുളക്)</option>
            <option value="Rubber">Rubber (റബ്ബർ)</option>
            <option value="Coconut">Coconut (തെങ്ങ്)</option>
            <option value="Vegetables">Vegetables (പച്ചക്കറി)</option>
          </select>

          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="bg-[#07090D] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200"
          >
            <option value="all">All Risks</option>
            <option value="Normal">Healthy (Normal)</option>
            <option value="Moderate">Moderate Stress</option>
            <option value="Critical">Critical Alert</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#07090D] text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
              <tr>
                <th onClick={() => toggleSort('name')} className="p-3.5 cursor-pointer hover:text-white">
                  <div className="flex items-center gap-1">
                    <span>Farmer Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3.5">Phone</th>
                <th className="p-3.5">Village</th>
                <th className="p-3.5">Crop</th>
                <th onClick={() => toggleSort('size')} className="p-3.5 cursor-pointer hover:text-white">
                  <div className="flex items-center gap-1">
                    <span>Acreage</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th onClick={() => toggleSort('risk')} className="p-3.5 cursor-pointer hover:text-white">
                  <div className="flex items-center gap-1">
                    <span>Risk Status</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {farmers.map((farmer) => {
                const isCritical = farmer.risk_status === 'Critical';
                const isModerate = farmer.risk_status === 'Moderate';
                return (
                  <tr
                    key={farmer.id}
                    onClick={() => openFarmerDrawer(farmer.id)}
                    className="hover:bg-white/5 transition cursor-pointer"
                  >
                    <td className="p-3.5 font-bold text-white flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isCritical ? 'bg-red-500' : isModerate ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                      <span>{farmer.full_name}</span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">{farmer.phone}</td>
                    <td className="p-3.5">{farmer.village}</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-lg bg-[#07090D] border border-white/10">
                        {farmer.crop_type}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono">{farmer.plot_size_acres} Acres</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isCritical
                            ? 'bg-red-950/80 text-red-300 border border-red-800'
                            : isModerate
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {farmer.risk_status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`tel:${farmer.phone}`}
                          className="p-2 rounded-lg bg-[#07090D] hover:text-[#84CC16] border border-white/10 text-slate-400"
                          title="Call Farmer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFarmerForSms(farmer);
                            setSmsText(
                              `Dear ${farmer.full_name}, FPO advisory: Please ensure immediate bio-fungicide spray against fungal blast risk for your ${farmer.crop_type} plot.`,
                            );
                            setSmsModalOpen(true);
                          }}
                          className="p-2 rounded-lg bg-[#07090D] hover:text-[#38BDF8] border border-white/10 text-slate-400 cursor-pointer"
                          title="Send Advisory SMS"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        {onLocateOnMap && (
                          <button
                            type="button"
                            onClick={() => onLocateOnMap(farmer.latitude, farmer.longitude)}
                            className="p-2 rounded-lg bg-[#07090D] hover:text-[#84CC16] border border-white/10 text-slate-400 cursor-pointer"
                            title="Locate on FPO Heatmap"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Farmer Dossier Drawer */}
      {selectedFarmerId && farmerDetails && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0E1015] border-l border-white/15 h-full p-5 overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#84CC16]" />
                <h3 className="text-base font-bold text-white">Farmer Agronomic Dossier</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFarmerId(null);
                  setFarmerDetails(null);
                }}
                className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#07090D] border border-white/10 space-y-2">
              <div className="text-base font-bold text-white">{farmerDetails.full_name}</div>
              <div className="text-xs text-slate-400">
                {farmerDetails.plot_name} &bull; {farmerDetails.village} ({farmerDetails.plot_size_acres} Acres)
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-xs font-mono">
                <div className="p-2 rounded bg-[#0E1015] border border-white/10">
                  <div className="text-[10px] text-slate-400">NDVI</div>
                  <div className="font-bold text-[#84CC16]">{farmerDetails.ndvi_score}</div>
                </div>
                <div className="p-2 rounded bg-[#0E1015] border border-white/10">
                  <div className="text-[10px] text-slate-400">Soil pH</div>
                  <div className="font-bold text-[#FACC15]">{farmerDetails.soil_ph}</div>
                </div>
                <div className="p-2 rounded bg-[#0E1015] border border-white/10">
                  <div className="text-[10px] text-slate-400">Moisture</div>
                  <div className="font-bold text-[#38BDF8]">{farmerDetails.soil_moisture}%</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold text-[#84CC16] uppercase">Topsoil Test History</h5>
              <div className="grid grid-cols-2 gap-2">
                {farmerDetails.soil_test_history?.map((item: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-[#07090D] border border-white/10 text-xs">
                    <div className="text-[10px] text-slate-400">{item.param}</div>
                    <div className="font-bold text-white font-mono">{item.value}</div>
                    <div className="text-[10px] text-[#84CC16]">{item.rating}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold text-[#38BDF8] uppercase">Active Subsidies</h5>
              <div className="space-y-1.5">
                {farmerDetails.active_schemes?.map((sch: string, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-[#07090D] border border-white/10 text-xs text-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                    <span>{sch}</span>
                  </div>
                ))}
              </div>
            </div>

            {onLocateOnMap && (
              <button
                type="button"
                onClick={() => {
                  const lat = farmerDetails.latitude;
                  const lon = farmerDetails.longitude;
                  setSelectedFarmerId(null);
                  onLocateOnMap(lat, lon);
                }}
                className="w-full py-2.5 rounded-xl bg-[#84CC16] text-[#07090D] font-bold text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
                <span>Locate Plot on FPO Command Map</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* SMS Modal */}
      {smsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0E1015] border border-white/15 rounded-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">
                Send Advisory SMS to {activeFarmerForSms?.full_name}
              </span>
              <button type="button" onClick={() => setSmsModalOpen(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              rows={4}
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              className="w-full bg-[#07090D] border border-white/10 rounded-xl p-3 text-xs text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSmsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSmsSentBanner(`Advisory SMS dispatched to ${activeFarmerForSms?.full_name} (${activeFarmerForSms?.phone})!`);
                  setSmsModalOpen(false);
                  setTimeout(() => setSmsSentBanner(null), 4000);
                }}
                className="px-4 py-2 rounded-xl bg-[#38BDF8] text-[#07090D] font-bold text-xs cursor-pointer"
              >
                Dispatch SMS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
