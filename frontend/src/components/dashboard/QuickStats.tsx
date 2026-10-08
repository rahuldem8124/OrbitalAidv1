"use client";

import { ConjunctionAnalytics } from "@/lib/types";
import { Navigation } from "lucide-react";
import HUDContainer from "../ui/HUDContainer";

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
    <HUDContainer title="MANEUVER OPS CENTER" className="flex flex-col h-full overflow-hidden" cornerCut={true}>
      <div className="flex-1 p-4 flex flex-col justify-between mt-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 relative">
          
          {/* Decorative center grid line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[var(--space-border)]/50 -translate-x-1/2"></div>
          
          {/* Conjunctions Column */}
          <div>
            <h3 className="text-[9px] text-[var(--accent-cyan)] font-mono font-bold mb-3 uppercase tracking-widest border-b border-[var(--space-border-bright)]/30 pb-1 flex justify-between items-center">
              <span>TARGET LOCKS</span>
              <span className="text-[var(--text-dim)]">#CNT</span>
            </h3>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono border-b border-[var(--space-border)]/30 pb-1">
                <span className="text-[var(--text-secondary)]">CRITICAL</span>
                <span className="text-[var(--tier-critical)] font-bold">{critical}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono border-b border-[var(--space-border)]/30 pb-1">
                <span className="text-[var(--text-secondary)]">HIGH RISK</span>
                <span className="text-[var(--tier-high)] font-bold">{high}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono border-b border-[var(--space-border)]/30 pb-1">
                <span className="text-[var(--text-secondary)]">WATCH</span>
                <span className="text-[var(--tier-watch)] font-bold">{watch}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-[var(--text-secondary)]">LOW RISK</span>
                <span className="text-[var(--tier-nominal)] font-bold">{low}</span>
              </div>
            </div>
          </div>

          {/* Maneuver Ops Column */}
          <div>
            <h3 className="text-[9px] text-[var(--accent-amber)] font-mono font-bold mb-3 uppercase tracking-widest border-b border-[var(--space-border-bright)]/30 pb-1 flex justify-between items-center">
              <span>EVASION VECTORS</span>
              <span className="text-[var(--text-dim)]">#STS</span>
            </h3>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono border-b border-[var(--space-border)]/30 pb-1">
                <span className="text-[var(--text-secondary)]">REQUIRED</span>
                <span className="text-[var(--tier-critical)] font-bold">{analytics.maneuver_required || 0}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono border-b border-[var(--space-border)]/30 pb-1">
                <span className="text-[var(--text-secondary)]">PENDING</span>
                <span className="text-[var(--accent-amber)] font-bold">{analytics.maneuver_pending || 0}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono border-b border-[var(--space-border)]/30 pb-1">
                <span className="text-[var(--text-secondary)]">APPROVED</span>
                <span className="text-[var(--tier-nominal)] font-bold">{analytics.maneuver_approved || 0}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-[var(--text-secondary)]">MITIGATED</span>
                <span className="text-[var(--accent-cyan)] font-bold">{analytics.conjunctions_mitigated || 0}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative Radar Sweep Element */}
        <div className="mt-4 pt-3 border-t border-[var(--space-border)]/30 flex items-center justify-between opacity-50">
           <div className="flex gap-1">
              {Array.from({length: 12}).map((_, i) => (
                <div key={i} className="w-1 h-3 bg-[var(--accent-amber)]" style={{ opacity: Math.random() * 0.8 + 0.2 }}></div>
              ))}
           </div>
           <span className="text-[8px] font-mono text-[var(--text-dim)] tracking-widest uppercase">DATALINK SECURE</span>
        </div>
      </div>
    </HUDContainer>
  );
}
