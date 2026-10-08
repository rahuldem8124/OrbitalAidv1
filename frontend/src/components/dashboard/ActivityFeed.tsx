"use client";

import { Alert, Maneuver } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { Bell, ShieldAlert, ChevronUp, ChevronDown, Terminal } from "lucide-react";
import { useState, useEffect } from "react";
import HUDContainer from "../ui/HUDContainer";

interface ActivityFeedProps {
  alerts: Alert[];
  maneuvers: Maneuver[];
}

type ActivityItem =
  | { type: "alert"; data: Alert }
  | { type: "maneuver"; data: Maneuver };

export default function ActivityFeed({ alerts, maneuvers }: ActivityFeedProps) {
  const [expanded, setExpanded] = useState(false);
  const [visibleItems, setVisibleItems] = useState<number>(1);

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

  // Typewriter effect for streaming in rows
  useEffect(() => {
    if (visibleItems < activities.length) {
      const timer = setTimeout(() => {
        setVisibleItems(v => v + 1);
      }, Math.random() * 150 + 50); // random interval for terminal feel
      return () => clearTimeout(timer);
    }
  }, [visibleItems, activities.length]);

  const getLogColors = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'text-[var(--tier-critical)] bg-[var(--tier-critical)]/10';
      case 'high': return 'text-[var(--tier-high)] bg-[var(--tier-high)]/10';
      case 'warning': case 'watch': return 'text-[var(--tier-watch)] bg-[var(--tier-watch)]/10';
      default: return 'text-[var(--text-muted)] bg-transparent';
    }
  };

  return (
    <HUDContainer className="flex flex-col h-full" cornerCut={false}>
      {/* Header bar with toggle */}
      <div
        className="flex items-center justify-between px-4 py-1.5 cursor-pointer select-none bg-[#030407] border-b border-[var(--space-border)]"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[var(--accent-cyan)]" />
          <span className="text-[10px] font-mono font-bold text-[var(--accent-cyan)] uppercase tracking-widest">
            TERMINAL STREAM // TELEMETRY LOG
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--text-dim)]">
            [ {alerts.length + maneuvers.length} EVENTS LOGGED ]
          </span>
          {expanded
            ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
            : <ChevronUp className="w-3 h-3 text-[var(--text-muted)]" />
          }
        </div>
      </div>

      {/* Console-style log entries */}
      <div className={`overflow-y-auto p-3 space-y-1 ${expanded ? 'max-h-[280px]' : 'max-h-[140px]'} transition-all duration-300 font-mono text-[10px]`}>
        {activities.slice(0, visibleItems).map((item, idx) => {
          const timestamp = item.type === "alert" ? item.data.created_at : item.data.proposed_at;
          const severity = item.type === "alert" ? item.data.severity : item.data.status;
          const message = item.type === "alert"
            ? item.data.message
            : `Maneuver ${item.data.status.toUpperCase()} — ${item.data.asset?.object_name || 'Unknown'}`;

          const colorClasses = getLogColors(severity);

          return (
            <div key={idx} className={`flex items-start gap-3 py-1 px-2 group border-l-2 border-transparent hover:border-[var(--text-muted)] hover:bg-[var(--space-card-hover)]/30 transition-all ${colorClasses}`}>
              <span className="whitespace-nowrap shrink-0 opacity-70">
                [{timeAgo(timestamp).padStart(12, ' ')}]
              </span>
              <span className="font-bold shrink-0 w-[80px]">
                {severity.toUpperCase()}
              </span>
              <span className="truncate flex-1 tracking-wide opacity-90 group-hover:opacity-100">
                {message}
              </span>
            </div>
          );
        })}
        {visibleItems === activities.length && (
          <div className="flex items-center gap-2 py-1 px-2 text-[var(--accent-cyan)] animate-pulse">
            <span className="w-1.5 h-3 bg-[var(--accent-cyan)]"></span>
            <span>AWAITING SIGNAL...</span>
          </div>
        )}
      </div>
    </HUDContainer>
  );
}