"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import {
  LayoutDashboard,
  Crosshair,
  Bell,
  Satellite,
  CircleDot,
  Database,
  BarChart3,
  FlaskConical,
  Navigation,
  Settings,
  Activity,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface NavItem {
  href: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<{ className?: string; [key: string]: any }>;
  label: string;
  /** If true, both pathname AND search params must match exactly */
  exact: boolean;
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "OVERVIEW",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Mission Control", exact: true },
      { href: "/conjunctions", icon: Crosshair, label: "Conjunctions", exact: false },
      { href: "/alerts", icon: Bell, label: "Alerts", exact: false },
    ]
  },
  {
    title: "SURVEILLANCE",
    items: [
      { href: "/fleet?type=satellite", icon: Satellite, label: "Satellites", exact: true },
      { href: "/fleet?type=debris", icon: CircleDot, label: "Debris", exact: true },
      { href: "/fleet", icon: Database, label: "Fleet Registry", exact: true },
    ]
  },
  {
    title: "ANALYSIS",
    items: [
      { href: "/analytics", icon: BarChart3, label: "Risk Analytics", exact: false },
      { href: "/simulation", icon: FlaskConical, label: "Simulation", exact: false },
    ]
  },
  {
    title: "OPERATIONS",
    items: [
      { href: "/maneuvers", icon: Navigation, label: "Maneuvers", exact: false },
    ]
  },
  {
    title: "SYSTEM",
    items: [
      { href: "/settings", icon: Settings, label: "Settings", exact: false },
      { href: "/system-health", icon: Activity, label: "System Health", exact: false },
    ]
  }
];

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("orbitaid_sidebar_collapsed");
    if (saved) {
      setCollapsed(JSON.parse(saved));
    }
  }, []);

  const toggleCollapse = () => {
    const val = !collapsed;
    setCollapsed(val);
    localStorage.setItem("orbitaid_sidebar_collapsed", JSON.stringify(val));
    window.dispatchEvent(new CustomEvent('sidebarToggle', { detail: val }));
  };

  const isItemActive = (item: NavItem): boolean => {
    const [itemPath, itemQueryStr] = item.href.split('?');

    if (item.exact) {
      if (pathname !== itemPath) return false;
      if (!itemQueryStr) {
        // Exact path match with NO query params — only active when no type param present
        // e.g. /fleet (no ?type=) should NOT match /fleet?type=satellite
        const typeParam = searchParams.get('type');
        // Fleet Registry (no query) is active only when there's no type filter
        return !typeParam;
      }
      // Has query params — check all of them match
      const itemParams = new URLSearchParams(itemQueryStr);
      for (const [key, value] of itemParams.entries()) {
        if (searchParams.get(key) !== value) return false;
      }
      return true;
    } else {
      // Prefix match — for non-exact routes like /conjunctions, /analytics, etc.
      if (itemPath === '/') return pathname === '/';
      return pathname === itemPath || pathname.startsWith(itemPath + '/');
    }
  };

  return (
    <div
      className={`fixed left-0 top-0 h-full bg-[#0a0e17] border-r border-[#1e293b] flex flex-col z-50 transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'}`}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#1e293b] shrink-0">
        {!collapsed && (
          <span className="text-xl font-bold text-[#e2e8f0] tracking-tight flex items-center gap-2">
            <Activity className="text-[#2dd4bf] w-5 h-5" />
            OrbitAid
          </span>
        )}
        {collapsed && (
          <Activity className="text-[#2dd4bf] w-6 h-6 mx-auto" />
        )}
        <button
          onClick={toggleCollapse}
          className={`p-1.5 rounded-lg text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#1e293b] transition-colors ${collapsed ? 'absolute -right-3 bg-[#111827] border border-[#1e293b]' : ''}`}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-[#1e293b] scrollbar-track-transparent">
        {sections.map((section, idx) => (
          <div key={idx} className="mb-6">
            {!collapsed && (
              <div className="px-6 mb-2 text-[10px] font-bold text-[#64748b] tracking-wider uppercase">
                {section.title}
              </div>
            )}
            <div className="flex flex-col gap-1 px-3">
              {section.items.map((item) => {
                const active = isItemActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                      active
                        ? "bg-[#2dd4bf]/10 text-[#2dd4bf] font-medium"
                        : "text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1a2332]"
                    }`}
                  >
                    <item.icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#2dd4bf]' : 'group-hover:text-[#e2e8f0]'}`} />
                    {!collapsed && (
                      <span className="text-sm truncate">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar() {
  return (
    <Suspense fallback={
      <div className="fixed left-0 top-0 h-full w-64 bg-[#0a0e17] border-r border-[#1e293b] z-50" />
    }>
      <SidebarInner />
    </Suspense>
  );
}