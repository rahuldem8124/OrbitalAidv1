
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Globe,
  AlertTriangle,
  ShieldAlert,
  Satellite,
  Bell,
  BarChart3,
  Layers,
  Database,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/", icon: Home, label: "Dashboard" },
  { href: "/conjunctions", icon: AlertTriangle, label: "Conjunctions" },
  { href: "/maneuvers", icon: ShieldAlert, label: "Maneuvers" },
  { href: "/fleet", icon: Satellite, label: "Fleet" },
  { href: "/alerts", icon: Bell, label: "Alerts" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/simulation", icon: Layers, label: "Simulation" },
  { href: "/data-sources", icon: Database, label: "Data Sources" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-16 h-full bg-[#05070d] border-r border-white/10 flex flex-col items-center py-6 gap-2">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`p-3 rounded-xl transition-all duration-200 ${
              isActive
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
            title={item.label}
          >
            <item.icon className="w-6 h-6" />
          </Link>
        );
      })}
    </div>
  );
}
