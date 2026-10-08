"use client";

import Link from "next/link";
import { ConjunctionWithDetails } from "@/lib/types";
import RiskBadge from "@/components/shared/RiskBadge";
import EmptyState from "@/components/shared/EmptyState";
import { formatDistance, getTCAStatus, formatUTCCompact } from "@/lib/time";
import { ExternalLink } from "lucide-react";

interface Props {
  conjunctions: ConjunctionWithDetails[];
}

export default function LiveConjunctionWatch({ conjunctions }: Props) {
  if (!conjunctions || conjunctions.length === 0) {
    return (
      <div className="bg-[var(--space-panel)] border border-[var(--space-border)] rounded-md flex flex-col h-full overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--space-border)]">
          <h2 className="text-[10px] font-mono font-semibold text-[var(--accent-amber)] uppercase tracking-widest">
            LIVE CONJUNCTION WATCH
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <EmptyState title="No Active Conjunctions" description="All clear — no imminent conjunctions." />
        </div>
      </div>
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
    <div className="bg-[var(--space-panel)] border border-[var(--space-border)] rounded-md flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--space-border)] flex justify-between items-center">
        <h2 className="text-[10px] font-mono font-semibold text-[var(--accent-amber)] uppercase tracking-widest">
          LIVE CONJUNCTION WATCH
        </h2>
        <Link href="/conjunctions" className="text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--accent-amber)] transition-colors flex items-center gap-1">
          VIEW ALL <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sorted.map(conj => {
          const status = getTCAStatus(conj.tca);
          const objA = conj.object_a_name || conj.object_a?.object_name || "OBJ-A";
          const objB = conj.object_b_name || conj.object_b?.object_name || "OBJ-B";

          return (
            <Link
              href={`/conjunctions?event=${conj.id}`}
              key={conj.id}
              className="block px-4 py-3 border-b border-[var(--space-border)] hover:bg-[var(--space-card-hover)] transition-colors"
            >
              {/* Object designations */}
              <div className="flex justify-between items-start mb-2">
                <div className="font-mono text-[11px] text-[var(--text-primary)] uppercase tracking-wide">
                  <span className="truncate max-w-[110px] inline-block align-bottom" title={objA}>{objA}</span>
                  <span className="text-[var(--text-dim)] mx-1">⟷</span>
                  <span className="truncate max-w-[110px] inline-block align-bottom" title={objB}>{objB}</span>
                </div>
                <RiskBadge tier={conj.risk_tier} size="sm" />
              </div>

              {/* Telemetry grid */}
              <div className="grid grid-cols-3 gap-x-3 text-[10px]">
                <div>
                  <span className="text-[var(--text-dim)] block mb-0.5 uppercase tracking-wider">Miss Dist</span>
                  <span className="font-mono text-[var(--text-primary)]">{formatDistance(conj.miss_distance_km)}</span>
                </div>
                <div>
                  <span className="text-[var(--text-dim)] block mb-0.5 uppercase tracking-wider">TCA</span>
                  <span className="font-mono text-[var(--text-secondary)]">{formatUTCCompact(conj.tca)}</span>
                </div>
                <div>
                  <span className="text-[var(--text-dim)] block mb-0.5 uppercase tracking-wider">Countdown</span>
                  {status.type === 'passed' ? (
                    <span className="font-mono text-[var(--text-dim)]">PASSED</span>
                  ) : status.type === 'upcoming' ? (
                    <span className={`font-mono font-medium ${status.isUrgent ? 'text-[var(--tier-critical)]' : 'text-[var(--accent-amber)]'}`}>
                      {status.label}
                    </span>
                  ) : (
                    <span className="text-[var(--text-dim)]">—</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
