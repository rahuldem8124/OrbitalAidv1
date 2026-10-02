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
          setSystemLabel("System Operational");
        } else if (s === "degraded") {
          setSystemStatus("degraded");
          setSystemLabel("System Degraded");
        } else {
          setSystemStatus("degraded");
          setSystemLabel("Status Unknown");
        }
      } catch {
        setSystemStatus("offline");
        setSystemLabel("Backend Offline");
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const getPageTitle = () => {
    if (pathname === "/") return "Mission Control";
    const segment = pathname.split("/")[1];
    if (!segment) return "";
    return segment
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const handleSearch = (q: string) => {
    if (q.trim()) {
      router.push(`/conjunctions?search=${encodeURIComponent(q.trim())}`);
    }
  };

  return (
    <div className="h-16 bg-[#111827]/95 backdrop-blur-sm border-b border-[#1e293b] flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <h1 className="text-[#e2e8f0] font-semibold text-lg">{getPageTitle()}</h1>
      </div>

      <div className="flex-1 flex justify-center max-w-xl mx-8">
        <SearchBar onSearch={handleSearch} />
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <SystemHealthIndicator status={systemStatus} label={systemLabel} />
        </div>

        <div className="h-6 w-px bg-[#1e293b]" />

        <div className="text-[#94a3b8] text-xs font-mono tracking-tight text-right whitespace-nowrap min-w-[200px]">
          {utcStr}
        </div>

        <button
          onClick={() => router.push("/alerts")}
          className="relative p-2 text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1a2332] rounded-lg transition-colors"
          title="View active alerts"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ef4444] rounded-full ring-2 ring-[#111827]" />
        </button>
      </div>
    </div>
  );
}