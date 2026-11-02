
"use client";

import { Bell, Search, User } from "lucide-react";
import { useEffect, useState } from "react";

export default function TopBar() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-16 bg-[#05070d]/90 border-b border-white/10 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">OA</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">OrbitalAid</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-white/60 text-sm font-mono">
          {currentTime.toUTCString()}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search (Cmd+K)..."
            className="w-64 bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
          />
        </div>
        <button className="relative p-2 text-white/60 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <button className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <User className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
