# diag_pass2.py
# Runs the v2 pass-2 acceptance logic on the candidate samples of the two
# missing pairs, and prints the outcome for each sample.
import numpy as np
from datetime import datetime, timezone
from sgp4.api import SatrecArray, jday
from app.db import SessionLocal
from app.models.models import SpaceObject
from app.screening.conjunction import latest_element
from app.propagation.propagator import build_satrec

START = datetime(2026, 10, 24, 6, 51, 13, 862304, tzinfo=timezone.utc)
jd0, fr0 = jday(START.year, START.month, START.day, START.hour, START.minute,
                START.second + START.microsecond / 1e6)
THR, DT, REFINE_HALF, MAX_EXPAND = 5.0, 10.0, 2, 4
PAIRS = [("INTELSAT 10-02", "MEV-2", 1425), ("STARLINK-33642", "STARLINK-34115", 8642)]

session = SessionLocal()
for na, nb, k in PAIRS:
    sats = []
    for name in (na, nb):
        o = session.query(SpaceObject).filter(SpaceObject.object_name == name).first()
        sats.append(build_satrec(latest_element(o)))

    print(f"\n=== {na} / {nb}, candidate step {k} ===")
    half = REFINE_HALF
    for attempt in range(MAX_EXPAND + 1):
        fine = np.arange(-half * DT, half * DT + 1.0, 1.0)
        sec = k * DT + fine
        e, r, v = SatrecArray(sats).sgp4(np.full(sec.size, jd0), fr0 + sec / 86400.0)
        good = (e[0] == 0) & (e[1] == 0)
        d = np.linalg.norm(r[0] - r[1], axis=1)
        d[~good] = np.inf
        finite = d[np.isfinite(d)]
        if finite.size == 0:
            print(f"  attempt {attempt}: no valid states"); break
        spread = finite.max() - finite.min()
        m = int(np.argmin(d))
        if spread < 1e-6:
            print(f"  attempt {attempt}: CONSTANT curve (half={half}), accept at centre, "
                  f"d={d[len(d)//2]:.6f} km")
            break
        if 0 < m < len(d) - 1:
            print(f"  attempt {attempt}: INTERIOR min {d[m]:.6f} km at +{sec[m]:.0f} s "
                  f"(half={half}) -> accept if < {THR} km")
            break
        print(f"  attempt {attempt}: EDGE min {d[m]:.6f} km at +{sec[m]:.0f} s "
              f"(half={half}) -> widen")
        half += REFINE_HALF
    else:
        print("  exhausted widening: REJECTED")
session.close()