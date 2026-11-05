# pm10_recall.py: run from backend/
import pandas as pd
import numpy as np

def key(d):
    lo = np.minimum(d.norad_a, d.norad_b).astype(str)
    hi = np.maximum(d.norad_a, d.norad_b).astype(str)
    return lo + "-" + hi

pipe_pairs = set(key(pd.read_csv("pipeline_events.csv")))

for f in ["reference_events.csv", "reference_events_pm10.csv"]:
    r = pd.read_csv(f)
    hit = key(r).isin(pipe_pairs)
    zero = r.rel_vel_kmps == 0
    print(f"\n{f}")
    print(f"  encounters {len(r)}  pairs {key(r).nunique()}")
    print(f"  recovered {hit.sum()}  = {100 * hit.mean():.2f}%")
    print(f"  zero-speed encounters {zero.sum()}  recovered {(hit & zero).sum()}")
    if (hit & zero).any():
        print(r.loc[hit & zero, ["name_a", "name_b", "miss_km"]].to_string(index=False))