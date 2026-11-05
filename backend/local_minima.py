# local_minima.py
# Lists every local minimum of the dense 1-s separation below 5 km for one pair.
import numpy as np
from datetime import datetime, timezone
from sgp4.api import SatrecArray, jday
from app.db import SessionLocal
from app.models.models import SpaceObject
from app.screening.conjunction import latest_element
from app.propagation.propagator import build_satrec

IDS = (60211, 60212)
THR = 5.0
START = datetime(2026, 10, 24, 6, 51, 13, 862304, tzinfo=timezone.utc)
jd0, fr0 = jday(START.year, START.month, START.day, START.hour, START.minute,
                START.second + START.microsecond / 1e6)
secs = np.arange(0, 24 * 3600 + 1, 1.0)

session = SessionLocal()
sats = []
for i in IDS:
    o = session.query(SpaceObject).filter(SpaceObject.norad_cat_id == i).first()
    sats.append(build_satrec(latest_element(o)))
session.close()

e, r, v = SatrecArray(sats).sgp4(np.full(secs.size, jd0), fr0 + secs / 86400.0)
d = np.linalg.norm(r[0] - r[1], axis=1)
d[(e[0] != 0) | (e[1] != 0)] = np.inf
vr = np.linalg.norm(v[0] - v[1], axis=1)

minima = []
for k in range(1, secs.size - 1):
    if d[k] < THR and d[k] <= d[k - 1] and d[k] <= d[k + 1]:
        minima.append((secs[k], d[k], vr[k]))

print(f"local minima below {THR} km: {len(minima)}")
for t, dm, vv in minima:
    print(f"  +{t:8.0f} s   min {dm:.3f} km   rel vel {vv:.4f} km/s")