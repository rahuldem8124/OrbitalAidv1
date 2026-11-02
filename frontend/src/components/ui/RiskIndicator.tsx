
import { AlertTriangle, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { RiskTier } from "@/lib/types";

interface RiskIndicatorProps {
  tier: RiskTier;
  showLabel?: boolean;
}

export default function RiskIndicator({ tier, showLabel = true }: RiskIndicatorProps) {
  const config = {
    critical: {
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
      label: "CRITICAL",
    },
    high: {
      icon: AlertTriangle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/30",
      label: "HIGH",
    },
    watch: {
      icon: AlertCircle,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30",
      label: "WATCH",
    },
    low: {
      icon: CheckCircle,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
      borderColor: "border-emerald-400/30",
      label: "LOW",
    },
  }[tier];

  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${config.bgColor} border ${config.borderColor}`}>
      <Icon className={`w-4 h-4 ${config.color}`} />
      {showLabel && (
        <span className={`text-xs font-bold ${config.color} font-mono`}>{config.label}</span>
      )}
    </div>
  );
}
