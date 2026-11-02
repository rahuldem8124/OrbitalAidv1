"use client";

import Link from "next/link";
import { ConjunctionWithDetails } from "@/lib/types";
import RiskBadge from "@/components/shared/RiskBadge";
import EmptyState from "@/components/shared/EmptyState";
import { formatDistance, getTCAStatus, formatUTCCompact } from "@/lib/time";
import { ExternalLink, Target } from "lucide-react";
import HUDContainer from "../ui/HUDContainer";

interface Props {
  conjunctions: ConjunctionWithDetails[];
  onSelect?: (conj: ConjunctionWithDetails) => void;
  selectedId?: string;
}

export default function LiveConjunctionWatch({ conjunctions, onSelect, selectedId }: Props) {
  if (!conjunctions || conjunctions.length === 0) {
    return (
      <HUDContainer title="TARGET ANALYSIS">
        <div className="flex-1 flex items-center justify-center p-4 h-full">
          <EmptyState title="NO ACTIVE TARGETS" description="Sensors clear. Tracking grid nominal." />
        </div>
      </HUDContainer>
    );
  }

  const sorted = [...conjunctions].sort((a, b) => {
    const riskWeight: Record<string, number> = { critical: 4, high: 3, watch: 2, low: 1 };
    const aRisk = a.risk_tier ? riskWeight[a.risk_tier] ?? 0 : 0;
    const bRisk = b.risk_tier ? riskWeight[b.risk_tier] ?? 0 : 0;
    if (aRisk !== bRisk) return bRisk - aRisk;
    return new Date(a.tca).getTime() - new Date(b.tca).getTime();
  }).slice(0, 8);

  return (
    <HUDContainer title="TARGET ANALYSIS" className="flex flex-col h-full overflow-hidden" cornerCut={true}>
      <div className="px-4 py-2 flex justify-between items-center border-b border-[var(--space-border-bright)]/30 mt-3">
        <div className="text-[9px] font-mono font-bold text-[var(--text-muted)] tracking-widest uppercase">
          LIVE INTERCEPT VECTOR
        </div>
        <Link href="/conjunctions" className="text-[9px] font-mono text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 uppercase tracking-widest">
          FULL GRID <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sorted.map(conj => {
          const status = getTCAStatus(conj.tca);
          const objA = conj.object_a_name || conj.object_a?.object_name || "OBJ-A";
          const objB = conj.object_b_name || conj.object_b?.object_name || "OBJ-B";
          
          const isCritical = conj.risk_tier === 'critical';
          const isSelected = selectedId === conj.id;

          return (
            <button
              key={conj.id}
              onClick={() => onSelect?.(conj)}
              className={`block w-full text-left p-2.5 border transition-all relative group rounded ${
                isCritical 
                  ? 'border-red-500/40 bg-red-950/20 hover:border-red-500/60' 
                  : isSelected 
                    ? 'border-amber-400/80 bg-amber-950/30 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-400/40' 
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20'
              }`}
            >
              {/* Subtle Corner brackets inside the card */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20"></div>

              {/* Header with Target Reticle */}
              <div className="flex justify-between items-start mb-2 border-b border-white/5 pb-1.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    <Target className={`w-3.5 h-3.5 ${isCritical ? 'text-red-400' : isSelected ? 'text-amber-400 animate-spin-slow' : 'text-zinc-400 group-hover:text-amber-400 transition-colors'}`} />
                    {isCritical && <span className="absolute w-3.5 h-3.5 rounded-full bg-red-500/30 animate-ping"></span>}
                  </div>
                  <div className="font-mono text-[10px] text-zinc-100 font-semibold tracking-wider">
                    <span className="truncate max-w-[90px] inline-block align-bottom">{objA}</span>
                    <span className="text-zinc-600 mx-1">×</span>
                    <span className="truncate max-w-[90px] inline-block align-bottom">{objB}</span>
                  </div>
                </div>
                <RiskBadge tier={conj.risk_tier} size="sm" />
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-3 gap-1.5">
                <div className={`p-1 flex flex-col items-center justify-center text-center rounded-sm border ${isCritical ? 'border-red-500/30 bg-red-950/40 text-red-300' : 'border-white/5 bg-black/40 text-zinc-200'}`}>
                  <span className={`text-[7.5px] uppercase tracking-wider mb-0.5 ${isCritical ? 'text-red-400/80 font-bold' : 'text-zinc-500'}`}>MISS DIST</span>
                  <span className="font-mono text-[10px] font-bold">
                    {formatDistance(conj.miss_distance_km)}
                  </span>
                </div>
                
                <div className="p-1 flex flex-col items-center justify-center text-center rounded-sm border border-white/5 bg-black/40">
                  <span className="text-[7.5px] text-zinc-500 uppercase tracking-wider mb-0.5">TCA (UTC)</span>
                  <span className="font-mono text-[9px] text-zinc-300">{formatUTCCompact(conj.tca)}</span>
                </div>
                
                <div className="p-1 flex flex-col items-center justify-center text-center rounded-sm border border-white/5 bg-black/40 relative overflow-hidden">
                  <span className="text-[7.5px] text-zinc-500 uppercase tracking-wider mb-0.5">COUNTDOWN</span>
                  <span>
                    {status.type === 'passed' ? (
                      <span className="font-mono text-[9px] text-zinc-500 font-bold">PASSED</span>
                    ) : status.type === 'upcoming' ? (
                      <span className={`font-mono text-[10px] font-bold ${status.isUrgent ? 'text-red-400' : 'text-amber-400'}`}>
                        {status.label}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </span>
                </div>
              </div>
              
              {/* Footer action label */}
              <div className="mt-1.5 flex justify-between items-center text-[7.5px] font-mono text-zinc-500 uppercase tracking-wider">
                <span className="group-hover:text-amber-400 transition-colors">CLICK TO LOCK TARGET</span>
                {isSelected && <span className="text-amber-400 font-bold animate-pulse">LOCKED IN 3D</span>}
              </div>
            </button>
          );
        })}
      </div>
    </HUDContainer>
  );
}
