"use client";

import { ConjunctionAnalytics } from "@/lib/types";
import { Navigation } from "lucide-react";

interface Props {
  analytics: ConjunctionAnalytics;
}

export default function QuickStats({ analytics }: Props) {
  const byRisk = analytics.by_risk_tier || {};
  const critical = byRisk.critical || 0;
  const high = byRisk.high || 0;
  const watch = byRisk.watch || 0;
  const low = byRisk.low || 0;

  return (
    <div className="bg-[var(--space-panel)] border border-[var(--space-border)] rounded-md flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--space-border)] flex items-center justify-between">
        <h2 className="text-[10px] font-mono font-semibold text-[var(--accent-amber)] uppercase tracking-widest">
          MANEUVER DECISION CENTER
        </h2>
        <Navigation className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </div>

      <div className="flex-1 p-4 flex flex-col justify-between">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <h3 className="text-[9px] text-[var(--text-dim)] font-semibold mb-2 uppercase tracking-widest border-b border-[var(--space-border)] pb-1">Conjunctions</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[var(--text-secondary)] font-medium">Critical</span>
                <span className="font-mono text-[var(--tier-critical)] font-semibold">{critical}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[var(--text-secondary)] font-medium">High Risk</span>
                <span className="font-mono text-[var(--tier-high)] font-semibold">{high}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[var(--text-secondary)] font-medium">Watch</span>
                <span className="font-mono text-[var(--tier-watch)] font-semibold">{watch}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[var(--text-secondary)] font-medium">Low Risk</span>
                <span className="font-mono text-[var(--tier-nominal)] font-semibold">{low}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[9px] text-[var(--text-dim)] font-semibold mb-2 uppercase tracking-widest border-b border-[var(--space-border)] pb-1">Maneuver Ops</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[var(--text-secondary)] font-medium">Required</span>
                <span className="font-mono text-[var(--tier-critical)] font-semibold">{analytics.maneuver_required || 0}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[var(--text-secondary)] font-medium">Pending</span>
                <span className="font-mono text-[var(--accent-amber)] font-semibold">{analytics.maneuver_pending || 0}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[var(--text-secondary)] font-medium">Approved</span>
                <span className="font-mono text-[var(--tier-nominal)] font-semibold">{analytics.maneuver_approved || 0}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[var(--text-secondary)] font-medium">Mitigated</span>
                <span className="font-mono text-[var(--accent-cyan)] font-semibold">{analytics.conjunctions_mitigated || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
