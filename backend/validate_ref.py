# validate_ref.py
# Dense 1-s check of reference encounters the pipeline did not report.
# Each encounter is compared with the dense minimum within +/- WINDOW_S of its
# own TCA, so multiple encounters of one pair are checked separately.
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

WINDOW_S = 300        # local search half-width around each reference TCA
TCA_TOL_S = 30        # dense minimum must lie within this of the reference TCA
MISS_TOL_KM = 0.05    # distance agreement tolerance
N_SAMPLE = 10
SEED = 7

ref = pd.read_csv("reference_events.csv")
pipe = pd.read_csv("pipeline_events.csv")
pipe_pairs = {frozenset((int(a), int(b))) for a, b in zip(pipe.norad_a, pipe.norad_b)}
ref["found"] = [frozenset((int(a), int(b))) in pipe_pairs
                for a, b in zip(ref.norad_a, ref.norad_b)]
sample = ref[(~ref.found) & (ref.rel_vel_kmps > 2)].sample(N_SAMPLE, random_state=SEED)

session = SessionLocal()
by_id = {}
for o in session.query(SpaceObject).all():
    el = latest_element(o)
    if el is not None:
        by_id[int(o.norad_cat_id)] = build_satrec(el)
session.close()

results = []
for _, row in sample.iterrows():
    tca = float(row.tca_sec)
    t = np.arange(tca - WINDOW_S, tca + WINDOW_S + 1.0, 1.0)
    sats = [by_id[int(row.norad_a)], by_id[int(row.norad_b)]]
    e, r, v = SatrecArray(sats).sgp4(np.full(t.size, jd0), fr0 + t / 86400.0)
    d = np.linalg.norm(r[0] - r[1], axis=1)
    d[(e[0] != 0) | (e[1] != 0)] = np.inf
    i = int(np.argmin(d))
    local_ok = abs(t[i] - tca) <= TCA_TOL_S
    match = local_ok and abs(d[i] - row.miss_km) < MISS_TOL_KM
    results.append(match)
    print(f"{row.name_a} <-> {row.name_b}: ref {row.miss_km:.3f} km at +{tca:.0f}s, "
          f"dense {d[i]:.3f} km at +{t[i]:.0f}s, rel vel {row.rel_vel_kmps:.2f} km/s, "
          f"{'match' if match else 'MISMATCH'}")
print(f"matches: {sum(results)}/{len(results)}")