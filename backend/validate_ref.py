# validate_ref.py
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

ref = pd.read_csv("reference_events.csv")
pipe = pd.read_csv("pipeline_events.csv")
pipe_pairs = {frozenset((a, b)) for a, b in zip(pipe.norad_a, pipe.norad_b)}
ref["found"] = [frozenset((a, b)) in pipe_pairs for a, b in zip(ref.norad_a, ref.norad_b)]
sample = ref[(~ref.found) & (ref.rel_vel_kmps > 2)].sample(10, random_state=1)

session = SessionLocal()
for _, row in sample.iterrows():
    sats = []
    for name in (row.name_a, row.name_b):
        obj = session.query(SpaceObject).filter(SpaceObject.object_name == name).first()
        sats.append(build_satrec(latest_element(obj)))
    e, r, v = SatrecArray(sats).sgp4(np.full(secs.size, jd0), fr0 + secs / 86400.0)
    d = np.linalg.norm(r[0] - r[1], axis=1)
    i = int(np.argmin(d))
    print(f"{row.name_a} <-> {row.name_b}: ref {row.miss_km:.3f} km, "
          f"dense {d[i]:.3f} km at +{secs[i]:.0f}s, rel vel {row.rel_vel_kmps:.2f} km/s")
session.close()