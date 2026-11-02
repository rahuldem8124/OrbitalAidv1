"use client";

import { useState } from "react";
import { Alert } from "@/lib/types";
import GlassPanel from "@/components/ui/GlassPanel";
import AlertActions from "@/app/alerts/AlertActions";
import AlertDetailPanel from "./AlertDetailPanel";

interface AlertsListClientProps {
  alerts: Alert[];
}

export default function AlertsListClient({ alerts }: AlertsListClientProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedAlert = alerts.find((a) => a.id === selected) ?? null;

  return (
    <>
      <div className="grid gap-3">
        {alerts.map((a) => (
          <div
            key={a.id}
            onClick={() => setSelected(a.id)}
            className="cursor-pointer"
          >
            <GlassPanel className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-xs uppercase font-bold mb-1">
                  {a.severity}
                </p>
                <p className="text-white text-sm">{a.message}</p>
                <p className="text-white/40 text-xs mt-1">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
              {!a.acknowledged_at && <AlertActions alertId={a.id} />}
            </GlassPanel>
          </div>
        ))}
        {alerts.length === 0 && (
          <GlassPanel>
            <p className="text-white/40 text-center py-8">No alerts.</p>
          </GlassPanel>
        )}
      </div>
      <AlertDetailPanel
        alert={selectedAlert}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
