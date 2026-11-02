"""
Risk Assessment: computes Probability of Collision (Pc) for ConjunctionEvents
and assigns a risk tier (critical / high / watch / low).

IMPORTANT LIMITATION: your source data (CelesTrak-style mean elements) has
no position covariance / uncertainty data — that normally comes from a
Conjunction Data Message (CDM), a separate product from Space-Track/18th SDS
that we don't have. Real Pc calculation (Foster/Akella method) requires it.

Without it, this uses a first-order Gaussian approximation with DEFAULT
uncertainty values assigned by object type (stations are well-tracked =
tight uncertainty, debris is poorly-tracked = loose uncertainty). This
makes the output INDICATIVE, not authoritative — useful for relative
triage (is A riskier than B?) but not a substitute for real CDM-based Pc
in an operational system. Upgrading this later means sourcing actual
covariance data, not more code.

DOCKING / FORMATION-FLYING FIX: intentional servicing/docking operations
(e.g. MEV-2 docking with Intelsat 10-02) previously scored as false-positive
high/critical risk, since they can sit at 0.00 km apart just like a real
collision. Fixed using relative velocity AND miss distance together as the
distinguishing signal — both must be near-EXACT zero. Relative velocity
alone was tried first and overcorrected: satellites in the same
constellation shell naturally share similar velocity (same altitude, same
speed) and can show small-but-nonzero relative velocity (tens of m/s) while
still being two independent objects on a real collision course. True
docking shows near-exact zero on both distance and velocity simultaneously;
constellation proximity does not.

Run directly: python -m app.risk.probability
"""

import logging
import math

from app.db import SessionLocal, init_db
from app.models.models import ConjunctionEvent, RiskAssessment, SpaceObject, new_uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Assumed 1-sigma position uncertainty per object type, in km.
# Stations are actively, precisely tracked; debris is the least well-tracked.
POSITION_UNCERTAINTY_KM = {
    "station": 0.1,
    "satellite": 0.5,
    "debris": 1.5,
}
DEFAULT_UNCERTAINTY_KM = 1.0  # fallback if type is somehow missing

# Assumed physical radius per object type, in km (used to build combined hard-body radius).
HARD_BODY_RADIUS_KM = {
    "station": 0.05,   # ~50m — large structure
    "satellite": 0.005,  # ~5m — rough default, real size varies a lot
    "debris": 0.001,   # ~1m — small fragment default
}
DEFAULT_RADIUS_KM = 0.005

# Risk tier thresholds, aligned with common industry Pc conventions
CRITICAL_PC = 1e-4
HIGH_PC = 1e-5
WATCH_PC = 1e-6

# Below this relative velocity (km/s) AND this miss distance (km), two
# objects are considered physically co-located (docked/formation-flying).
# Both conditions are required together: constellation satellites in the
# same shell can show naturally low relative velocity (tens of m/s) just
# from sharing similar orbits, without being docked — that's real risk,
# not a false positive. True docking shows near-EXACT zero on both axes.
CODOCKED_RELATIVE_VELOCITY_KMPS = 0.001   # 1 m/s
CODOCKED_MISS_DISTANCE_KM = 0.1            # 100 m


def is_likely_docked_or_formation(event: ConjunctionEvent) -> bool:
    """
    True only if both relative velocity AND miss distance are near-exact
    zero — the physical signature of genuine docking/attachment, not just
    two constellation satellites sharing a similar orbital plane.
    """
    if event.relative_velocity_kmps is None:
        return False
    return (
        event.relative_velocity_kmps < CODOCKED_RELATIVE_VELOCITY_KMPS
        and event.miss_distance_km < CODOCKED_MISS_DISTANCE_KM
    )


def compute_pc(miss_distance_km: float, obj_a: SpaceObject, obj_b: SpaceObject) -> float:
    """
    First-order Gaussian approximation of probability of collision:

        Pc ≈ (HBR² / 2σ²) * exp(-d² / 2σ²)

    where HBR = combined hard-body radius, σ = combined position uncertainty
    (circularized, i.e. treating the encounter-plane covariance as a circle
    rather than an ellipse — a simplification made because we don't have
    real covariance shape/orientation data), d = miss distance.

    This is a coarse estimate. Clamped to [0, 1].
    """
    sigma_a = POSITION_UNCERTAINTY_KM.get(obj_a.type, DEFAULT_UNCERTAINTY_KM)
    sigma_b = POSITION_UNCERTAINTY_KM.get(obj_b.type, DEFAULT_UNCERTAINTY_KM)
    combined_sigma = math.sqrt(sigma_a ** 2 + sigma_b ** 2)

    hbr_a = HARD_BODY_RADIUS_KM.get(obj_a.type, DEFAULT_RADIUS_KM)
    hbr_b = HARD_BODY_RADIUS_KM.get(obj_b.type, DEFAULT_RADIUS_KM)
    combined_hbr = hbr_a + hbr_b

    if combined_sigma <= 0:
        return 0.0

    pc = (combined_hbr ** 2 / (2 * combined_sigma ** 2)) * math.exp(
        -(miss_distance_km ** 2) / (2 * combined_sigma ** 2)
    )
    return max(0.0, min(pc, 1.0))


def risk_tier_for_pc(pc: float) -> str:
    if pc >= CRITICAL_PC:
        return "critical"
    if pc >= HIGH_PC:
        return "high"
    if pc >= WATCH_PC:
        return "watch"
    return "low"


def assess_all(status: str = "active"):
    """
    Computes and persists a fresh RiskAssessment for every ConjunctionEvent
    with the given status. Always inserts a new row (rather than overwriting)
    so Pc history over time is preserved for trend analysis later.
    """
    init_db()
    session = SessionLocal()

    events = session.query(ConjunctionEvent).filter_by(status=status).all()
    logger.info(f"Assessing {len(events)} '{status}' conjunction event(s)")

    tier_counts = {"critical": 0, "high": 0, "watch": 0, "low": 0}
    excluded_count = 0

    try:
        for event in events:
            obj_a = event.object_a
            obj_b = event.object_b

            if is_likely_docked_or_formation(event):
                pc = 0.0
                tier = "low"
                method = "excluded_formation_flying"
                excluded_count += 1
                logger.info(
                    f"EXCLUDED (formation/docked): {obj_a.object_name} <-> {obj_b.object_name} | "
                    f"miss distance {event.miss_distance_km:.2f} km | "
                    f"relative velocity {event.relative_velocity_kmps:.4f} km/s"
                )
            else:
                pc = compute_pc(event.miss_distance_km, obj_a, obj_b)
                tier = risk_tier_for_pc(pc)
                method = "approx_gaussian_no_covariance"

                if tier in ("critical", "high"):
                    logger.info(
                        f"{tier.upper()}: {obj_a.object_name} <-> {obj_b.object_name} | "
                        f"miss distance {event.miss_distance_km:.2f} km | Pc={pc:.2e}"
                    )

            tier_counts[tier] += 1

            assessment = RiskAssessment(
                id=new_uuid(),
                conjunction_event_id=event.id,
                pc=pc,
                risk_tier=tier,
                method=method,
            )
            session.add(assessment)

        session.commit()
    except Exception:
        session.rollback()
        logger.exception("Risk assessment failed, rolled back this batch.")
        raise
    finally:
        session.close()

    logger.info(
        f"Done. critical={tier_counts['critical']} high={tier_counts['high']} "
        f"watch={tier_counts['watch']} low={tier_counts['low']} "
        f"(excluded as formation/docked: {excluded_count})"
    )
    return tier_counts


if __name__ == "__main__":
    assess_all()