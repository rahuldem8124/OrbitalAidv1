"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SearchBar from "../shared/SearchBar";
import SystemHealthIndicator from "../shared/SystemHealthIndicator";
import { fetchSystemHealth } from "@/lib/api";
import MissionBriefingModal from "../dashboard/MissionBriefingModal";

export default function TopBar() {
  const [times, setTimes] = useState({ WDC: "", BER: "", MOS: "", UTC: "" });
  const [systemStatus, setSystemStatus] = useState<"online" | "degraded" | "offline">("online");
  const [systemLabel, setSystemLabel] = useState("Checking...");
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Live clocks
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatTZ = (timeZone: string) => 
        now.toLocaleTimeString('en-US', { timeZone, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      setTimes({
        WDC: formatTZ('America/New_York'),
        BER: formatTZ('Europe/Berlin'),
        MOS: formatTZ('Europe/Moscow'),
        UTC: formatTZ('UTC') + ' Z',
      });
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
    <>
      <div className="flex flex-col shrink-0 z-40 bg-[var(--space-canvas)] relative border-b border-[var(--space-border)]">
        {/* Top Dense Timezone Strip */}
        <div className="h-6 flex items-center justify-between px-4 border-b border-[var(--space-border-bright)]/30 bg-[#030407]">
          <div className="flex items-center gap-4 text-[9px] font-mono text-[var(--text-dim)] tracking-widest">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              DEFCON 5
            </span>
            <span>//</span>
            <span>ORBITAL SURVEILLANCE NET</span>
          </div>
          
          {times.UTC && (
            <div className="flex items-center gap-3 text-[10px] font-mono tracking-wider font-semibold">
              <span className="text-[var(--text-muted)]">WDC: <span className="text-[var(--text-primary)]">{times.WDC}</span></span>
              <span className="text-[var(--space-border-bright)]">|</span>
              <span className="text-[var(--text-muted)]">BER: <span className="text-[var(--text-primary)]">{times.BER}</span></span>
              <span className="text-[var(--space-border-bright)]">|</span>
              <span className="text-[var(--text-muted)]">MOS: <span className="text-[var(--text-primary)]">{times.MOS}</span></span>
              <span className="text-[var(--space-border-bright)]">|</span>
              <span className="text-[var(--accent-cyan)]">UTC: {times.UTC}</span>
            </div>
          )}
        </div>

        {/* Main Nav Bar */}
        <div className="h-12 bg-[var(--space-panel)] flex items-center justify-between px-6 relative overflow-hidden">
          <div className="absolute inset-0 scanline opacity-30 pointer-events-none"></div>
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-2 h-2 border-t-2 border-l-2 border-[var(--accent-cyan)]"></div>
            <h1 className="text-[var(--text-primary)] font-mono font-bold tracking-widest text-sm">{getPageTitle()}</h1>
          </div>

          <div className="flex-1 flex justify-center max-w-xl mx-8 relative z-10">
            <SearchBar onSearch={handleSearch} />
          </div>

          <div className="flex items-center gap-6 relative z-10">
            <button
              onClick={() => setIsBriefingOpen(true)}
              className="px-3 py-1 bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/30 text-[var(--accent-cyan)] text-[9px] font-mono font-bold tracking-widest uppercase hover:bg-[var(--accent-cyan)]/20 transition-colors"
            >
              MISSION BRIEFING
            </button>

            {/* Tracking Progress Bar */}
            <div className="hidden md:flex flex-col gap-1 w-32">
              <div className="flex justify-between text-[8px] font-mono tracking-widest text-[var(--text-muted)]">
                <span>TRACKING</span>
                <span className="text-[var(--accent-amber)]">ACTV</span>
              </div>
              <div className="h-1 w-full bg-[#030407] border border-[var(--space-border-bright)] relative">
                <div className="absolute top-0 left-0 h-full bg-[var(--accent-amber)] w-[85%]"></div>
              </div>
            </div>

            <div className="h-4 w-px bg-[var(--space-border-bright)]" />

            <div className="flex items-center gap-3">
              <SystemHealthIndicator status={systemStatus} label={systemLabel} />
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
      </div>
      <MissionBriefingModal isOpen={isBriefingOpen} onClose={() => setIsBriefingOpen(false)} />
    </>
  );
}