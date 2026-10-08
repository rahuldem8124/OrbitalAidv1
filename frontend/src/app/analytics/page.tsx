"use client";

import { useEffect, useState } from 'react';
import {
  fetchStats,
  fetchConjunctionAnalytics,
  fetchManeuverAnalytics,
  fetchRiskDistribution,
  fetchAltitudeDistribution,
  fetchResponseTimes,
} from '@/lib/api';
import { StatsSummary, ConjunctionAnalytics, ManeuverAnalytics, ResponseTimeMetrics } from '@/lib/types';
import MetricCard from '@/components/shared/MetricCard';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Clock, TrendingUp } from 'lucide-react';

const TIER_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  watch: "#eab308",
  low: "#22c55e",
  unassessed: "#6b7280",
};

const ALTITUDE_COLOR = "#2dd4bf"; // Teal accent

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<{
    stats: StatsSummary | null;
    conjunctionStats: ConjunctionAnalytics | null;
    maneuverStats: ManeuverAnalytics | null;
    riskDist: Record<string, number> | null;
    altitudeDist: { bins: Record<string, number>; skipped_no_elements: number; total: number } | null;
    responseTimes: ResponseTimeMetrics | null;
  }>({
    stats: null,
    conjunctionStats: null,
    maneuverStats: null,
    riskDist: null,
    altitudeDist: null,
    responseTimes: null,
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendPeriod, setTrendPeriod] = useState<"7d" | "30d">("30d");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use allSettled so a single endpoint failure doesn't wipe the whole page
      const [
        statsRes,
        conjunctionStatsRes,
        maneuverStatsRes,
        riskDistRes,
        altitudeDistRes,
        responseTimesRes
      ] = await Promise.allSettled([
        fetchStats(),
        fetchConjunctionAnalytics(),
        fetchManeuverAnalytics(),
        fetchRiskDistribution(),
        fetchAltitudeDistribution(),
        fetchResponseTimes(),
      ]);

      const resolved = <T,>(r: PromiseSettledResult<T>): T | null =>
        r.status === 'fulfilled' ? r.value : null;

      const stats = resolved(statsRes);
      const conjunctionStats = resolved(conjunctionStatsRes);
      const maneuverStats = resolved(maneuverStatsRes);
      const riskDist = resolved(riskDistRes);
      const altitudeDist = resolved(altitudeDistRes);
      const responseTimes = resolved(responseTimesRes);

      if (!stats && !conjunctionStats && !maneuverStats) {
        setError("Analytics data unavailable — backend may be offline.");
      }

      setData({ stats, conjunctionStats, maneuverStats, riskDist, altitudeDist, responseTimes });
    } catch (err) {
      console.error(err);
      setError("Could not load analytics — make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-white text-2xl font-semibold tracking-tight">ORBITAL SAFETY ANALYTICS CENTER</h1>
        <LoadingState variant="cards" rows={8} />
        <LoadingState variant="chart" rows={2} />
      </div>
    );
  }

  // If ALL primary data failed, show error with retry
  if (error && !data.stats && !data.conjunctionStats && !data.maneuverStats) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-white text-2xl font-semibold tracking-tight">ORBITAL SAFETY ANALYTICS CENTER</h1>
        <ErrorState message={error} onRetry={loadData} />
      </div>
    );
  }

  const { stats, conjunctionStats, maneuverStats, riskDist, altitudeDist, responseTimes } = data;

  // Trend data mapping
  let trendData = conjunctionStats?.trend || [];
  if (trendPeriod === "7d") {
    trendData = trendData.slice(-7);
  }
  const mappedTrend = trendData.map(t => ({
    date: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    critical: t.critical,
    high: t.high,
    other: Math.max(0, t.count - t.critical - t.high)
  }));

  // Risk Distribution mapping
  const riskData = Object.entries(riskDist || {}).map(([tier, count]) => ({
    tier,
    count,
  })).sort((a, b) => b.count - a.count);

  // Maneuver status mapping
  const maneuverData = Object.entries(maneuverStats?.by_status || {}).map(([status, count]) => ({
    status: status.replace('_', ' ').toUpperCase(),
    count
  }));

  // Conjunction status mapping
  const conjunctionStatusData = Object.entries(conjunctionStats?.by_status || {}).map(([status, count]) => ({
    name: status.toUpperCase(),
    value: count,
  }));
  const STATUS_COLORS = ['#2dd4bf', '#3b82f6', '#64748b'];

  // Altitude mapping
  const altitudeData = Object.entries(altitudeDist?.bins || {}).map(
    ([label, count]) => ({
      label,
      count,
    })
  );

  return (
    <div className="flex flex-col gap-6 pb-12">
      <h1 className="text-[#f8fafc] text-2xl font-semibold tracking-tight font-mono">ORBITAL SAFETY ANALYTICS CENTER</h1>

      {/* Section 1: Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Objects Tracked" value={stats?.total_objects?.toLocaleString() ?? "—"} />
        <MetricCard label="Active Satellites" value={stats?.satellites?.toLocaleString() ?? "—"} />
        <MetricCard label="Debris Count" value={stats?.debris?.toLocaleString() ?? "—"} />
        <MetricCard label="Total Conjunctions" value={conjunctionStats?.total_conjunctions?.toLocaleString() ?? "—"} />
        
        <MetricCard label="Critical Events" value={conjunctionStats?.by_risk_tier?.critical ?? 0} variant={conjunctionStats?.by_risk_tier?.critical ? 'critical' : 'default'} />
        <MetricCard label="Active Alerts" value={stats?.unacknowledged_alerts ?? "—"} variant={(stats?.unacknowledged_alerts ?? 0) > 0 ? 'warning' : 'default'} />
        <MetricCard label="Pending Maneuvers" value={stats?.pending_maneuvers ?? "—"} />
        <MetricCard label="Conjunctions Mitigated" value={conjunctionStats?.conjunctions_mitigated ?? 0} variant="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 2: Conjunction Trend */}
        <div className="bg-[var(--space-panel)] border border-[var(--space-border)] rounded-md p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Conjunction Trend</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setTrendPeriod("7d")} 
                className={`text-xs px-3 py-1 rounded ${trendPeriod === "7d" ? 'bg-[#2dd4bf]/20 text-[var(--accent-cyan)]' : 'bg-[var(--space-card-hover)] text-[var(--text-secondary)] hover:text-white'}`}
              >
                7D
              </button>
              <button 
                onClick={() => setTrendPeriod("30d")} 
                className={`text-xs px-3 py-1 rounded ${trendPeriod === "30d" ? 'bg-[#2dd4bf]/20 text-[var(--accent-cyan)]' : 'bg-[var(--space-card-hover)] text-[var(--text-secondary)] hover:text-white'}`}
              >
                30D
              </button>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mappedTrend} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCrit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TIER_COLORS.critical} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={TIER_COLORS.critical} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TIER_COLORS.high} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={TIER_COLORS.high} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOther" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#111827", borderColor: "#1e293b", color: "#f8fafc" }}
                  itemStyle={{ color: "#e2e8f0" }}
                />
                <Area type="monotone" dataKey="other" stackId="1" stroke="#2dd4bf" fillOpacity={1} fill="url(#colorOther)" name="Other" />
                <Area type="monotone" dataKey="high" stackId="1" stroke={TIER_COLORS.high} fillOpacity={1} fill="url(#colorHigh)" name="High" />
                <Area type="monotone" dataKey="critical" stackId="1" stroke={TIER_COLORS.critical} fillOpacity={1} fill="url(#colorCrit)" name="Critical" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Section 3: Risk Distribution */}
        <div className="bg-[var(--space-panel)] border border-[var(--space-border)] rounded-md p-5 flex flex-col gap-4">
          <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Risk Distribution</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                <YAxis type="category" dataKey="tier" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#111827", borderColor: "#1e293b", color: "#f8fafc" }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {riskData.map((entry) => (
                    <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] || "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 4: Maneuver Analytics */}
        <div className="bg-[var(--space-panel)] border border-[var(--space-border)] rounded-md p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Maneuver Activity</h3>
            <span className="text-[var(--accent-cyan)] text-sm font-mono">{maneuverStats?.approval_rate.toFixed(1) || 0}% Approval Rate</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maneuverData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="status" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#111827", borderColor: "#1e293b", color: "#f8fafc" }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Section 6: Conjunction Status Breakdown */}
        <div className="bg-[var(--space-panel)] border border-[var(--space-border)] rounded-md p-5 flex flex-col gap-4">
          <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Conjunction Status</h3>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={conjunctionStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {conjunctionStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "#111827", borderColor: "#1e293b", color: "#f8fafc" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Section 5: Mitigation Analytics */}
      <div className="bg-[var(--space-panel)] border border-[var(--space-border)] rounded-md p-5 flex flex-col gap-4">
        <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Mitigation Summary</h3>
        <p className="text-[var(--text-secondary)] text-sm mb-2 font-mono uppercase">
          <span className="text-[var(--accent-cyan)] font-bold">{maneuverStats?.total_mitigated || 0}</span> CONJUNCTIONS MITIGATED &mdash; <span className="text-[var(--text-primary)] font-bold">{maneuverStats?.approval_rate.toFixed(1) || 0}%</span> APPROVAL RATE
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total Mitigated" value={maneuverStats?.total_mitigated || 0} variant="success" />
          <MetricCard label="Maneuvers Executed" value={maneuverStats?.by_status?.executed || 0} />
          <MetricCard label="Approval Rate" value={`${maneuverStats?.approval_rate.toFixed(1) || 0}%`} />
          <MetricCard label="Avg Delta-V" value={`${maneuverStats?.avg_delta_v.toFixed(3) || 0} m/s`} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 7: Altitude Distribution */}
        <div className="bg-[var(--space-panel)] border border-[var(--space-border)] rounded-md p-5 flex flex-col gap-4">
          <div>
            <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-1">Altitude Distribution</h3>
            <p className="text-[var(--text-secondary)] text-xs">
              {altitudeDist?.total.toLocaleString()} objects tracked
              {altitudeDist?.skipped_no_elements ? ` • ${altitudeDist.skipped_no_elements} skipped` : ''}
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={altitudeData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                <YAxis dataKey="label" type="category" width={100} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#111827", borderColor: "#1e293b", color: "#f8fafc" }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="count" fill={ALTITUDE_COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Section 8: Response Times */}
        <div className="flex flex-col gap-6">
          <div className="bg-[var(--space-panel)] border border-[var(--space-border)] rounded-md p-5 flex flex-col gap-4 h-full">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[var(--accent-cyan)]" />
              <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Alert Acknowledgement</h3>
            </div>
            {responseTimes?.alert_acknowledgement?.count ? (
              <div className="space-y-4 mt-2">
                <div className="flex items-center justify-between border-b border-[var(--space-border)] pb-2">
                  <span className="text-[var(--text-secondary)] text-sm">Average</span>
                  <span className="text-[var(--accent-cyan)] font-mono text-lg font-bold">
                    {formatDuration(responseTimes.alert_acknowledgement.avg_seconds)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-[var(--space-border)] pb-2">
                  <span className="text-[var(--text-secondary)] text-sm">Median</span>
                  <span className="text-[var(--accent-cyan)] font-mono text-lg font-bold">
                    {formatDuration(responseTimes.alert_acknowledgement.median_seconds)}
                  </span>
                </div>
                <p className="text-[var(--text-muted)] text-xs">
                  Based on {responseTimes.alert_acknowledgement.count} acknowledged alerts
                </p>
              </div>
            ) : (
              <p className="text-[var(--text-muted)] text-sm flex-1 flex items-center justify-center">No alert data yet</p>
            )}
          </div>

          <div className="bg-[var(--space-panel)] border border-[var(--space-border)] rounded-md p-5 flex flex-col gap-4 h-full">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#a855f7]" />
              <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Maneuver Decision Time</h3>
            </div>
            {responseTimes?.maneuver_decision?.count ? (
              <div className="space-y-4 mt-2">
                <div className="flex items-center justify-between border-b border-[var(--space-border)] pb-2">
                  <span className="text-[var(--text-secondary)] text-sm">Average</span>
                  <span className="text-[#a855f7] font-mono text-lg font-bold">
                    {formatDuration(responseTimes.maneuver_decision.avg_seconds)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-[var(--space-border)] pb-2">
                  <span className="text-[var(--text-secondary)] text-sm">Median</span>
                  <span className="text-[#a855f7] font-mono text-lg font-bold">
                    {formatDuration(responseTimes.maneuver_decision.median_seconds)}
                  </span>
                </div>
                <p className="text-[var(--text-muted)] text-xs">
                  Based on {responseTimes.maneuver_decision.count} decided maneuvers
                </p>
              </div>
            ) : (
              <p className="text-[var(--text-muted)] text-sm flex-1 flex items-center justify-center">No maneuver data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
