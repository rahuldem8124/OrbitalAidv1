"use client";

import { useState } from "react";
import Globe from "@/components/dashboard/Globe";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import LiveConjunctionWatch from "@/components/dashboard/LiveConjunctionWatch";
import QuickStats from "@/components/dashboard/QuickStats";
import MetricCard from "@/components/shared/MetricCard";
import HUDContainer from "@/components/ui/HUDContainer";
import { Satellite, AlertTriangle, ShieldAlert, Bell, Activity } from "lucide-react";
import { ConjunctionWithDetails } from "@/lib/types";

export default function DashboardClient({ 
  stats, 
  health, 
  analytics, 
  conjunctionsRes, 
  alertsRes, 
  maneuversRes, 
  positionsRes, 
  criticalRisks 
}: any) {
  const [selectedConjunction, setSelectedConjunction] = useState<ConjunctionWithDetails | null>(null);

  return (
    <div className="flex flex-col h-full w-full bg-[#000000] grid-overlay p-4 gap-4">
      {/* Top Telemetry Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 flex-shrink-0">
        <MetricCard label="TRACKED TARGETS" value={stats.total_objects} icon={<Satellite className="w-3.5 h-3.5" />} />
        <MetricCard label="ACTIVE VECTORS" value={stats.active_conjunctions} icon={<Activity className="w-3.5 h-3.5" />} />
        <MetricCard label="CRITICAL THREATS" value={criticalRisks} variant={criticalRisks > 0 ? "critical" : "default"} icon={<AlertTriangle className="w-3.5 h-3.5" />} />
        <MetricCard label="ACTIVE ALERTS" value={stats.unacknowledged_alerts} variant={stats.unacknowledged_alerts > 0 ? "warning" : "default"} icon={<Bell className="w-3.5 h-3.5" />} />
        <MetricCard label="EVASION PENDING" value={stats.pending_maneuvers} icon={<ShieldAlert className="w-3.5 h-3.5" />} />
        <MetricCard label="SYSTEM CORE" value={health.status.toUpperCase()} variant={health.status === 'healthy' ? 'success' : health.status === 'degraded' ? 'warning' : 'critical'} />
      </div>

      {/* Main Split Deck */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Left / Center Zone: 3D Globe + Terminal Stream */}
        <HUDContainer title="GLOBAL TACTICAL PROJECTION" cornerCut={true} className="flex-1 flex flex-col relative overflow-hidden">
          <div className="flex-1 relative">
            <Globe 
              positions={positionsRes.positions} 
              selectedConjunction={selectedConjunction} 
              onCloseConjunction={() => setSelectedConjunction(null)}
            />
            
            {/* Radar overlay graphics on top of globe */}
            {!selectedConjunction && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-96 h-96 rounded-full border border-[var(--space-border-bright)]/20 flex items-center justify-center">
                <div className="w-64 h-64 rounded-full border border-[var(--space-border-bright)]/30 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full border border-[var(--accent-cyan)]/20 animate-pulse"></div>
                </div>
                <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-[var(--space-border-bright)]/20"></div>
                <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-[var(--space-border-bright)]/20"></div>
              </div>
            )}
          </div>

          <div className="w-full shrink-0 relative z-20">
            <ActivityFeed alerts={alertsRes.alerts} maneuvers={maneuversRes.maneuvers} />
          </div>
        </HUDContainer>

        {/* Right Zone: Target Analysis Deck */}
        <div className="w-[30%] min-w-[340px] max-w-[400px] flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex-shrink-0">
            <LiveConjunctionWatch 
              conjunctions={conjunctionsRes.items} 
              onSelect={setSelectedConjunction} 
              selectedId={selectedConjunction?.id} 
            />
          </div>
          <div className="flex-shrink-0">
            <QuickStats analytics={analytics} />
          </div>
        </div>
      </div>
    </div>
  );
}
