
import { StatsSummary } from "@/lib/types";
import GlassPanel from "@/components/ui/GlassPanel";
import { Satellite, Building, Trash2, AlertTriangle, ShieldAlert, Bell } from "lucide-react";

interface KPIStripProps {
  stats: StatsSummary;
}

export default function KPIStrip({ stats }: KPIStripProps) {
  const kpis = [
    { label: "Satellites", value: stats.satellites, icon: Satellite, color: "text-cyan-400" },
    { label: "Stations", value: stats.stations, icon: Building, color: "text-purple-400" },
    { label: "Debris", value: stats.debris, icon: Trash2, color: "text-orange-400" },
    { label: "Active Conjunctions", value: stats.active_conjunctions, icon: AlertTriangle, color: "text-red-400" },
    { label: "Pending Maneuvers", value: stats.pending_maneuvers, icon: ShieldAlert, color: "text-yellow-400" },
    { label: "Unacknowledged Alerts", value: stats.unacknowledged_alerts, icon: Bell, color: "text-rose-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi) => (
        <GlassPanel key={kpi.label} className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${kpi.color} bg-white/5`}>
            <kpi.icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-white/50 text-xs">{kpi.label}</p>
            <p className={`text-2xl font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
