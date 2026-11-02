"use client";

import { useState } from "react";
import { Maneuver } from "@/lib/types";
import GlassPanel from "@/components/ui/GlassPanel";
import ManeuverActions from "@/app/maneuvers/ManeuverActions";
import ConjunctionDetailPanel from "./ConjunctionDetailPanel";

interface ManeuversListClientProps {
  maneuvers: Maneuver[];
}

export default function ManeuversListClient({
  maneuvers,
}: ManeuversListClientProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-4">
        {maneuvers.map((m) => (
          <div
            key={m.id}
            onClick={() => setSelected(m.conjunction_event_id)}
            className="cursor-pointer"
          >
            <GlassPanel className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{m.asset.object_name}</p>
                <div className="flex gap-6 mt-1 text-xs text-white/50">
                  <span>
                    Δv:{" "}
                    <span className="text-amber-400 font-mono">
                      {m.delta_v_mps.toFixed(3)} m/s
                    </span>
                  </span>
                  <span>
                    New miss distance:{" "}
                    <span className="text-amber-400 font-mono">
                      {m.predicted_new_miss_distance_km} km
                    </span>
                  </span>
                  <span>
                    Status:{" "}
                    <span className="text-white/70 uppercase">{m.status}</span>
                  </span>
                </div>
              </div>
              {m.status === "proposed" && (
                <ManeuverActions maneuverId={m.id} />
              )}
            </GlassPanel>
          </div>
        ))}
        {maneuvers.length === 0 && (
          <GlassPanel>
            <p className="text-white/40 text-center py-8">No maneuvers proposed.</p>
          </GlassPanel>
        )}
      </div>
      <ConjunctionDetailPanel
        conjunctionId={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
