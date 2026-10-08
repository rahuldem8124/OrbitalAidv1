'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchConjunctionAnalytics,
  fetchConjunctionsPaginated,
  fetchConjunctionTimeline,
  approveManeuver,
  rejectManeuver,
  fetchConjunctions,
  fetchObjectPositions
} from '@/lib/api';
import {
  ConjunctionWithDetails,
  PaginatedResponse,
  ConjunctionAnalytics,
  EventLog
} from '@/lib/types';
import { formatUTCCompact, getTCAStatus, formatDistance, formatVelocity, formatPc } from '@/lib/time';
import DataTable from '@/components/shared/DataTable';
import FilterBar from '@/components/shared/FilterBar';
import RiskBadge from '@/components/shared/RiskBadge';
import StatusBadge from '@/components/shared/StatusBadge';
import MetricCard from '@/components/shared/MetricCard';
import Timeline from '@/components/shared/Timeline';
import Globe from '@/components/dashboard/Globe';
import { ShieldAlert, AlertTriangle, AlertCircle, CheckCircle, Clock, Rocket, AlertOctagon, ArrowLeft, Target, X } from 'lucide-react';

export default function ConjunctionsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ risk_tier: '', status: '', search: '', time_to_tca: '' });
  const [sortBy, setSortBy] = useState('tca');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [selectedConjunction, setSelectedConjunction] = useState<ConjunctionWithDetails | null>(null);
  const [data, setData] = useState<PaginatedResponse<ConjunctionWithDetails> | null>(null);
  const [analytics, setAnalytics] = useState<ConjunctionAnalytics | null>(null);
  const [timeline, setTimeline] = useState<EventLog[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [filters.search]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    if (key !== 'search') setPage(1);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [analyticsData, conjunctionsData, posData] = await Promise.all([
        fetchConjunctionAnalytics().catch(() => null),
        fetchConjunctionsPaginated({
          page,
          per_page: 20,
          status: filters.status || undefined,
          risk_tier: filters.risk_tier || undefined,
          search: debouncedSearch || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        }).catch(async () => {
          const res = await fetchConjunctions(filters.status || "active", filters.risk_tier || undefined);
          return {
            items: res.conjunctions as ConjunctionWithDetails[],
            total: res.total,
            page: 1,
            per_page: res.total,
            pages: 1
          };
        }),
        fetchObjectPositions(undefined, 300).catch(() => ({ positions: [] })),
      ]);
      
      if (analyticsData) setAnalytics(analyticsData);
      setData(conjunctionsData);
      if (posData?.positions) setPositions(posData.positions);
    } catch (err) {
      console.error(err);
      setError("Failed to load conjunction data");
    } finally {
      setLoading(false);
    }
  }, [page, filters.status, filters.risk_tier, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle keyboard ESC to close simulation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedConjunction) {
        closeSimulation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedConjunction]);

  const handleRowClick = async (item: ConjunctionWithDetails) => {
    setSelectedConjunction(item);
    try {
      const tl = await fetchConjunctionTimeline(item.id);
      setTimeline(tl);
    } catch {
      setTimeline([
        {
          id: '1',
          conjunction_event_id: item.id,
          action: 'Event Detected',
          actor: 'System',
          timestamp: new Date().toISOString(),
          details: `Conjunction detected between ${item.object_a_name || item.object_a?.object_name} and ${item.object_b_name || item.object_b?.object_name}`
        }
      ]);
    }
  };

  const closeSimulation = () => {
    setSelectedConjunction(null);
    setTimeline([]);
  };

  const handleManeuverAction = async (action: 'approve' | 'reject') => {
    if (!selectedConjunction?.maneuver) return;
    try {
      if (action === 'approve') {
        await approveManeuver(selectedConjunction.maneuver.id, 'Operator');
      } else {
        await rejectManeuver(selectedConjunction.maneuver.id, 'Operator');
      }
      loadData();
      setSelectedConjunction(prev => {
        if (!prev || !prev.maneuver) return prev;
        return {
          ...prev,
          maneuver: {
            ...prev.maneuver,
            status: action === 'approve' ? 'approved' : 'rejected'
          }
        };
      });
    } catch (error) {
      console.error(`Failed to ${action} maneuver`, error);
    }
  };

  const columns = [
    {
      key: 'status',
      label: 'Status',
      width: '80px',
      render: (item: ConjunctionWithDetails) => (
        <div className="flex justify-center">
          <div className={`w-2.5 h-2.5 rounded-full ${item.status === 'active' ? 'bg-amber-400' : item.status === 'resolved' ? 'bg-emerald-400' : 'bg-zinc-600'}`} title={item.status} />
        </div>
      )
    },
    {
      key: 'primary_object',
      label: 'Primary Object',
      render: (item: ConjunctionWithDetails) => (
        <div className="flex flex-col">
          <span className="font-medium text-[var(--text-primary)]">{item.object_a?.object_name || item.object_a_name || 'Unknown'}</span>
          <span className="text-xs text-[var(--text-muted)] font-mono">{item.object_a?.norad_cat_id || 'N/A'}</span>
        </div>
      )
    },
    {
      key: 'secondary_object',
      label: 'Secondary Object',
      render: (item: ConjunctionWithDetails) => (
        <div className="flex flex-col">
          <span className="font-medium text-[var(--text-primary)]">{item.object_b?.object_name || item.object_b_name || 'Unknown'}</span>
          <span className="text-xs text-[var(--text-muted)] font-mono">{item.object_b?.norad_cat_id || 'N/A'}</span>
        </div>
      )
    },
    {
      key: 'miss_distance_km',
      label: 'Miss Distance',
      sortable: true,
      render: (item: ConjunctionWithDetails) => {
        const md = item.miss_distance_km;
        let color = 'text-[var(--text-primary)]';
        if (md != null && md > 0) {
          if (md < 1) color = 'text-[var(--tier-critical)] font-bold';
          else if (md < 2) color = 'text-[var(--tier-high)] font-bold';
          else if (md < 5) color = 'text-[var(--tier-watch)]';
        }
        return <span className={`font-mono ${color}`}>{formatDistance(md)}</span>;
      }
    },
    {
      key: 'relative_velocity_kmps',
      label: 'Rel. Velocity',
      render: (item: ConjunctionWithDetails) => (
        <span className="font-mono text-[var(--text-primary)]">{formatVelocity(item.relative_velocity_kmps)}</span>
      )
    },
    {
      key: 'tca',
      label: 'TCA (UTC)',
      sortable: true,
      render: (item: ConjunctionWithDetails) => (
        <span className="font-mono text-xs text-[var(--text-primary)] whitespace-nowrap">{formatUTCCompact(item.tca)}</span>
      )
    },
    {
      key: 'time_to_tca',
      label: 'Time to TCA',
      render: (item: ConjunctionWithDetails) => {
        const status = getTCAStatus(item.tca);
        if (status.type === 'unknown') return <span className="text-[var(--text-muted)]">—</span>;
        if (status.type === 'passed') return (
          <span className="font-mono text-xs text-[var(--text-muted)]">
            TCA PASSED<br /><span className="text-[10px]">{status.suffix}</span>
          </span>
        );
        return (
          <span className={`font-mono text-xs font-medium ${status.isUrgent ? 'text-[var(--tier-critical)]' : 'text-amber-400'}`}>
            {status.label}
          </span>
        );
      }
    },
    {
      key: 'risk_tier',
      label: 'Risk',
      sortable: true,
      render: (item: ConjunctionWithDetails) => <RiskBadge tier={item.risk_tier} />
    },
    {
      key: 'pc',
      label: 'Pc',
      sortable: true,
      render: (item: ConjunctionWithDetails) => (
        <span className="font-mono text-xs text-[var(--text-primary)]">{formatPc(item.pc)}</span>
      )
    },
    {
      key: 'maneuver',
      label: 'Maneuver',
      render: (item: ConjunctionWithDetails) => (
        item.maneuver ? <StatusBadge status={item.maneuver.status} /> : <span className="text-[var(--text-muted)] text-sm">None</span>
      )
    },
    {
      key: 'preventive_action',
      label: 'Preventive Action',
      render: (item: ConjunctionWithDetails) => (
        <span className="text-xs truncate max-w-[150px] inline-block text-[var(--text-primary)]" title={item.preventive_action || ''}>{item.preventive_action || '—'}</span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: () => (
        <button className="text-xs bg-amber-950/20 hover:bg-amber-400/20 text-amber-400 px-3 py-1.5 rounded transition-colors border border-amber-400/30 font-mono font-medium">
          SIMULATE
        </button>
      )
    }
  ];

  const filterConfig = [
    {
      key: 'risk_tier',
      label: 'Risk Level',
      type: 'select' as const,
      options: [
        { value: 'critical', label: 'Critical' },
        { value: 'high', label: 'High' },
        { value: 'watch', label: 'Watch' },
        { value: 'low', label: 'Low' },
      ],
      value: filters.risk_tier,
      onChange: (val: string) => handleFilterChange('risk_tier', val)
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: [
        { value: 'active', label: 'Active' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'expired', label: 'Expired' },
      ],
      value: filters.status,
      onChange: (val: string) => handleFilterChange('status', val)
    },
    {
      key: 'time_to_tca',
      label: 'Time to TCA',
      type: 'select' as const,
      options: [
        { value: '<24h', label: '< 24 Hours' },
        { value: '<72h', label: '< 72 Hours' },
        { value: '<7d', label: '< 7 Days' },
      ],
      value: filters.time_to_tca,
      onChange: (val: string) => handleFilterChange('time_to_tca', val)
    },
    {
      key: 'search',
      label: 'Search',
      type: 'search' as const,
      value: filters.search,
      onChange: (val: string) => handleFilterChange('search', val)
    }
  ];

  return (
    <div className="flex flex-col gap-6 w-full mx-auto pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-2xl font-semibold tracking-tight uppercase font-mono">CONJUNCTION & RISK OPERATIONS CENTER</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard label="Total Conjunctions" value={analytics?.total_conjunctions || 0} icon={<AlertOctagon className="w-5 h-5" />} />
        <MetricCard label="Critical" value={analytics?.by_risk_tier?.critical || 0} variant="critical" icon={<ShieldAlert className="w-5 h-5" />} />
        <MetricCard label="High Risk" value={analytics?.by_risk_tier?.high || 0} variant="warning" icon={<AlertTriangle className="w-5 h-5" />} />
        <MetricCard label="Watch" value={analytics?.by_risk_tier?.watch || 0} icon={<AlertCircle className="w-5 h-5" />} />
        <MetricCard label="Low Risk" value={analytics?.by_risk_tier?.low || 0} variant="success" icon={<CheckCircle className="w-5 h-5" />} />
        
        <MetricCard label="Upcoming <24h" value={analytics?.upcoming_24h || 0} icon={<Clock className="w-5 h-5" />} />
        <MetricCard label="Upcoming <72h" value={analytics?.upcoming_72h || 0} icon={<Clock className="w-5 h-5" />} />
        <MetricCard label="Maneuver Required" value={analytics?.maneuver_required || 0} variant="warning" icon={<Rocket className="w-5 h-5" />} />
        <MetricCard label="Maneuver Approved" value={analytics?.maneuver_approved || 0} variant="success" icon={<Rocket className="w-5 h-5" />} />
        <MetricCard label="Maneuver Pending" value={analytics?.maneuver_pending || 0} icon={<Rocket className="w-5 h-5" />} />
      </div>

      <FilterBar 
        filters={filterConfig} 
        onReset={() => setFilters({ risk_tier: '', status: '', search: '', time_to_tca: '' })}
      />

      {error && (
        <div className="bg-[var(--tier-critical)]/10 border border-[var(--tier-critical)]/30 text-[var(--tier-critical)] p-4 rounded-md flex justify-center">
          {error}
        </div>
      )}

      <DataTable 
        columns={columns}
        data={data?.items || []}
        total={data?.total || 0}
        page={page}
        perPage={20}
        onPageChange={setPage}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={(key, order) => {
          setSortBy(key);
          setSortOrder(order);
          setPage(1);
        }}
        onRowClick={handleRowClick}
        loading={loading}
        rowKey={(item) => item.id}
      />

      {/* ============================================================== */}
      {/* 3D CONJUNCTION ENCOUNTER SIMULATION & DETAIL SIDE-PANEL        */}
      {/* ============================================================== */}
      {selectedConjunction && (
        <div className="fixed inset-0 z-50 bg-[#000000] overflow-hidden select-none animate-in fade-in duration-200">
          {/* Fullscreen React Three Fiber 3D Simulation Canvas */}
          <div className="absolute inset-0 w-full h-full z-0">
            <Globe
              positions={positions}
              selectedConjunction={selectedConjunction}
              onCloseConjunction={closeSimulation}
            />
          </div>

          {/* Top-Left Exit Button & Simulation HUD Status */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
            <button
              onClick={closeSimulation}
              className="bg-[#050505]/95 hover:bg-[#151515] text-amber-400 border border-amber-400/30 px-3.5 py-2 rounded-sm font-mono text-[10px] font-bold tracking-widest uppercase transition-all shadow-2xl flex items-center gap-2 group cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>RETURN TO OPS GRID [ESC]</span>
            </button>
            <div className="bg-[#050505]/90 border border-white/10 px-3 py-2 rounded-sm font-mono text-[9px] text-zinc-400 hidden sm:flex items-center gap-2 shadow-2xl">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-zinc-200 font-bold">LOCAL 3D ENCOUNTER SIMULATION</span>
              <span className="text-zinc-600">|</span>
              <span>DRAG TO ROTATE AROUND COLLISION POINT</span>
            </div>
          </div>

          {/* Floating Right Conjunction Detail UI Panel */}
          <div className="absolute right-4 top-4 bottom-4 w-[540px] max-w-[calc(100vw-2rem)] z-20 bg-[#050505]/95 backdrop-blur-md border border-white/10 rounded-md shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300">
            {/* Panel Header */}
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                <h2 className="font-mono text-xs font-bold text-white tracking-widest uppercase">
                  CONJUNCTION DETAIL // ENCOUNTER ANALYSIS
                </h2>
              </div>
              <button
                onClick={closeSimulation}
                className="text-zinc-400 hover:text-white p-1 rounded-xs transition-colors cursor-pointer"
                title="Close Simulation [ESC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Detail Data */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Event Overview Section */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <h3 className="text-amber-400 font-mono font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-400"></span>
                    Event Overview
                  </h3>
                  <span className="font-mono text-[10px] text-zinc-400">ID: {selectedConjunction.id}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#111111]/80 p-3.5 rounded-sm border border-white/10">
                    <span className="text-[10px] font-mono text-zinc-400 block mb-1 uppercase tracking-wider">Primary Object (White Path)</span>
                    <div className="text-white font-bold text-sm">{selectedConjunction.object_a?.object_name || selectedConjunction.object_a_name || 'Unknown'}</div>
                    <div className="text-zinc-400 text-xs font-mono mt-1">NORAD: {selectedConjunction.object_a?.norad_cat_id || 'N/A'}</div>
                    <div className="text-zinc-300 text-[10px] uppercase font-mono mt-1.5 border border-white/10 inline-block px-1.5 py-0.5 rounded bg-black/60">
                      {selectedConjunction.object_a?.type || 'Unknown'}
                    </div>
                  </div>
                  <div className="bg-[#111111]/80 p-3.5 rounded-sm border border-white/10">
                    <span className="text-[10px] font-mono text-zinc-400 block mb-1 uppercase tracking-wider">Secondary Object (Red Path)</span>
                    <div className="text-white font-bold text-sm">{selectedConjunction.object_b?.object_name || selectedConjunction.object_b_name || 'Unknown'}</div>
                    <div className="text-zinc-400 text-xs font-mono mt-1">NORAD: {selectedConjunction.object_b?.norad_cat_id || 'N/A'}</div>
                    <div className="text-zinc-300 text-[10px] uppercase font-mono mt-1.5 border border-white/10 inline-block px-1.5 py-0.5 rounded bg-black/60">
                      {selectedConjunction.object_b?.type || 'Unknown'}
                    </div>
                  </div>
                </div>
                <div>
                  <StatusBadge status={selectedConjunction.status} />
                </div>
              </div>

              {/* Encounter Data Section */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <h3 className="text-amber-400 font-mono font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-400"></span>
                    Encounter Data
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#111111]/80 border border-white/10 p-3.5 rounded-sm flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Miss Distance</span>
                    <span className={`text-2xl font-mono font-bold ${
                      selectedConjunction.miss_distance_km < 1 ? 'text-[var(--tier-critical)]' : 
                      selectedConjunction.miss_distance_km < 2 ? 'text-[var(--tier-high)]' : 
                      selectedConjunction.miss_distance_km < 5 ? 'text-[var(--tier-watch)]' : 'text-amber-300'
                    }`}>
                      {selectedConjunction.miss_distance_km != null ? selectedConjunction.miss_distance_km.toFixed(3) : '—'} <span className="text-sm text-zinc-500">km</span>
                    </span>
                  </div>
                  <div className="bg-[#111111]/80 border border-white/10 p-3.5 rounded-sm flex flex-col justify-center text-xs">
                    <div className="flex justify-between items-center border-b border-white/5 pb-1.5 mb-1.5">
                      <span className="text-zinc-400">TCA (UTC)</span>
                      <span className="font-mono text-zinc-200">{formatUTCCompact(selectedConjunction.tca)}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/5 pb-1.5 mb-1.5">
                      <span className="text-zinc-400">Countdown</span>
                      {(() => {
                        const s = getTCAStatus(selectedConjunction.tca);
                        if (s.type === 'passed') return <span className="font-mono text-zinc-500">TCA PASSED</span>;
                        if (s.type === 'upcoming') return <span className={`font-mono font-bold ${s.isUrgent ? 'text-[var(--tier-critical)]' : 'text-amber-400'}`}>{s.label}</span>;
                        return <span className="text-zinc-500">—</span>;
                      })()}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">Rel. Velocity</span>
                      <span className="font-mono text-zinc-200">{formatVelocity(selectedConjunction.relative_velocity_kmps)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Assessment Section */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <h3 className="text-amber-400 font-mono font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-400"></span>
                    Risk Assessment
                  </h3>
                </div>
                {!selectedConjunction.risk_assessment && selectedConjunction.risk_tier === null ? (
                  <div className="bg-amber-950/20 border border-amber-800/40 p-3.5 rounded-sm text-center text-amber-300 text-xs font-mono">
                    ASSESSMENT PENDING SENSOR CONVERGENCE
                  </div>
                ) : (
                  <div className="flex items-center gap-5 bg-[#111111]/80 p-3.5 rounded-sm border border-white/10">
                    <div className="flex-shrink-0">
                      <RiskBadge tier={selectedConjunction.risk_tier} size="lg" />
                    </div>
                    <div className="flex flex-col flex-1 gap-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Collision Probability (Pc)</span>
                        <span className="font-mono text-white font-bold">{selectedConjunction.pc ? selectedConjunction.pc.toExponential(4) : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Assessment Method</span>
                        <span className="text-zinc-200 font-mono">{selectedConjunction.risk_method || 'Foster 1992 2D'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Preventive Action & Maneuver Section */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <h3 className="text-amber-400 font-mono font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-400"></span>
                    Preventive Action & Maneuver
                  </h3>
                </div>
                <div className="bg-[#111111]/80 p-4 rounded-sm border border-white/10 flex flex-col gap-3">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">Recommended Action</span>
                    <div className="text-xs font-mono text-white font-bold">{selectedConjunction.preventive_action || 'Enhanced Monitoring'}</div>
                  </div>
                  {selectedConjunction.maneuver ? (
                    <div className="mt-2 border-t border-white/10 pt-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-mono font-bold text-white uppercase">Proposed Evasion Burn</span>
                        <StatusBadge status={selectedConjunction.maneuver.status} />
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 text-xs mb-4 font-mono">
                        <div className="text-zinc-400">Maneuver ID</div>
                        <div className="text-zinc-200">{selectedConjunction.maneuver.id}</div>
                        <div className="text-zinc-400">Delta-V</div>
                        <div className="text-amber-300 font-bold">{selectedConjunction.maneuver.delta_v_mps.toFixed(3)} m/s</div>
                        <div className="text-zinc-400">Predicted Miss Dist.</div>
                        <div className="text-emerald-400 font-bold">{selectedConjunction.maneuver.predicted_new_miss_distance_km.toFixed(2)} km</div>
                      </div>
                      {(selectedConjunction.maneuver.status === 'proposed' || selectedConjunction.maneuver.status === 'under_review') && (
                        <div className="flex gap-3 mt-3">
                          <button 
                            onClick={() => handleManeuverAction('approve')}
                            className="flex-1 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/50 py-2 rounded-sm font-mono font-bold text-xs transition-colors cursor-pointer"
                          >
                            APPROVE EVASION
                          </button>
                          <button 
                            onClick={() => handleManeuverAction('reject')}
                            className="flex-1 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/50 py-2 rounded-sm font-mono font-bold text-xs transition-colors cursor-pointer"
                          >
                            REJECT EVASION
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 border-t border-white/10 pt-3 text-center">
                      <span className="text-xs font-mono text-zinc-500">NO MANEUVER PROPOSED FOR THIS VECTOR</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Event Timeline Section */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <h3 className="text-amber-400 font-mono font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-400"></span>
                    Event Timeline
                  </h3>
                </div>
                <div className="bg-[#111111]/80 p-4 rounded-sm border border-white/10">
                  <Timeline events={timeline.map(e => ({ action: e.action, actor: e.actor, timestamp: e.timestamp, details: e.details ?? undefined }))} />
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
