
"""
OrbitalAid - Fast Conjunction Screening

Finds pairs of objects that come within a dangerous distance of each other
and persists them as ConjunctionEvent rows.

OPTIMIZED TWO-STAGE SCREENING
-----------------------------

Stage 1:
    Fast orbital-element filtering using:
        - altitude
        - inclination
        - RAAN

Stage 2:
    Instead of propagating BOTH objects separately for EVERY candidate pair,
    this version propagates each relevant object ONCE per coarse timestamp.

    The resulting positions/velocities are stored in NumPy arrays and all
    candidate-pair distances are calculated simultaneously.

Stage 3:
    Only candidate pairs whose coarse minimum distance is close to the danger
    threshold are refined using 1-second propagation around the approximate TCA.

This avoids the old pattern:

    candidate pair
        -> propagate A 1441 times
        -> propagate B 1441 times
        -> next pair
        -> propagate A AGAIN
        -> propagate B AGAIN
        -> ...

For a large catalog this was the primary performance bottleneck.

Run directly:

    python -m app.screening.conjunction [limit]

Examples:

    python -m app.screening.conjunction 8000
    python -m app.screening.conjunction 15000
    python -m app.screening.conjunction
"""

import logging
import math
import sys
from datetime import datetime, timedelta, timezone

import numpy as np

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

# Stage 2 - actual conjunction threshold
DANGER_DISTANCE_KM = 5.0

# Coarse scan
COARSE_TIME_STEP_SECONDS = 60
SCREEN_WINDOW_HOURS = 24

# Fine refinement
FINE_TIME_STEP_SECONDS = 1

# A pair is sent to fine refinement when its coarse result is within this
# multiple of the danger threshold.
#
# Existing behavior was:
#
#     best_distance < DANGER_DISTANCE_KM * 3
#
# so this preserves that behavior.
REFINEMENT_MULTIPLIER = 3.0


# ---------------------------------------------------------------------------
# Orbital metadata helpers
# ---------------------------------------------------------------------------

def semi_major_axis_km(mean_motion_revs_per_day: float) -> float:
    """
    Convert mean motion in revolutions/day to semi-major axis in km.

    Uses Kepler's third law.
    """
    n_rad_per_sec = (
        mean_motion_revs_per_day
        * 2.0
        * math.pi
        / 86400.0
    )

    return (MU_EARTH / (n_rad_per_sec ** 2)) ** (1.0 / 3.0)


def latest_element(space_object: SpaceObject):
    """
    Return the latest orbital element record.

    Objects without orbital elements return None.
    """
    if not space_object.elements:
        return None

    return max(space_object.elements, key=lambda e: e.epoch)


def approx_altitude_km(space_object: SpaceObject) -> float | None:
    """
    Rough altitude estimate from the latest orbital element.

    Used only for Stage 1 filtering.
    """
    latest = latest_element(space_object)

    if latest is None:
        return None

    a = semi_major_axis_km(latest.mean_motion)

    return a - EARTH_RADIUS_KM


def latest_inclination_deg(space_object: SpaceObject) -> float | None:
    """
    Latest orbital inclination in degrees.
    """
    latest = latest_element(space_object)

    if latest is None:
        return None

    return latest.inclination


def latest_raan_deg(space_object: SpaceObject) -> float | None:
    """
    Latest RAAN in degrees.
    """
    latest = latest_element(space_object)

    if latest is None:
        return None

    return latest.ra_of_asc_node


def circular_diff_deg(a: float, b: float) -> float:
    """
    Smallest angular difference between two degree values.

    Correctly handles the 0/360 degree wraparound.
    """
    diff = abs(a - b) % 360.0

    return min(diff, 360.0 - diff)


def reference_epoch(objects) -> datetime:
    """
    Start of the screening window: the latest orbital-element epoch in the
    catalog. Objects are then propagated at most about a month from their
    own epoch, instead of months beyond it.
    """
    epochs = []
    for obj in objects:
        el = latest_element(obj)
        if el is not None:
            e = el.epoch
            epochs.append(e.replace(tzinfo=timezone.utc) if e.tzinfo is None else e)
    return max(epochs)


# ---------------------------------------------------------------------------
# Docked station handling
# ---------------------------------------------------------------------------

def is_docked_complex_member(obj: SpaceObject) -> bool:
    """
    True if this object is part of a docked station complex.

    Some station components are tagged as satellites while others are tagged
    as stations, so both the object type and object name are checked.
    """
    if obj.type == "station":
        return True

    name = obj.object_name.upper()

    return (
        name.startswith("ISS (")
        or name.startswith("CSS (")
    )


def same_station_complex(
    obj_a: SpaceObject,
    obj_b: SpaceObject,
) -> bool:
    """
    True if both objects belong to the same docked station complex.

    Such objects share orbital elements while attached and therefore should
    not be treated as independent collision risks.
    """
    return (
        is_docked_complex_member(obj_a)
        and is_docked_complex_member(obj_b)
    )


# ---------------------------------------------------------------------------
# Stage 1 - coarse orbital filtering
# ---------------------------------------------------------------------------

def coarse_filter(
    objects: list[SpaceObject],
) -> list[tuple[SpaceObject, SpaceObject]]:
    """
    Stage 1:

    Pair objects whose:
        - altitude is close
        - inclination is close
        - RAAN is close

    Objects are sorted by altitude so the inner loop can stop as soon as the
    altitude difference exceeds the allowed range.
    """

    with_data = []

    for obj in objects:
        latest = latest_element(obj)

        if latest is None:
            continue

        try:
            altitude = (
                semi_major_axis_km(latest.mean_motion)
                - EARTH_RADIUS_KM
            )

            inclination = latest.inclination
            raan = latest.ra_of_asc_node

        except (TypeError, ValueError, ZeroDivisionError):
            continue

        if altitude is None or inclination is None or raan is None:
            continue

        with_data.append(
            (
                obj,
                float(altitude),
                float(inclination),
                float(raan),
            )
        )

    # Sort by altitude.
    with_data.sort(key=lambda item: item[1])

    candidates: list[tuple[SpaceObject, SpaceObject]] = []

    n = len(with_data)

    for i in range(n):
        obj_a, alt_a, incl_a, raan_a = with_data[i]

        for j in range(i + 1, n):
            obj_b, alt_b, incl_b, raan_b = with_data[j]

            # Because the list is altitude sorted, everything after this
            # point will also be outside the altitude range.
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
# Vectorized distance calculation
# ---------------------------------------------------------------------------

def vectorized_pair_distances(
    positions: np.ndarray,
    pair_indices_a: np.ndarray,
    pair_indices_b: np.ndarray,
) -> np.ndarray:
    """
    Calculate distances for many object pairs simultaneously.

    positions:
        shape = (N, 3)

    pair_indices_a:
        shape = (P,)

    pair_indices_b:
        shape = (P,)

    returns:
        shape = (P,)
    """

    delta = (
        positions[pair_indices_a]
        - positions[pair_indices_b]
    )

    return np.sqrt(
        np.sum(delta * delta, axis=1)
    )


# ---------------------------------------------------------------------------
# Batch coarse screening
# ---------------------------------------------------------------------------

def batch_find_closest_approaches(
    candidates: list[tuple[SpaceObject, SpaceObject]],
    start: datetime,
    hours: int,
):
    """
    Fast Stage 2 screening.

    IMPORTANT:

    The old implementation propagated each object independently for every
    candidate pair.

    This implementation instead:

        1. Finds the unique objects involved in candidate pairs.
        2. Propagates each unique object once at each coarse timestamp.
        3. Stores positions/velocities in NumPy arrays.
        4. Calculates all candidate pair distances at once.
        5. Tracks the best coarse TCA for every pair.

    Returns a dictionary:

        {
            (object_a_id, object_b_id): {
                "distance_km": ...,
                "time": ...,
                "relative_velocity_kmps": ...
            }
        }
    """

    if not candidates:
        return {}

    # ------------------------------------------------------------------
    # Build unique object list.
    # ------------------------------------------------------------------

    unique_objects = {}
    for obj_a, obj_b in candidates:
        unique_objects[obj_a.id] = obj_a
        unique_objects[obj_b.id] = obj_b

    objects = list(unique_objects.values())

    object_index = {
        obj.id: index
        for index, obj in enumerate(objects)
    }

    # ------------------------------------------------------------------
    # Convert candidate objects into integer NumPy indices.
    # ------------------------------------------------------------------

    pair_indices_a = np.asarray(
        [object_index[obj_a.id] for obj_a, _ in candidates],
        dtype=np.int32,
    )

    pair_indices_b = np.asarray(
        [object_index[obj_b.id] for _, obj_b in candidates],
        dtype=np.int32,
    )

    pair_count = len(candidates)
    object_count = len(objects)

    logger.info(
        "Batch screening %d unique objects across %d candidate pairs",
        object_count,
        pair_count,
    )

    # ------------------------------------------------------------------
    # Best result arrays.
    # ------------------------------------------------------------------

    best_distances = np.full(
        pair_count,
        np.inf,
        dtype=np.float64,
    )

    best_times = [None] * pair_count

    best_relative_velocities = np.full(
        pair_count,
        np.nan,
        dtype=np.float64,
    )

    # ------------------------------------------------------------------
    # Time range.
    # ------------------------------------------------------------------

    total_steps = (
        hours * 3600
    ) // COARSE_TIME_STEP_SECONDS

    total_steps += 1

    logger.info(
        "Coarse propagation: %d objects × %d timestamps",
        object_count,
        total_steps,
    )

    # ------------------------------------------------------------------
    # Main coarse propagation loop.
    #
    # IMPORTANT:
    # We only hold one timestamp's positions in memory at a time.
    # This prevents a huge positions[timestamp, object, xyz] array from
    # consuming hundreds of MB of RAM.
    # ------------------------------------------------------------------

    step_delta = timedelta(
        seconds=COARSE_TIME_STEP_SECONDS
    )

    current_time = start

    for step_number in range(total_steps):

        # --------------------------------------------------------------
        # Propagate every unique object exactly once at this timestamp.
        # --------------------------------------------------------------

        positions = np.full(
            (object_count, 3),
            np.nan,
            dtype=np.float64,
        )

        velocities = np.full(
            (object_count, 3),
            np.nan,
            dtype=np.float64,
        )

        valid = np.zeros(
            object_count,
            dtype=bool,
        )

        for object_idx, obj in enumerate(objects):

            try:
                state = propagate_object(
                    obj,
                    current_time,
                )
            except (ValueError, TypeError, OverflowError):
                continue
            except Exception:
                # Keep one bad object from killing the complete 24-hour
                # catalog screening run.
                continue

            if not state:
                continue

            if state.get("error", 0) != 0:
                continue

            position = state.get("position_km")
            velocity = state.get("velocity_kmps")

            if position is None or velocity is None:
                continue

            try:
                positions[object_idx] = np.asarray(
                    position,
                    dtype=np.float64,
                )

                velocities[object_idx] = np.asarray(
                    velocity,
                    dtype=np.float64,
                )

                valid[object_idx] = True

            except (TypeError, ValueError):
                continue

        # --------------------------------------------------------------
        # Determine which candidate pairs have valid states.
        # --------------------------------------------------------------

        pair_valid = (
            valid[pair_indices_a]
            & valid[pair_indices_b]
        )

        valid_pair_indices = np.flatnonzero(pair_valid)

        if valid_pair_indices.size:

            distances = vectorized_pair_distances(
                positions,
                pair_indices_a[valid_pair_indices],
                pair_indices_b[valid_pair_indices],
            )

            # ----------------------------------------------------------
            # Find candidates that improved their previous best.
            # ----------------------------------------------------------

            previous_best = best_distances[
                valid_pair_indices
            ]

            improved_mask = distances < previous_best

            improved_pair_indices = (
                valid_pair_indices[improved_mask]
            )

            improved_distances = (
                distances[improved_mask]
            )

            if improved_pair_indices.size:

                best_distances[
                    improved_pair_indices
                ] = improved_distances

                # ------------------------------------------------------
                # Store time and relative velocity for improved pairs.
                # ------------------------------------------------------

                for local_index, pair_index in enumerate(
                    improved_pair_indices
                ):
                    best_times[pair_index] = current_time

                    a_idx = pair_indices_a[pair_index]
                    b_idx = pair_indices_b[pair_index]

                    relative_velocity = (
                        velocities[a_idx]
                        - velocities[b_idx]
                    )

                    best_relative_velocities[
                        pair_index
                    ] = np.linalg.norm(
                        relative_velocity
                    )

        # --------------------------------------------------------------
        # Progress logging.
        # --------------------------------------------------------------

        if (
            step_number == 0
            or (step_number + 1) % 60 == 0
            or step_number == total_steps - 1
        ):
            logger.info(
                "Coarse screening progress: %d/%d timestamps | "
                "time=%s",
                step_number + 1,
                total_steps,
                current_time,
            )

        current_time += step_delta

    # ------------------------------------------------------------------
    # Convert results into the same structure expected by the rest of
    # the application.
    # ------------------------------------------------------------------

    results = {}

    for pair_index, (obj_a, obj_b) in enumerate(candidates):

        if best_times[pair_index] is None:
            continue

        relative_velocity = best_relative_velocities[pair_index]

        if not np.isfinite(relative_velocity):
            relative_velocity = None
        else:
            relative_velocity = float(relative_velocity)

        results[
            (obj_a.id, obj_b.id)
        ] = {
            "object_a": obj_a,
            "object_b": obj_b,
            "distance_km": float(
                best_distances[pair_index]
            ),
            "time": best_times[pair_index],
            "relative_velocity_kmps": relative_velocity,
        }

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
    Perform high-resolution 1-second refinement around the coarse TCA.

    Only pairs whose coarse result is close enough to the danger threshold
    reach this function.
    """

    coarse_time = coarse_result["time"]

    if coarse_time is None:
        return None

    coarse_distance = coarse_result["distance_km"]

    # Same refinement window as the original implementation:
    #
    #     TCA - 60 sec
    #     through
    #     TCA + 60 sec
    #
    refine_start = (
        coarse_time
        - timedelta(seconds=COARSE_TIME_STEP_SECONDS)
    )

    refine_end = (
        coarse_time
        + timedelta(seconds=COARSE_TIME_STEP_SECONDS)
    )

    best_distance = float(coarse_distance)
    best_time = coarse_time
    best_relative_velocity = (
        coarse_result.get(
            "relative_velocity_kmps"
        )
    )

    current_time = refine_start

    fine_step = timedelta(
        seconds=FINE_TIME_STEP_SECONDS
    )

    while current_time <= refine_end:

        try:
            state_a = propagate_object(
                obj_a,
                current_time,
            )

            state_b = propagate_object(
                obj_b,
                current_time,
            )

        except (ValueError, TypeError, OverflowError):
            current_time += fine_step
            continue

        except Exception:
            current_time += fine_step
            continue

        if not state_a or not state_b:
            current_time += fine_step
            continue

        if (
            state_a.get("error", 0) != 0
            or state_b.get("error", 0) != 0
        ):
            current_time += fine_step
            continue

        try:
            pos_a = np.asarray(
                state_a["position_km"],
                dtype=np.float64,
            )

            pos_b = np.asarray(
                state_b["position_km"],
                dtype=np.float64,
            )

            distance = float(
                np.linalg.norm(pos_a - pos_b)
            )

        except (KeyError, TypeError, ValueError):
            current_time += fine_step
            continue

        if distance < best_distance:

            best_distance = distance
            best_time = current_time

            try:
                vel_a = np.asarray(
                    state_a["velocity_kmps"],
                    dtype=np.float64,
                )

                vel_b = np.asarray(
                    state_b["velocity_kmps"],
                    dtype=np.float64,
                )

                best_relative_velocity = float(
                    np.linalg.norm(
                        vel_a - vel_b
                    )
                )

            except (KeyError, TypeError, ValueError):
                best_relative_velocity = None

        current_time += fine_step

    return {
        "distance_km": best_distance,
        "time": best_time,
        "relative_velocity_kmps": best_relative_velocity,
    }
# ---------------------------------------------------------------------------
# Single-pair convenience wrapper (used by app/simulation/simulator.py,
# which checks one specific hypothetical pair rather than a full candidate
# list, so it doesn't need the batch/vectorized path above).
# ---------------------------------------------------------------------------

def find_closest_approach(
    obj_a: SpaceObject,
    obj_b: SpaceObject,
    start: datetime,
    hours: int,
):
    """
    Screen a single object pair for closest approach, reusing the batch
    coarse-screening and fine-refinement functions above rather than
    duplicating propagation logic.
    """
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

    limit:
        If supplied, screens only the first N objects from the database.

        Example:
            python -m app.screening.conjunction 8000

        Full catalog:
            python -m app.screening.conjunction
    """

    # ------------------------------------------------------------------
    # Database setup
    # ------------------------------------------------------------------

    init_db()

    session = SessionLocal()

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
        logger.warning(
            "No space objects found. Nothing to screen."
        )
        session.close()
        return 0

    # ------------------------------------------------------------------
    # Stage 1
    # ------------------------------------------------------------------

    logger.info(
        "Starting Stage 1 coarse orbital filtering..."
    )

    candidates = coarse_filter(objects)

    logger.info(
        "Coarse filter found %d candidate pairs to check closely",
        len(candidates),
    )

    if not candidates:
        logger.info(
            "No candidate pairs found. Screening complete."
        )
        session.close()
        return 0

    # ------------------------------------------------------------------
    # Screening start time
    # ------------------------------------------------------------------

    now = reference_epoch(objects)
    logger.info("Screening window start (reference epoch): %s", now)

    try:

        # ==============================================================
        # Stage 2
        # ==============================================================

        logger.info(
            "Starting optimized batch propagation..."
        )

        coarse_results = batch_find_closest_approaches(
            candidates=candidates,
            start=now,
            hours=hours,
        )

        logger.info(
            "Batch propagation complete. %d candidate pairs "
            "produced valid coarse results.",
            len(coarse_results),
        )

        # ==============================================================
        # Stage 3
        # ==============================================================

        refinement_threshold = (
            DANGER_DISTANCE_KM
            * REFINEMENT_MULTIPLIER
        )

        logger.info(
            "Fine refinement threshold: %.2f km",
            refinement_threshold,
        )

        found_count = 0

        refinement_count = 0

        for result in coarse_results.values():

            obj_a = result["object_a"]
            obj_b = result["object_b"]

            coarse_distance = result["distance_km"]

            # ----------------------------------------------------------
            # If coarse distance is nowhere near the danger threshold,
            # don't waste time doing 1-second propagation.
            # ----------------------------------------------------------

            if coarse_distance > refinement_threshold:
                continue

            refinement_count += 1

            logger.debug(
                "Refining %s <-> %s | coarse distance %.3f km",
                obj_a.object_name,
                obj_b.object_name,
                coarse_distance,
            )

            refined = refine_closest_approach(
                obj_a=obj_a,
                obj_b=obj_b,
                coarse_result=result,
            )

            if refined is None:
                continue

            # ----------------------------------------------------------
            # Actual conjunction threshold.
            # ----------------------------------------------------------

            if refined["distance_km"] >= DANGER_DISTANCE_KM:
                continue

            # ----------------------------------------------------------
            # Persist conjunction event.
            # ----------------------------------------------------------

            event = ConjunctionEvent(
                id=new_uuid(),
                object_a_id=obj_a.id,
                object_b_id=obj_b.id,
                tca=refined["time"],
                miss_distance_km=round(
                    refined["distance_km"],
                    3,
                ),
                relative_velocity_kmps=(
                    round(
                        refined["relative_velocity_kmps"],
                        3,
                    )
                    if refined["relative_velocity_kmps"]
                    is not None
                    else None
                ),
                status="active",
            )

            session.add(event)

            found_count += 1

            logger.info(
                "CONJUNCTION: %s <-> %s | "
                "miss distance %.2f km at %s",
                obj_a.object_name,
                obj_b.object_name,
                refined["distance_km"],
                refined["time"],
            )

        logger.info(
            "Fine refinement checked %d close coarse candidates.",
            refinement_count,
        )

        # --------------------------------------------------------------
        # Save all events in one transaction.
        # --------------------------------------------------------------

        session.commit()

        logger.info(
            "Screening complete. %d conjunction(s) found and saved.",
            found_count,
        )

        return found_count

    except Exception:
        session.rollback()

        logger.exception(
            "Screening failed, rolled back this batch."
        )

        raise

    finally:
        session.close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":

    limit_arg = (
        int(sys.argv[1])
        if len(sys.argv) > 1
        else None
    )

    screen_all(
        limit=limit_arg
    )

