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
      <div className="flex-1 p-3.5 flex flex-col justify-between mt-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 relative">
          
          {/* Decorative center grid line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-1/2"></div>
          
          {/* Conjunctions Column */}
          <div>
            <h3 className="text-[8.5px] text-amber-400 font-mono font-bold mb-2 uppercase tracking-widest border-b border-white/10 pb-1 flex justify-between items-center">
              <span>TARGET LOCKS</span>
              <span className="text-zinc-500">#CNT</span>
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[9.5px] font-mono border-b border-white/5 pb-1">
                <span className="text-zinc-400">CRITICAL</span>
                <span className="text-red-400 font-bold">{critical}</span>
              </div>
              <div className="flex justify-between items-center text-[9.5px] font-mono border-b border-white/5 pb-1">
                <span className="text-zinc-400">HIGH RISK</span>
                <span className="text-orange-400 font-bold">{high}</span>
              </div>
              <div className="flex justify-between items-center text-[9.5px] font-mono border-b border-white/5 pb-1">
                <span className="text-zinc-400">WATCH</span>
                <span className="text-amber-400 font-bold">{watch}</span>
              </div>
              <div className="flex justify-between items-center text-[9.5px] font-mono">
                <span className="text-zinc-400">LOW RISK</span>
                <span className="text-emerald-400 font-bold">{low}</span>
              </div>
            </div>
          </div>

          {/* Maneuver Ops Column */}
          <div>
            <h3 className="text-[8.5px] text-zinc-300 font-mono font-bold mb-2 uppercase tracking-widest border-b border-white/10 pb-1 flex justify-between items-center">
              <span>EVASION VECTORS</span>
              <span className="text-zinc-500">#STS</span>
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[9.5px] font-mono border-b border-white/5 pb-1">
                <span className="text-zinc-400">REQUIRED</span>
                <span className="text-red-400 font-bold">{analytics.maneuver_required || 0}</span>
              </div>
              <div className="flex justify-between items-center text-[9.5px] font-mono border-b border-white/5 pb-1">
                <span className="text-zinc-400">PENDING</span>
                <span className="text-amber-400 font-bold">{analytics.maneuver_pending || 0}</span>
              </div>
              <div className="flex justify-between items-center text-[9.5px] font-mono border-b border-white/5 pb-1">
                <span className="text-zinc-400">APPROVED</span>
                <span className="text-emerald-400 font-bold">{analytics.maneuver_approved || 0}</span>
              </div>
              <div className="flex justify-between items-center text-[9.5px] font-mono">
                <span className="text-zinc-400">MITIGATED</span>
                <span className="text-amber-400 font-bold">{analytics.conjunctions_mitigated || 0}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative Radar Sweep Element */}
        <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between opacity-60">
           <div className="flex gap-1">
              {Array.from({length: 10}).map((_, i) => (
                <div key={i} className="w-1 h-2 bg-amber-400/80 rounded-xs" style={{ opacity: (i + 1) / 10 }}></div>
              ))}
           </div>
           <span className="text-[7.5px] font-mono text-zinc-500 tracking-widest uppercase">DATALINK // 100% NOMINAL</span>
        </div>
      </div>
    </HUDContainer>
  );
}
