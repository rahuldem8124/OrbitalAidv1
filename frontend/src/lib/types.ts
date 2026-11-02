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

export interface ObjectPosition {
  id: string;
  object_name: string;
  type: ObjectType;
  position_km: [number, number, number];
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

export interface SimulationResultItem {
  object_name: string;
  object_type: string;
  miss_distance_km: number;
  tca: string;
  relative_velocity_kmps: number;
  pc: number;
  risk_tier: RiskTier;
}

export interface NewObjectSimulationResult {
  simulated_object: string;
  candidates_checked: number;
  conjunctions_found: number;
  results: SimulationResultItem[];
}

export interface ManeuverSimulationResult {
  asset: string;
  threat: string;
  current_miss_distance_km: number;
  current_pc: number;
  current_risk_tier: RiskTier;
  applied_delta_v_mps: number;
  predicted_new_miss_distance_km: number;
  predicted_new_pc: number;
  predicted_new_risk_tier: RiskTier;
}

export interface ResponseTimeMetrics {
  alert_acknowledgement: {
    count: number;
    avg_seconds: number | null;
    median_seconds: number | null;
  };
  maneuver_decision: {
    count: number;
    avg_seconds: number | null;
    median_seconds: number | null;
  };
}


export type PreventiveAction = 'Continue Monitoring' | 'Enhanced Monitoring' | 'Evaluate Maneuver' | 'Immediate Maneuver Analysis' | 'Assessment Pending';

export interface RiskAssessment {
  id?: string;
}

export interface ConjunctionWithDetails extends ConjunctionEvent {
  risk_assessment: RiskAssessment | null;
  maneuver: Maneuver | null;
  preventive_action: PreventiveAction;
  object_a_name: string;
  object_b_name: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SystemHealth {
  status: string;
  database: string;
  api: string;
  objects_tracked: number;
  conjunctions_active: number;
  risk_assessments: number;
  alerts_active: number;
  maneuvers_pending: number;
  last_screening: string | null;
  last_risk_assessment: string | null;
  data_freshness: string | null;
}

export interface SystemSettings {
  id: number;
  screening_distance_km: number;
  screening_time_window_hours: number;
  auto_screening: boolean;
  screening_frequency_minutes: number;
  data_refresh_interval_minutes: number;
  risk_critical_threshold: number;
  risk_high_threshold: number;
  risk_watch_threshold: number;
  alert_enabled: boolean;
  alert_critical_enabled: boolean;
  alert_high_enabled: boolean;
  alert_watch_enabled: boolean;
  updated_at: string;
}

export interface ConjunctionAnalytics {
  total_conjunctions: number;
  by_risk_tier: Record<string, number>;
  by_status: Record<string, number>;
  upcoming_24h: number;
  upcoming_72h: number;
  maneuver_required: number;
  maneuver_approved: number;
  maneuver_pending: number;
  conjunctions_mitigated: number;
  trend: Array<{ date: string; count: number; critical: number; high: number }>;
}

export interface ManeuverAnalytics {
  total: number;
  by_status: Record<string, number>;
  approval_rate: number;
  avg_delta_v: number;
  avg_risk_reduction: number | null;
  total_mitigated: number;
}

export interface EventLog {
  id: string;
  conjunction_event_id: string | null;
  action: string;
  actor: string;
  timestamp: string;
  details: string | null;
}

export interface SearchResults {
  objects: SpaceObject[];
  conjunctions: ConjunctionEvent[];
  alerts: Alert[];
}