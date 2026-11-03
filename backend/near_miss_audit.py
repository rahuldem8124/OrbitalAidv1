# near_miss_audit.py
# Dense 1-s check of near-miss pairs (sampled minimum in (5, 10] km, absent
# from the reference). Satellites are looked up by NORAD ID, not by name,
# because many debris fragments share a name.
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
secs = np.arange(0, 24 * 3600 + 1, 1.0)

N_AUDIT = 2000        # sample size from make_near_miss output
MIN_SEP_KM = 1e-3     # below this, the pair is treated as degenerate and reported separately
SEED = 11

# ---- NORAD ID -> Satrec, built once ----
sat_by_id = {}
session = SessionLocal()
for o in session.query(SpaceObject).all():
    el = latest_element(o)
    if el is None:
        continue
    try:
        sat_by_id[int(o.norad_cat_id)] = (o.object_name, build_satrec(el))
    except Exception:
        continue
session.close()

near = pd.read_csv("near_miss_pairs.csv")
near = near[near.norad_a.isin(sat_by_id.keys()) & near.norad_b.isin(sat_by_id.keys())]
sample = near.sample(min(N_AUDIT, len(near)), random_state=SEED)

audited = 0
degenerate = 0
hits = []
for _, row in sample.iterrows():
    a, b = int(row.norad_a), int(row.norad_b)
    _, sat_a = sat_by_id[a]
    _, sat_b = sat_by_id[b]
    e, r, v = SatrecArray([sat_a, sat_b]).sgp4(np.full(secs.size, jd0), fr0 + secs / 86400.0)
    bad = (e[0] != 0) | (e[1] != 0)
    d = np.linalg.norm(r[0] - r[1], axis=1)
    d[bad] = np.inf
    audited += 1

    if np.all(~np.isfinite(d)):
        continue
    if d.min() < MIN_SEP_KM:
        degenerate += 1
        continue
    i = int(np.argmin(d))
    if d[i] < 5.0:
        vrel = float(np.linalg.norm(v[0][i] - v[1][i]))
        hits.append((row.name_a, row.name_b, a, b, round(float(d[i]), 3),
                     float(secs[i]), round(vrel, 3)))

print(f"audited: {audited}")
print(f"degenerate (min separation < {MIN_SEP_KM} km, excluded): {degenerate}")
print(f"valid dense minima below 5 km not in reference: {len(hits)}")
for h in hits:
    print("  ", h)