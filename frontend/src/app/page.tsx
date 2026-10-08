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
import DashboardClient from "@/components/dashboard/DashboardClient";

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
      <DashboardClient 
        stats={stats}
        health={health}
        analytics={analytics}
        conjunctionsRes={conjunctionsRes}
        alertsRes={alertsRes}
        maneuversRes={maneuversRes}
        positionsRes={positionsRes}
        criticalRisks={criticalRisks}
      />
    );
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    return (
      <div className="h-full flex items-center justify-center bg-[#000000] grid-overlay">
        <ErrorState
          title="SYS_FAIL // C2 OFFLINE"
          message="NO SIGNAL FROM TELEMETRY CORE. CHECK SENSOR UPLINK."
        />
      </div>
    );
  }
}