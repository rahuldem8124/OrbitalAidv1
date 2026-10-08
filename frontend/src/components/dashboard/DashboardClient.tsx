"use client";

import { useState } from "react";
import Globe from "@/components/dashboard/Globe";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import LiveConjunctionWatch from "@/components/dashboard/LiveConjunctionWatch";
import QuickStats from "@/components/dashboard/QuickStats";
import MetricCard from "@/components/shared/MetricCard";
import { Satellite, AlertTriangle, ShieldAlert, Bell, Activity, Radio } from "lucide-react";
import { ConjunctionWithDetails } from "@/lib/types";

interface DashboardClientProps {
  stats: {
    total_objects: number;
    active_conjunctions: number;
    unacknowledged_alerts: number;
    pending_maneuvers: number;
  };
  health: {
    status: string;
  };
  analytics: any;
  conjunctionsRes: {
    items: ConjunctionWithDetails[];
  };
  alertsRes: {
    alerts: any[];
  };
  maneuversRes: {
    maneuvers: any[];
  };
  positionsRes: {
    positions: any[];
  };
  criticalRisks: number;
}

export default function DashboardClient({
  stats,
  health,
  analytics,
  conjunctionsRes,
  alertsRes,
  maneuversRes,
  positionsRes,
  criticalRisks,
}: DashboardClientProps) {
  const [selectedConjunction, setSelectedConjunction] = useState<ConjunctionWithDetails | null>(null);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#030508] select-none">
      
      {/* ============================================================== */}
      {/* LAYER 0: FULL-SCREEN IMMERSIVE 3D WEBGL CANVAS (Z-0)           */}
      {/* ============================================================== */}
      <div className="absolute inset-0 w-full h-full z-0">
        <Globe
          positions={positionsRes.positions}
          selectedConjunction={selectedConjunction}
          onCloseConjunction={() => setSelectedConjunction(null)}
        />
      </div>

      {/* ============================================================== */}
      {/* LAYER 1: FLOATING HUD OVERLAYS (Z-10, POINTER-EVENTS-NONE ROOT)*/}
      {/* ============================================================== */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        
        {/* TOP METRIC STRIP (Floating Glass HUD) */}
        <div className="absolute top-3 left-4 right-4 z-20 pointer-events-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            <MetricCard
              label="Tracked Targets"
              value={stats.total_objects?.toLocaleString() ?? "0"}
              icon={<Satellite className="w-3.5 h-3.5" />}
            />
            <MetricCard
              label="Active Vectors"
              value={stats.active_conjunctions ?? 0}
              icon={<Activity className="w-3.5 h-3.5" />}
            />
            <MetricCard
              label="Critical Threats"
              value={criticalRisks}
              variant={criticalRisks > 0 ? "critical" : "default"}
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
            />
            <MetricCard
              label="Active Alerts"
              value={stats.unacknowledged_alerts ?? 0}
              variant={stats.unacknowledged_alerts > 0 ? "warning" : "default"}
              icon={<Bell className="w-3.5 h-3.5" />}
            />
            <MetricCard
              label="Evasion Pending"
              value={stats.pending_maneuvers ?? 0}
              variant={stats.pending_maneuvers > 0 ? "warning" : "default"}
              icon={<ShieldAlert className="w-3.5 h-3.5" />}
            />
            <MetricCard
              label="System Core"
              value={health.status ? health.status.toUpperCase() : "ONLINE"}
              variant={health.status === "healthy" || health.status === "operational" ? "success" : "warning"}
            />
          </div>
        </div>

        {/* BOTTOM LEFT: FLOATING TERMINAL STREAM */}
        <div className="absolute left-4 bottom-4 w-[520px] max-w-[calc(100vw-28rem)] h-56 z-20 pointer-events-auto shadow-2xl">
          <ActivityFeed alerts={alertsRes.alerts} maneuvers={maneuversRes.maneuvers} />
        </div>

        {/* BOTTOM CENTER: SUBTLE HUD SENSOR BAR */}
        <div className="hidden xl:flex absolute bottom-4 left-1/2 -translate-x-1/2 z-10 items-center gap-3 bg-[#05070A]/60 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-sm shadow-xl text-[9px] font-mono text-zinc-400">
          <div className="flex items-center gap-1.5 text-cyan-400">
            <Radio className="w-3 h-3 animate-pulse" />
            <span className="font-bold">ORBITAL SURVEILLANCE RADAR</span>
          </div>
          <span className="text-zinc-600">|</span>
          <span>SGP4 BATCH PROPAGATOR ACTIVE</span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-500">CLICK & DRAG TO ROTATE SCENE</span>
        </div>

        {/* RIGHT SIDEBAR: FLOATING CONJUNCTION WATCH & STATS */}
        <div className="absolute right-4 top-20 bottom-4 w-96 z-20 pointer-events-auto flex flex-col gap-3 overflow-hidden">
          {/* Conjunction list cards */}
          <div className="flex-1 min-h-0 overflow-hidden shadow-2xl">
            <LiveConjunctionWatch
              conjunctions={conjunctionsRes.items}
              onSelect={setSelectedConjunction}
              selectedId={selectedConjunction?.id}
            />
          </div>

          {/* Quick Analytics Card at bottom of sidebar */}
          <div className="shrink-0 h-44 shadow-2xl">
            <QuickStats analytics={analytics} />
          </div>
        </div>

      </div>

    </div>
  );
}
