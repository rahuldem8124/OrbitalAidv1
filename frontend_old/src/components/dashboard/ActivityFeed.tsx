
import { Alert, Maneuver } from "@/lib/types";
import GlassPanel from "@/components/ui/GlassPanel";
import Link from "next/link";
import { ArrowUpRight, Bell, ShieldAlert, Clock } from "lucide-react";

interface ActivityFeedProps {
  alerts: Alert[];
  maneuvers: Maneuver[];
}

type ActivityItem = 
  | { type: "alert"; data: Alert }
  | { type: "maneuver"; data: Maneuver };

export default function ActivityFeed({ alerts, maneuvers }: ActivityFeedProps) {
  const activities: ActivityItem[] = [
    ...alerts.map(a => ({ type: "alert", data: a })),
    ...maneuvers.map(m => ({ type: "maneuver", data: m })),
  ].sort((a, b) => {
    const dateA = new Date(a.type === "alert" ? a.data.created_at : a.data.proposed_at);
    const dateB = new Date(b.type === "alert" ? b.data.created_at : b.data.proposed_at);
    return dateB.getTime() - dateA.getTime();
  }).slice(0, 10);

  return (
    <GlassPanel className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Activity Feed</h3>
        <div className="flex gap-2">
          <Link href="/alerts" className="text-cyan-400 text-sm hover:text-cyan-300 flex items-center gap-1">
            Alerts
            <ArrowUpRight className="w-4 h-4" />
          </Link>
          <Link href="/maneuvers" className="text-cyan-400 text-sm hover:text-cyan-300 flex items-center gap-1">
            Maneuvers
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
      <div className="space-y-3 overflow-y-auto flex-1">
        {activities.map((item, idx) => (
          <div key={idx} className="p-3 rounded-lg bg-white/5 border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              {item.type === "alert" ? (
                <Bell className={`w-4 h-4 ${
                  item.data.severity === "critical" ? "text-red-500" :
                  item.data.severity === "high" ? "text-orange-500" : "text-yellow-500"
                }`} />
              ) : (
                <ShieldAlert className="w-4 h-4 text-purple-400" />
              )}
              <p className="text-white/70 text-xs uppercase font-bold">
                {item.type === "alert" ? item.data.severity.toUpperCase() : item.data.status.toUpperCase()}
              </p>
            </div>
            <p className="text-white text-sm mb-1">
              {item.type === "alert" ? item.data.message : `Maneuver for ${item.data.asset.object_name}`}
            </p>
            <div className="flex items-center gap-1 text-xs text-white/40">
              <Clock className="w-3 h-3" />
              <span>
                {new Date(
                  item.type === "alert" ? item.data.created_at : item.data.proposed_at
                ).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
