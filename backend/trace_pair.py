# trace_pair.py
# Traces one pair near its dense minimum: 10-s distances, whether pass 1 would
# keep the sample, and whether the reference holds any encounter nearby.
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from sgp4.api import SatrecArray, jday
from app.db import SessionLocal
from app.models.models import SpaceObject
from app.screening.conjunction import latest_element
from app.propagation.propagator import build_satrec

NAME_A, NAME_B = "STARLINK-4697", "STARLINK-36325"
CENTER_S = 18080
THR, VMAX, DT, MARGIN = 5.0, 15.0, 10.0, 1.5

START = datetime(2026, 10, 24, 6, 51, 13, 862304, tzinfo=timezone.utc)
jd0, fr0 = jday(START.year, START.month, START.day, START.hour, START.minute,
                START.second + START.microsecond / 1e6)

session = SessionLocal()
sats, ids = [], []
for name in (NAME_A, NAME_B):
    o = session.query(SpaceObject).filter(SpaceObject.object_name == name).first()
    sats.append(build_satrec(latest_element(o)))
    ids.append(int(o.norad_cat_id))
session.close()
print("NORAD IDs:", ids)

ref = pd.read_csv("reference_events.csv")
mask = ((ref.norad_a == min(ids)) & (ref.norad_b == max(ids)))
print("reference rows for this pair:")
print(ref[mask][["step", "tca_sec", "miss_km", "rel_vel_kmps"]].to_string())

steps = np.arange(int(CENTER_S / DT) - 30, int(CENTER_S / DT) + 31)
t = steps * DT
e, r, v = SatrecArray(sats).sgp4(np.full(t.size, jd0), fr0 + t / 86400.0)
d = np.linalg.norm(r[0] - r[1], axis=1)
vr = np.linalg.norm(v[0] - v[1], axis=1)
keep_bound = np.sqrt(THR**2 + (MARGIN * vr * DT / 2) ** 2)
for s, tt, dd, vv, kb in zip(steps, t, d, vr, keep_bound):
    flag = "KEEP" if dd <= kb else "drop"
    print(f"step {s:5d}  t={tt:7.0f}s  d={dd:8.3f} km  vrel={vv:6.2f}  bound={kb:7.2f}  {flag}")