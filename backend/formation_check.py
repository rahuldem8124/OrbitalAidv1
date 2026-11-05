# formation_check.py: run from backend/ with DATABASE_URL set
import os
import pandas as pd
from sqlalchemy import create_engine

eng = create_engine(os.environ["DATABASE_URL"])
objs = pd.read_sql_table("objects", eng)[["id", "norad_cat_id", "object_name"]]
ev = pd.read_sql_table("conjunction_events", eng)
ra = pd.read_sql_table("risk_assessments", eng)

a = objs.rename(columns={"id": "object_a_id", "norad_cat_id": "na", "object_name": "name_a"})
b = objs.rename(columns={"id": "object_b_id", "norad_cat_id": "nb", "object_name": "name_b"})
ev = ev.merge(a, on="object_a_id").merge(b, on="object_b_id")

# keep the latest risk row per event, in case of the duplicate-run defect
ra = ra.sort_values("computed_at").drop_duplicates("conjunction_event_id", keep="last")
ev = ev.merge(ra[["conjunction_event_id", "pc", "risk_tier", "method"]],
              left_on="id", right_on="conjunction_event_id", how="left")

print("== Events in database:", len(ev), "==")
print("Tier counts:")
print(ev.risk_tier.value_counts(dropna=False).to_string())

targets = [{28358, 46113}, {31698, 36605}]
pair_set = ev.apply(lambda r: {int(r.na), int(r.nb)}, axis=1)
mask = pair_set.apply(lambda s: s in targets)
print("\n== Formation-pair rows ==")
cols = ["name_a", "name_b", "tca", "miss_distance_km", "relative_velocity_kmps",
        "status", "pc", "risk_tier", "method"]
print(ev.loc[mask, cols].to_string(index=False) if mask.any() else "NO MATCHING EVENTS")