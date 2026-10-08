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
      <div className="flex flex-col shrink-0 z-40 bg-[#05070A]/90 backdrop-blur-md relative border-b border-white/10 shadow-lg">
        {/* Top Dense Timezone Strip */}
        <div className="h-6 flex items-center justify-between px-4 border-b border-white/5 bg-black/40">
          <div className="flex items-center gap-4 text-[9px] font-mono text-zinc-500 tracking-widest">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              DEFCON 5
            </span>
            <span className="text-zinc-700">//</span>
            <span className="text-zinc-400">ORBITAL SURVEILLANCE NET</span>
          </div>
          
          {times.UTC && (
            <div className="flex items-center gap-3 text-[10px] font-mono tracking-wider font-semibold">
              <span className="text-zinc-500">WDC: <span className="text-zinc-200">{times.WDC}</span></span>
              <span className="text-zinc-700">|</span>
              <span className="text-zinc-500">BER: <span className="text-zinc-200">{times.BER}</span></span>
              <span className="text-zinc-700">|</span>
              <span className="text-zinc-500">MOS: <span className="text-zinc-200">{times.MOS}</span></span>
              <span className="text-zinc-700">|</span>
              <span className="text-amber-400 font-bold">UTC: {times.UTC}</span>
            </div>
          )}
        </div>

        {/* Main Nav Bar */}
        <div className="h-12 bg-transparent flex items-center justify-between px-6 relative overflow-hidden">
          <div className="absolute inset-0 scanline opacity-15 pointer-events-none"></div>
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-2 h-2 border-t border-l border-amber-400"></div>
            <h1 className="text-white font-mono font-bold tracking-widest text-sm">{getPageTitle()}</h1>
          </div>

          <div className="flex-1 flex justify-center max-w-xl mx-8 relative z-10">
            <SearchBar onSearch={handleSearch} />
          </div>

          <div className="flex items-center gap-5 relative z-10">
            <button
              onClick={() => setIsBriefingOpen(true)}
              className="px-3 py-1 bg-amber-950/40 border border-amber-500/40 text-amber-300 text-[9px] font-mono font-bold tracking-widest uppercase hover:bg-amber-900/50 hover:border-amber-400 transition-all rounded-xs shadow-sm"
            >
              MISSION BRIEFING
            </button>

            {/* Tracking Progress Bar */}
            <div className="hidden md:flex flex-col gap-1 w-28">
              <div className="flex justify-between text-[8px] font-mono tracking-widest text-zinc-400">
                <span>TRACKING</span>
                <span className="text-amber-400 font-bold">ACTV</span>
              </div>
              <div className="h-1 w-full bg-black/60 border border-white/10 relative rounded-xs overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-amber-400 w-[85%]"></div>
              </div>
            </div>

            <div className="h-4 w-px bg-white/10" />

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