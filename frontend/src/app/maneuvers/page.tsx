"use client";

import { useState, useEffect } from "react";
import { fetchManeuvers, fetchManeuverAnalytics, approveManeuver, rejectManeuver } from "@/lib/api";
import { Maneuver, ManeuverAnalytics } from "@/lib/types";
import MetricCard from "@/components/shared/MetricCard";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import Link from "next/link";
import { X, FileText, CheckCircle, XCircle } from "lucide-react";

export default function ManeuversPage() {
  const [maneuvers, setManeuvers] = useState<Maneuver[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<ManeuverAnalytics | null>(null);
  
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedManeuver, setSelectedManeuver] = useState<Maneuver | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  const perPage = 15;

  const loadData = async () => {
    setLoading(true);
    try {
      const [maneuversRes, analyticsRes] = await Promise.all([
        fetchManeuvers(statusFilter !== "all" ? statusFilter : undefined),
        fetchManeuverAnalytics().catch(() => null)
      ]);
      
      setManeuvers(maneuversRes.maneuvers);
      setTotal(maneuversRes.total);
      
      if (analyticsRes) {
        setAnalytics(analyticsRes);
      }
    } catch (error) {
      console.error("Failed to load maneuvers data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      await approveManeuver(id, "Operator");
      await loadData();
      if (selectedManeuver && selectedManeuver.id === id) {
        setSelectedManeuver({ ...selectedManeuver, status: "approved" });
      }
    } catch (e) {
      console.error(e);
      alert("Failed to approve maneuver.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(true);
    try {
      await rejectManeuver(id, "Operator");
      await loadData();
      if (selectedManeuver && selectedManeuver.id === id) {
        setSelectedManeuver({ ...selectedManeuver, status: "rejected" });
      }
    } catch (e) {
      console.error(e);
      alert("Failed to reject maneuver.");
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    {
      key: "status",
      label: "Status",
      render: (m: Maneuver) => <StatusBadge status={m.status} />
    },
    {
      key: "conjunction",
      label: "Related Conjunction",
      render: (m: Maneuver) => <span className="font-mono text-cyan-400">{m.conjunction_event_id.slice(0, 8)}...</span>
    },
    {
      key: "asset",
      label: "Asset",
      render: (m: Maneuver) => m.asset.object_name
    },
    {
      key: "delta_v",
      label: "Delta-V",
      render: (m: Maneuver) => <span className="font-mono">{m.delta_v_mps.toFixed(3)} m/s</span>
    },
    {
      key: "miss_distance",
      label: "Predicted Miss Dist",
      render: (m: Maneuver) => <span className="font-mono">{m.predicted_new_miss_distance_km.toFixed(2)} km</span>
    },
    {
      key: "proposed_at",
      label: "Proposed At",
      render: (m: Maneuver) => new Date(m.proposed_at).toLocaleString()
    },
    {
      key: "decided_by",
      label: "Decided By",
      render: (m: Maneuver) => m.decided_by || "—"
    },
    {
      key: "actions",
      label: "Actions",
      render: (m: Maneuver) => (
        <div className="flex gap-2">
          {(m.status === "proposed" || m.status === "under_review") ? (
            <>
              <button onClick={(e) => { e.stopPropagation(); handleApprove(m.id); }} className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold px-2 py-1 bg-emerald-500/10 rounded">Approve</button>
              <button onClick={(e) => { e.stopPropagation(); handleReject(m.id); }} className="text-red-400 hover:text-red-300 text-xs font-semibold px-2 py-1 bg-red-500/10 rounded">Reject</button>
            </>
          ) : (
            <button onClick={() => setSelectedManeuver(m)} className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold px-2 py-1 bg-cyan-500/10 rounded">View</button>
          )}
        </div>
      )
    }
  ];

  // Calculate stats from list if analytics fails
  const totalManeuvers = analytics?.total || total;
  const proposed = analytics?.by_status?.proposed || maneuvers.filter(m => m.status === "proposed").length;
  const underReview = analytics?.by_status?.under_review || maneuvers.filter(m => m.status === "under_review").length;
  const approved = analytics?.by_status?.approved || maneuvers.filter(m => m.status === "approved").length;
  const executed = analytics?.by_status?.executed || maneuvers.filter(m => m.status === "executed").length;
  const rejected = analytics?.by_status?.rejected || maneuvers.filter(m => m.status === "rejected").length;

  // Pagination purely client-side for now since fetchManeuvers returns all matched items if paginated isn't strictly requested by filter, but we do have fetchManeuvers.
  const paginatedManeuvers = maneuvers.slice((page - 1) * perPage, page * perPage);

  const workflowStates = ["proposed", "under_review", "approved", "executed", "verified"];
  const isRejected = selectedManeuver?.status === "rejected";
  
  return (
    <div className="flex flex-col gap-6 relative min-h-screen">
      <h1 className="text-teal-400 text-2xl font-semibold tracking-wide uppercase">Maneuver & Preventive Actions</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Total Maneuvers" value={totalManeuvers} />
        <MetricCard label="Proposed" value={proposed} variant="warning" />
        <MetricCard label="Under Review" value={underReview} variant="warning" />
        <MetricCard label="Approved" value={approved} variant="success" />
        <MetricCard label="Executed" value={executed} variant="success" />
        <MetricCard label="Rejected" value={rejected} variant="critical" />
      </div>

      <div className="flex items-center gap-4 border-b border-[var(--space-border)] pb-4">
        <span className="text-sm text-gray-400">Filter by Status:</span>
        <select 
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-[var(--space-panel)] border border-[var(--space-border)] text-sm rounded-md px-3 py-1.5 text-white focus:outline-none focus:border-teal-500"
        >
          <option value="all">All</option>
          <option value="proposed">Proposed</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="executed">Executed</option>
          <option value="verified">Verified</option>
        </select>
      </div>

      <DataTable 
        columns={columns}
        data={paginatedManeuvers}
        total={maneuvers.length}
        page={page}
        perPage={perPage}
        onPageChange={setPage}
        loading={loading}
        rowKey={(m) => m.id}
        onRowClick={(m) => setSelectedManeuver(m)}
      />

      {selectedManeuver && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[var(--space-canvas)] border-l border-[var(--space-border)] shadow-2xl p-6 overflow-y-auto z-50 flex flex-col gap-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl text-white font-mono mb-2">ID: {selectedManeuver.id.slice(0, 8)}...</h2>
              <StatusBadge status={selectedManeuver.status} />
            </div>
            <button onClick={() => setSelectedManeuver(null)} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="bg-[var(--space-panel)] rounded-md p-4 border border-[var(--space-border)] flex flex-col gap-4">
            <div>
              <span className="text-xs text-gray-500 uppercase">Related Conjunction</span>
              <p className="text-cyan-400 font-mono text-sm">{selectedManeuver.conjunction_event_id}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase">Asset</span>
              <p className="text-white text-sm">{selectedManeuver.asset.object_name} (NORAD: {selectedManeuver.asset.norad_cat_id})</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-gray-500 uppercase">Delta-V</span>
                <p className="text-white font-mono">{selectedManeuver.delta_v_mps.toFixed(3)} m/s</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase">Fuel Cost</span>
                <p className="text-white font-mono">{selectedManeuver.fuel_cost_kg ? selectedManeuver.fuel_cost_kg + " kg" : "N/A"}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase">Predicted Miss Dist</span>
                <p className="text-emerald-400 font-mono">{selectedManeuver.predicted_new_miss_distance_km.toFixed(2)} km</p>
              </div>
            </div>
            
            <div className="border-t border-[var(--space-border)] pt-4 mt-2">
              <span className="text-xs text-gray-500 uppercase">Timestamps</span>
              <p className="text-sm text-gray-300">Proposed: <span className="font-mono">{new Date(selectedManeuver.proposed_at).toLocaleString()}</span></p>
              {selectedManeuver.decided_at && (
                <p className="text-sm text-gray-300">Decided: <span className="font-mono">{new Date(selectedManeuver.decided_at).toLocaleString()}</span></p>
              )}
            </div>
            
            {selectedManeuver.decided_by && (
              <div>
                <span className="text-xs text-gray-500 uppercase">Decided By</span>
                <p className="text-white text-sm">{selectedManeuver.decided_by}</p>
              </div>
            )}
            
            {selectedManeuver.notes && (
              <div>
                <span className="text-xs text-gray-500 uppercase">Notes</span>
                <p className="text-sm text-gray-300 bg-[var(--space-canvas)] p-2 rounded border border-[var(--space-border)] mt-1">{selectedManeuver.notes}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-gray-500 uppercase">Workflow State</span>
            <div className="flex flex-col gap-1">
              {isRejected ? (
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="w-4 h-4" />
                  <span className="text-sm font-mono uppercase">Rejected</span>
                </div>
              ) : (
                workflowStates.map((state, idx) => {
                  const stateIdx = workflowStates.indexOf(selectedManeuver.status);
                  const isPast = idx <= stateIdx;
                  const isCurrent = idx === stateIdx;
                  return (
                    <div key={state} className={`flex items-center gap-2 ${isCurrent ? 'text-teal-400' : isPast ? 'text-gray-300' : 'text-gray-600'}`}>
                      {isPast ? <CheckCircle className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current"></div>}
                      <span className={`text-sm font-mono uppercase ${isCurrent ? 'font-bold' : ''}`}>{state.replace('_', ' ')}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-3">
            {(selectedManeuver.status === "proposed" || selectedManeuver.status === "under_review") && (
              <div className="flex gap-3">
                <button 
                  onClick={() => handleApprove(selectedManeuver.id)} 
                  disabled={actionLoading}
                  className="flex-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 py-2 rounded-md font-semibold disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "APPROVE"}
                </button>
                <button 
                  onClick={() => handleReject(selectedManeuver.id)} 
                  disabled={actionLoading}
                  className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 py-2 rounded-md font-semibold disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "REJECT"}
                </button>
              </div>
            )}
            <Link 
              href={`/conjunctions/${selectedManeuver.conjunction_event_id}`}
              className="w-full text-center bg-[var(--space-card-hover)] hover:bg-[#2d3748] text-white py-2 rounded-md font-semibold text-sm transition-colors"
            >
              VIEW CONJUNCTION
            </Link>
          </div>
        </div>
      )}
      
      {/* Overlay */}
      {selectedManeuver && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSelectedManeuver(null)}
        />
      )}
    </div>
  );
}
