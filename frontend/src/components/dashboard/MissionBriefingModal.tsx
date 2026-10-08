"use client";

import { useEffect, useState } from "react";
import HUDContainer from "../ui/HUDContainer";

interface MissionBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MissionBriefingModal({ isOpen, onClose }: MissionBriefingModalProps) {
  const [stream, setStream] = useState<string[]>([]);
  
  useEffect(() => {
    if (!isOpen) {
      setStream([]);
      return;
    }
    
    const lines = [
      "INITIATING SECURE HANDSHAKE...",
      "UPLINK ESTABLISHED.",
      "DECODING ORBITAL TELEMETRY...",
      "TARGET ACQUIRED: OBJ-7734X",
      "CALCULATING INTERCEPT VECTOR...",
      "WARNING: CRITICAL MISS DISTANCE DETECTED.",
      "RECOMMEND IMMEDIATE EVASION MANEUVER.",
      "AWAITING COMMAND INPUT..."
    ];
    
    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < lines.length) {
        setStream(prev => [...prev, lines[currentLine]]);
        currentLine++;
      } else {
        clearInterval(interval);
      }
    }, 600);
    
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/90 backdrop-blur-md">
      <div className="absolute inset-0 scanline opacity-30 pointer-events-none"></div>
      
      {/* Background Circular Framing */}
      <div className="absolute w-[800px] h-[800px] rounded-full border border-[var(--space-border-bright)]/10 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full border border-[var(--accent-amber)]/5 flex items-center justify-center border-dashed">
          <div className="w-[400px] h-[400px] rounded-full border border-[var(--tier-critical)]/10 animate-[spin_60s_linear_infinite]"></div>
        </div>
        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-[var(--space-border-bright)]/10"></div>
        <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-[var(--space-border-bright)]/10"></div>
      </div>

      <HUDContainer title="MISSION BRIEFING // ANALYSIS" className="w-[800px] h-[500px] flex gap-4 p-4 relative z-10">
        <button 
          onClick={onClose}
          className="absolute -top-3 right-4 px-2 bg-[#000000] text-[10px] font-mono font-bold text-[var(--accent-amber)] tracking-widest uppercase hover:text-white transition-colors border-x border-[var(--space-border-bright)]/30"
        >
          [ CLOSE ]
        </button>

        {/* Left Side: Decoding Process Terminal */}
        <div className="flex-1 border border-[var(--space-border)]/50 bg-[#000000]/60 flex flex-col relative overflow-hidden">
          <div className="absolute inset-0 scanline opacity-20 pointer-events-none"></div>
          <div className="px-3 py-1.5 border-b border-[var(--space-border)]/50 bg-[var(--accent-amber)]/10">
            <span className="text-[9px] font-mono font-bold text-[var(--accent-amber)] tracking-widest uppercase">
              DECODING PROCESS
            </span>
          </div>
          <div className="flex-1 p-4 font-mono text-[11px] text-[var(--accent-amber)] overflow-y-auto space-y-2">
            {stream.map((line, i) => (
              <div key={i} className="flex gap-2 opacity-90">
                <span className="opacity-50">&gt;</span>
                <span className={`${line.includes('WARNING') ? 'text-[var(--tier-critical)]' : ''} typewriter-effect`}>
                  {line}
                </span>
              </div>
            ))}
            {stream.length < 8 && (
              <div className="flex gap-2 opacity-90 animate-pulse">
                <span className="opacity-50">&gt;</span>
                <span className="w-2 h-3 bg-[var(--accent-amber)]"></span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Telemetry Blocks */}
        <div className="w-[300px] flex flex-col gap-3">
          <div className="border border-[var(--space-border)]/50 bg-[#000000]/60 flex flex-col">
            <div className="px-3 py-1.5 border-b border-[var(--space-border)]/50 bg-[var(--accent-amber)]/10">
              <span className="text-[9px] font-mono font-bold text-[var(--accent-amber)] tracking-widest uppercase">
                IP DATA / TELEMETRY
              </span>
            </div>
            <div className="p-3 font-mono text-[10px] space-y-1">
              <div className="flex justify-between border-b border-[var(--space-border)]/30 pb-1">
                <span className="text-[var(--text-muted)]">SOURCE IP</span>
                <span className="text-[var(--text-primary)]">192.168.4.11</span>
              </div>
              <div className="flex justify-between border-b border-[var(--space-border)]/30 pb-1 pt-1">
                <span className="text-[var(--text-muted)]">ENCRYPTION</span>
                <span className="text-[var(--accent-amber)]">AES-256-GCM</span>
              </div>
              <div className="flex justify-between pt-1 text-[#000000] bg-[var(--tier-critical)] font-bold px-1 -mx-1">
                <span>SIGNAL INTEGRITY</span>
                <span>COMPROMISED</span>
              </div>
            </div>
          </div>

          <div className="border border-[var(--space-border)]/50 bg-[#000000]/60 flex flex-col flex-1">
            <div className="px-3 py-1.5 border-b border-[var(--space-border)]/50 bg-[var(--text-muted)]/10">
              <span className="text-[9px] font-mono font-bold text-[var(--text-muted)] tracking-widest uppercase">
                TARGET VECTORS
              </span>
            </div>
            <div className="p-3 font-mono text-[10px] space-y-2">
              <div className="flex flex-col">
                <span className="text-[8px] text-[var(--text-dim)] uppercase">VELOCITY (REL)</span>
                <span className="text-lg font-bold text-[var(--text-primary)] tracking-tighter">14.2 km/s</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] text-[var(--text-dim)] uppercase">IMPACT PROB</span>
                <span className="text-lg font-bold text-[var(--tier-critical)] tracking-tighter">2.4e-3</span>
              </div>
              <div className="mt-3 pt-2 border-t border-[var(--space-border)]/30 flex flex-col items-center justify-center gap-1.5">
                <img
                  src="/logo.png"
                  alt="OrbitalAid"
                  className="w-14 h-14 object-contain rounded-xs border border-amber-400/40 p-0.5"
                />
                <span className="text-[8px] font-mono text-zinc-500 tracking-widest uppercase">ORBITALAID C2</span>
              </div>
            </div>
          </div>
        </div>
      </HUDContainer>
    </div>
  );
}
