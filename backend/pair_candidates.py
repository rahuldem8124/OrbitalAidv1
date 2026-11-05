# pair_candidates.py
# Repeats pass 1 (keep test) and pass 2 (+/-20 s refinement) for one pair,
# without the KD-tree, to see whether the full-catalog run drops its minima.
import numpy as np
from datetime import datetime, timezone
from sgp4.api import SatrecArray, jday
from app.db import SessionLocal
from app.models.models import SpaceObject
from app.screening.conjunction import latest_element
from app.propagation.propagator import build_satrec

IDS = (60211, 60212)
THR, VMAX, DT, MARGIN, REFINE_HALF = 5.0, 15.0, 10.0, 1.5, 2
START = datetime(2026, 10, 24, 6, 51, 13, 862304, tzinfo=timezone.utc)
jd0, fr0 = jday(START.year, START.month, START.day, START.hour, START.minute,
                START.second + START.microsecond / 1e6)

session = SessionLocal()
sats = []
for i in IDS:
    o = session.query(SpaceObject).filter(SpaceObject.norad_cat_id == i).first()
    sats.append(build_satrec(latest_element(o)))
session.close()

n_steps = int(24 * 3600 // DT) + 1
pass1_keep = []
for k in range(n_steps):
    e, r, v = SatrecArray(sats).sgp4(np.array([jd0]), np.array([fr0 + k * DT / 86400.0]))
    if (e[:, 0] != 0).any():
        continue
    d = np.linalg.norm(r[0, 0] - r[1, 0])
    vr = np.linalg.norm(v[0, 0] - v[1, 0])
    if d <= np.sqrt(THR**2 + (MARGIN * vr * DT / 2) ** 2):
        pass1_keep.append((k, d))

print(f"pass 1 keeps for this pair: {len(pass1_keep)} samples")
print("first few kept (step, distance km):", [(k, round(float(d), 3)) for k, d in pass1_keep[:8]])

tcas = []
fine = np.arange(-REFINE_HALF * DT, REFINE_HALF * DT + 1.0, 1.0)
for k, _ in pass1_keep:
    sec = k * DT + fine
    e, r, v = SatrecArray(sats).sgp4(np.full(sec.size, jd0), fr0 + sec / 86400.0)
    d = np.linalg.norm(r[0] - r[1], axis=1)
    d[(e[0] != 0) | (e[1] != 0)] = np.inf
    m = int(np.argmin(d))
    if d[m] < THR:
        tcas.append(round(float(sec[m])))

unique = sorted(set(tcas))
print(f"pass 2 refined TCAs below {THR} km: {len(tcas)} rows, {len(unique)} distinct TCAs")
print("distinct TCAs (s):", unique)