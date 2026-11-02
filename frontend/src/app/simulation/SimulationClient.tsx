"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  fetchObjects,
  simulateNewObject,
  simulateManeuver,
} from "@/lib/api";
import {
  SpaceObject,
  NewObjectSimulationResult,
  ManeuverSimulationResult,
} from "@/lib/types";
import GlassPanel from "@/components/ui/GlassPanel";
import RiskIndicator from "@/components/ui/RiskIndicator";
import { Loader2, Rocket, Orbit, ArrowRight, AlertTriangle } from "lucide-react";

type Tab = "new-object" | "maneuver";

const ORBITAL_FIELDS = [
  { key: "mean_motion", label: "Mean Motion", unit: "revs/day", step: "0.0001" },
  { key: "eccentricity", label: "Eccentricity", unit: "", step: "0.0001" },
  { key: "inclination", label: "Inclination", unit: "deg", step: "0.01" },
  { key: "ra_of_asc_node", label: "RA of Asc Node", unit: "deg", step: "0.01" },
  { key: "arg_of_pericenter", label: "Arg of Pericenter", unit: "deg", step: "0.01" },
  { key: "mean_anomaly", label: "Mean Anomaly", unit: "deg", step: "0.01" },
] as const;

export default function SimulationClient() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("new-object");

  const urlConjunctionId = searchParams.get("conjunctionId");
  const urlAssetId = searchParams.get("assetId");
  const urlThreatId = searchParams.get("threatId");

  // New object form state
  const [name, setName] = useState("SIMULATED-OBJECT");
  const [orbitalElements, setOrbitalElements] = useState({
    mean_motion: "",
    eccentricity: "",
    inclination: "",
    ra_of_asc_node: "",
    arg_of_pericenter: "",
    mean_anomaly: "",
    bstar: "0",
  });
  const [newObjLoading, setNewObjLoading] = useState(false);
  const [newObjResult, setNewObjResult] = useState<NewObjectSimulationResult | null>(null);
  const [newObjError, setNewObjError] = useState<string | null>(null);

  // Maneuver simulation state
  const [objects, setObjects] = useState<SpaceObject[]>([]);
  const [assetId, setAssetId] = useState("");
  const [threatId, setThreatId] = useState("");
  const [deltaV, setDeltaV] = useState("");
  const [maneuverLoading, setManeuverLoading] = useState(false);
  const [maneuverResult, setManeuverResult] = useState<ManeuverSimulationResult | null>(null);
  const [maneuverError, setManeuverError] = useState<string | null>(null);

  // Pre-select tab and fields from URL params
  useEffect(() => {
    if (urlAssetId || urlThreatId) {
      setTab("maneuver");
      if (urlAssetId) setAssetId(urlAssetId);
      if (urlThreatId) setThreatId(urlThreatId);
    }
  }, [urlAssetId, urlThreatId]);

  // Fetch objects for dropdowns
  useEffect(() => {
    fetchObjects(undefined, 500)
      .then((res) => setObjects(res.objects))
      .catch(console.error);
  }, []);

  const handleNewObjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewObjLoading(true);
    setNewObjError(null);
    setNewObjResult(null);
    try {
      const result = await simulateNewObject({
        name,
        mean_motion: parseFloat(orbitalElements.mean_motion),
        eccentricity: parseFloat(orbitalElements.eccentricity),
        inclination: parseFloat(orbitalElements.inclination),
        ra_of_asc_node: parseFloat(orbitalElements.ra_of_asc_node),
        arg_of_pericenter: parseFloat(orbitalElements.arg_of_pericenter),
        mean_anomaly: parseFloat(orbitalElements.mean_anomaly),
        bstar: parseFloat(orbitalElements.bstar) || 0,
      });
      setNewObjResult(result);
    } catch {
      setNewObjError("Simulation failed — check the backend is running and input values are valid.");
    } finally {
      setNewObjLoading(false);
    }
  };

  const handleManeuverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManeuverLoading(true);
    setManeuverError(null);
    setManeuverResult(null);
    try {
      const result = await simulateManeuver({
        asset_id: assetId,
        threat_id: threatId,
        delta_v_mps: parseFloat(deltaV),
      });
      setManeuverResult(result);
    } catch {
      setManeuverError("Simulation failed — check the backend is running and objects are valid.");
    } finally {
      setManeuverLoading(false);
    }
  };

  const tierOrder = { critical: 3, high: 2, watch: 1, low: 0 };
  const getImprovement = (current: string, predicted: string) => {
    return (tierOrder[predicted as keyof typeof tierOrder] ?? 0) < (tierOrder[current as keyof typeof tierOrder] ?? 0);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-white text-2xl font-semibold">Simulation & What-If Analysis</h1>

      {/* Tab toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("new-object")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
            tab === "new-object"
              ? "bg-white/10 border border-white/20 text-white"
              : "bg-transparent border border-white/5 text-white/50 hover:text-white/70"
          }`}
        >
          <Rocket className="w-4 h-4" />
          New Object Launch
        </button>
        <button
          onClick={() => setTab("maneuver")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
            tab === "maneuver"
              ? "bg-white/10 border border-white/20 text-white"
              : "bg-transparent border border-white/5 text-white/50 hover:text-white/70"
          }`}
        >
          <Orbit className="w-4 h-4" />
          Simulate Maneuver
        </button>
      </div>

      {/* Tab 1: New Object Launch */}
      {tab === "new-object" && (
        <GlassPanel>
          <form onSubmit={handleNewObjectSubmit} className="space-y-4">
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase mb-1">
                Object Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {ORBITAL_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="block text-white/60 text-xs font-semibold uppercase mb-1">
                    {field.label}
                    {field.unit && (
                      <span className="text-white/30 normal-case ml-1">
                        ({field.unit})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step={field.step}
                    required
                    value={orbitalElements[field.key]}
                    onChange={(e) =>
                      setOrbitalElements((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={newObjLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-amber-400 hover:bg-amber-300 text-black font-mono text-sm font-bold tracking-wider disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]"
            >
              {newObjLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <Rocket className="w-4 h-4 text-black" />
              )}
              {newObjLoading ? "RUNNING SIMULATION…" : "RUN SIMULATION"}
            </button>
          </form>

          {newObjError && (
            <p className="mt-4 text-amber-400/80 text-sm p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
              {newObjError}
            </p>
          )}

          {newObjResult && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-4 text-xs text-white/50">
                <span>
                  Checked <span className="text-white font-mono">{newObjResult.candidates_checked}</span> candidates
                </span>
                <span>
                  Found <span className="text-amber-400 font-mono">{newObjResult.conjunctions_found}</span> conjunctions
                </span>
              </div>

              {newObjResult.results.length > 0 ? (
                <div className="space-y-2">
                  {newObjResult.results.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-md bg-white/5 border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-white text-sm font-medium">{r.object_name}</p>
                          <p className="text-white/40 text-xs">
                            TCA: {new Date(r.tca).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-amber-400 font-mono text-sm font-semibold">
                            {r.miss_distance_km.toFixed(1)} km
                          </p>
                          {r.pc != null && (
                            <p className="text-rose-400 font-mono text-xs">
                              Pc: {(r.pc * 100).toFixed(4)}%
                            </p>
                          )}
                        </div>
                        {r.risk_tier && <RiskIndicator tier={r.risk_tier} />}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/40 text-center py-4 text-sm">
                  No conjunctions found for this object configuration.
                </p>
              )}
            </div>
          )}
        </GlassPanel>
      )}

      {/* Tab 2: Simulate Maneuver */}
      {tab === "maneuver" && (
        <GlassPanel>
          <form onSubmit={handleManeuverSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white/60 text-xs font-semibold uppercase mb-1">
                  Asset Object
                </label>
                <select
                  required
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500/50"
                >
                  <option value="" className="bg-gray-900">Select asset…</option>
                  {objects.map((obj) => (
                    <option key={obj.id} value={obj.id} className="bg-gray-900">
                      {obj.object_name} ({obj.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-white/60 text-xs font-semibold uppercase mb-1">
                  Threat Object
                </label>
                <select
                  required
                  value={threatId}
                  onChange={(e) => setThreatId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500/50"
                >
                  <option value="" className="bg-gray-900">Select threat…</option>
                  {objects.map((obj) => (
                    <option key={obj.id} value={obj.id} className="bg-gray-900">
                      {obj.object_name} ({obj.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase mb-1">
                Delta-V <span className="text-white/30 normal-case">(m/s)</span>
              </label>
              <input
                type="number"
                step="0.001"
                required
                value={deltaV}
                onChange={(e) => setDeltaV(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-amber-500/50"
                placeholder="e.g. 0.5"
              />
            </div>

            <button
              type="submit"
              disabled={maneuverLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-amber-400 hover:bg-amber-300 text-black font-mono text-sm font-bold tracking-wider disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]"
            >
              {maneuverLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <Orbit className="w-4 h-4 text-black" />
              )}
              {maneuverLoading ? "RUNNING SIMULATION…" : "RUN SIMULATION"}
            </button>
          </form>

          {maneuverError && (
            <p className="mt-4 text-amber-400/80 text-sm p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
              {maneuverError}
            </p>
          )}

          {maneuverResult && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span>
                  <span className="text-white font-medium">{maneuverResult.asset}</span>
                  {" "}vs{" "}
                  <span className="text-white font-medium">{maneuverResult.threat}</span>
                </span>
                <span>·</span>
                <span>
                  Δv: <span className="text-amber-400 font-mono">{maneuverResult.applied_delta_v_mps.toFixed(3)} m/s</span>
                </span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
                {/* Current */}
                <div className="p-4 rounded-md bg-white/5 border border-white/5">
                  <p className="text-white/40 text-xs font-semibold uppercase mb-3">Current</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-white/40 text-xs">Miss Distance</p>
                      <p className="text-white font-mono text-sm font-semibold">
                        {maneuverResult.current_miss_distance_km.toFixed(1)} km
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Collision Probability</p>
                      <p className="text-rose-400 font-mono text-sm font-semibold">
                        {(maneuverResult.current_pc * 100).toFixed(4)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Risk Tier</p>
                      <div className="mt-1">
                        <RiskIndicator tier={maneuverResult.current_risk_tier} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center px-2">
                  <ArrowRight className="w-5 h-5 text-white/30" />
                </div>

                {/* Predicted */}
                <div
                  className={`p-4 rounded-md border ${
                    getImprovement(
                      maneuverResult.current_risk_tier,
                      maneuverResult.predicted_new_risk_tier
                    )
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : maneuverResult.predicted_new_risk_tier === maneuverResult.current_risk_tier
                      ? "bg-white/5 border-white/5"
                      : "bg-red-500/10 border-red-500/20"
                  }`}
                >
                  <p className="text-white/40 text-xs font-semibold uppercase mb-3">Predicted</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-white/40 text-xs">Miss Distance</p>
                      <p className="text-white font-mono text-sm font-semibold">
                        {maneuverResult.predicted_new_miss_distance_km.toFixed(1)} km
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Collision Probability</p>
                      <p className="text-rose-400 font-mono text-sm font-semibold">
                        {(maneuverResult.predicted_new_pc * 100).toFixed(4)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Risk Tier</p>
                      <div className="mt-1">
                        <RiskIndicator tier={maneuverResult.predicted_new_risk_tier} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-amber-400/80 text-xs leading-relaxed">
                  Estimate uses a simplified linearized model, not a full orbit re-propagation.
                </p>
              </div>
            </div>
          )}
        </GlassPanel>
      )}
    </div>
  );
}
