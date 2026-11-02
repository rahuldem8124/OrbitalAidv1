import {
  SpaceObject,
  ObjectPosition,
  ConjunctionEvent,
  ConjunctionWithDetails,
  Maneuver,
  Alert,
  StatsSummary,
  NewObjectSimulationResult,
  ManeuverSimulationResult,
  ResponseTimeMetrics,
  PaginatedResponse,
  EventLog,
  SystemHealth,
  SystemSettings,
  ConjunctionAnalytics,
  ManeuverAnalytics,
  SearchResults,
} from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function fetchStats(): Promise<StatsSummary> {
  const res = await fetch(`${API_BASE_URL}/stats/summary`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function fetchObjects(
  type?: string,
  limit = 100,
  offset = 0
): Promise<{ total: number; objects: SpaceObject[] }> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  params.set("limit", limit.toString());
  params.set("offset", offset.toString());
  const res = await fetch(`${API_BASE_URL}/objects?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch objects");
  return res.json();
}

export async function fetchObjectPositions(
  type?: string,
  limit = 300,
  at?: string
): Promise<{ total: number; skipped: number; at: string; positions: ObjectPosition[] }> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  params.set("limit", limit.toString());
  if (at) params.set("at", at);
  const res = await fetch(`${API_BASE_URL}/objects/positions?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch object positions");
  return res.json();
}

export async function fetchObject(objectId: string): Promise<SpaceObject> {
  const res = await fetch(`${API_BASE_URL}/objects/${objectId}`);
  if (!res.ok) throw new Error("Failed to fetch object");
  return res.json();
}

export async function fetchConjunctions(
  status = "active",
  riskTier?: string,
  limit = 100
): Promise<{ total: number; conjunctions: ConjunctionEvent[] }> {
  const params = new URLSearchParams();
  params.set("status", status);
  if (riskTier) params.set("risk_tier", riskTier);
  params.set("limit", limit.toString());
  const res = await fetch(`${API_BASE_URL}/conjunctions?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch conjunctions");
  return res.json();
}

export async function fetchConjunction(eventId: string): Promise<ConjunctionEvent> {
  const res = await fetch(`${API_BASE_URL}/conjunctions/${eventId}`);
  if (!res.ok) throw new Error("Failed to fetch conjunction");
  return res.json();
}

export async function fetchManeuvers(status?: string): Promise<{ total: number; maneuvers: Maneuver[] }> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const res = await fetch(`${API_BASE_URL}/maneuvers?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch maneuvers");
  return res.json();
}

export async function approveManeuver(
  maneuverId: string,
  decidedBy: string,
  notes?: string
): Promise<Maneuver> {
  const res = await fetch(`${API_BASE_URL}/maneuvers/${maneuverId}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ decided_by: decidedBy, notes }),
  });
  if (!res.ok) throw new Error("Failed to approve maneuver");
  return res.json();
}

export async function rejectManeuver(
  maneuverId: string,
  decidedBy: string,
  notes?: string
): Promise<Maneuver> {
  const res = await fetch(`${API_BASE_URL}/maneuvers/${maneuverId}/reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ decided_by: decidedBy, notes }),
  });
  if (!res.ok) throw new Error("Failed to reject maneuver");
  return res.json();
}

export async function fetchAlerts(unacknowledgedOnly = false): Promise<{ total: number; alerts: Alert[] }> {
  const params = new URLSearchParams();
  if (unacknowledgedOnly) params.set("unacknowledged_only", "true");
  const res = await fetch(`${API_BASE_URL}/alerts?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch alerts");
  return res.json();
}

export async function acknowledgeAlert(
  alertId: string,
  acknowledgedBy: string
): Promise<Alert> {
  const res = await fetch(`${API_BASE_URL}/alerts/${alertId}/acknowledge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ acknowledged_by: acknowledgedBy }),
  });
  if (!res.ok) throw new Error("Failed to acknowledge alert");
  return res.json();
}

export async function fetchConjunctionExplain(
  eventId: string
): Promise<{ explanation: string }> {
  const res = await fetch(`${API_BASE_URL}/conjunctions/${eventId}/explain`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to fetch explanation");
  return res.json();
}

export async function simulateNewObject(elements: {
  name?: string;
  mean_motion: number;
  eccentricity: number;
  inclination: number;
  ra_of_asc_node: number;
  arg_of_pericenter: number;
  mean_anomaly: number;
  bstar?: number;
}): Promise<NewObjectSimulationResult> {
  const res = await fetch(`${API_BASE_URL}/simulations/new-object`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(elements),
  });
  if (!res.ok) throw new Error("Simulation failed");
  return res.json();
}

export async function simulateManeuver(input: {
  asset_id: string;
  threat_id: string;
  delta_v_mps: number;
}): Promise<ManeuverSimulationResult> {
  const res = await fetch(`${API_BASE_URL}/simulations/maneuver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Maneuver simulation failed");
  return res.json();
}

export async function fetchRiskDistribution(
  status?: string
): Promise<Record<string, number>> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const res = await fetch(`${API_BASE_URL}/analytics/risk-distribution?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch risk distribution");
  return res.json();
}

export async function fetchAltitudeDistribution(
  type?: string
): Promise<{ bins: Record<string, number>; skipped_no_elements: number; total: number }> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  const res = await fetch(`${API_BASE_URL}/analytics/altitude-distribution?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch altitude distribution");
  return res.json();
}

export async function fetchResponseTimes(): Promise<ResponseTimeMetrics> {
  const res = await fetch(`${API_BASE_URL}/analytics/response-times`);
  if (!res.ok) throw new Error("Failed to fetch response times");
  return res.json();
}


export async function fetchConjunctionsPaginated(params: {
  page?: number; per_page?: number; status?: string; risk_tier?: string;
  date_from?: string; date_to?: string; object_id?: string;
  search?: string; sort_by?: string; sort_order?: string;
}): Promise<PaginatedResponse<ConjunctionWithDetails>> {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) p.set(k, String(v));
  });
  const res = await fetch(`${API_BASE_URL}/conjunctions?${p.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch paginated conjunctions");
  return res.json();
}

export async function fetchConjunctionTimeline(eventId: string): Promise<EventLog[]> {
  const res = await fetch(`${API_BASE_URL}/conjunctions/${eventId}/timeline`);
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

export async function fetchAlertsPaginated(params: {
  page?: number; per_page?: number; severity?: string;
  unacknowledged_only?: boolean; search?: string;
}): Promise<PaginatedResponse<Alert>> {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) p.set(k, String(v));
  });
  const res = await fetch(`${API_BASE_URL}/alerts?${p.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch paginated alerts");
  return res.json();
}

export async function fetchAlert(alertId: string): Promise<Alert> {
  const res = await fetch(`${API_BASE_URL}/alerts/${alertId}`);
  if (!res.ok) throw new Error("Failed to fetch alert");
  return res.json();
}

export async function resolveAlert(alertId: string, resolvedBy: string): Promise<Alert> {
  const res = await fetch(`${API_BASE_URL}/alerts/${alertId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolved_by: resolvedBy }),
  });
  if (!res.ok) throw new Error("Failed to resolve alert");
  return res.json();
}

export async function fetchManeuversPaginated(params: {
  page?: number; per_page?: number; status?: string;
}): Promise<PaginatedResponse<Maneuver>> {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) p.set(k, String(v));
  });
  const res = await fetch(`${API_BASE_URL}/maneuvers?${p.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch paginated maneuvers");
  return res.json();
}

export async function fetchManeuver(maneuverId: string): Promise<Maneuver> {
  const res = await fetch(`${API_BASE_URL}/maneuvers/${maneuverId}`);
  if (!res.ok) throw new Error("Failed to fetch maneuver");
  return res.json();
}

export async function updateManeuverStatus(maneuverId: string, status: string, decidedBy: string): Promise<Maneuver> {
  const res = await fetch(`${API_BASE_URL}/maneuvers/${maneuverId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, decided_by: decidedBy }),
  });
  if (!res.ok) throw new Error("Failed to update maneuver status");
  return res.json();
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const res = await fetch(`${API_BASE_URL}/system/health`);
  if (!res.ok) throw new Error("Failed to fetch system health");
  return res.json();
}

export async function fetchSettings(): Promise<SystemSettings> {
  const res = await fetch(`${API_BASE_URL}/system/settings`);
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

export async function updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
  const res = await fetch(`${API_BASE_URL}/system/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Failed to update settings");
  return res.json();
}

export async function fetchConjunctionAnalytics(): Promise<ConjunctionAnalytics> {
  const res = await fetch(`${API_BASE_URL}/analytics/conjunctions`);
  if (!res.ok) throw new Error("Failed to fetch conjunction analytics");
  return res.json();
}

export async function fetchManeuverAnalytics(): Promise<ManeuverAnalytics> {
  const res = await fetch(`${API_BASE_URL}/analytics/maneuvers`);
  if (!res.ok) throw new Error("Failed to fetch maneuver analytics");
  return res.json();
}

export async function globalSearch(query: string): Promise<SearchResults> {
  const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Failed to search");
  return res.json();
}
