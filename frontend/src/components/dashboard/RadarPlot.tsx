"use client";

import { useMemo } from "react";

interface RadarPlotProps {
  azimuthStart?: number;
  azimuthEnd?: number;
  elevationStart?: number;
  elevationEnd?: number;
  size?: number;
}

export default function RadarPlot({
  azimuthStart = 45,
  azimuthEnd = 135,
  elevationStart = 30,
  elevationEnd = 10,
  size = 200
}: RadarPlotProps) {
  const center = size / 2;
  const radius = (size / 2) - 20;

  // Generate grid circles
  const circles = [0.33, 0.66, 1].map((r) => radius * r);
  
  // Generate spoke lines every 45 degrees
  const spokes = Array.from({ length: 8 }).map((_, i) => {
    const angle = (i * 45 * Math.PI) / 180;
    return {
      x2: center + radius * Math.cos(angle),
      y2: center + radius * Math.sin(angle),
    };
  });

  // Convert polar to cartesian for plotting trajectory
  const polarToCartesian = (az: number, el: number) => {
    // Elevation maps to distance from center (90 deg = center, 0 deg = edge)
    const r = radius * (1 - el / 90);
    const theta = ((az - 90) * Math.PI) / 180; // -90 so 0 is at top
    return {
      x: center + r * Math.cos(theta),
      y: center + r * Math.sin(theta),
    };
  };

  const startPt = polarToCartesian(azimuthStart, elevationStart);
  const endPt = polarToCartesian(azimuthEnd, elevationEnd);

  return (
    <div className="relative inline-flex items-center justify-center bg-[#000000]/40 border border-[var(--space-border-bright)]/30 rounded-sm p-2">
      {/* Corner brackets */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[var(--text-muted)] opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[var(--text-muted)] opacity-50"></div>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>
        
        {/* Radar Background Glow */}
        <circle cx={center} cy={center} r={radius} fill="url(#radar-glow)" />

        {/* Grid Circles */}
        {circles.map((r, i) => (
          <circle key={i} cx={center} cy={center} r={r} fill="none" stroke="var(--space-border-bright)" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
        ))}

        {/* Spokes */}
        {spokes.map((spoke, i) => (
          <line key={i} x1={center} y1={center} x2={spoke.x2} y2={spoke.y2} stroke="var(--space-border-bright)" strokeWidth="1" opacity="0.3" />
        ))}
        
        {/* Crosshair at center */}
        <path d={`M ${center - 5} ${center} H ${center + 5} M ${center} ${center - 5} V ${center + 5}`} stroke="var(--accent-cyan)" strokeWidth="1" />

        {/* Trajectory Line */}
        <path
          d={`M ${startPt.x} ${startPt.y} Q ${center} ${center} ${endPt.x} ${endPt.y}`}
          fill="none"
          stroke="var(--tier-critical)"
          strokeWidth="1.5"
          strokeDasharray="4,4"
        />

        {/* Primary Target (Center) */}
        <circle cx={center} cy={center} r={3} fill="var(--accent-cyan)" />
        <circle cx={center} cy={center} r={6} fill="none" stroke="var(--accent-cyan)" strokeWidth="1" opacity="0.5">
          <animate attributeName="r" values="3;10" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Secondary Target (End point) */}
        <circle cx={endPt.x} cy={endPt.y} r={3} fill="var(--tier-critical)" />
        <path d={`M ${endPt.x - 4} ${endPt.y - 4} L ${endPt.x + 4} ${endPt.y + 4} M ${endPt.x + 4} ${endPt.y - 4} L ${endPt.x - 4} ${endPt.y + 4}`} stroke="var(--tier-critical)" strokeWidth="1" />
        
        {/* Azimuth Labels */}
        <text x={center} y={center - radius - 5} fill="var(--text-dim)" fontSize="8" fontFamily="monospace" textAnchor="middle">0°</text>
        <text x={center + radius + 10} y={center + 3} fill="var(--text-dim)" fontSize="8" fontFamily="monospace" textAnchor="middle">90°</text>
        <text x={center} y={center + radius + 10} fill="var(--text-dim)" fontSize="8" fontFamily="monospace" textAnchor="middle">180°</text>
        <text x={center - radius - 12} y={center + 3} fill="var(--text-dim)" fontSize="8" fontFamily="monospace" textAnchor="middle">270°</text>
      </svg>
      
      {/* HUD overlay labels */}
      <div className="absolute top-1 left-1 text-[8px] font-mono text-[var(--accent-cyan)] tracking-widest uppercase">POLAR</div>
      <div className="absolute bottom-1 right-1 text-[8px] font-mono text-[var(--tier-critical)] tracking-widest uppercase animate-pulse">TRK-LOCK</div>
    </div>
  );
}
