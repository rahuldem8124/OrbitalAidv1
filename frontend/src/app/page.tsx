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
import SystemHealthIndicator from "@/components/shared/SystemHealthIndicator";
import ErrorState from "@/components/shared/ErrorState";
import LiveClock from "@/components/dashboard/LiveClock";
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
      <div className="flex flex-col gap-6 min-h-screen grid-overlay">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-[#1e293b] pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#e2e8f0] tracking-tight">MISSION CONTROL</h1>
            <p className="text-[#94a3b8] text-sm mt-1">Orbital Surveillance & Conjunction Operations</p>
          </div>
          <div className="flex flex-col items-end gap-2 mt-4 md:mt-0">
            <div className="flex items-center gap-4 bg-[#111827] border border-[#1e293b] px-4 py-2 rounded-lg">
              <SystemHealthIndicator status={health.status === 'healthy' ? 'online' : health.status === 'degraded' ? 'degraded' : 'offline'} label="SYSTEM" />
              <div className="w-px h-4 bg-[#1e293b]"></div>
              <LiveClock />
            </div>
            {health.data_freshness && (
              <span className="text-xs text-[#64748b]">Data Freshness: {health.data_freshness}</span>
            )}
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard 
            label="Objects Tracked" 
            value={stats.total_objects} 
            icon={<Satellite className="w-5 h-5" />} 
          />
          <MetricCard 
            label="Active Conjunctions" 
            value={stats.active_conjunctions} 
            icon={<Activity className="w-5 h-5" />} 
          />
          <MetricCard 
            label="Critical Risks" 
            value={criticalRisks} 
            variant={criticalRisks > 0 ? "critical" : "default"}
            icon={<AlertTriangle className="w-5 h-5" />} 
          />
          <MetricCard 
            label="Active Alerts" 
            value={stats.unacknowledged_alerts} 
            variant={stats.unacknowledged_alerts > 0 ? "warning" : "default"}
            icon={<Bell className="w-5 h-5" />} 
          />
          <MetricCard 
            label="Pending Maneuvers" 
            value={stats.pending_maneuvers} 
            icon={<ShieldAlert className="w-5 h-5" />} 
          />
          <MetricCard 
            label="System Status" 
            value={health.status.toUpperCase()}
            variant={health.status === 'healthy' ? 'success' : health.status === 'degraded' ? 'warning' : 'critical'}
          />
        </div>

        {/* Main Content (2-column layout on desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
          {/* Left: 3D Globe */}
          <div className="lg:col-span-2 h-full bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden p-1 relative">
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
              <h2 className="text-[#2dd4bf] font-mono text-sm tracking-widest font-semibold bg-[#111827]/80 px-2 py-1 rounded">ORBITAL VIEW</h2>
            </div>
            <Globe positions={positionsRes.positions} />
          </div>

          {/* Right: Live Conjunction Watch */}
          <div className="h-full">
            <LiveConjunctionWatch conjunctions={conjunctionsRes.items} />
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
          <div className="h-full bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
             <ActivityFeed alerts={alertsRes.alerts} maneuvers={maneuversRes.maneuvers} />
          </div>
          <div className="h-full">
            <QuickStats analytics={analytics} />
          </div>
        </div>
      </div>
    );
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    return (
      <div className="h-full flex items-center justify-center pt-20">
        <ErrorState
          title="Mission Control Offline"
          message="Could not connect to the OrbitalAid backend. Ensure the API server is running and the NEXT_PUBLIC_API_URL environment variable is configured correctly."
        />
      </div>
    );
  }
}