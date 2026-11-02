# export_events.py
import pandas as pd
from app.db import SessionLocal
from app.models.models import ConjunctionEvent, SpaceObject

session = SessionLocal()
rows = []
for ev in session.query(ConjunctionEvent).all():
    a = session.query(SpaceObject).get(ev.object_a_id)
    b = session.query(SpaceObject).get(ev.object_b_id)
    rows.append({
        "norad_a": int(a.norad_cat_id), "norad_b": int(b.norad_cat_id),
        "name_a": a.object_name, "name_b": b.object_name,
        "tca_utc": ev.tca, "miss_km": ev.miss_distance_km,
        "rel_vel_kmps": ev.relative_velocity_kmps,
    })
session.close()
pd.DataFrame(rows).to_csv("pipeline_events.csv", index=False)
print(f"exported {len(rows)} events to pipeline_events.csv")