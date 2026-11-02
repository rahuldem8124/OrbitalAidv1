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
        const typeParam = searchParams.get('type');
        return !typeParam;
      }
      const itemParams = new URLSearchParams(itemQueryStr);
      for (const [key, value] of itemParams.entries()) {
        if (searchParams.get(key) !== value) return false;
      }
      return true;
    } else {
      if (itemPath === '/') return pathname === '/';
      return pathname === itemPath || pathname.startsWith(itemPath + '/');
    }
  };

  return (
    <div
      className={`fixed left-0 top-0 h-full bg-[var(--space-canvas)] border-r border-[var(--space-border)] flex flex-col z-50 transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'}`}
    >
      <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--space-border)] shrink-0 bg-[var(--space-panel)]">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden group">
            <img
              src="/logo.png"
              alt="OrbitalAid Logo"
              className="w-8 h-8 object-contain rounded-xs shrink-0 border border-amber-400/30 group-hover:border-amber-400 transition-colors"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-mono font-bold text-white tracking-widest uppercase leading-tight truncate">
                ORBITALAID
              </span>
              <span className="text-[8px] font-mono font-medium text-amber-400 tracking-wider uppercase leading-tight truncate">
                AEROSPACE C2
              </span>
            </div>
          </Link>
        )}
        {collapsed && (
          <Link href="/" className="mx-auto block" title="OrbitalAid Aerospace">
            <img
              src="/logo.png"
              alt="OrbitalAid Logo"
              className="w-8 h-8 object-contain rounded-xs border border-amber-400/30 hover:border-amber-400 transition-colors"
            />
          </Link>
        )}
        <button
          onClick={toggleCollapse}
          className={`p-1 rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--space-card)] transition-colors ${collapsed ? 'absolute -right-3 bg-[var(--space-panel)] border border-[var(--space-border)]' : ''}`}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-[var(--space-border-bright)] scrollbar-track-transparent">
        {sections.map((section, idx) => (
          <div key={idx} className="mb-6">
            {!collapsed && (
              <div className="px-6 mb-2 text-[9px] font-mono font-bold text-[var(--text-muted)] tracking-widest uppercase">
                {section.title}
              </div>
            )}
            <div className="flex flex-col gap-0.5 px-3">
              {section.items.map((item) => {
                const active = isItemActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-sm transition-all duration-200 group ${
                      active
                        ? "bg-amber-950/20 text-amber-400 font-medium border-l-2 border-amber-400"
                        : "text-zinc-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
                    }`}
                  >
                    <item.icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'group-hover:text-white'}`} />
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
      <div className="fixed left-0 top-0 h-full w-64 bg-[var(--space-canvas)] border-r border-[var(--space-border)] z-50" />
    }>
      <SidebarInner />
    </Suspense>
  );
}