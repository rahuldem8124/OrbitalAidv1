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
    <HUDContainer className="flex flex-col h-full bg-[#05070A]/70 backdrop-blur-md border border-white/10 rounded-md shadow-2xl overflow-hidden" cornerCut={false}>
      {/* Header bar with toggle */}
      <div
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none bg-white/[0.02] border-b border-white/10"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            LIVE TELEMETRY STREAM
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-zinc-500">
            [ {alerts.length + maneuvers.length} EVENTS ]
          </span>
          {expanded
            ? <ChevronDown className="w-3 h-3 text-zinc-400" />
            : <ChevronUp className="w-3 h-3 text-zinc-400" />
          }
        </div>
      </div>

      {/* Console-style log entries */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[9.5px]">
        {activities.slice(0, visibleItems).map((item, idx) => {
          const timestamp = item.type === "alert" ? item.data.created_at : item.data.proposed_at;
          const severity = item.type === "alert" ? item.data.severity : item.data.status;
          const message = item.type === "alert"
            ? item.data.message
            : `Maneuver ${item.data.status.toUpperCase()} — ${item.data.asset?.object_name || 'Unknown'}`;

          const colorClasses = getLogColors(severity);

          return (
            <div key={idx} className={`flex items-start gap-2.5 py-1 px-1.5 group border-l border-white/10 hover:border-cyan-400 hover:bg-white/[0.04] transition-all rounded-xs ${colorClasses}`}>
              <span className="whitespace-nowrap shrink-0 text-zinc-500 text-[8.5px]">
                {timeAgo(timestamp)}
              </span>
              <span className="font-bold shrink-0 text-[8.5px] uppercase">
                [{severity}]
              </span>
              <span className="truncate flex-1 tracking-wide opacity-90 group-hover:opacity-100 text-zinc-200">
                {message}
              </span>
            </div>
          );
        })}
        {visibleItems === activities.length && (
          <div className="flex items-center gap-2 py-1 px-1.5 text-cyan-400 text-[9px] font-mono opacity-80">
            <span className="w-1.5 h-2.5 bg-cyan-400 animate-pulse"></span>
            <span>UPLINK SYNCED // AWAITING SENSOR BURST</span>
          </div>
        )}
      </div>
    </HUDContainer>
  );
}