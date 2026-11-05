# diag_two.py
# For the two pipeline pairs missing from the reference, shows whether pass 1
# keeps the sample near their TCA, and what pass 2 does with it.
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from sgp4.api import SatrecArray, jday
from app.db import SessionLocal
from app.models.models import SpaceObject
from app.screening.conjunction import latest_element
from app.propagation.propagator import build_satrec

START = datetime(2026, 10, 24, 6, 51, 13, 862304, tzinfo=timezone.utc)
jd0, fr0 = jday(START.year, START.month, START.day, START.hour, START.minute,
                START.second + START.microsecond / 1e6)
THR, VMAX, DT, MARGIN = 5.0, 15.0, 10.0, 1.5
PAIRS = [("INTELSAT 10-02", "MEV-2", 14250), ("STARLINK-33642", "STARLINK-34115", 86420)]

session = SessionLocal()
for na, nb, tca in PAIRS:
    print(f"\n=== {na} / {nb}  (reference TCA {tca} s) ===")
    sats = []
    for name in (na, nb):
        o = session.query(SpaceObject).filter(SpaceObject.object_name == name).first()
        sats.append(build_satrec(latest_element(o)))

    k0 = int(round(tca / DT))
    for k in range(k0 - 3, k0 + 4):
        if k < 0:
            continue
        sec = np.array([k * DT])
        e, r, v = SatrecArray(sats).sgp4(np.full(1, jd0), fr0 + sec / 86400.0)
        d = np.linalg.norm(r[0, 0] - r[1, 0])
        vr = np.linalg.norm(v[0, 0] - v[1, 0])
        bound = np.sqrt(THR**2 + (MARGIN * vr * DT / 2) ** 2)
        print(f"  pass1 step {k} t={k*DT:8.0f}s d={d:8.3f} km  "
              f"bound={bound:6.2f}  {'KEEP' if d <= bound else 'drop'}")

    fine = np.arange(-40, 41, 1.0)
    sec = k0 * DT + fine
    e, r, v = SatrecArray(sats).sgp4(np.full(sec.size, jd0), fr0 + sec / 86400.0)
    d = np.linalg.norm(r[0] - r[1], axis=1)
    d[(e[0] != 0) | (e[1] != 0)] = np.inf
    finite = d[np.isfinite(d)]
    print(f"  pass2 window +/-40 s: min {d.min():.6f} km at +{sec[int(np.argmin(d))]:.0f} s")
    print(f"  distance range over window: {finite.max() - finite.min():.3e} km  "
          f"(constant-curve test fires if < 1e-6)")
session.close()