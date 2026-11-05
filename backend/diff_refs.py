# diff_refs.py
# Compares the new reference with the previous (TCA-grouped) reference.
# Lists pipeline pairs missing from the new reference, and reference pairs
# dropped by the edge rule.
import pandas as pd

ref = pd.read_csv("reference_events.csv")
old = pd.read_csv("reference_events_tca_v1.csv")
pipe = pd.read_csv("pipeline_events.csv")

def pairs(df):
    return {frozenset((int(a), int(b))) for a, b in zip(df.norad_a, df.norad_b)}

def rows_for(df, keys):
    mask = [frozenset((int(a), int(b))) in keys for a, b in zip(df.norad_a, df.norad_b)]
    return df[mask]

missing = pairs(pipe) - pairs(ref)
print(f"pipeline pairs absent from new reference: {len(missing)}")
print(rows_for(pipe, missing)[["name_a", "name_b", "tca_utc", "miss_km", "rel_vel_kmps"]].to_string(index=False))

lost = pairs(old) - pairs(ref)
print(f"\nreference pairs present before and absent now: {len(lost)}")
print(rows_for(old, lost)[["name_a", "name_b", "tca_sec", "miss_km", "rel_vel_kmps"]]
      .head(25).to_string(index=False))