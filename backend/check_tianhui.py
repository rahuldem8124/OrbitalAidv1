# check_tianhui.py
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from sgp4.api import SatrecArray, jday
from app.db import SessionLocal
from app.models.models import SpaceObject
from app.screening.conjunction import latest_element
from app.propagation.propagator import build_satrec

IDS = (60211, 60212)
START = datetime(2026, 10, 24, 6, 51, 13, 862304, tzinfo=timezone.utc)
jd0, fr0 = jday(START.year, START.month, START.day, START.hour, START.minute,
                START.second + START.microsecond / 1e6)
secs = np.arange(0, 24 * 3600 + 1, 1.0)

ref = pd.read_csv("reference_events.csv")
print("reference rows for this pair:")
print(ref[(ref.norad_a == IDS[0]) & (ref.norad_b == IDS[1])]
      [["step", "tca_sec", "miss_km", "rel_vel_kmps"]].to_string())

session = SessionLocal()
sats = []
for i in IDS:
    o = session.query(SpaceObject).filter(SpaceObject.norad_cat_id == i).first()
    sats.append(build_satrec(latest_element(o)))
session.close()

e, r, v = SatrecArray(sats).sgp4(np.full(secs.size, jd0), fr0 + secs / 86400.0)
d = np.linalg.norm(r[0] - r[1], axis=1)
d[(e[0] != 0) | (e[1] != 0)] = np.inf
below = d < 5.0

segs, i = [], 0
while i < secs.size:
    if below[i]:
        j = i
        while j + 1 < secs.size and below[j + 1]:
            j += 1
        k = i + int(np.argmin(d[i:j + 1]))
        segs.append((secs[k], d[k], float(np.linalg.norm(v[0][k] - v[1][k]))))
        i = j + 1
    else:
        i += 1

print(f"dense below-5-km segments: {len(segs)}")
for t, dm, vr in segs:
    print(f"  min {dm:.3f} km at +{t:.0f} s, rel vel {vr:.3f} km/s")