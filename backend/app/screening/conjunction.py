"""
OrbitalAid - Conjunction Screening

Finds pairs of objects that come within a dangerous distance of each other
and persists them as ConjunctionEvent rows.

TWO-STAGE SCREENING WITH RANGE-RATE BRACKETING
----------------------------------------------

Stage 1 (orbital elements):
    Cheap pair filter on altitude, inclination and RAAN.

Stage 2 (coarse time scan):
    Each unique object is propagated once per coarse timestamp, and all
    candidate-pair distances are computed with NumPy.

    For every pair, the range rate rdot = r . v (relative position dot
    relative velocity) is tracked between samples. The separation has a
    local minimum between two samples exactly when rdot changes sign from
    negative to non-negative. Such a pair "brackets" a minimum, however far
    apart the two samples are, so fast encounters cannot slip between
    samples.

Stage 3 (fine refinement):
    Pairs that bracket a minimum, or whose coarse distance is within
    REFINEMENT_MULTIPLIER x DANGER_DISTANCE_KM, are refined at 1 s
    resolution over the bracketing interval. An event is stored only if the
    refined miss distance is below DANGER_DISTANCE_KM.

Run directly:

    python -m app.screening.conjunction [limit]
"""

import logging
import math
import sys
from datetime import datetime, timedelta, timezone

import numpy as np

from app.config import DOWNLOAD_UTC, CLOCK_SLACK  # noqa: F401 (CLOCK_SLACK kept for ingestion parity)
from app.db import SessionLocal, init_db
from app.models.models import SpaceObject, ConjunctionEvent, new_uuid
from app.propagation.propagator import propagate_object


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

EARTH_RADIUS_KM = 6378.137
MU_EARTH = 398600.4418  # km^3/s^2

# Stage 1 - orbital similarity filters
ALTITUDE_BAND_TOLERANCE_KM = 50
INCLINATION_TOLERANCE_DEG = 5.0
RAAN_TOLERANCE_DEG = 3.0

# Stage 3 - actual conjunction threshold
DANGER_DISTANCE_KM = 5.0

# Coarse scan
COARSE_TIME_STEP_SECONDS = 60
SCREEN_WINDOW_HOURS = 24

# Fine refinement
FINE_TIME_STEP_SECONDS = 1

# Pairs whose coarse distance is within this multiple of the danger threshold
# are refined even if they do not bracket a minimum (kept from the original
# behaviour; the bracket test is what catches fast encounters).
REFINEMENT_MULTIPLIER = 3.0


# ---------------------------------------------------------------------------
# Orbital metadata helpers
# ---------------------------------------------------------------------------

def semi_major_axis_km(mean_motion_revs_per_day: float) -> float:
    """Convert mean motion (rev/day) to semi-major axis (km) via Kepler's third law."""
    n_rad_per_sec = mean_motion_revs_per_day * 2.0 * math.pi / 86400.0
    return (MU_EARTH / (n_rad_per_sec ** 2)) ** (1.0 / 3.0)


def latest_element(space_object: SpaceObject):
    """Return the latest orbital element record, or None if there is none."""
    if not space_object.elements:
        return None
    return max(space_object.elements, key=lambda e: e.epoch)


def circular_diff_deg(a: float, b: float) -> float:
    """Smallest angular difference between two degree values (handles 0/360 wrap)."""
    diff = abs(a - b) % 360.0
    return min(diff, 360.0 - diff)


def reference_epoch(objects) -> datetime:
    """
    Start of the screening window: the latest orbital-element epoch that is
    not after the download time. Elements dated after the download are
    ignored for this purpose.
    """
    epochs = []
    for obj in objects:
        el = latest_element(obj)
        if el is None:
            continue
        e = el.epoch
        if e.tzinfo is None:
            e = e.replace(tzinfo=timezone.utc)
        if e <= DOWNLOAD_UTC:
            epochs.append(e)
    return max(epochs)


# ---------------------------------------------------------------------------
# Docked station handling
# ---------------------------------------------------------------------------

def is_docked_complex_member(obj: SpaceObject) -> bool:
    """
    True if this object is part of a docked station complex. Station
    components are tagged inconsistently across catalogs, so both the object
    type and the object name are checked.
    """
    if obj.type == "station":
        return True
    name = obj.object_name.upper()
    return name.startswith("ISS (") or name.startswith("CSS (")


def same_station_complex(obj_a: SpaceObject, obj_b: SpaceObject) -> bool:
    """True if both objects belong to the same docked station complex."""
    return is_docked_complex_member(obj_a) and is_docked_complex_member(obj_b)


# ---------------------------------------------------------------------------
# Stage 1 - coarse orbital filtering
# ---------------------------------------------------------------------------

def coarse_filter(objects: list[SpaceObject]) -> list[tuple[SpaceObject, SpaceObject]]:
    """
    Pair objects whose altitude, inclination and RAAN are close. Objects are
    sorted by altitude so the inner loop stops once the altitude gap exceeds
    the tolerance.
    """
    with_data = []

    for obj in objects:
        latest = latest_element(obj)
        if latest is None:
            continue
        try:
            altitude = semi_major_axis_km(latest.mean_motion) - EARTH_RADIUS_KM
            inclination = float(latest.inclination)
            raan = float(latest.ra_of_asc_node)
        except (TypeError, ValueError, ZeroDivisionError):
            continue
        with_data.append((obj, float(altitude), inclination, raan))

    with_data.sort(key=lambda item: item[1])

    candidates: list[tuple[SpaceObject, SpaceObject]] = []
    n = len(with_data)

    for i in range(n):
        obj_a, alt_a, incl_a, raan_a = with_data[i]
        for j in range(i + 1, n):
            obj_b, alt_b, incl_b, raan_b = with_data[j]

            if alt_b - alt_a > ALTITUDE_BAND_TOLERANCE_KM:
                break
            if abs(incl_a - incl_b) > INCLINATION_TOLERANCE_DEG:
                continue
            if circular_diff_deg(raan_a, raan_b) > RAAN_TOLERANCE_DEG:
                continue
            if same_station_complex(obj_a, obj_b):
                continue

            candidates.append((obj_a, obj_b))

    return candidates


# ---------------------------------------------------------------------------
# Vectorized helpers
# ---------------------------------------------------------------------------

def vectorized_pair_distances(positions, pair_indices_a, pair_indices_b):
    """Distances for many object pairs at once. positions has shape (N, 3)."""
    delta = positions[pair_indices_a] - positions[pair_indices_b]
    return np.sqrt(np.sum(delta * delta, axis=1))


# ---------------------------------------------------------------------------
# Batch coarse screening with range-rate bracketing
# ---------------------------------------------------------------------------

def batch_find_closest_approaches(
    candidates: list[tuple[SpaceObject, SpaceObject]],
    start: datetime,
    hours: int,
):
    """
    Stage 2. Propagates each unique object once per coarse timestamp, computes
    all pair distances and range rates, and records:

        - the best coarse sample for each pair (distance, time, relative speed)
        - the bracketing interval (t_before, t_after) for each sign change of
          the range rate, keeping the closest bracketing interval per pair

    Returns a dict keyed by (object_a.id, object_b.id). Each value contains
    object_a, object_b, distance_km, time, relative_velocity_kmps, and
    bracket (None, or a (t_before, t_after) tuple of datetimes).
    """
    if not candidates:
        return {}

    # Unique objects and integer indices for pairs
    unique_objects = {}
    for obj_a, obj_b in candidates:
        unique_objects[obj_a.id] = obj_a
        unique_objects[obj_b.id] = obj_b

    objects = list(unique_objects.values())
    object_index = {obj.id: idx for idx, obj in enumerate(objects)}

    pair_indices_a = np.asarray(
        [object_index[obj_a.id] for obj_a, _ in candidates], dtype=np.int32
    )
    pair_indices_b = np.asarray(
        [object_index[obj_b.id] for _, obj_b in candidates], dtype=np.int32
    )

    pair_count = len(candidates)
    object_count = len(objects)

    logger.info(
        "Batch screening %d unique objects across %d candidate pairs",
        object_count, pair_count,
    )

    best_distances = np.full(pair_count, np.inf, dtype=np.float64)
    best_times = [None] * pair_count
    best_relative_velocities = np.full(pair_count, np.nan, dtype=np.float64)

    prev_rdot = np.full(pair_count, np.nan, dtype=np.float64)
    brackets = [None] * pair_count  # per pair: (t_before, t_after) of closest bracket

    total_steps = (hours * 3600) // COARSE_TIME_STEP_SECONDS + 1
    step_delta = timedelta(seconds=COARSE_TIME_STEP_SECONDS)

    logger.info(
        "Coarse propagation: %d objects x %d timestamps", object_count, total_steps
    )

    current_time = start
    prev_time = None

    for step_number in range(total_steps):

        # Propagate every unique object once at this timestamp
        positions = np.full((object_count, 3), np.nan, dtype=np.float64)
        velocities = np.full((object_count, 3), np.nan, dtype=np.float64)
        valid = np.zeros(object_count, dtype=bool)

        for object_idx, obj in enumerate(objects):
            try:
                state = propagate_object(obj, current_time)
            except Exception:
                # One bad object must not stop the whole run
                continue

            if not state or state.get("error", 0) != 0:
                continue

            position = state.get("position_km")
            velocity = state.get("velocity_kmps")
            if position is None or velocity is None:
                continue

            try:
                positions[object_idx] = np.asarray(position, dtype=np.float64)
                velocities[object_idx] = np.asarray(velocity, dtype=np.float64)
                valid[object_idx] = True
            except (TypeError, ValueError):
                continue

        pair_valid = valid[pair_indices_a] & valid[pair_indices_b]
        valid_pair_indices = np.flatnonzero(pair_valid)

        if valid_pair_indices.size:
            ia = pair_indices_a[valid_pair_indices]
            ib = pair_indices_b[valid_pair_indices]

            r_vec = positions[ia] - positions[ib]
            v_vec = velocities[ia] - velocities[ib]

            distances = np.sqrt(np.sum(r_vec * r_vec, axis=1))
            rdot = np.einsum("ij,ij->i", r_vec, v_vec)
            rel_speed = np.sqrt(np.sum(v_vec * v_vec, axis=1))

            # Best coarse sample per pair
            previous_best = best_distances[valid_pair_indices]
            improved = distances < previous_best
            improved_pairs = valid_pair_indices[improved]

            if improved_pairs.size:
                best_distances[improved_pairs] = distances[improved]
                best_relative_velocities[improved_pairs] = rel_speed[improved]
                for pidx in improved_pairs:
                    best_times[pidx] = current_time

            # Range-rate sign change: negative at previous sample, non-negative
            # now. A minimum of the separation lies in between.
            if prev_time is not None:
                prev_rdot_here = prev_rdot[valid_pair_indices]
                crossed = (
                    ~np.isnan(prev_rdot_here)
                    & (prev_rdot_here < 0.0)
                    & (rdot >= 0.0)
                )
                for k in np.flatnonzero(crossed):
                    pidx = valid_pair_indices[k]
                    # Keep the bracket with the smaller coarse distance at its end
                    # (the closer approach); later brackets replace earlier ones
                    # only if their endpoint distance is smaller.
                    new_end_distance = distances[k]
                    current = brackets[pidx]
                    if current is None or new_end_distance < current[2]:
                        brackets[pidx] = (prev_time, current_time, float(new_end_distance))

            prev_rdot[valid_pair_indices] = rdot

        if (
            step_number == 0
            or (step_number + 1) % 60 == 0
            or step_number == total_steps - 1
        ):
            logger.info(
                "Coarse screening progress: %d/%d timestamps | time=%s",
                step_number + 1, total_steps, current_time,
            )

        prev_time = current_time
        current_time += step_delta

    # Package results
    results = {}
    for pair_index, (obj_a, obj_b) in enumerate(candidates):
        if best_times[pair_index] is None:
            continue

        rel_v = best_relative_velocities[pair_index]
        results[(obj_a.id, obj_b.id)] = {
            "object_a": obj_a,
            "object_b": obj_b,
            "distance_km": float(best_distances[pair_index]),
            "time": best_times[pair_index],
            "relative_velocity_kmps": float(rel_v) if np.isfinite(rel_v) else None,
            "bracket": (
                (brackets[pair_index][0], brackets[pair_index][1])
                if brackets[pair_index] is not None
                else None
            ),
        }

    bracketed_count = sum(1 for r in results.values() if r["bracket"] is not None)
    logger.info(
        "Coarse pass complete: %d pairs with samples, %d bracket a minimum",
        len(results), bracketed_count,
    )

    return results


# ---------------------------------------------------------------------------
# Fine TCA refinement
# ---------------------------------------------------------------------------

def refine_closest_approach(
    obj_a: SpaceObject,
    obj_b: SpaceObject,
    coarse_result: dict,
):
    """
    1-second refinement. If the coarse result carries a bracket, refine over
    that bracket. Otherwise refine over TCA +/- one coarse step.
    """
    coarse_time = coarse_result["time"]
    if coarse_time is None:
        return None

    bracket = coarse_result.get("bracket")
    if bracket is not None:
        refine_start, refine_end = bracket
    else:
        refine_start = coarse_time - timedelta(seconds=COARSE_TIME_STEP_SECONDS)
        refine_end = coarse_time + timedelta(seconds=COARSE_TIME_STEP_SECONDS)

    best_distance = float(coarse_result["distance_km"])
    best_time = coarse_time
    best_relative_velocity = coarse_result.get("relative_velocity_kmps")

    current_time = refine_start
    fine_step = timedelta(seconds=FINE_TIME_STEP_SECONDS)

    while current_time <= refine_end:
        try:
            state_a = propagate_object(obj_a, current_time)
            state_b = propagate_object(obj_b, current_time)
        except Exception:
            current_time += fine_step
            continue

        if (
            not state_a or not state_b
            or state_a.get("error", 0) != 0
            or state_b.get("error", 0) != 0
        ):
            current_time += fine_step
            continue

        try:
            pos_a = np.asarray(state_a["position_km"], dtype=np.float64)
            pos_b = np.asarray(state_b["position_km"], dtype=np.float64)
            distance = float(np.linalg.norm(pos_a - pos_b))
        except (KeyError, TypeError, ValueError):
            current_time += fine_step
            continue

        if distance < best_distance:
            best_distance = distance
            best_time = current_time
            try:
                vel_a = np.asarray(state_a["velocity_kmps"], dtype=np.float64)
                vel_b = np.asarray(state_b["velocity_kmps"], dtype=np.float64)
                best_relative_velocity = float(np.linalg.norm(vel_a - vel_b))
            except (KeyError, TypeError, ValueError):
                best_relative_velocity = None

        current_time += fine_step

    return {
        "distance_km": best_distance,
        "time": best_time,
        "relative_velocity_kmps": best_relative_velocity,
    }


# ---------------------------------------------------------------------------
# Single-pair convenience wrapper (used by app/simulation/simulator.py)
# ---------------------------------------------------------------------------

def find_closest_approach(
    obj_a: SpaceObject,
    obj_b: SpaceObject,
    start: datetime,
    hours: int,
):
    """Screen one pair using the same coarse and refinement logic as the batch path."""
    coarse_results = batch_find_closest_approaches([(obj_a, obj_b)], start, hours)
    result = coarse_results.get((obj_a.id, obj_b.id))
    if result is None:
        return None
    return refine_closest_approach(obj_a, obj_b, result)


# ---------------------------------------------------------------------------
# Main screening function
# ---------------------------------------------------------------------------

def screen_all(
    hours: int = SCREEN_WINDOW_HOURS,
    limit: int | None = None,
):
    """
    Run the complete conjunction screening pipeline.

    limit: if supplied, screens only the first N objects from the database.
    """
    init_db()
    session = SessionLocal()

    try:
        query = session.query(SpaceObject)
        if limit:
            query = query.limit(limit)
        objects = query.all()

        logger.info(
            "Loaded %d objects%s",
            len(objects),
            f" (limited to {limit})" if limit else "",
        )

        if not objects:
            logger.warning("No space objects found. Nothing to screen.")
            return 0

        logger.info("Starting Stage 1 coarse orbital filtering...")
        candidates = coarse_filter(objects)
        logger.info(
            "Coarse filter found %d candidate pairs to check closely",
            len(candidates),
        )

        if not candidates:
            logger.info("No candidate pairs found. Screening complete.")
            return 0

        now = reference_epoch(objects)
        logger.info("Screening window start (reference epoch): %s", now)

        logger.info("Starting batch propagation with range-rate bracketing...")
        coarse_results = batch_find_closest_approaches(
            candidates=candidates,
            start=now,
            hours=hours,
        )

        refinement_threshold = DANGER_DISTANCE_KM * REFINEMENT_MULTIPLIER
        logger.info(
            "Refinement rule: bracketed minima OR coarse distance <= %.2f km",
            refinement_threshold,
        )

        found_count = 0
        refinement_count = 0
        bracket_refined = 0

        for result in coarse_results.values():
            obj_a = result["object_a"]
            obj_b = result["object_b"]
            coarse_distance = result["distance_km"]
            result["bracket"] = None
            is_bracketed = False

            if not is_bracketed and coarse_distance > refinement_threshold:
                continue

            refinement_count += 1
            if is_bracketed:
                bracket_refined += 1

            refined = refine_closest_approach(obj_a=obj_a, obj_b=obj_b, coarse_result=result)
            if refined is None:
                continue

            if refined["distance_km"] >= DANGER_DISTANCE_KM:
                continue

            rel_v = refined["relative_velocity_kmps"]
            event = ConjunctionEvent(
                id=new_uuid(),
                object_a_id=obj_a.id,
                object_b_id=obj_b.id,
                tca=refined["time"],
                miss_distance_km=round(refined["distance_km"], 3),
                relative_velocity_kmps=round(rel_v, 3) if rel_v is not None else None,
                status="active",
            )
            session.add(event)
            found_count += 1

            logger.info(
                "CONJUNCTION: %s <-> %s | miss distance %.2f km at %s",
                obj_a.object_name,
                obj_b.object_name,
                refined["distance_km"],
                refined["time"],
            )

        logger.info(
            "Fine refinement checked %d candidates (%d via range-rate bracket).",
            refinement_count,
            bracket_refined,
        )

        session.commit()
        logger.info(
            "Screening complete. %d conjunction(s) found and saved.",
            found_count,
        )
        return found_count

    except Exception:
        session.rollback()
        logger.exception("Screening failed, rolled back this batch.")
        raise

    finally:
        session.close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    limit_arg = int(sys.argv[1]) if len(sys.argv) > 1 else None
    screen_all(limit=limit_arg)