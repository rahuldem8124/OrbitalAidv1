"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchConjunction,
  fetchManeuvers,
  approveManeuver,
  rejectManeuver,
  fetchConjunctionExplain,
} from "@/lib/api";
import { ConjunctionEvent, Maneuver } from "@/lib/types";
import DraggablePanel from "@/components/ui/DraggablePanel";
import RiskIndicator from "@/components/ui/RiskIndicator";
import { Loader2, Sparkles } from "lucide-react";

interface ConjunctionDetailPanelProps {
  conjunctionId: string | null;
  onClose: () => void;
}

export default function ConjunctionDetailPanel({
  conjunctionId,
  onClose,
}: ConjunctionDetailPanelProps) {
  const [conjunction, setConjunction] = useState<ConjunctionEvent | null>(null);
  const [maneuvers, setManeuvers] = useState<Maneuver[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<"approved" | "rejected" | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);

  const loadData = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [conj, maneuversRes] = await Promise.all([
        fetchConjunction(id),
        fetchManeuvers(),
      ]);
      setConjunction(conj);
      setManeuvers(
        maneuversRes.maneuvers.filter((m) => m.conjunction_event_id === id)
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!conjunctionId) {
      setConjunction(null);
      setManeuvers([]);
      setExplanation(null);
      setExplainError(null);
      setActionResult(null);
      return;
    }
    loadData(conjunctionId);
  }, [conjunctionId, loadData]);

  const handleAction = async (
    action: "approve" | "reject",
    maneuverId: string
  ) => {
    setActionLoading(true);
    setActionResult(null);
    try {
      if (action === "approve") {
        await approveManeuver(maneuverId, "operator-1");
      } else {
        await rejectManeuver(maneuverId, "operator-1");
      }
      setActionResult(action === "approve" ? "approved" : "rejected");
      if (conjunctionId) {
        await loadData(conjunctionId);
      }
      setTimeout(() => setActionResult(null), 2000);
    } catch (err) {
      console.error(err);
      alert("Action failed — check the backend is running.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!conjunctionId) return;
    setExplainLoading(true);
    setExplainError(null);
    setExplanation(null);
    try {
      const res = await fetchConjunctionExplain(conjunctionId);
      setExplanation(res.explanation);
    } catch {
      setExplainError(
        "Explanation unavailable — the backend explain endpoint may not be configured."
      );
    } finally {
      setExplainLoading(false);
    }
  };

  if (!conjunctionId) return null;

  const proposedManeuver = maneuvers.find((m) => m.status === "proposed");

  return (
    <DraggablePanel title="Conjunction Detail" onClose={onClose}>
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : conjunction ? (
          <>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white font-semibold text-base">
                  {conjunction.object_a.object_name}
                  <span className="text-white/40 mx-2">↔</span>
                  {conjunction.object_b.object_name}
                </p>
                <p className="text-white/40 text-xs mt-1">
                  Risk method: {conjunction.risk_method ?? "N/A"}
                </p>
              </div>
              {conjunction.risk_tier && (
                <RiskIndicator tier={conjunction.risk_tier} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-white/5 border border-white/5">
                <p className="text-white/40 text-xs">Miss Distance</p>
                <p className="text-white font-mono font-semibold">
                  {conjunction.miss_distance_km.toFixed(1)} km
                </p>
              </div>
              <div className="p-3 rounded-md bg-white/5 border border-white/5">
                <p className="text-white/40 text-xs">TCA</p>
                <p className="text-white font-mono font-semibold text-sm">
                  {new Date(conjunction.tca).toLocaleString()}
                </p>
              </div>
              {conjunction.relative_velocity_kmps != null && (
                <div className="p-3 rounded-md bg-white/5 border border-white/5">
                  <p className="text-white/40 text-xs">Relative Velocity</p>
                  <p className="text-purple-400 font-mono font-semibold">
                    {conjunction.relative_velocity_kmps.toFixed(2)} km/s
                  </p>
                </div>
              )}
              {conjunction.pc != null && (
                <div className="p-3 rounded-md bg-white/5 border border-white/5">
                  <p className="text-white/40 text-xs">Collision Probability</p>
                  <p className="text-rose-400 font-mono font-semibold">
                    {(conjunction.pc * 100).toFixed(4)}%
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 pt-3">
              <p className="text-white/60 text-xs font-semibold uppercase mb-2">
                Maneuver
              </p>
              {proposedManeuver ? (
                <div className="space-y-2">
                  <div className="p-2 rounded bg-white/5 text-xs text-white/60">
                    <span className="text-white font-mono">
                      Δv {proposedManeuver.delta_v_mps.toFixed(2)} m/s
                    </span>
                    <span className="mx-2">·</span>
                    <span>
                      New miss: {proposedManeuver.predicted_new_miss_distance_km.toFixed(1)} km
                    </span>
                    {proposedManeuver.fuel_cost_kg != null && (
                      <>
                        <span className="mx-2">·</span>
                        <span>Fuel: {proposedManeuver.fuel_cost_kg.toFixed(1)} kg</span>
                      </>
                    )}
                  </div>
                  {actionResult ? (
                    <div
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold text-center ${
                        actionResult === "approved"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-red-500/20 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {actionResult === "approved" ? "Approved ✓" : "Rejected ✓"}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        disabled={actionLoading}
                        onClick={() => handleAction("approve", proposedManeuver.id)}
                        className="flex-1 px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs font-semibold disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={() => handleAction("reject", proposedManeuver.id)}
                        className="flex-1 px-3 py-1.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 text-xs font-semibold disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  disabled
                  className="w-full px-3 py-1.5 rounded-md bg-white/5 text-white/30 border border-white/5 text-xs font-semibold cursor-not-allowed"
                >
                  No maneuver proposed
                </button>
              )}
            </div>

            <div className="border-t border-white/10 pt-3">
              <button
                onClick={handleExplain}
                disabled={explainLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-black border border-amber-400 font-mono text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-colors"
              >
                {explainLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                )}
                {explainLoading ? "ANALYZING…" : "EXPLAIN THIS RISK"}
              </button>
              {explanation && (
                <p className="mt-2 text-white/70 text-xs leading-relaxed p-3 rounded-md bg-white/5 border border-white/5">
                  {explanation}
                </p>
              )}
              {explainError && (
                <p className="mt-2 text-amber-400/80 text-xs p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                  {explainError}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-white/40 text-center py-8">Conjunction not found.</p>
        )}
      </div>
    </DraggablePanel>
  );
}
