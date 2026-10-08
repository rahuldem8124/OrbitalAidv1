"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ResponseTimeMetrics } from "@/lib/types";
import GlassPanel from "@/components/ui/GlassPanel";
import { Clock, TrendingUp } from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  watch: "#eab308",
  low: "#34d399",
  unassessed: "#6b7280",
};

const ALTITUDE_COLOR = "#F59E0B";

interface AnalyticsChartsProps {
  riskDistribution: Record<string, number>;
  altitudeDistribution: {
    bins: Record<string, number>;
    skipped_no_elements: number;
    total: number;
  };
  responseTimes: ResponseTimeMetrics;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function AnalyticsCharts({
  riskDistribution,
  altitudeDistribution,
  responseTimes,
}: AnalyticsChartsProps) {
  const riskData = Object.entries(riskDistribution).map(([tier, count]) => ({
    tier,
    count,
  }));

  const altitudeData = Object.entries(altitudeDistribution.bins).map(
    ([label, count]) => ({
      label,
      count,
    })
  );

  return (
    <div className="space-y-6">
      {/* Risk Distribution */}
      <GlassPanel>
        <h3 className="text-white text-sm font-semibold mb-4">
          Risk Tier Distribution
        </h3>
        {riskData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={riskData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="tier"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(0,0,0,0.8)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {riskData.map((entry) => (
                  <Cell
                    key={entry.tier}
                    fill={TIER_COLORS[entry.tier] ?? "#6b7280"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-white/40 text-center py-8 text-sm">No risk data available.</p>
        )}
      </GlassPanel>

      {/* Altitude Distribution */}
      <GlassPanel>
        <h3 className="text-white text-sm font-semibold mb-4">
          Altitude Distribution
        </h3>
        <p className="text-white/40 text-xs mb-3">
          {altitudeDistribution.total.toLocaleString()} objects tracked
          {altitudeDistribution.skipped_no_elements > 0 &&
            ` · ${altitudeDistribution.skipped_no_elements} skipped (no elements)`}
        </p>
        {altitudeData.some((d) => d.count > 0) ? (
          <ResponsiveContainer width="100%" height={Math.max(200, altitudeData.length * 40)}>
            <BarChart data={altitudeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                type="number"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                dataKey="label"
                type="category"
                width={180}
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(0,0,0,0.8)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Bar dataKey="count" fill={ALTITUDE_COLOR} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-white/40 text-center py-8 text-sm">No altitude data available.</p>
        )}
      </GlassPanel>

      {/* Response Times */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassPanel>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-white text-sm font-semibold">
              Alert Acknowledgement
            </h3>
          </div>
          {responseTimes.alert_acknowledgement.count > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-xs">Average</span>
                <span className="text-amber-400 font-mono text-sm font-semibold">
                  {formatDuration(responseTimes.alert_acknowledgement.avg_seconds)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-xs">Median</span>
                <span className="text-amber-400 font-mono text-sm font-semibold">
                  {formatDuration(responseTimes.alert_acknowledgement.median_seconds)}
                </span>
              </div>
              <p className="text-white/30 text-xs mt-1">
                Based on {responseTimes.alert_acknowledgement.count} acknowledged alerts
              </p>
            </div>
          ) : (
            <p className="text-white/40 text-sm py-4 text-center">No data yet</p>
          )}
        </GlassPanel>

        <GlassPanel>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <h3 className="text-white text-sm font-semibold">
              Maneuver Decision
            </h3>
          </div>
          {responseTimes.maneuver_decision.count > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-xs">Average</span>
                <span className="text-purple-400 font-mono text-sm font-semibold">
                  {formatDuration(responseTimes.maneuver_decision.avg_seconds)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-xs">Median</span>
                <span className="text-purple-400 font-mono text-sm font-semibold">
                  {formatDuration(responseTimes.maneuver_decision.median_seconds)}
                </span>
              </div>
              <p className="text-white/30 text-xs mt-1">
                Based on {responseTimes.maneuver_decision.count} decided maneuvers
              </p>
            </div>
          ) : (
            <p className="text-white/40 text-sm py-4 text-center">No data yet</p>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
