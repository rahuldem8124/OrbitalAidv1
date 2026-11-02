# verify_pairs.py
# Dense 1-second ground truth for selected pairs over the full screening window.
import numpy as np
from datetime import datetime, timezone
from sgp4.api import SatrecArray, jday

from app.db import SessionLocal
from app.models.models import SpaceObject
from app.screening.conjunction import latest_element
from app.propagation.propagator import build_satrec

START = datetime(2026, 10, 24, 6, 51, 13, 862304, tzinfo=timezone.utc)
HOURS = 24

PAIRS = [
    ("STARLINK-1573", "STARLINK-34364"),
    ("AC1-002", "TRANSPORTER-18 OBJECT CH"),
    ("STARLINK-4046", "STARLINK-31997"),
    ("STARLINK-32172", "STARLINK-31843"),
]

jd0, fr0 = jday(
    START.year, START.month, START.day,
    START.hour, START.minute, START.second + START.microsecond / 1e6,
)
secs = np.arange(0, HOURS * 3600 + 1, 1.0)

session = SessionLocal()
try:
    for name_a, name_b in PAIRS:
        sats, labels = [], []
        for name in (name_a, name_b):
            obj = session.query(SpaceObject).filter(SpaceObject.object_name == name).first()
            if obj is None:
                raise SystemExit(f"Object not found in database: {name}")
            el = latest_element(obj)
            sats.append(build_satrec(el))
            labels.append(name)

        e, r, v = SatrecArray(sats).sgp4(np.full(secs.size, jd0), fr0 + secs / 86400.0)
        d = np.linalg.norm(r[0] - r[1], axis=1)
        i = int(np.argmin(d))
        rel_v = np.linalg.norm(v[0][i] - v[1][i])
        print(f"{name_a} <-> {name_b}: min {d[i]:.3f} km at +{secs[i]:.0f}s, rel vel {rel_v:.3f} km/s")
finally:
    session.close()