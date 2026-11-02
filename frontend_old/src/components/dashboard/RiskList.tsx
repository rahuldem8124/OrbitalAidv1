
import { ConjunctionEvent } from "@/lib/types";
import GlassPanel from "@/components/ui/GlassPanel";
import RiskIndicator from "@/components/ui/RiskIndicator";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface RiskListProps {
  conjunctions: ConjunctionEvent[];
}

export default function RiskList({ conjunctions }: RiskListProps) {
  return (
    <GlassPanel className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Top Conjunction Risks</h3>
        <Link href="/conjunctions" className="text-cyan-400 text-sm hover:text-cyan-300 flex items-center gap-1">
          View All
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="space-y-3 overflow-y-auto flex-1">
        {conjunctions.slice(0, 5).map((conj) => (
          <div key={conj.id} className="p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-white font-medium text-sm">{conj.object_a.object_name} <span className="text-white/40">↔</span> {conj.object_b.object_name}</p>
              </div>
              {conj.risk_tier && <RiskIndicator tier={conj.risk_tier} />}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-white/40">Miss Distance</p>
                <p className="text-cyan-400 font-mono font-semibold">{conj.miss_distance_km.toFixed(1)} km</p>
              </div>
              <div>
                <p className="text-white/40">TCA</p>
                <p className="text-white font-mono font-semibold">{new Date(conj.tca).toLocaleString()}</p>
              </div>
              {conj.pc != null && (
                <div>
                  <p className="text-white/40">Collision Probability</p>
                  <p className="text-rose-400 font-mono font-semibold">{(conj.pc * 100).toFixed(4)}%</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
