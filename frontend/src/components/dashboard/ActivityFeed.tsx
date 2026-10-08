"use client";

import { Alert, Maneuver } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { Bell, ShieldAlert, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";

interface ActivityFeedProps {
  alerts: Alert[];
  maneuvers: Maneuver[];
}

type ActivityItem =
  | { type: "alert"; data: Alert }
  | { type: "maneuver"; data: Maneuver };

export default function ActivityFeed({ alerts, maneuvers }: ActivityFeedProps) {
  const [expanded, setExpanded] = useState(false);

  const activities: ActivityItem[] = [
    ...alerts.map((a): ActivityItem => ({ type: "alert", data: a })),
    ...maneuvers.map((m): ActivityItem => ({ type: "maneuver", data: m })),
  ]
    .sort((a, b) => {
      const dateA = new Date(a.type === "alert" ? a.data.created_at : a.data.proposed_at);
      const dateB = new Date(b.type === "alert" ? b.data.created_at : b.data.proposed_at);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, expanded ? 20 : 6);

  const severityDot = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-[var(--tier-critical)]';
      case 'high': return 'bg-[var(--tier-high)]';
      case 'warning': case 'watch': return 'bg-[var(--tier-watch)]';
      default: return 'bg-[var(--text-dim)]';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--space-panel)]/90 backdrop-blur-md border-t border-[var(--space-border)]">
      {/* Header bar with toggle */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer select-none hover:bg-[var(--space-card-hover)]/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-[10px] font-mono font-semibold text-[var(--accent-amber)] uppercase tracking-widest">
          TELEMETRY LOG
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--text-dim)]">
            {alerts.length + maneuvers.length} events
          </span>
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            : <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          }
        </div>
      </div>

      {/* Console-style log entries */}
      <div className={`overflow-y-auto px-4 pb-2 space-y-0.5 ${expanded ? 'max-h-[280px]' : 'max-h-[140px]'} transition-all duration-200`}>
        {activities.map((item, idx) => {
          const timestamp = item.type === "alert" ? item.data.created_at : item.data.proposed_at;
          const severity = item.type === "alert" ? item.data.severity : item.data.status;
          const Icon = item.type === "alert" ? Bell : ShieldAlert;
          const message = item.type === "alert"
            ? item.data.message
            : `Maneuver ${item.data.status.toUpperCase()} — ${item.data.asset?.object_name || 'Unknown'}`;

          return (
            <div key={idx} className="flex items-start gap-2 py-1 text-[11px] font-mono leading-tight group">
              <span className="text-[var(--text-dim)] whitespace-nowrap shrink-0">
                {timeAgo(timestamp)}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${severityDot(severity)}`}></span>
              <Icon className="w-3 h-3 mt-0.5 shrink-0 text-[var(--text-muted)]" />
              <span className="text-[var(--text-secondary)] truncate group-hover:text-[var(--text-primary)] transition-colors">
                {message}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}