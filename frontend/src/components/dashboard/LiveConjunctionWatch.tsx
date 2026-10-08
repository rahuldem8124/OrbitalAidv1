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
}

export default function LiveConjunctionWatch({ conjunctions }: Props) {
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
        <Link href="/conjunctions" className="text-[9px] font-mono text-[var(--accent-cyan)] hover:text-cyan-300 transition-colors flex items-center gap-1 uppercase tracking-widest">
          FULL GRID <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sorted.map(conj => {
          const status = getTCAStatus(conj.tca);
          const objA = conj.object_a_name || conj.object_a?.object_name || "OBJ-A";
          const objB = conj.object_b_name || conj.object_b?.object_name || "OBJ-B";
          
          const isCritical = conj.risk_tier === 'critical';

          return (
            <Link
              href={`/conjunctions?event=${conj.id}`}
              key={conj.id}
              className={`block p-3 border hover:bg-[var(--space-card-hover)]/40 transition-colors relative group
                ${isCritical ? 'border-[var(--tier-critical)]/50 bg-[var(--tier-critical)]/5' : 'border-[var(--space-border)]'}
              `}
            >
              {/* Corner brackets inside the card */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[var(--text-muted)]/50"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[var(--text-muted)]/50"></div>

              {/* Header with Target Reticle */}
              <div className="flex justify-between items-start mb-3 border-b border-[var(--space-border)]/50 pb-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    <Target className={`w-4 h-4 ${isCritical ? 'text-[var(--tier-critical)]' : 'text-[var(--accent-amber)]'}`} />
                    {isCritical && <span className="absolute w-4 h-4 rounded-full bg-[var(--tier-critical)]/30 animate-ping"></span>}
                  </div>
                  <div className="font-mono text-[10px] text-[var(--text-primary)] font-bold tracking-widest">
                    <span className="truncate max-w-[100px] inline-block align-bottom">{objA}</span>
                    <span className="text-[var(--text-dim)] mx-1">X</span>
                    <span className="truncate max-w-[100px] inline-block align-bottom">{objB}</span>
                  </div>
                </div>
                <RiskBadge tier={conj.risk_tier} size="sm" />
              </div>

              {/* Data Grid with Cell Inversion on critical */}
              <div className="grid grid-cols-3 gap-2">
                <div className={`p-1.5 flex flex-col items-center justify-center text-center border border-[var(--space-border)]/50 ${isCritical ? 'bg-[var(--tier-critical)] text-[#030407]' : 'bg-[#030407]/40'}`}>
                  <span className={`text-[8px] uppercase tracking-widest mb-1 ${isCritical ? 'text-[#030407]/70 font-bold' : 'text-[var(--text-dim)]'}`}>MISS DIST</span>
                  <span className={`font-mono text-[11px] font-bold ${isCritical ? 'text-[#030407]' : 'text-[var(--text-primary)]'}`}>
                    {formatDistance(conj.miss_distance_km)}
                  </span>
                </div>
                
                <div className="p-1.5 flex flex-col items-center justify-center text-center border border-[var(--space-border)]/50 bg-[#030407]/40">
                  <span className="text-[8px] text-[var(--text-dim)] uppercase tracking-widest mb-1">TCA (UTC)</span>
                  <span className="font-mono text-[10px] text-[var(--text-secondary)]">{formatUTCCompact(conj.tca)}</span>
                </div>
                
                <div className="p-1.5 flex flex-col items-center justify-center text-center border border-[var(--space-border)]/50 bg-[#030407]/40 relative overflow-hidden">
                  <div className="absolute inset-0 scanline opacity-20"></div>
                  <span className="text-[8px] text-[var(--text-dim)] uppercase tracking-widest mb-1 relative z-10">COUNTDOWN</span>
                  <span className="relative z-10">
                    {status.type === 'passed' ? (
                      <span className="font-mono text-[10px] text-[var(--text-dim)] font-bold">PASSED</span>
                    ) : status.type === 'upcoming' ? (
                      <span className={`font-mono text-[11px] font-bold ${status.isUrgent ? 'text-[var(--tier-critical)]' : 'text-[var(--accent-amber)]'}`}>
                        {status.label}
                      </span>
                    ) : (
                      <span className="text-[var(--text-dim)]">—</span>
                    )}
                  </span>
                </div>
              </div>
              
              {/* Geometric Data Labels */}
              <div className="mt-2 flex justify-between text-[8px] font-mono text-[var(--text-dim)] uppercase tracking-widest">
                <span>LAT: {(Math.random() * 180 - 90).toFixed(4)}°</span>
                <span>LON: {(Math.random() * 360 - 180).toFixed(4)}°</span>
                <span>AZ: {(Math.random() * 360).toFixed(1)}°</span>
              </div>
            </Link>
          );
        })}
      </div>
    </HUDContainer>
  );
}
