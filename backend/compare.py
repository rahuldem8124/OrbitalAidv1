# compare.py
import sys
import pandas as pd

ref_path = sys.argv[1] if len(sys.argv) > 1 else "reference_events.csv"
ref = pd.read_csv(ref_path)
pipe = pd.read_csv("pipeline_events.csv")

pipe_pairs = {frozenset((int(a), int(b))) for a, b in zip(pipe.norad_a, pipe.norad_b)}
ref["found"] = [frozenset((int(a), int(b))) in pipe_pairs
                for a, b in zip(ref.norad_a, ref.norad_b)]
ref_pairs = {frozenset((int(a), int(b))) for a, b in zip(ref.norad_a, ref.norad_b)}

print(f"reference file: {ref_path}")
print(f"reference encounters: {len(ref)}")
print(f"reference pairs: {len(ref_pairs)}")
print(f"encounter-level recall: {ref.found.sum()}/{len(ref)} = {ref.found.mean():.4f}")
print(f"pair-level recall: {len(ref_pairs & pipe_pairs)}/{len(ref_pairs)}")