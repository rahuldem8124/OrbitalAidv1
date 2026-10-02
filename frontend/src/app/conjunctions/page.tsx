'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchConjunctionAnalytics,
  fetchConjunctionsPaginated,
  fetchConjunctionTimeline,
  approveManeuver,
  rejectManeuver,
  fetchConjunctions
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
import DetailDrawer from '@/components/shared/DetailDrawer';
import Timeline from '@/components/shared/Timeline';
import { ShieldAlert, AlertTriangle, AlertCircle, CheckCircle, Clock, Rocket, AlertOctagon } from 'lucide-react';

export default function ConjunctionsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ risk_tier: '', status: '', search: '', time_to_tca: '' });
  const [sortBy, setSortBy] = useState('tca');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [selectedConjunction, setSelectedConjunction] = useState<ConjunctionWithDetails | null>(null);
  const [data, setData] = useState<PaginatedResponse<ConjunctionWithDetails> | null>(null);
  const [analytics, setAnalytics] = useState<ConjunctionAnalytics | null>(null);
  const [timeline, setTimeline] = useState<EventLog[]>([]);
  
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
      
      const [analyticsData, conjunctionsData] = await Promise.all([
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
          // Fallback if paginated endpoint is unavailable
          const res = await fetchConjunctions(filters.status || "active", filters.risk_tier || undefined);
          return {
            items: res.conjunctions as ConjunctionWithDetails[],
            total: res.total,
            page: 1,
            per_page: res.total,
            pages: 1
          };
        })
      ]);
      
      if (analyticsData) setAnalytics(analyticsData);
      setData(conjunctionsData);
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

  const closeDrawer = () => {
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
          <div className={`w-2.5 h-2.5 rounded-full ${item.status === 'active' ? 'bg-[#2dd4bf]' : item.status === 'resolved' ? 'bg-[#22c55e]' : 'bg-[#64748b]'}`} title={item.status} />
        </div>
      )
    },
    {
      key: 'primary_object',
      label: 'Primary Object',
      render: (item: ConjunctionWithDetails) => (
        <div className="flex flex-col">
          <span className="font-medium text-[#e2e8f0]">{item.object_a?.object_name || item.object_a_name || 'Unknown'}</span>
          <span className="text-xs text-[#64748b] font-mono">{item.object_a?.norad_cat_id || 'N/A'}</span>
        </div>
      )
    },
    {
      key: 'secondary_object',
      label: 'Secondary Object',
      render: (item: ConjunctionWithDetails) => (
        <div className="flex flex-col">
          <span className="font-medium text-[#e2e8f0]">{item.object_b?.object_name || item.object_b_name || 'Unknown'}</span>
          <span className="text-xs text-[#64748b] font-mono">{item.object_b?.norad_cat_id || 'N/A'}</span>
        </div>
      )
    },
    {
      key: 'miss_distance_km',
      label: 'Miss Distance',
      sortable: true,
      render: (item: ConjunctionWithDetails) => {
        const md = item.miss_distance_km;
        let color = 'text-[#e2e8f0]';
        if (md != null && md > 0) {
          if (md < 1) color = 'text-[#ef4444]';
          else if (md < 2) color = 'text-[#f97316]';
          else if (md < 5) color = 'text-[#eab308]';
        }
        return <span className={`font-mono ${color}`}>{formatDistance(md)}</span>;
      }
    },
    {
      key: 'relative_velocity_kmps',
      label: 'Rel. Velocity',
      render: (item: ConjunctionWithDetails) => (
        <span className="font-mono text-[#e2e8f0]">{formatVelocity(item.relative_velocity_kmps)}</span>
      )
    },
    {
      key: 'tca',
      label: 'TCA (UTC)',
      sortable: true,
      render: (item: ConjunctionWithDetails) => (
        <span className="font-mono text-xs text-[#e2e8f0] whitespace-nowrap">{formatUTCCompact(item.tca)}</span>
      )
    },
    {
      key: 'time_to_tca',
      label: 'Time to TCA',
      render: (item: ConjunctionWithDetails) => {
        const status = getTCAStatus(item.tca);
        if (status.type === 'unknown') return <span className="text-[#64748b]">—</span>;
        if (status.type === 'passed') return (
          <span className="font-mono text-xs text-[#64748b]">
            TCA PASSED<br /><span className="text-[10px]">{status.suffix}</span>
          </span>
        );
        return (
          <span className={`font-mono text-xs font-medium ${status.isUrgent ? 'text-[#ef4444]' : 'text-[#2dd4bf]'}`}>
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
        <span className="font-mono text-xs text-[#e2e8f0]">{formatPc(item.pc)}</span>
      )
    },
    {
      key: 'maneuver',
      label: 'Maneuver',
      render: (item: ConjunctionWithDetails) => (
        item.maneuver ? <StatusBadge status={item.maneuver.status} /> : <span className="text-[#64748b] text-sm">None</span>
      )
    },
    {
      key: 'preventive_action',
      label: 'Preventive Action',
      render: (item: ConjunctionWithDetails) => (
        <span className="text-xs truncate max-w-[150px] inline-block text-[#e2e8f0]" title={item.preventive_action || ''}>{item.preventive_action || '—'}</span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: () => (
        <button className="text-xs bg-[#1e293b] hover:bg-[#2dd4bf]/20 text-[#2dd4bf] px-3 py-1.5 rounded transition-colors border border-[#2dd4bf]/30">
          View
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
        <h1 className="text-white text-2xl font-semibold tracking-tight uppercase">CONJUNCTION & RISK OPERATIONS CENTER</h1>
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
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] p-4 rounded-xl flex justify-center">
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

      <DetailDrawer 
        open={!!selectedConjunction} 
        onClose={closeDrawer} 
        title="CONJUNCTION DETAIL"
        width="w-full max-w-2xl"
      >
        {selectedConjunction && (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                <h3 className="text-[#2dd4bf] font-medium uppercase tracking-wider text-sm">Event Overview</h3>
                <span className="font-mono text-xs text-[#94a3b8]">ID: {selectedConjunction.id}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1a2332] p-4 rounded-lg border border-[#1e293b]">
                  <span className="text-xs text-[#64748b] block mb-1 uppercase">Primary Object</span>
                  <div className="text-[#e2e8f0] font-medium">{selectedConjunction.object_a?.object_name || selectedConjunction.object_a_name || 'Unknown'}</div>
                  <div className="text-[#94a3b8] text-sm font-mono mt-1">NORAD: {selectedConjunction.object_a?.norad_cat_id || 'N/A'}</div>
                  <div className="text-[#94a3b8] text-xs capitalize mt-1 border border-[#1e293b] inline-block px-2 py-0.5 rounded bg-[#111827]">
                    {selectedConjunction.object_a?.type || 'Unknown'}
                  </div>
                </div>
                <div className="bg-[#1a2332] p-4 rounded-lg border border-[#1e293b]">
                  <span className="text-xs text-[#64748b] block mb-1 uppercase">Secondary Object</span>
                  <div className="text-[#e2e8f0] font-medium">{selectedConjunction.object_b?.object_name || selectedConjunction.object_b_name || 'Unknown'}</div>
                  <div className="text-[#94a3b8] text-sm font-mono mt-1">NORAD: {selectedConjunction.object_b?.norad_cat_id || 'N/A'}</div>
                  <div className="text-[#94a3b8] text-xs capitalize mt-1 border border-[#1e293b] inline-block px-2 py-0.5 rounded bg-[#111827]">
                    {selectedConjunction.object_b?.type || 'Unknown'}
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <StatusBadge status={selectedConjunction.status} />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                <h3 className="text-[#2dd4bf] font-medium uppercase tracking-wider text-sm">Encounter Data</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-lg flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-[#94a3b8] uppercase mb-1">Miss Distance</span>
                  <span className={`text-3xl font-mono font-bold ${
                    selectedConjunction.miss_distance_km < 1 ? 'text-[#ef4444]' : 
                    selectedConjunction.miss_distance_km < 2 ? 'text-[#f97316]' : 
                    selectedConjunction.miss_distance_km < 5 ? 'text-[#eab308]' : 'text-[#2dd4bf]'
                  }`}>
                    {selectedConjunction.miss_distance_km != null ? selectedConjunction.miss_distance_km.toFixed(3) : '—'} <span className="text-lg text-[#64748b]">km</span>
                  </span>
                </div>
                <div className="bg-[#111827] border border-[#1e293b] p-4 rounded-lg flex flex-col justify-center">
                  <div className="flex justify-between items-center border-b border-[#1e293b] pb-2 mb-2">
                    <span className="text-xs text-[#94a3b8]">TCA (UTC)</span>
                    <span className="text-xs font-mono text-[#e2e8f0]">{formatUTCCompact(selectedConjunction.tca)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#1e293b] pb-2 mb-2">
                    <span className="text-xs text-[#94a3b8]">Time to TCA</span>
                    {(() => {
                      const s = getTCAStatus(selectedConjunction.tca);
                      if (s.type === 'passed') return <span className="text-xs font-mono text-[#64748b]">TCA PASSED · {s.suffix}</span>;
                      if (s.type === 'upcoming') return <span className={`text-xs font-mono font-medium ${s.isUrgent ? 'text-[#ef4444]' : 'text-[#f97316]'}`}>{s.label}</span>;
                      return <span className="text-xs text-[#64748b]">—</span>;
                    })()}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#94a3b8]">Rel. Velocity</span>
                    <span className="text-xs font-mono text-[#e2e8f0]">{formatVelocity(selectedConjunction.relative_velocity_kmps)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                <h3 className="text-[#2dd4bf] font-medium uppercase tracking-wider text-sm">Risk Assessment</h3>
              </div>
              {!selectedConjunction.risk_assessment && selectedConjunction.risk_tier === null ? (
                <div className="bg-[#eab308]/10 border border-[#eab308]/30 p-4 rounded-lg text-center text-[#eab308] text-sm">
                  ASSESSMENT UNAVAILABLE
                </div>
              ) : (
                <div className="flex items-center gap-6 bg-[#1a2332] p-4 rounded-lg border border-[#1e293b]">
                  <div className="flex-shrink-0">
                    <RiskBadge tier={selectedConjunction.risk_tier} size="lg" />
                  </div>
                  <div className="flex flex-col flex-1 gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#94a3b8]">Collision Probability (Pc)</span>
                      <span className="font-mono text-[#e2e8f0]">{selectedConjunction.pc ? selectedConjunction.pc.toExponential(4) : '—'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#94a3b8]">Assessment Method</span>
                      <span className="text-[#e2e8f0]">{selectedConjunction.risk_method || '—'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                <h3 className="text-[#2dd4bf] font-medium uppercase tracking-wider text-sm">Preventive Action & Maneuver</h3>
              </div>
              <div className="bg-[#1a2332] p-4 rounded-lg border border-[#1e293b] flex flex-col gap-3">
                <div>
                  <span className="text-xs text-[#94a3b8] uppercase block mb-1">Recommended Action</span>
                  <div className="text-sm text-[#e2e8f0]">{selectedConjunction.preventive_action || 'None'}</div>
                </div>
                {selectedConjunction.maneuver ? (
                  <div className="mt-2 border-t border-[#1e293b] pt-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-[#e2e8f0]">Proposed Maneuver</span>
                      <StatusBadge status={selectedConjunction.maneuver.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 text-sm mb-4">
                      <div className="text-[#94a3b8]">Maneuver ID</div>
                      <div className="font-mono text-xs text-[#e2e8f0]">{selectedConjunction.maneuver.id}</div>
                      <div className="text-[#94a3b8]">Delta-V</div>
                      <div className="font-mono text-[#e2e8f0]">{selectedConjunction.maneuver.delta_v_mps.toFixed(2)} m/s</div>
                      <div className="text-[#94a3b8]">New Miss Dist.</div>
                      <div className="font-mono text-[#e2e8f0]">{selectedConjunction.maneuver.predicted_new_miss_distance_km.toFixed(2)} km</div>
                    </div>
                    {(selectedConjunction.maneuver.status === 'proposed' || selectedConjunction.maneuver.status === 'under_review') && (
                      <div className="flex gap-3 mt-4">
                        <button 
                          onClick={() => handleManeuverAction('approve')}
                          className="flex-1 bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/50 py-2 rounded-md font-medium text-sm transition-colors"
                        >
                          APPROVE
                        </button>
                        <button 
                          onClick={() => handleManeuverAction('reject')}
                          className="flex-1 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/50 py-2 rounded-md font-medium text-sm transition-colors"
                        >
                          REJECT
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 border-t border-[#1e293b] pt-3 text-center">
                    <span className="text-sm text-[#64748b]">NO MANEUVER PROPOSED</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                <h3 className="text-[#2dd4bf] font-medium uppercase tracking-wider text-sm">Event Timeline</h3>
              </div>
              <div className="bg-[#1a2332] p-4 rounded-lg border border-[#1e293b]">
                <Timeline events={timeline.map(e => ({ action: e.action, actor: e.actor, timestamp: e.timestamp, details: e.details ?? undefined }))} />
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
