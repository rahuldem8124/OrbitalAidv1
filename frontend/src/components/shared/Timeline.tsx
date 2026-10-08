"use client";

import { Clock } from "lucide-react";

interface TimelineEvent {
  action: string;
  actor: string;
  timestamp: string;
  details?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
}

export default function Timeline({ events }: TimelineProps) {
  if (events.length === 0) {
    return <div className="text-sm text-[var(--text-muted)] text-center py-4">No events recorded.</div>;
  }

  return (
    <div className="relative border-l-2 border-[var(--space-border)] ml-3 py-2 space-y-6">
      {events.map((event, idx) => (
        <div key={idx} className="relative pl-6 group">
          <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-[#2dd4bf] ring-4 ring-[#111827] group-hover:scale-125 transition-transform" />
          
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">{event.action}</span>
              <span className="text-xs text-[var(--text-muted)]">by</span>
              <span className="text-xs font-medium text-[var(--text-secondary)]">{event.actor}</span>
            </div>
            
            <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] font-mono-data">
              <Clock className="w-3 h-3" />
              {new Date(event.timestamp).toLocaleString()}
            </div>
            
            {event.details && (
              <div className="mt-2 text-sm text-[var(--text-secondary)] bg-[var(--space-card)] p-3 rounded-md border border-[var(--space-border)]">
                {event.details}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
