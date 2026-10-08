"use client";

import { useState, useEffect } from "react";
import { fetchObjects, fetchStats } from "@/lib/api";
import { SpaceObject, StatsSummary } from "@/lib/types";
import MetricCard from "@/components/shared/MetricCard";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { X, Search } from "lucide-react";

export default function FleetPage() {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [objects, setObjects] = useState<SpaceObject[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedObject, setSelectedObject] = useState<SpaceObject | null>(null);
  
  const perPage = 15;

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [statsRes, objectsRes] = await Promise.all([
          fetchStats().catch(() => null),
          fetchObjects(typeFilter !== "all" ? typeFilter : undefined, 500, 0)
        ]);
        if (statsRes) setStats(statsRes);
        setObjects(objectsRes.objects);
        setTotal(objectsRes.total);
      } catch (err) {
        console.error("Failed to load fleet data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [typeFilter]);

  const filteredObjects = objects.filter(o => 
    !searchQuery || 
    o.object_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.norad_cat_id.toString().includes(searchQuery)
  );

  const paginatedObjects = filteredObjects.slice((page - 1) * perPage, page * perPage);

  const columns = [
    {
      key: "norad_cat_id",
      label: "NORAD ID",
      render: (o: SpaceObject) => <span className="font-mono text-amber-400">{o.norad_cat_id}</span>
    },
    {
      key: "object_name",
      label: "Name",
      render: (o: SpaceObject) => <span className="font-semibold">{o.object_name}</span>
    },
    {
      key: "type",
      label: "Type",
      render: (o: SpaceObject) => {
        let variant = "default";
        if (o.type === 'satellite') variant = "active";
        else if (o.type === 'station') variant = "under_review";
        return <StatusBadge status={o.type} />
      }
    },
    {
      key: "object_id",
      label: "Object ID (COSPAR)",
      render: (o: SpaceObject) => <span className="font-mono text-gray-400">{o.object_id || "—"}</span>
    },
    {
      key: "is_own_asset",
      label: "Own Asset",
      render: (o: SpaceObject) => <span className={o.is_own_asset ? "text-emerald-400" : "text-gray-600"}>{o.is_own_asset ? "✓" : "—"}</span>
    },
    {
      key: "source_file",
      label: "Source",
      render: (o: SpaceObject) => <span className="text-xs text-gray-500">{o.source_file}</span>
    }
  ];

  return (
    <div className="flex flex-col gap-6 relative min-h-screen">
      <h1 className="text-white text-2xl font-semibold tracking-wide uppercase font-mono">Fleet & Object Registry</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Objects" value={stats?.total_objects || total} />
        <MetricCard label="Satellites" value={stats?.satellites || objects.filter(o => o.type === 'satellite').length} variant="success" />
        <MetricCard label="Stations" value={stats?.stations || objects.filter(o => o.type === 'station').length} variant="warning" />
        <MetricCard label="Debris" value={stats?.debris || objects.filter(o => o.type === 'debris').length} variant="default" />
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-[var(--space-border)] pb-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <span className="text-sm text-gray-400 whitespace-nowrap">Filter by Type:</span>
          <select 
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="bg-[var(--space-panel)] border border-[var(--space-border)] text-sm rounded-md px-3 py-1.5 text-white focus:outline-none focus:border-amber-400 w-full md:w-auto"
          >
            <option value="all">All</option>
            <option value="satellite">Satellite</option>
            <option value="station">Station</option>
            <option value="debris">Debris</option>
          </select>
        </div>
        
        <div className="relative w-full md:w-64">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            className="bg-[var(--space-panel)] border border-[var(--space-border)] text-sm rounded-md block w-full pl-10 p-2 text-white focus:outline-none focus:border-amber-400 placeholder-gray-500"
            placeholder="Search Name or NORAD ID..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={paginatedObjects}
        total={filteredObjects.length}
        page={page}
        perPage={perPage}
        onPageChange={setPage}
        loading={loading}
        rowKey={(o) => o.id}
        onRowClick={(o) => setSelectedObject(o)}
      />

      {selectedObject && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[var(--space-canvas)] border-l border-[var(--space-border)] shadow-2xl p-6 overflow-y-auto z-50 flex flex-col gap-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl text-white font-bold mb-2">{selectedObject.object_name}</h2>
              <StatusBadge status={selectedObject.type} />
            </div>
            <button onClick={() => setSelectedObject(null)} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="bg-[var(--space-panel)] rounded-md p-5 border border-[var(--space-border)] flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-gray-500 uppercase block mb-1">NORAD ID</span>
                <p className="text-amber-400 font-mono text-lg">{selectedObject.norad_cat_id}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase block mb-1">Object ID</span>
                <p className="text-white font-mono">{selectedObject.object_id || "N/A"}</p>
              </div>
            </div>
            
            <div className="border-t border-[var(--space-border)] pt-4">
              <span className="text-xs text-gray-500 uppercase block mb-1">Ownership</span>
              <div className="flex items-center gap-2">
                {selectedObject.is_own_asset ? (
                  <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-sm font-medium border border-emerald-500/20">Own Asset</span>
                ) : (
                  <span className="px-2 py-1 bg-gray-800 text-gray-400 rounded text-sm font-medium border border-gray-700">External / Unowned</span>
                )}
              </div>
            </div>

            <div className="border-t border-[var(--space-border)] pt-4">
              <span className="text-xs text-gray-500 uppercase block mb-1">Data Source</span>
              <p className="text-gray-300 text-sm">{selectedObject.source_file}</p>
            </div>
            
            <div className="border-t border-[var(--space-border)] pt-4">
              <span className="text-xs text-gray-500 uppercase block mb-1">Internal Database ID</span>
              <p className="text-gray-500 font-mono text-xs">{selectedObject.id}</p>
            </div>
          </div>
          
          <div className="mt-auto pt-6">
            <button 
              className="w-full text-center bg-[var(--space-card-hover)] hover:bg-[#2d3748] text-white py-2 rounded-md font-semibold text-sm transition-colors"
              onClick={() => alert("Detailed trajectory view coming soon.")}
            >
              VIEW TRAJECTORY
            </button>
          </div>
        </div>
      )}
      
      {/* Overlay */}
      {selectedObject && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSelectedObject(null)}
        />
      )}
    </div>
  );
}