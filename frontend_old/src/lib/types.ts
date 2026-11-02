
export type ObjectType = "satellite" | "station" | "debris";
export type RiskTier = "critical" | "high" | "watch" | "low";
export type AlertSeverity = "critical" | "high" | "watch";
export type ManeuverStatus = "proposed" | "under_review" | "approved" | "executed" | "verified" | "rejected";
export type ConjunctionStatus = "active" | "resolved" | "expired";

export interface SpaceObject {
  id: string;
  norad_cat_id: number;
  object_name: string;
  object_id: string | null;
  type: ObjectType;
  source_file: string;
  is_own_asset: boolean;
}

export interface ConjunctionEvent {
  id: string;
  object_a: SpaceObject;
  object_b: SpaceObject;
  tca: string;
  miss_distance_km: number;
  relative_velocity_kmps: number | null;
  status: ConjunctionStatus;
  risk_tier: RiskTier | null;
  pc: number | null;
  risk_method: string | null;
}

export interface Maneuver {
  id: string;
  conjunction_event_id: string;
  asset: SpaceObject;
  delta_v_mps: number;
  predicted_new_miss_distance_km: number;
  fuel_cost_kg: number | null;
  status: ManeuverStatus;
  proposed_at: string;
  decided_by: string | null;
  decided_at: string | null;
  notes: string | null;
}

export interface Alert {
  id: string;
  conjunction_event_id: string;
  severity: AlertSeverity;
  message: string;
  channels_sent: string | null;
  created_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}

export interface StatsSummary {
  total_objects: number;
  satellites: number;
  stations: number;
  debris: number;
  active_conjunctions: number;
  pending_maneuvers: number;
  unacknowledged_alerts: number;
}
