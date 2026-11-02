"""
SGP4 orbital propagator.
Converts an OrbitalElement row's mean elements into a Satrec (SGP4 satellite
record) directly — no need to reconstruct a TLE string — then computes
position/velocity at any requested UTC time.

Every downstream module (screening, risk, maneuvers, live tracking) calls
into propagate() or propagate_object().
"""

import math
from datetime import datetime, timezone

from sgp4.api import Satrec, WGS72, jday

# SGP4's reference epoch: days since 1949 Dec 31 00:00 UT
SGP4_EPOCH_REF = datetime(1949, 12, 31, tzinfo=timezone.utc)

MINUTES_PER_DAY = 1440.0
TWO_PI = 2.0 * math.pi

SGP4_ERROR_MESSAGES = {
    0: "no error",
    1: "mean eccentricity out of range",
    2: "mean motion less than 0",
    3: "perturbed eccentricity out of range",
    4: "semi-latus rectum < 0",
    5: "epoch elements are sub-orbital",
    6: "satellite has decayed",
}


def build_satrec(element) -> Satrec:
    """
    Build a Satrec directly from an OrbitalElement's mean elements.

    Unit conversions applied here:
      - MEAN_MOTION: revs/day -> radians/minute
      - MEAN_MOTION_DOT / _DDOT: revs/day^2, revs/day^3 -> radians/minute^2, ^3
      - INCLINATION / RA_OF_ASC_NODE / ARG_OF_PERICENTER / MEAN_ANOMALY: degrees -> radians
      - EPOCH: datetime -> days since 1949-12-31 00:00 UT
    """
    sat = Satrec()

    epoch_dt = element.epoch
    if epoch_dt.tzinfo is None:
        epoch_dt = epoch_dt.replace(tzinfo=timezone.utc)
    epoch_days = (epoch_dt - SGP4_EPOCH_REF).total_seconds() / 86400.0

    no_kozai = element.mean_motion * TWO_PI / MINUTES_PER_DAY
    ndot = (element.mean_motion_dot or 0.0) * TWO_PI / (MINUTES_PER_DAY ** 2)
    nddot = (element.mean_motion_ddot or 0.0) * TWO_PI / (MINUTES_PER_DAY ** 3)

    satnum = element.object.norad_cat_id if getattr(element, "object", None) else 0

    sat.sgp4init(
        WGS72,
        "i",                                    # improved (modern) operation mode
        int(satnum),
        epoch_days,
        element.bstar or 0.0,
        ndot,
        nddot,
        element.eccentricity,
        math.radians(element.arg_of_pericenter),
        math.radians(element.inclination),
        math.radians(element.mean_anomaly),
        no_kozai,
        math.radians(element.ra_of_asc_node),
    )
    return sat


def propagate(element, when: datetime) -> dict:
    """
    Compute position/velocity at a given UTC datetime from one OrbitalElement.

    Returns:
        {
          "position_km": (x, y, z),      # TEME frame
          "velocity_kmps": (vx, vy, vz), # TEME frame
          "error": 0,                     # 0 = success, see SGP4_ERROR_MESSAGES
        }
    """
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)

    sat = build_satrec(element)

    jd, fr = jday(
        when.year, when.month, when.day,
        when.hour, when.minute, when.second + when.microsecond / 1e6,
    )

    error, position, velocity = sat.sgp4(jd, fr)

    return {
        "position_km": position,
        "velocity_kmps": velocity,
        "error": error,
        "error_message": SGP4_ERROR_MESSAGES.get(error, "unknown error"),
    }


def propagate_object(space_object, when: datetime) -> dict:
    """Convenience: propagate using an object's most recent orbital element."""
    if not space_object.elements:
        raise ValueError(f"{space_object.object_name} has no orbital elements loaded")

    latest_element = max(space_object.elements, key=lambda e: e.epoch)
    latest_element.object = space_object  # ensure norad_cat_id is reachable
    return propagate(latest_element, when)