# time_matched.py
# Time-matched recall: a reference encounter is recovered only if the pipeline
# reports the same NORAD pair with a TCA within TOL_S seconds of the reference TCA.
# Usage: py time_matched.py [reference_csv] [tolerance_seconds]
import sys
import pandas as pd

ref_path = sys.argv[1] if len(sys.argv) > 1 else "reference_events.csv"
TOL_S = float(sys.argv[2]) if len(sys.argv) > 2 else 60.0
START = pd.Timestamp("2026-10-24 06:51:13.862304", tz="UTC")

ref = pd.read_csv(ref_path)
pipe = pd.read_csv("pipeline_events.csv")
pipe["t_sec"] = (pd.to_datetime(pipe.tca_utc, utc=True) - START).dt.total_seconds()

def key(a, b):
    a, b = int(a), int(b)
    return (min(a, b), max(a, b))

pipe_tca = {}
for a, b, t in zip(pipe.norad_a, pipe.norad_b, pipe.t_sec):
    pipe_tca.setdefault(key(a, b), []).append(t)

ref["matched"] = [
    any(abs(t - rt) <= TOL_S for t in pipe_tca.get(key(a, b), []))
    for a, b, rt in zip(ref.norad_a, ref.norad_b, ref.tca_sec)
]

ref_pairs = ref.groupby(["norad_a", "norad_b"]).ngroups
matched_pairs = ref[ref.matched].groupby(["norad_a", "norad_b"]).ngroups

print(f"reference file: {ref_path}")
print(f"time tolerance: +/-{TOL_S:.0f} s")
print(f"reference encounters: {len(ref)}")
print(f"time-matched encounters: {ref.matched.sum()}")
print(f"time-matched encounter recall: {ref.matched.mean():.4f}")
print(f"time-matched pairs: {matched_pairs} of {ref_pairs}")
print(f"time-matched pair recall: {matched_pairs / ref_pairs:.4f}")

bands = pd.cut(ref.rel_vel_kmps, [-0.001, 0.05, 0.5, 2, 5, 20], include_lowest=True)
print(ref.groupby(bands, observed=False)["matched"].agg(["size", "sum", "mean"]))