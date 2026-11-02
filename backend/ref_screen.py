# ref_screen.py
# Brute-force reference: every pair within DANGER km at any time in the window.
# Uses a KD-tree per sample instead of element gates, so it has no prefilter losses.
import time
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
DT = 10.0          # coarse sampling, seconds
THR = 5.0          # miss-distance threshold, km
VMAX = 15.0        # maximum plausible relative speed, km/s
MARGIN = 1.5       # safety factor on the sampling bound
OUT = "reference_events.csv"

jd0, fr0 = jday(START.year, START.month, START.day,
                START.hour, START.minute,
                START.second + START.microsecond / 1e6)

session = SessionLocal()
sats, ids, names, station = [], [], [], []
for o in session.query(SpaceObject).all():
    el = latest_element(o)
    if el is None:
        continue
    try:
        s = build_satrec(el)
    except Exception:
        continue
    sats.append(s)
    ids.append(int(o.norad_cat_id))
    names.append(o.object_name)
    station.append(is_docked_complex_member(o))
session.close()
station = np.array(station)
print(f"objects with usable elements: {len(sats)}")

arr = SatrecArray(sats)
n_steps = int(HOURS * 3600 // DT) + 1

# ---- Pass 1: find sample steps where a pair is plausibly within THR ----
cand = []  # (i, j, k) indices into sats, k = sample step
t0 = time.perf_counter()
for k in range(n_steps):
    e, r, v = arr.sgp4(np.array([jd0]), np.array([fr0 + k * DT / 86400.0]))
    ok = np.flatnonzero(e[:, 0] == 0)
    if ok.size < 2:
        continue
    P = r[ok, 0, :]
    V = v[ok, 0, :]
    tree = cKDTree(P)
    pr = tree.query_pairs(THR + VMAX * DT / 2, output_type="ndarray")
    if pr.size == 0:
        continue
    a, b = pr[:, 0], pr[:, 1]
    d = np.linalg.norm(P[a] - P[b], axis=1)
    vr = np.linalg.norm(V[a] - V[b], axis=1)
    keep = d <= np.sqrt(THR**2 + (MARGIN * vr * DT / 2) ** 2)
    for x, y in zip(ok[a[keep]], ok[b[keep]]):
        i, j = (int(x), int(y)) if x < y else (int(y), int(x))
        if station[i] and station[j]:
            continue
        cand.append((i, j, k))
    if k % 500 == 0:
        print(f"step {k}/{n_steps}  candidates so far {len(cand)}  "
              f"elapsed {time.perf_counter() - t0:.0f}s")
print(f"pass 1 done in {time.perf_counter() - t0:.0f}s, candidate samples: {len(cand)}")

# ---- Pass 2: 1-second refinement around each candidate sample ----
fine = np.arange(-DT, DT + 1.0, 1.0)
rows = []
for i, j, k in cand:
    sec = k * DT + fine
    e, r, v = SatrecArray([sats[i], sats[j]]).sgp4(
        np.full(sec.size, jd0), fr0 + sec / 86400.0)
    good = (e[0] == 0) & (e[1] == 0)
    if not good.any():
        continue
    d = np.linalg.norm(r[0] - r[1], axis=1)
    d[~good] = np.inf
    m = int(np.argmin(d))
    if d[m] < THR:
        rows.append((ids[i], ids[j], names[i], names[j], k,
                     float(sec[m]), float(d[m]),
                     float(np.linalg.norm(v[0][m] - v[1][m]))))

df = pd.DataFrame(rows, columns=["norad_a", "norad_b", "name_a", "name_b",
                                 "step", "tca_sec", "miss_km", "rel_vel_kmps"])
# Merge consecutive refinements of the same encounter into one event
df = df.sort_values(["norad_a", "norad_b", "step"]).reset_index(drop=True)
df["gap"] = df.groupby(["norad_a", "norad_b"])["step"].diff().fillna(999) > 2
df["encounter"] = df.groupby(["norad_a", "norad_b"])["gap"].cumsum()
events = (df.sort_values("miss_km")
            .groupby(["norad_a", "norad_b", "encounter"], as_index=False)
            .first())
events.to_csv(OUT, index=False)

print(f"reference encounters below {THR} km: {len(events)}")
print(f"distinct pairs: {events.groupby(['norad_a', 'norad_b']).ngroups}")
print(f"runtime total: {time.perf_counter() - t0:.0f}s")
print(f"wrote {OUT}")