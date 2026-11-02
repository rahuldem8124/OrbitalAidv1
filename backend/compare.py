# compare.py
import pandas as pd

ref = pd.read_csv("reference_events.csv")
pipe = pd.read_csv("pipeline_events.csv")

pipe_pairs = {frozenset((a, b)) for a, b in zip(pipe.norad_a, pipe.norad_b)}
ref["found"] = [frozenset((a, b)) in pipe_pairs
                for a, b in zip(ref.norad_a, ref.norad_b)]

print(f"reference encounters: {len(ref)}")
print(f"pipeline events: {len(pipe)}")
print(f"recall (encounters): {ref.found.mean():.3f}")
print(ref.groupby(pd.cut(ref.rel_vel_kmps, [0, 0.05, 0.5, 2, 5, 20]))["found"]
         .agg(["size", "mean"]))