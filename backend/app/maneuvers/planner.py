"""
Maneuver Planning: proposes avoidance maneuvers for your own assets involved
in critical/high risk conjunctions.

LIMITATIONS, stated plainly:
  - "Own asset" targeting relies on SpaceObject.is_own_asset, which defaults
    False for everything ingested (no dataset provides real fleet ownership).
    Until you flag real assets, this proposes maneuvers for any non-debris
    object in a critical/high event as an interim default.
  - Delta-v is computed from real orbital mechanics (a linearized secular
    displacement estimate), but fuel cost requires object mass and thruster
    Isp, which don't exist in the source data — left as None, not guessed.
  - Some 0.00 km "conjunctions" (e.g. MEV-2 docking with Intelsat 10-02) are
    intentional servicing operations, not real collision risk — the system
    can't yet tell the difference, so this may propose nonsensical avoidance
    maneuvers for genuinely docking spacecraft. Known limitation, not fixed.

Delta-v approximation used:
  A small along-track/radial velocity change applied at some lead time
  before TCA grows into a position displacement at TCA, roughly linearly
  for small maneuvers:
      displacement_at_tca ≈ delta_v * lead_time
  So to grow the miss distance from its current (dangerous) value up to a
  target safe distance:
      delta_v ≈ (target_miss_distance - current_miss_distance) / lead_time
  This is a standard simplified estimate for early planning purposes, not
  a substitute for real B-plane targeting in an operational system.

Run directly: python -m app.maneuvers.planner
"""

import logging
from datetime import datetime, timezone

from app.db import SessionLocal, init_db
from app.models.models import ConjunctionEvent, RiskAssessment, Maneuver, SpaceObject, new_uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TARGET_MISS_DISTANCE_KM = 5.0   # safe margin to aim for
MIN_LEAD_TIME_SECONDS = 60       # avoid divide-by-near-zero for events with TCA in the past/imminent


def is_maneuverable(obj: SpaceObject) -> bool:
    """
    Can this object plausibly be maneuvered? Debris never can (no propulsion).
    Interim default: any non-debris object counts, until real is_own_asset
    flags exist — see module docstring.
    """
    if obj.type == "debris":
        return False
    return obj.is_own_asset or True  # TODO: tighten to `obj.is_own_asset` once real fleet data exists


def compute_delta_v(current_miss_distance_km: float, tca: datetime, decision_time: datetime) -> dict:
    """
    Returns required delta-v (m/s) to grow miss distance to TARGET_MISS_DISTANCE_KM,
    and the resulting predicted new miss distance.
    """
    # SQLite doesn't preserve timezone info, so datetimes read back from the
    # database come back naive (no tzinfo) even though they represent UTC.
    # Normalize both sides to naive-UTC before subtracting, since Python
    # refuses to subtract a naive datetime from an aware one.
    if tca.tzinfo is not None:
        tca = tca.replace(tzinfo=None)
    if decision_time.tzinfo is not None:
        decision_time = decision_time.replace(tzinfo=None)

    lead_time_seconds = (tca - decision_time).total_seconds()
    lead_time_seconds = max(lead_time_seconds, MIN_LEAD_TIME_SECONDS)

    distance_gap_km = TARGET_MISS_DISTANCE_KM - current_miss_distance_km

    if distance_gap_km <= 0:
        # Already outside the target safe distance — no maneuver needed.
        return {"delta_v_mps": 0.0, "predicted_new_miss_distance_km": current_miss_distance_km}

    delta_v_kmps = distance_gap_km / lead_time_seconds
    delta_v_mps = delta_v_kmps * 1000

    return {
        "delta_v_mps": round(delta_v_mps, 4),
        "predicted_new_miss_distance_km": round(TARGET_MISS_DISTANCE_KM, 3),
    }


def propose_maneuvers(risk_tiers: tuple = ("critical", "high")):
    """
    For every active ConjunctionEvent whose latest RiskAssessment is in
    risk_tiers, propose a maneuver for whichever involved object is
    maneuverable (see is_maneuverable). If both are maneuverable, proposes
    for both independently — an operator decides which (if either) to
    actually execute.
    """
    init_db()
    session = SessionLocal()
    now = datetime.now(timezone.utc)

    events = (
        session.query(ConjunctionEvent)
        .filter_by(status="active")
        .all()
    )

    proposed_count = 0

    try:
        for event in events:
            if not event.risk_assessments:
                continue

            latest_assessment = max(event.risk_assessments, key=lambda ra: ra.computed_at)
            if latest_assessment.risk_tier not in risk_tiers:
                continue

            for asset in (event.object_a, event.object_b):
                if not is_maneuverable(asset):
                    continue

                # Skip if a maneuver's already been proposed for this asset/event pair
                existing = (
                    session.query(Maneuver)
                    .filter_by(conjunction_event_id=event.id, asset_id=asset.id)
                    .first()
                )
                if existing:
                    continue

                result = compute_delta_v(event.miss_distance_km, event.tca, now)
                if result["delta_v_mps"] == 0.0:
                    continue  # already safe, nothing to propose

                maneuver = Maneuver(
                    id=new_uuid(),
                    conjunction_event_id=event.id,
                    asset_id=asset.id,
                    delta_v_mps=result["delta_v_mps"],
                    predicted_new_miss_distance_km=result["predicted_new_miss_distance_km"],
                    fuel_cost_kg=None,  # not computable without mass + Isp — see module docstring
                    status="proposed",
                )
                session.add(maneuver)
                proposed_count += 1

                logger.info(
                    f"PROPOSED: {asset.object_name} | event {event.object_a.object_name} <-> "
                    f"{event.object_b.object_name} | delta-v {result['delta_v_mps']:.3f} m/s | "
                    f"tier={latest_assessment.risk_tier}"
                )

        session.commit()
    except Exception:
        session.rollback()
        logger.exception("Maneuver proposal failed, rolled back this batch.")
        raise
    finally:
        session.close()

    logger.info(f"Done. {proposed_count} maneuver(s) proposed.")
    return proposed_count


def approve_maneuver(maneuver_id: str, decided_by: str, notes: str | None = None):
    """Approve a proposed maneuver. In a real system this would be role-gated (Approver role only)."""
    session = SessionLocal()
    try:
        maneuver = session.query(Maneuver).filter_by(id=maneuver_id).first()
        if not maneuver:
            raise ValueError(f"No maneuver with id {maneuver_id}")
        maneuver.status = "approved"
        maneuver.decided_by = decided_by
        maneuver.decided_at = datetime.now(timezone.utc)
        maneuver.notes = notes
        session.commit()
        logger.info(f"Maneuver {maneuver_id} approved by {decided_by}")
    finally:
        session.close()


def reject_maneuver(maneuver_id: str, decided_by: str, notes: str | None = None):
    """Reject a proposed maneuver."""
    session = SessionLocal()
    try:
        maneuver = session.query(Maneuver).filter_by(id=maneuver_id).first()
        if not maneuver:
            raise ValueError(f"No maneuver with id {maneuver_id}")
        maneuver.status = "rejected"
        maneuver.decided_by = decided_by
        maneuver.decided_at = datetime.now(timezone.utc)
        maneuver.notes = notes
        session.commit()
        logger.info(f"Maneuver {maneuver_id} rejected by {decided_by}")
    finally:
        session.close()


if __name__ == "__main__":
    propose_maneuvers()