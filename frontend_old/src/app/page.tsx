
import { fetchStats, fetchObjects, fetchConjunctions, fetchManeuvers, fetchAlerts } from "@/lib/api";
import KPIStrip from "@/components/dashboard/KPIStrip";
import Globe from "@/components/dashboard/Globe";
import RiskList from "@/components/dashboard/RiskList";
import ActivityFeed from "@/components/dashboard/ActivityFeed";

export const revalidate = 30;

export default async function Home() {
  const [stats, objectsRes, conjunctionsRes, maneuversRes, alertsRes] = await Promise.all([
    fetchStats(),
    fetchObjects(undefined, 100),
    fetchConjunctions(),
    fetchManeuvers(),
    fetchAlerts(),
  ]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Command Overview</h1>
        <p className="text-white/60">Space situational awareness and collision risk management</p>
      </div>

      {/* KPI Strip */}
      <KPIStrip stats={stats} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Globe */}
        <div className="lg:col-span-2 h-[500px]">
          <Globe objects={objectsRes.objects} />
        </div>

        {/* Side Panels */}
        <div className="lg:col-span-1 space-y-6">
          <div className="h-[240px]">
            <RiskList conjunctions={conjunctionsRes.conjunctions} />
          </div>
          <div className="h-[240px]">
            <ActivityFeed alerts={alertsRes.alerts} maneuvers={maneuversRes.maneuvers} />
          </div>
        </div>
      </div>
    </div>
  );
}
