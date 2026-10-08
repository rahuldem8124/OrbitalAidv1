import {
  fetchStats,
  fetchAlerts,
  fetchManeuvers,
  fetchObjectPositions,
  fetchSystemHealth,
  fetchConjunctionAnalytics,
  fetchConjunctionsPaginated,
} from "@/lib/api";
import Globe from "@/components/dashboard/Globe";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import LiveConjunctionWatch from "@/components/dashboard/LiveConjunctionWatch";
import QuickStats from "@/components/dashboard/QuickStats";
import MetricCard from "@/components/shared/MetricCard";
import ErrorState from "@/components/shared/ErrorState";
import { Satellite, AlertTriangle, ShieldAlert, Bell, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const [stats, health, analytics, conjunctionsRes, alertsRes, maneuversRes, positionsRes] = await Promise.all([
      fetchStats(),
      fetchSystemHealth(),
      fetchConjunctionAnalytics(),
      fetchConjunctionsPaginated({ per_page: 8, sort_by: 'tca', sort_order: 'asc' }),
      fetchAlerts(),
      fetchManeuvers(),
      fetchObjectPositions(undefined, 300),
    ]);

    const criticalRisks = analytics.by_risk_tier?.critical || 0;

    return (
      <div className="flex flex-col h-full w-full bg-[var(--space-canvas)] grid-overlay p-4 gap-4">
        
        {/* Top Telemetry Strip (Fixed Height) */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 flex-shrink-0">
          <MetricCard 
            label="Objects Tracked" 
            value={stats.total_objects} 
            icon={<Satellite className="w-4 h-4" />} 
          />
          <MetricCard 
            label="Active Conjunctions" 
            value={stats.active_conjunctions} 
            icon={<Activity className="w-4 h-4" />} 
          />
          <MetricCard 
            label="Critical Risks" 
            value={criticalRisks} 
            variant={criticalRisks > 0 ? "critical" : "default"}
            icon={<AlertTriangle className="w-4 h-4" />} 
          />
          <MetricCard 
            label="Active Alerts" 
            value={stats.unacknowledged_alerts} 
            variant={stats.unacknowledged_alerts > 0 ? "warning" : "default"}
            icon={<Bell className="w-4 h-4" />} 
          />
          <MetricCard 
            label="Pending Maneuvers" 
            value={stats.pending_maneuvers} 
            icon={<ShieldAlert className="w-4 h-4" />} 
          />
          <MetricCard 
            label="System Status" 
            value={health.status.toUpperCase()}
            variant={health.status === 'healthy' ? 'success' : health.status === 'degraded' ? 'warning' : 'critical'}
          />
        </div>

        {/* Main Split Deck */}
        <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
          
          {/* Left / Center Zone: 3D Globe + Docked Telemetry Drawer */}
          <div className="flex-1 flex flex-col relative rounded-md border border-[var(--space-border)] overflow-hidden bg-[var(--space-panel)]">
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
              <h2 className="text-[10px] font-mono font-semibold text-[var(--accent-amber)] uppercase tracking-widest bg-[var(--space-panel)]/80 backdrop-blur px-2 py-1 border border-[var(--space-border)] rounded-sm">
                ORBITAL VIEW
              </h2>
            </div>
            
            {/* The Globe takes up all remaining space */}
            <div className="flex-1 relative">
              <Globe positions={positionsRes.positions} />
            </div>

            {/* Docked Bottom Telemetry Drawer */}
            <div className="w-full shrink-0 relative z-20">
              <ActivityFeed alerts={alertsRes.alerts} maneuvers={maneuversRes.maneuvers} />
            </div>
          </div>

          {/* Right Zone: Conjunction Operations Deck */}
          <div className="w-[30%] min-w-[340px] max-w-[400px] flex flex-col gap-4 overflow-y-auto pr-1">
            <div className="flex-shrink-0">
              <LiveConjunctionWatch conjunctions={conjunctionsRes.items} />
            </div>
            <div className="flex-shrink-0">
              <QuickStats analytics={analytics} />
            </div>
          </div>

        </div>

      </div>
    );
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    return (
      <div className="h-full flex items-center justify-center bg-[var(--space-canvas)] grid-overlay">
        <ErrorState
          title="Mission Control Offline"
          message="Could not connect to the OrbitalAid backend. Ensure the API server is running and the NEXT_PUBLIC_API_URL environment variable is configured correctly."
        />
      </div>
    );
  }
}