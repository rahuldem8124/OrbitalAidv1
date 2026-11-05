# tca_mismatch.py
# Pairs present in both files whose pipeline TCA is not within 300 s of any
# reference TCA for that pair. Shows both TCAs side by side.
import pandas as pd

START = pd.Timestamp("2026-10-24 06:51:13.862304", tz="UTC")
ref = pd.read_csv("reference_events.csv")
pipe = pd.read_csv("pipeline_events.csv")
pipe["t_sec"] = (pd.to_datetime(pipe.tca_utc, utc=True) - START).dt.total_seconds()

def key(a, b):
    return (min(int(a), int(b)), max(int(a), int(b)))

ref_t = {}
for a, b, t, v in zip(ref.norad_a, ref.norad_b, ref.tca_sec, ref.rel_vel_kmps):
    ref_t.setdefault(key(a, b), []).append((round(t), round(v, 3)))

rows = []
for a, b, t, m in zip(pipe.norad_a, pipe.norad_b, pipe.t_sec, pipe.miss_km):
    k = key(a, b)
    if k not in ref_t:
        continue
    nearest = min(ref_t[k], key=lambda x: abs(x[0] - t))
    if abs(nearest[0] - t) > 300:
        rows.append((pipe.name_a[len(rows)] if False else k, round(t), m, nearest[0], nearest[1], len(ref_t[k])))

print(f"pairs in both files with no reference TCA within 300 s: {len(rows)}")
for r in rows[:15]:
    print(f"  pair {r[0]}  pipeline tca {r[1]} s (miss {r[2]} km)  nearest ref tca {r[3]} s  ref encounters {r[5]}")