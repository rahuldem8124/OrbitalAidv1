/**
 * Centralized time utilities for OrbitAid.
 * All date/time operations must go through this module.
 * Policy: everything displayed in UTC, ISO-8601 stored internally.
 */

/**
 * Format an ISO timestamp as "26 SEP 2026 · 15:32 UTC"
 */
export function formatUTC(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "INVALID DATE";
    const day = d.getUTCDate().toString().padStart(2, "0");
    const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
    const year = d.getUTCFullYear();
    const hh = d.getUTCHours().toString().padStart(2, "0");
    const mm = d.getUTCMinutes().toString().padStart(2, "0");
    return `${day} ${month} ${year} · ${hh}:${mm} UTC`;
  } catch {
    return "—";
  }
}

/**
 * Format an ISO timestamp as compact "26 SEP · 15:32 UTC"
 */
export function formatUTCCompact(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "INVALID DATE";
    const day = d.getUTCDate().toString().padStart(2, "0");
    const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
    const hh = d.getUTCHours().toString().padStart(2, "0");
    const mm = d.getUTCMinutes().toString().padStart(2, "0");
    return `${day} ${month} · ${hh}:${mm} UTC`;
  } catch {
    return "—";
  }
}

/**
 * Format date only: "26 SEP 2026"
 */
export function formatUTCDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "INVALID DATE";
    const day = d.getUTCDate().toString().padStart(2, "0");
    const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
    const year = d.getUTCFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return "—";
  }
}

/**
 * Format time only: "15:32:09 UTC"
 */
export function formatUTCTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "INVALID";
    const hh = d.getUTCHours().toString().padStart(2, "0");
    const mm = d.getUTCMinutes().toString().padStart(2, "0");
    const ss = d.getUTCSeconds().toString().padStart(2, "0");
    return `${hh}:${mm}:${ss} UTC`;
  } catch {
    return "—";
  }
}

export type TCAStatus =
  | { type: "upcoming"; label: string; suffix: string; isUrgent: boolean }
  | { type: "passed"; label: string; suffix: string }
  | { type: "unknown" };

/**
 * Returns a structured TCA status for display.
 * Examples:
 *   upcoming: { label: "T−02h 14m", isUrgent: true }
 *   passed:   { label: "TCA PASSED", suffix: "+03h 18m ago" }
 */
export function getTCAStatus(tcaIso: string | null | undefined): TCAStatus {
  if (!tcaIso) return { type: "unknown" };
  try {
    const tca = new Date(tcaIso);
    if (isNaN(tca.getTime())) return { type: "unknown" };
    const now = new Date();
    const diffMs = tca.getTime() - now.getTime();

    if (diffMs > 0) {
      // Upcoming
      const totalSecs = Math.floor(diffMs / 1000);
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;
      let label: string;
      if (h > 0) {
        label = `T−${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m`;
      } else if (m > 0) {
        label = `T−${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
      } else {
        label = `T−${s.toString().padStart(2, "0")}s`;
      }
      return { type: "upcoming", label, suffix: "", isUrgent: diffMs < 3600_000 };
    } else {
      // Passed
      const totalSecs = Math.floor(-diffMs / 1000);
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      let suffix: string;
      if (h > 0) {
        suffix = `+${h}h ${m}m ago`;
      } else {
        suffix = `+${m}m ago`;
      }
      return { type: "passed", label: "TCA PASSED", suffix };
    }
  } catch {
    return { type: "unknown" };
  }
}

/**
 * Returns a live TCA countdown string, updating every second.
 * Use within a useEffect with setInterval(1000).
 */
export function computeTCACountdown(tcaIso: string | null | undefined): string {
  const status = getTCAStatus(tcaIso);
  if (status.type === "unknown") return "—";
  if (status.type === "passed") return status.suffix ? `${status.label} (${status.suffix})` : status.label;
  return status.label;
}

/**
 * Relative time: "3 hours ago", "just now", etc.
 */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const diffSecs = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSecs < 60) return "just now";
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    return `${Math.floor(diffSecs / 86400)}d ago`;
  } catch {
    return "—";
  }
}

/**
 * Format a distance value safely. Returns "N/A" for null, undefined, or zero.
 */
export function formatDistance(km: number | null | undefined): string {
  if (km == null) return "N/A";
  if (km === 0) return "N/A";
  if (km < 0.001) return `${(km * 1000).toFixed(3)} m`;
  if (km < 1) return `${km.toFixed(4)} km`;
  return `${km.toFixed(3)} km`;
}

/**
 * Format velocity safely. Returns "N/A" for null, undefined, or zero.
 */
export function formatVelocity(kmps: number | null | undefined): string {
  if (kmps == null) return "N/A";
  if (kmps === 0) return "N/A";
  return `${kmps.toFixed(3)} km/s`;
}

/**
 * Format probability of collision (Pc) as a readable scientific notation string.
 */
export function formatPc(pc: number | null | undefined): string {
  if (pc == null) return "N/A";
  if (pc === 0) return "< 1×10⁻¹²";
  if (pc < 1e-9) return pc.toExponential(2).replace("e-", "×10⁻").replace("e+", "×10⁺");
  if (pc < 1e-6) return pc.toExponential(2).replace("e-", "×10⁻");
  return `${(pc * 100).toFixed(4)}%`;
}
