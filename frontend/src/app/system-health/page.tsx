"use client";

import { useState, useEffect } from "react";
import { fetchSystemHealth } from "@/lib/api";
import { SystemHealth } from "@/lib/types";
import MetricCard from "@/components/shared/MetricCard";
import SystemHealthIndicator from "@/components/shared/SystemHealthIndicator";
import { formatUTC, timeAgo } from "@/lib/time";
import { RefreshCw, AlertTriangle } from "lucide-react";

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastPolled, setLastPolled] = useState<Date>(new Date());

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const poll = async () => {
      try {
        const data = await fetchSystemHealth();
        setHealth(data);
        setError(false);
        setLastPolled(new Date());
      } catch (err) {
        console.error("System health fetch failed", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    poll();
    interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  const renderStatusCard = (label: string, status: string | undefined, note?: string) => {
    let indicatorState: 'online' | 'offline' | 'degraded' | 'unknown' = 'unknown';

    if (status) {
      const s = status.toLowerCase();
      if (s === 'online' || s === 'running' || s === 'connected' || s === 'healthy' || s === 'operational') {
        indicatorState = 'online';
      } else if (s === 'degraded' || s === 'idle') {
        indicatorState = 'degraded';
      } else if (s === 'offline' || s === 'error') {
        indicatorState = 'offline';
      }
    } else {
      indicatorState = error ? 'offline' : 'unknown';
    }

    const stateColor = {
      online: 'text-[var(--tier-nominal)]',
      degraded: 'text-[var(--tier-watch)]',
      offline: 'text-[var(--tier-critical)]',
      unknown: 'text-[var(--text-muted)]',
    }[indicatorState];

    return (
      <div className="bg-[var(--space-panel)] border border-[var(--space-border)] p-5 rounded-md flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[var(--text-primary)] font-medium block">{label}</span>
          {note && <span className="text-xs text-[var(--text-muted)] mt-1 block">{note}</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-sm font-mono uppercase tracking-wider ${stateColor}`}>
            {status || (error ? 'OFFLINE' : 'UNKNOWN')}
          </span>
          <SystemHealthIndicator status={indicatorState === 'unknown' ? 'degraded' : indicatorState} />
        </div>
      </div>
    );
  };

  if (loading && !health) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-[var(--accent-cyan)] text-2xl font-semibold tracking-wide uppercase">System Health Dashboard</h1>
        <div className="text-[var(--text-muted)] text-sm">Loading system telemetry...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl pb-12">
      <div className="flex justify-between items-end border-b border-[var(--space-border)] pb-4 gap-4 flex-wrap">
        <h1 className="text-[var(--accent-cyan)] text-2xl font-semibold tracking-wide uppercase">System Health Dashboard</h1>
        <div className="flex items-center gap-3 text-sm text-[var(--text-muted)] font-mono">
          <RefreshCw className="w-3.5 h-3.5 animate-spin-slow opacity-50" />
          <span>Polled {timeAgo(lastPolled.toISOString())} · Auto-refresh 15s</span>
        </div>
      </div>

      {error && !health && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-md flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>System health endpoint unavailable. Cannot reach backend.</span>
        </div>
      )}

      {/* Status Grid */}
      <div>
        <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Service Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderStatusCard("Backend API", health?.api || (error ? "offline" : "unknown"), "REST API service")}
          {renderStatusCard("Database", health?.database || (error ? "offline" : "unknown"), "Primary data store")}
          {renderStatusCard(
            "Screening Engine",
            health?.status === "operational" ? "Running" : health?.status ? "Idle" : undefined,
            "Conjunction screening pipeline"
          )}
          {renderStatusCard(
            "Risk Engine",
            health?.status === "operational" ? "Running" : health?.status ? "Idle" : undefined,
            "Probability of collision assessment"
          )}
          {renderStatusCard(
            "Data Feed",
            health ? "Connected" : undefined,
            "TLE/OMM ingestion feed"
          )}
        </div>
      </div>

      {/* Operational Metrics */}
      <div>
        <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Operational Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard label="Objects Tracked" value={health?.objects_tracked?.toLocaleString() ?? "—"} />
          <MetricCard label="Active Conjunctions" value={health?.conjunctions_active ?? "—"} variant="warning" />
          <MetricCard label="Risk Assessments" value={health?.risk_assessments?.toLocaleString() ?? "—"} />
          <MetricCard label="Active Alerts" value={health?.alerts_active ?? "—"} variant="critical" />
          <MetricCard label="Pending Maneuvers" value={health?.maneuvers_pending ?? "—"} variant="warning" />
          <MetricCard
            label="Overall Status"
            value={health?.status?.toUpperCase() ?? "UNKNOWN"}
            variant={
              health?.status === "operational" ? "success"
              : health?.status === "degraded" ? "warning"
              : "default"
            }
          />
        </div>
      </div>

      {/* Last Operations — no clipping, two-line layout for timestamps */}
      <div className="bg-[var(--space-panel)] border border-[var(--space-border)] p-6 rounded-md">
        <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4 border-b border-[var(--space-border)] pb-2">
          Last Operations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Last Screening Job</span>
            {health?.last_screening ? (
              <>
                <span className="text-[var(--text-primary)] font-mono text-sm break-all">{formatUTC(health.last_screening)}</span>
                <span className="text-xs text-[var(--text-muted)]">{timeAgo(health.last_screening)}</span>
              </>
            ) : (
              <span className="text-[var(--text-muted)] text-sm">Never run</span>
            )}
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Last Risk Assessment</span>
            {health?.last_risk_assessment ? (
              <>
                <span className="text-[var(--text-primary)] font-mono text-sm break-all">{formatUTC(health.last_risk_assessment)}</span>
                <span className="text-xs text-[var(--text-muted)]">{timeAgo(health.last_risk_assessment)}</span>
              </>
            ) : (
              <span className="text-[var(--text-muted)] text-sm">Never run</span>
            )}
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Data Freshness Check</span>
            {health?.data_freshness ? (
              <>
                <span className="text-[var(--text-primary)] font-mono text-sm break-all">{formatUTC(health.data_freshness)}</span>
                <span className="text-xs text-[var(--text-muted)]">{timeAgo(health.data_freshness)}</span>
              </>
            ) : (
              <span className="text-[var(--text-muted)] text-sm">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Disclaimer for status fields not backed by real health checks */}
      <div className="text-xs text-[var(--text-muted)] bg-[var(--space-panel)] border border-[var(--space-border)] rounded-md p-4">
        <strong className="text-[var(--text-secondary)]">Note:</strong> Screening Engine and Risk Engine status reflect overall system
        health, not real-time process monitoring. &quot;Running&quot; indicates the API is operational; it does not confirm that
        background processes are actively executing.
      </div>
    </div>
  );
}
