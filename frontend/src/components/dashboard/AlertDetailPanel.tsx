"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchConjunction, acknowledgeAlert } from "@/lib/api";
import { Alert, ConjunctionEvent } from "@/lib/types";
import DraggablePanel from "@/components/ui/DraggablePanel";
import RiskIndicator from "@/components/ui/RiskIndicator";
import {
  Loader2,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Radio,
} from "lucide-react";

interface AlertDetailPanelProps {
  alert: Alert | null;
  onClose: () => void;
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    label: "CRITICAL",
  },
  high: {
    icon: AlertTriangle,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    label: "HIGH",
  },
  watch: {
    icon: AlertCircle,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    label: "WATCH",
  },
} as const;

export default function AlertDetailPanel({
  alert,
  onClose,
}: AlertDetailPanelProps) {
  const router = useRouter();
  const [conjunction, setConjunction] = useState<ConjunctionEvent | null>(null);
  const [conjLoading, setConjLoading] = useState(false);
  const [ackLoading, setAckLoading] = useState(false);
  const [ackResult, setAckResult] = useState(false);

  const loadConjunction = useCallback(async (conjunctionId: string) => {
    setConjLoading(true);
    try {
      const conj = await fetchConjunction(conjunctionId);
      setConjunction(conj);
    } catch (err) {
      console.error(err);
    } finally {
      setConjLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!alert) {
      setConjunction(null);
      setAckResult(false);
      return;
    }
    loadConjunction(alert.conjunction_event_id);
  }, [alert, loadConjunction]);

  const handleAcknowledge = async () => {
    if (!alert) return;
    setAckLoading(true);
    try {
      await acknowledgeAlert(alert.id, "operator-1");
      setAckResult(true);
      setTimeout(() => setAckResult(false), 2000);
    } catch (err) {
      console.error(err);
      window.alert("Action failed — check the backend is running.");
    } finally {
      setAckLoading(false);
    }
  };

  if (!alert) return null;

  const severity = severityConfig[alert.severity] ?? severityConfig.watch;
  const SeverityIcon = severity.icon;

  return (
    <DraggablePanel title="Alert Detail" onClose={onClose}>
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${severity.bgColor} border ${severity.borderColor}`}
            >
              <SeverityIcon className={`w-3.5 h-3.5 ${severity.color}`} />
              <span
                className={`text-xs font-bold ${severity.color} font-mono uppercase`}
              >
                {severity.label}
              </span>
            </div>
            {alert.acknowledged_at ? (
              <span className="flex items-center gap-1 text-emerald-400 text-xs">
                <CheckCircle className="w-3.5 h-3.5" />
                Acknowledged
              </span>
            ) : (
              <span className="text-white/30 text-xs">Unacknowledged</span>
            )}
          </div>
          <p className="text-white/40 text-xs">
            {new Date(alert.created_at).toLocaleString()}
          </p>
        </div>

        <div className="p-3 rounded-md bg-white/5 border border-white/5">
          <p className="text-white text-sm leading-relaxed">{alert.message}</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/40">
          <Radio className="w-3.5 h-3.5" />
          <span>
            Channels:{" "}
            <span className="text-white/60">
              {alert.channels_sent ?? "N/A"}
            </span>
          </span>
        </div>

        <div className="border-t border-white/10 pt-3">
          <p className="text-white/60 text-xs font-semibold uppercase mb-2">
            Associated Conjunction
          </p>
          {conjLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            </div>
          ) : conjunction ? (
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <p className="text-white font-medium text-sm">
                  {conjunction.object_a.object_name}
                  <span className="text-white/40 mx-2">↔</span>
                  {conjunction.object_b.object_name}
                </p>
                {conjunction.risk_tier && (
                  <RiskIndicator tier={conjunction.risk_tier} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-white/5">
                  <p className="text-white/40 text-xs">Miss Distance</p>
                  <p className="text-white font-mono text-xs font-semibold">
                    {conjunction.miss_distance_km.toFixed(1)} km
                  </p>
                </div>
                <div className="p-2 rounded bg-white/5">
                  <p className="text-white/40 text-xs">TCA</p>
                  <p className="text-white font-mono text-xs">
                    {new Date(conjunction.tca).toLocaleString()}
                  </p>
                </div>
                {conjunction.relative_velocity_kmps != null && (
                  <div className="p-2 rounded bg-white/5">
                    <p className="text-white/40 text-xs">Relative Velocity</p>
                    <p className="text-purple-400 font-mono text-xs font-semibold">
                      {conjunction.relative_velocity_kmps.toFixed(2)} km/s
                    </p>
                  </div>
                )}
                {conjunction.pc != null && (
                  <div className="p-2 rounded bg-white/5">
                    <p className="text-white/40 text-xs">Collision Probability</p>
                    <p className="text-rose-400 font-mono text-xs font-semibold">
                      {(conjunction.pc * 100).toFixed(4)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-white/30 text-xs py-2">
              Conjunction data unavailable.
            </p>
          )}
        </div>

        <div className="border-t border-white/10 pt-3 flex gap-2">
          {!alert.acknowledged_at && (
            ackResult ? (
              <div className="flex-1 px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold text-center">
                Acknowledged ✓
              </div>
            ) : (
              <button
                disabled={ackLoading}
                onClick={handleAcknowledge}
                className="flex-1 px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-black border border-amber-400 font-mono text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-colors"
              >
                {ackLoading ? "Acknowledging…" : "Acknowledge"}
              </button>
            )
          )}
          <button
            onClick={() => {
              onClose();
              router.push("/maneuvers");
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white text-xs font-semibold transition-colors"
          >
            View Maneuvers
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </DraggablePanel>
  );
}
