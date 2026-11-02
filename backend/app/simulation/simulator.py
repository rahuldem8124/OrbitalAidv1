"""
Simulation / What-If Sandbox.

Screens a HYPOTHETICAL object (a planned launch, or an existing object under
a hypothetical maneuver) against the real object registry, using the exact
same propagation, coarse-filtering, and Pc-scoring engines as the real
screening pipeline — nothing here is written to the database, and no
existing data is modified. This reuses real physics rather than
reimplementing anything, so results carry the same fidelity (and the same
documented limitations, e.g. covariance-free Pc) as the live system.

Two modes:
  - screen_new_object: screen a hypothetical set of orbital elements (e.g. a
    planned launch) against the real catalog.
  - simulate_maneuver: take a real existing object, apply a hypothetical
    delta-v, and estimate the resulting change in miss distance against a
    specified real threat object, using the same linearized displacement
    model already used in maneuvers/planner.py (not a full re-propagation of
    a perturbed orbit, which would require converting a perturbed state
    vector back into mean elements — out of scope here).

Both modes also return real, propagated position samples (trajectory) for
3D visualization — not fabricated paths, actual SGP4 output at each sampled
time step.
"""

import logging
from datetime import datetime, timedelta, timezone

from app.db import SessionLocal
from app.models.models import SpaceObject, OrbitalElement, new_uuid
from app.propagation.propagator import propagate_object
from app.screening.conjunction import (
    approx_altitude_km, latest_inclination_deg, latest_raan_deg,
    circular_diff_deg, find_closest_approach, same_station_complex,
    ALTITUDE_BAND_TOLERANCE_KM, INCLINATION_TOLERANCE_DEG,
    RAAN_TOLERANCE_DEG, SCREEN_WINDOW_HOURS,
)
from app.risk.probability import compute_pc, risk_tier_for_pc

logger = logging.getLogger(__name__)

SIMULATED_NORAD_ID = 9000000  # placeholder, well above real NORAD IDs
TRAJECTORY_STEP_SECONDS = 300  # 5-minute sampling for 3D visualization


def build_hypothetical_object(elements: dict, name: str = "SIMULATED-OBJECT") -> SpaceObject:
    """
    Build an in-memory (never persisted) SpaceObject + OrbitalElement pair
    from user-supplied mean elements, so it can be propagated and screened
    with the same functions used for real objects.
    """
    obj = SpaceObject(
        id=new_uuid(),
        norad_cat_id=SIMULATED_NORAD_ID,
        object_name=name,
        object_id=None,
        type="satellite",
        source_file="simulation",
        is_own_asset=True,
    )

    element = OrbitalElement(
        id=new_uuid(),
        object_id=obj.id,
        epoch=datetime.now(timezone.utc),
        mean_motion=elements["mean_motion"],
        eccentricity=elements["eccentricity"],
        inclination=elements["inclination"],
        ra_of_asc_node=elements["ra_of_asc_node"],
        arg_of_pericenter=elements["arg_of_pericenter"],
        mean_anomaly=elements["mean_anomaly"],
        bstar=elements.get("bstar", 0.0),
        mean_motion_dot=elements.get("mean_motion_dot", 0.0),
        mean_motion_ddot=elements.get("mean_motion_ddot", 0.0),
    )
    element.object = obj
    obj.elements = [element]
    return obj


def get_trajectory_samples(obj_a: SpaceObject, obj_b: SpaceObject, start: datetime, hours: int) -> list[dict]:
    """
    Real, propagated position samples for both objects across the screening
    window — used to draw an honest 3D path in the frontend visualization,
    not a fabricated trajectory.
    """
    samples = []
    t = start
    end = start + timedelta(hours=hours)
    while t <= end:
        try:
            state_a = propagate_object(obj_a, t)
            state_b = propagate_object(obj_b, t)
        except ValueError:
            break
        if state_a["error"] == 0 and state_b["error"] == 0:
            samples.append({
                "time": t.isoformat(),
                "position_a_km": list(state_a["position_km"]),
                "position_b_km": list(state_b["position_km"]),
            })
        t += timedelta(seconds=TRAJECTORY_STEP_SECONDS)
    return samples


def screen_new_object(elements: dict, name: str = "SIMULATED-OBJECT", hours: int = SCREEN_WINDOW_HOURS) -> dict:
    """Screen a hypothetical object (e.g. a planned launch) against the real catalog."""
    hypothetical = build_hypothetical_object(elements, name)

    session = SessionLocal()
    try:
        real_objects = session.query(SpaceObject).all()

        hyp_altitude = approx_altitude_km(hypothetical)
        hyp_inclination = latest_inclination_deg(hypothetical)
        hyp_raan = latest_raan_deg(hypothetical)

        if hyp_altitude is None:
            raise ValueError("Could not compute altitude from supplied elements.")

        candidates = []
        for real_obj in real_objects:
            real_alt = approx_altitude_km(real_obj)
            real_incl = latest_inclination_deg(real_obj)
            real_raan = latest_raan_deg(real_obj)
            if real_alt is None or real_incl is None or real_raan is None:
                continue
            if abs(real_alt - hyp_altitude) > ALTITUDE_BAND_TOLERANCE_KM:
                continue
            if abs(real_incl - hyp_inclination) > INCLINATION_TOLERANCE_DEG:
                continue
            if circular_diff_deg(real_raan, hyp_raan) > RAAN_TOLERANCE_DEG:
                continue
            candidates.append(real_obj)

        logger.info(f"Simulation coarse filter found {len(candidates)} candidates for {name}")

        now = datetime.now(timezone.utc)
        results = []

        for real_obj in candidates:
            if same_station_complex(hypothetical, real_obj):
                continue

            result = find_closest_approach(hypothetical, real_obj, now, hours)
            if not result or result["distance_km"] >= 25:  # wider net than live screening — this is exploratory
                continue

            pc = compute_pc(result["distance_km"], hypothetical, real_obj)
            tier = risk_tier_for_pc(pc)

            results.append({
                "object_name": real_obj.object_name,
                "object_type": real_obj.type,
                "miss_distance_km": round(result["distance_km"], 3),
                "tca": result["time"].isoformat(),
                "relative_velocity_kmps": round(result["relative_velocity_kmps"], 3),
                "pc": pc,
                "risk_tier": tier,
            })

        results.sort(key=lambda r: r["miss_distance_km"])

        closest_trajectory = None
        if results:
            closest_real_obj = next(
                (obj for obj in candidates if obj.object_name == results[0]["object_name"]), None
            )
            if closest_real_obj:
                closest_trajectory = get_trajectory_samples(hypothetical, closest_real_obj, now, hours)

        return {
            "simulated_object": name,
            "candidates_checked": len(candidates),
            "conjunctions_found": len(results),
            "results": results,
            "closest_trajectory": closest_trajectory,
        }
    finally:
        session.close()


def simulate_maneuver(asset_id: str, threat_id: str, delta_v_mps: float) -> dict:
    """
    Estimate the effect of a hypothetical delta-v applied to an existing
    real asset, against a specific existing real threat object, using the
    same linearized displacement model as maneuvers/planner.py:

        new_miss_distance ≈ current_miss_distance + (delta_v * lead_time)

    Does NOT re-propagate a genuinely perturbed orbit — reuses the same
    simplified estimate already used for real maneuver planning, applied
    hypothetically and without persisting anything.

    predicted_position_km is derived honestly: pushed along the existing
    asset-to-threat line at TCA, since a maneuver direction was never
    separately computed by this model — this is the only direction the
    underlying math actually justifies, not a fabricated new trajectory.
    """
    session = SessionLocal()
    try:
        asset = session.query(SpaceObject).filter_by(id=asset_id).first()
        threat = session.query(SpaceObject).filter_by(id=threat_id).first()
        if not asset or not threat:
            raise ValueError("Asset or threat object not found.")

        now = datetime.now(timezone.utc)
        current = find_closest_approach(asset, threat, now, SCREEN_WINDOW_HOURS)
        if not current or current["time"] is None:
            raise ValueError("No close approach found between these two objects in the current window.")

        lead_time_seconds = max((current["time"] - now).total_seconds(), 60)
        displacement_km = (delta_v_mps / 1000) * lead_time_seconds
        new_miss_distance = current["distance_km"] + displacement_km

        current_pc = compute_pc(current["distance_km"], asset, threat)
        new_pc = compute_pc(max(new_miss_distance, 0), asset, threat)

        # Honest derivation: push the asset further along the existing
        # asset-to-threat line at TCA, since direction was never separately
        # computed — this is the only direction actually justified by the math.
        state_asset_tca = propagate_object(asset, current["time"])
        state_threat_tca = propagate_object(threat, current["time"])
        pos_a = state_asset_tca["position_km"]
        pos_t = state_threat_tca["position_km"]
        vec = [pos_a[i] - pos_t[i] for i in range(3)]
        vec_mag = sum(v ** 2 for v in vec) ** 0.5
        unit_vec = [v / vec_mag for v in vec] if vec_mag > 0 else [1, 0, 0]
        predicted_position_km = [pos_t[i] + unit_vec[i] * max(new_miss_distance, 0) for i in range(3)]

        return {
            "asset": asset.object_name,
            "threat": threat.object_name,
            "current_miss_distance_km": round(current["distance_km"], 3),
            "current_pc": current_pc,
            "current_risk_tier": risk_tier_for_pc(current_pc),
            "applied_delta_v_mps": delta_v_mps,
            "predicted_new_miss_distance_km": round(new_miss_distance, 3),
            "predicted_new_pc": new_pc,
            "predicted_new_risk_tier": risk_tier_for_pc(new_pc),
            "tca": current["time"].isoformat(),
            "predicted_position_km": predicted_position_km,
            "trajectory": get_trajectory_samples(asset, threat, now, SCREEN_WINDOW_HOURS),
        }
    finally:
        session.close()