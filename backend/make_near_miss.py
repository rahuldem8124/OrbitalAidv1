# make_near_miss.py
# Lists object pairs whose 10-s sampled minimum separation lies in (5, 10] km
# and which the brute-force reference did not report. These are the pairs
# where a missed sub-5-km minimum is most likely, so they are audited next.
import time
from collections import Counter
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from sgp4.api import SatrecArray, jday

from app.db import SessionLocal
from app.models.models import SpaceObject
from app.screening.conjunction import latest_element, is_docked_complex_member
from app.propagation.propagator import build_satrec

START = datetime(2026, 10, 24, 6, 51, 13, 862304, tzinfo=timezone.utc)
HOURS = 24
DT = 10.0
LOW, HIGH = 5.0, 10.0       # near-miss band, km
VMAX = 15.0
OUT = "near_miss_pairs.csv"

jd0, fr0 = jday(START.year, START.month, START.day,
                START.hour, START.minute,
                START.second + START.microsecond / 1e6)

# ---- Load population (same rules as ref_screen.py) ----
skipped = Counter()
sats, ids, names, station = [], [], [], []
session = SessionLocal()
for o in session.query(SpaceObject).all():
    el = latest_element(o)
    if el is None:
        skipped["no_elements"] += 1
        continue
    try:
        s = build_satrec(el)
    except Exception as ex:
        skipped[type(ex).__name__] += 1
        continue
    sats.append(s)
    ids.append(int(o.norad_cat_id))
    names.append(o.object_name)
    station.append(is_docked_complex_member(o))
session.close()
station = np.array(station)
print(f"usable objects: {len(sats)}  skipped: {dict(skipped)}")

# ---- Reference pairs to exclude ----
ref = pd.read_csv("reference_events.csv")
ref_pairs = {frozenset((int(a), int(b))) for a, b in zip(ref.norad_a, ref.norad_b)}

# ---- Scan the 10-s grid; record each pair's minimum sampled distance ----
arr = SatrecArray(sats)
n_steps = int(HOURS * 3600 // DT) + 1
best = {}                    # (i, j) -> (min sampled distance, step, rel speed)
t0 = time.perf_counter()

for k in range(n_steps):
    e, r, v = arr.sgp4(np.array([jd0]), np.array([fr0 + k * DT / 86400.0]))
    ok = np.flatnonzero(e[:, 0] == 0)
    if ok.size < 2:
        continue
    P = r[ok, 0, :]
    V = v[ok, 0, :]
    pr = cKDTree(P).query_pairs(HIGH + VMAX * DT / 2, output_type="ndarray")
    if pr.size == 0:
        continue
    a, b = pr[:, 0], pr[:, 1]
    d = np.linalg.norm(P[a] - P[b], axis=1)
    vr = np.linalg.norm(V[a] - V[b], axis=1)
    for x, y, dd, vv in zip(ok[a], ok[b], d, vr):
        if dd > HIGH:
            continue
        i, j = (int(x), int(y)) if x < y else (int(y), int(x))
        if station[i] and station[j]:
            continue
        cur = best.get((i, j))
        if cur is None or dd < cur[0]:
            best[(i, j)] = (float(dd), k, float(vv))
    if k % 500 == 0:
        print(f"step {k}/{n_steps}  pairs tracked {len(best)}  "
              f"elapsed {time.perf_counter() - t0:.0f}s")

# ---- Keep pairs whose sampled minimum is in (LOW, HIGH] and not in the reference ----
rows = []
for (i, j), (dmin, k, vv) in best.items():
    if dmin <= LOW:
        continue                       # already counted as encounters if < 5 km
    if frozenset((ids[i], ids[j])) in ref_pairs:
        continue
    rows.append((ids[i], ids[j], names[i], names[j], round(dmin, 3),
                 round(vv, 3), k * DT))

out = pd.DataFrame(rows, columns=["norad_a", "norad_b", "name_a", "name_b",
                                  "sampled_min_km", "rel_vel_kmps", "sample_time_sec"])
out = out.sort_values("sampled_min_km").reset_index(drop=True)
out.to_csv(OUT, index=False)

print(f"pass complete in {time.perf_counter() - t0:.0f}s")
print(f"pairs with sampled minimum in ({LOW}, {HIGH}] km, not in reference: {len(out)}")
print(f"wrote {OUT}")