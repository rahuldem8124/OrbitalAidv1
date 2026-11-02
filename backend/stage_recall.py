# stage_recall.py
# Classifies each brute-force reference encounter as:
#   found                       - pair appears in the pipeline output
#   prefilter loss              - the element prefilter alone drops the pair
#   fine-gate loss              - the pair passes the prefilter but the pipeline still missed it
import pandas as pd

from app.db import SessionLocal
from app.models.models import SpaceObject
from app.screening.conjunction import (
    latest_element,
    semi_major_axis_km,
    circular_diff_deg,
    same_station_complex,
    ALTITUDE_BAND_TOLERANCE_KM,
    INCLINATION_TOLERANCE_DEG,
    RAAN_TOLERANCE_DEG,
)

EARTH_RADIUS_KM = 6378.137

ref = pd.read_csv("reference_events.csv")
pipe = pd.read_csv("pipeline_events.csv")
pipe_pairs = {frozenset((int(a), int(b))) for a, b in zip(pipe.norad_a, pipe.norad_b)}

session = SessionLocal()
objs = {int(o.norad_cat_id): o for o in session.query(SpaceObject).all()}


def passes_prefilter(a, b):
    oa, ob = objs.get(a), objs.get(b)
    if oa is None or ob is None:
        return False
    la, lb = latest_element(oa), latest_element(ob)
    if la is None or lb is None:
        return False
    ha = semi_major_axis_km(la.mean_motion) - EARTH_RADIUS_KM
    hb = semi_major_axis_km(lb.mean_motion) - EARTH_RADIUS_KM
    if abs(ha - hb) > ALTITUDE_BAND_TOLERANCE_KM:
        return False
    if abs(la.inclination - lb.inclination) > INCLINATION_TOLERANCE_DEG:
        return False
    if circular_diff_deg(la.ra_of_asc_node, lb.ra_of_asc_node) > RAAN_TOLERANCE_DEG:
        return False
    if same_station_complex(oa, ob):
        return False
    return True


rows = []
for _, r in ref.iterrows():
    a, b = int(r.norad_a), int(r.norad_b)
    if frozenset((a, b)) in pipe_pairs:
        cls = "found"
    elif not passes_prefilter(a, b):
        cls = "prefilter loss"
    else:
        cls = "fine-gate loss"
    rows.append((cls, float(r.rel_vel_kmps)))
session.close()

df = pd.DataFrame(rows, columns=["class", "rel_vel"])
print("Counts by class:")
print(df["class"].value_counts())
print()
bands = pd.cut(df.rel_vel, [0, 0.05, 0.5, 2, 5, 20])
print("Crosstab by relative speed (km/s):")
print(pd.crosstab(bands, df["class"]))