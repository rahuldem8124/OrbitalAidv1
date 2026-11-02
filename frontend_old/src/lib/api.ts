
import {
  SpaceObject,
  ConjunctionEvent,
  Maneuver,
  Alert,
  StatsSummary,
} from "./types";

const API_BASE_URL = "http://localhost:8000";

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
