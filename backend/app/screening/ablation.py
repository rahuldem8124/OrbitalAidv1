"""
Three-stage coarse-filter ablation (no propagation).

Counts unordered candidate pairs after each stage, using the same rules as
app/screening/conjunction.py. Station-complex pairs are excluded at every
stage, as in production.

  Stage A  altitude band only
  Stage B  altitude band + inclination
  Stage C  altitude band + inclination + RAAN   (production filter)

Run from backend/:
    py -m app.screening.ablation          # full catalog
    py -m app.screening.ablation 3000     # first 3,000 rows (earlier subset)
"""

import json
import sys
import time
from datetime import datetime, timezone

import numpy as np

from app.db import SessionLocal
from app.models.models import SpaceObject
from app.screening.conjunction import (
    ALTITUDE_BAND_TOLERANCE_KM,
    EARTH_RADIUS_KM,
    INCLINATION_TOLERANCE_DEG,
    RAAN_TOLERANCE_DEG,
    is_docked_complex_member,
    latest_element,
    semi_major_axis_km,
)


def load_orbital_arrays(limit):
    session = SessionLocal()
    try:
        query = session.query(SpaceObject)
        if limit:
            query = query.limit(limit)
        objects = query.all()

        altitude, inclination, raan, docked = [], [], [], []
        skipped = 0
        for obj in objects:
            element = latest_element(obj)
            if element is None:
                skipped += 1
                continue
            altitude.append(semi_major_axis_km(element.mean_motion) - EARTH_RADIUS_KM)
            inclination.append(element.inclination)
            raan.append(element.ra_of_asc_node)
            docked.append(is_docked_complex_member(obj))

        return (
            np.asarray(altitude, dtype=np.float64),
            np.asarray(inclination, dtype=np.float64),
            np.asarray(raan, dtype=np.float64),
            np.asarray(docked, dtype=bool),
            len(objects),
            skipped,
        )
    finally:
        session.close()


def circular_diff(a, b):
    d = np.abs(a - b) % 360.0
    return np.minimum(d, 360.0 - d)


def count_stages(altitude, inclination, raan, docked):
    order = np.argsort(altitude, kind="stable")
    altitude = altitude[order]
    inclination = inclination[order]
    raan = raan[order]
    docked = docked[order]

    n = len(altitude)

    # Altitude-sorted, so the partners of i with j > i form the contiguous
    # block [i+1, hi[i]).
    hi = np.searchsorted(altitude, altitude + ALTITUDE_BAND_TOLERANCE_KM, side="right")

    count_a = count_b = count_c = 0

    for i in range(n):
        j0, j1 = i + 1, int(hi[i])
        if j1 <= j0:
            continue

        alt_ok = (altitude[j0:j1] - altitude[i]) <= ALTITUDE_BAND_TOLERANCE_KM
        not_station = ~(docked[i] & docked[j0:j1])
        base = alt_ok & not_station

        incl_ok = np.abs(inclination[j0:j1] - inclination[i]) <= INCLINATION_TOLERANCE_DEG
        raan_ok = circular_diff(raan[j0:j1], raan[i]) <= RAAN_TOLERANCE_DEG

        count_a += int(base.sum())
        b_mask = base & incl_ok
        count_b += int(b_mask.sum())
        count_c += int((b_mask & raan_ok).sum())

        if i % 2000 == 0:
            print(f"  progress {i}/{n}", flush=True)

    return count_a, count_b, count_c


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    scope = f"subset_{limit}" if limit else "full_catalog"

    print(f"Loading objects ({scope})...", flush=True)
    t0 = time.perf_counter()
    altitude, inclination, raan, docked, total, skipped = load_orbital_arrays(limit)
    t1 = time.perf_counter()

    print(
        f"Loaded {total} objects, {skipped} without elements, "
        f"{len(altitude)} used. Counting pairs...",
        flush=True,
    )
    a, b, c = count_stages(altitude, inclination, raan, docked)
    t2 = time.perf_counter()

    def reduction(part, base):
        return round(100.0 * (1 - part / base), 2) if base else None

    result = {
        "scope": scope,
        "objects_total": total,
        "objects_without_elements": skipped,
        "objects_used": int(len(altitude)),
        "parameters": {
            "altitude_tolerance_km": ALTITUDE_BAND_TOLERANCE_KM,
            "inclination_tolerance_deg": INCLINATION_TOLERANCE_DEG,
            "raan_tolerance_deg": RAAN_TOLERANCE_DEG,
        },
        "candidate_pairs": {
            "A_altitude_only": a,
            "B_plus_inclination": b,
            "C_plus_raan_production": c,
        },
        "reduction_vs_A_percent": {
            "B": reduction(b, a),
            "C": reduction(c, a),
        },
        "timing_seconds": {
            "load": round(t1 - t0, 2),
            "count": round(t2 - t1, 2),
        },
        "run_at_utc": datetime.now(timezone.utc).isoformat(),
    }

    print(json.dumps(result, indent=2))

    out_file = f"ablation_{scope}.json"
    with open(out_file, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nSaved {out_file}")

    print("\nCHECKS")
    if limit == 3000:
        ok = (a, b, c) == (594972, 360116, 19367)
        print(f"  Subset expected A=594972 B=360116 C=19367: {'OK' if ok else 'MISMATCH'}")
    if limit is None:
        print(f"  Full-catalog expected C=364779 (production run): {'OK' if c == 364779 else 'MISMATCH'}")


if __name__ == "__main__":
    main()