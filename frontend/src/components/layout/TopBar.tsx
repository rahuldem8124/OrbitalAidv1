"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SearchBar from "../shared/SearchBar";
import SystemHealthIndicator from "../shared/SystemHealthIndicator";
import { fetchSystemHealth } from "@/lib/api";

export default function TopBar() {
  const [utcStr, setUtcStr] = useState("");
  const [systemStatus, setSystemStatus] = useState<"online" | "degraded" | "offline">("online");
  const [systemLabel, setSystemLabel] = useState("Checking...");
  const pathname = usePathname();
  const router = useRouter();

  // Live UTC clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = now.getUTCHours().toString().padStart(2, "0");
      const mm = now.getUTCMinutes().toString().padStart(2, "0");
      const ss = now.getUTCSeconds().toString().padStart(2, "0");
      const day = now.getUTCDate().toString().padStart(2, "0");
      const month = now.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
      const year = now.getUTCFullYear();
      setUtcStr(`${day} ${month} ${year} · ${hh}:${mm}:${ss} UTC`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch system health to get real status
  useEffect(() => {
    const check = async () => {
      try {
        const h = await fetchSystemHealth();
        const s = h.status?.toLowerCase() ?? "";
        if (s === "operational" || s === "healthy") {
          setSystemStatus("online");
          setSystemLabel("SYSTEM NOMINAL");
        } else if (s === "degraded") {
          setSystemStatus("degraded");
          setSystemLabel("SYSTEM DEGRADED");
        } else {
          setSystemStatus("degraded");
          setSystemLabel("STATUS UNKNOWN");
        }
      } catch {
        setSystemStatus("offline");
        setSystemLabel("BACKEND OFFLINE");
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const getPageTitle = () => {
    if (pathname === "/") return "MISSION CONTROL";
    const segment = pathname.split("/")[1];
    if (!segment) return "";
    return segment
      .split("-")
      .map((w) => w.toUpperCase())
      .join(" ");
  };

  const handleSearch = (q: string) => {
    if (q.trim()) {
      router.push(`/conjunctions?search=${encodeURIComponent(q.trim())}`);
    }
  };

  return (
    <div className="h-14 shrink-0 bg-[var(--space-panel)] border-b border-[var(--space-border)] flex items-center justify-between px-6 z-40">
      <div className="flex items-center gap-4">
        <h1 className="text-[var(--text-primary)] font-mono font-semibold tracking-widest text-sm">{getPageTitle()}</h1>
      </div>

      <div className="flex-1 flex justify-center max-w-xl mx-8">
        <SearchBar onSearch={handleSearch} />
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <SystemHealthIndicator status={systemStatus} label={systemLabel} />
        </div>

        <div className="h-4 w-px bg-[var(--space-border-bright)]" />

        <div className="text-[var(--text-muted)] text-[11px] font-mono tracking-wider text-right whitespace-nowrap min-w-[180px]">
          {utcStr}
        </div>

        <button
          onClick={() => router.push("/alerts")}
          className="relative p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--space-card-hover)] rounded-sm transition-colors"
          title="View active alerts"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[var(--tier-critical)] rounded-full ring-2 ring-[var(--space-panel)]" />
        </button>
      </div>
    </div>
  );
}