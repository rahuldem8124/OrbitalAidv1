"use client";

import { useState } from "react";
import { ConjunctionEvent } from "@/lib/types";
import GlassPanel from "@/components/ui/GlassPanel";
import RiskIndicator from "@/components/ui/RiskIndicator";
import ConjunctionDetailPanel from "./ConjunctionDetailPanel";

interface ConjunctionsTableClientProps {
  conjunctions: ConjunctionEvent[];
}

export default function ConjunctionsTableClient({
  conjunctions,
}: ConjunctionsTableClientProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <GlassPanel className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white/40 border-b border-white/10">
              <th className="pb-3 pr-4">Object A</th>
              <th className="pb-3 pr-4">Object B</th>
              <th className="pb-3 pr-4">Miss Distance</th>
              <th className="pb-3 pr-4">TCA</th>
              <th className="pb-3 pr-4">Pc</th>
              <th className="pb-3 pr-4">Risk</th>
            </tr>
          </thead>
          <tbody>
            {conjunctions.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelected(c.id)}
                className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
              >
                <td className="py-3 pr-4 text-white">{c.object_a.object_name}</td>
                <td className="py-3 pr-4 text-white">{c.object_b.object_name}</td>
                <td className="py-3 pr-4 text-amber-400 font-mono">
                  {c.miss_distance_km.toFixed(2)} km
                </td>
                <td className="py-3 pr-4 text-white/70 font-mono">
                  {new Date(c.tca).toLocaleString()}
                </td>
                <td className="py-3 pr-4 text-rose-400 font-mono">
                  {c.pc != null ? `${(c.pc * 100).toFixed(4)}%` : "—"}
                </td>
                <td className="py-3 pr-4">
                  {c.risk_tier && <RiskIndicator tier={c.risk_tier} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {conjunctions.length === 0 && (
          <p className="text-white/40 text-center py-8">No active conjunctions.</p>
        )}
      </GlassPanel>
      <ConjunctionDetailPanel
        conjunctionId={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
