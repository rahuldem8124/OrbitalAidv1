"use client";

import { useEffect, useState, useMemo } from "react";
import { Alert } from "@/lib/types";
import { fetchAlertsPaginated, fetchAlerts, acknowledgeAlert, resolveAlert } from "@/lib/api";
import MetricCard from "@/components/shared/MetricCard";
import FilterBar from "@/components/shared/FilterBar";
import DataTable from "@/components/shared/DataTable";
import DetailDrawer from "@/components/shared/DetailDrawer";
import RiskBadge from "@/components/shared/RiskBadge";
import StatusBadge from "@/components/shared/StatusBadge";
import Link from "next/link";
import { Bell, AlertTriangle, AlertCircle, ShieldAlert, CheckCircle } from "lucide-react";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [allAlertsForStats, setAllAlertsForStats] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 15;
  const [filters, setFilters] = useState({ severity: '', status: '', search: '' });
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);

  // Load stats data once
  useEffect(() => {
    fetchAlerts(false).then(res => setAllAlertsForStats(res.alerts)).catch(console.error);
  }, []);

  // Load paginated table data
  useEffect(() => {
    const unacknowledged_only: boolean | undefined =
      filters.status === 'active' ? true : undefined;

    setLoading(true);
    fetchAlertsPaginated({
      page,
      per_page: perPage,
      severity: filters.severity || undefined,
      unacknowledged_only,
      search: filters.search || undefined,
    }).then(res => {
      let finalItems: Alert[] = res.items;
      if (filters.status === 'acknowledged') {
        finalItems = finalItems.filter((a: Alert) => a.acknowledged_by);
      }
      setAlerts(finalItems);
      setTotal(res.total);
      setLoading(false);
    }).catch((err: unknown) => {
      console.error(err);
      setLoading(false);
    });
  }, [page, filters]);

  const stats = useMemo(() => {
    return {
      total: allAlertsForStats.length,
      unacknowledged: allAlertsForStats.filter((a: Alert) => !a.acknowledged_by).length,
      critical: allAlertsForStats.filter((a: Alert) => a.severity === 'critical').length,
      high: allAlertsForStats.filter((a: Alert) => a.severity === 'high').length,
      watch: allAlertsForStats.filter((a: Alert) => a.severity === 'watch').length,
      acknowledged: allAlertsForStats.filter((a: Alert) => a.acknowledged_by).length,
    };
  }, [allAlertsForStats]);

  const handleAcknowledge = async (alert: Alert) => {
    try {
      await acknowledgeAlert(alert.id, "System User");
      setSelectedAlert(prev => prev?.id === alert.id ? { ...prev, acknowledged_by: "System User", acknowledged_at: new Date().toISOString() } : prev);
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, acknowledged_by: "System User", acknowledged_at: new Date().toISOString() } : a));
      setAllAlertsForStats(prev => prev.map(a => a.id === alert.id ? { ...a, acknowledged_by: "System User", acknowledged_at: new Date().toISOString() } : a));
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolve = async (alert: Alert) => {
    try {
      await resolveAlert(alert.id, "System User");
      // Optionally remove from list or show success
      setSelectedAlert(null);
    } catch (e) {
      console.error(e);
    }
  };

  const filterConfig = [
    {
      key: 'severity',
      label: 'Severity',
      type: 'select' as const,
      options: [
        { value: 'critical', label: 'Critical' },
        { value: 'high', label: 'High' },
        { value: 'watch', label: 'Watch' }
      ],
      value: filters.severity,
      onChange: (val: string) => { setFilters(f => ({ ...f, severity: val })); setPage(1); }
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: [
        { value: 'active', label: 'Active/Unacknowledged' },
        { value: 'acknowledged', label: 'Acknowledged' }
      ],
      value: filters.status,
      onChange: (val: string) => { setFilters(f => ({ ...f, status: val })); setPage(1); }
    },
    {
      key: 'search',
      label: 'Search',
      type: 'search' as const,
      value: filters.search,
      onChange: (val: string) => { setFilters(f => ({ ...f, search: val })); setPage(1); }
    }
  ];

  const columns = [
    {
      key: 'severity',
      label: 'Severity',
      render: (item: Alert) => (
        <div className="flex items-center -ml-4 pl-4 h-full">
          <div className={`absolute left-0 w-1 h-full max-h-12 ${
            item.severity === 'critical' ? 'bg-[#ef4444]' :
            item.severity === 'high' ? 'bg-[#f97316]' :
            item.severity === 'watch' ? 'bg-[#eab308]' : 'bg-gray-500'
          }`} />
          <RiskBadge tier={item.severity as any} size="sm" />
        </div>
      )
    },
    {
      key: 'message',
      label: 'Message',
      render: (item: Alert) => (
        <div className="truncate max-w-[300px]" title={item.message}>
          {item.message}
        </div>
      )
    },
    {
      key: 'event',
      label: 'Related Event',
      render: (item: Alert) => (
        <Link 
          href={`/conjunctions/${item.conjunction_event_id}`}
          className="text-[var(--accent-cyan)] hover:underline font-mono text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {item.conjunction_event_id.substring(0, 8)}...
        </Link>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (item: Alert) => (
        <span className="text-xs text-[var(--text-secondary)]">
          {new Date(item.created_at).toLocaleString()}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: Alert) => (
        <StatusBadge status={item.acknowledged_by ? 'Acknowledged' : 'Active'} />
      )
    },
    {
      key: 'acknowledged_by',
      label: 'Acknowledged By',
      render: (item: Alert) => (
        <span className="text-xs text-[var(--text-secondary)]">
          {item.acknowledged_by || "—"}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: Alert) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {!item.acknowledged_by && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAcknowledge(item); }}
              className="px-2 py-1 bg-[var(--space-card-hover)] hover:bg-[#334155] text-[10px] uppercase font-bold text-[var(--text-primary)] rounded border border-[#334155] transition-colors"
            >
              Acknowledge
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedAlert(item); }}
            className="px-2 py-1 text-[10px] uppercase font-bold text-[var(--accent-cyan)] hover:text-[#5eead4] transition-colors"
          >
            View
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-6 p-2 min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-[var(--text-primary)] text-2xl font-semibold tracking-tight uppercase">Alert & Incident Center</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Total Alerts" value={stats.total} icon={<Bell className="w-5 h-5" />} />
        <MetricCard label="Unacknowledged" value={stats.unacknowledged} variant="warning" icon={<AlertCircle className="w-5 h-5" />} />
        <MetricCard label="Critical" value={stats.critical} variant="critical" icon={<ShieldAlert className="w-5 h-5" />} />
        <MetricCard label="High" value={stats.high} icon={<AlertTriangle className="w-5 h-5" />} />
        <MetricCard label="Watch" value={stats.watch} icon={<AlertCircle className="w-5 h-5" />} />
        <MetricCard label="Acknowledged" value={stats.acknowledged} variant="success" icon={<CheckCircle className="w-5 h-5" />} />
      </div>

      <FilterBar 
        filters={filterConfig} 
        onReset={() => {
          setFilters({ severity: '', status: '', search: '' });
          setPage(1);
        }} 
      />

      <DataTable
        columns={columns}
        data={alerts}
        total={total}
        page={page}
        perPage={perPage}
        onPageChange={setPage}
        loading={loading}
        onRowClick={setSelectedAlert}
        rowKey={(item) => item.id}
      />

      <DetailDrawer
        open={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        title="Alert Details"
      >
        {selectedAlert && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Alert ID</p>
                <p className="font-mono text-sm text-[var(--text-primary)] bg-[var(--space-card)] p-2 rounded border border-[var(--space-border)]">
                  {selectedAlert.id}
                </p>
              </div>
              <RiskBadge tier={selectedAlert.severity as any} size="lg" />
            </div>

            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Message</p>
              <div className="p-3 rounded-md bg-[var(--space-card)] border border-[var(--space-border)] text-[var(--text-primary)] text-sm">
                {selectedAlert.message}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Created At</p>
                <p className="text-sm text-[var(--text-primary)]">{new Date(selectedAlert.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Status</p>
                <StatusBadge status={selectedAlert.acknowledged_by ? 'Acknowledged' : 'Active'} />
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Channels Sent</p>
                <div className="flex gap-1 flex-wrap">
                  {(selectedAlert.channels_sent || 'web').split(',').map(c => (
                    <span key={c} className="px-2 py-0.5 bg-[var(--space-card-hover)] text-[var(--text-secondary)] text-xs rounded uppercase">
                      {c.trim()}
                    </span>
                  ))}
                </div>
              </div>
              {selectedAlert.acknowledged_by && (
                <div>
                  <p className="text-sm text-[var(--text-secondary)] mb-1">Acknowledged By</p>
                  <p className="text-sm text-[var(--text-primary)]">{selectedAlert.acknowledged_by}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {selectedAlert.acknowledged_at ? new Date(selectedAlert.acknowledged_at).toLocaleString() : ''}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Related Event</p>
              <Link 
                href={`/conjunctions/${selectedAlert.conjunction_event_id}`}
                className="inline-flex items-center gap-2 p-3 w-full rounded-md bg-[var(--space-card)] border border-[var(--space-border)] hover:border-[#2dd4bf]/50 transition-colors group"
              >
                <span className="font-mono text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-cyan)] transition-colors">
                  {selectedAlert.conjunction_event_id}
                </span>
                <span className="ml-auto text-xs text-[var(--accent-cyan)]">View Conjunction →</span>
              </Link>
            </div>

            <div className="mt-4 flex flex-col gap-3 pt-6 border-t border-[var(--space-border)]">
              {!selectedAlert.acknowledged_by && (
                <button
                  onClick={() => handleAcknowledge(selectedAlert)}
                  className="w-full py-2 bg-[#2dd4bf]/10 hover:bg-[#2dd4bf]/20 text-[var(--accent-cyan)] border border-[#2dd4bf]/30 rounded-md text-sm font-medium transition-colors"
                >
                  ACKNOWLEDGE
                </button>
              )}
              <button
                onClick={() => handleResolve(selectedAlert)}
                className="w-full py-2 bg-[var(--space-card)] hover:bg-[var(--space-card-hover)] text-[var(--text-primary)] border border-[#334155] rounded-md text-sm font-medium transition-colors"
              >
                RESOLVE
              </button>
              <Link
                href={`/conjunctions/${selectedAlert.conjunction_event_id}`}
                className="w-full py-2 bg-[var(--space-card)] hover:bg-[var(--space-card-hover)] text-[var(--text-primary)] border border-[#334155] rounded-md text-sm font-medium transition-colors text-center"
              >
                VIEW CONJUNCTION
              </Link>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
