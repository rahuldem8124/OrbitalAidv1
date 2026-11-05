# paper_checks.py: run from backend/ with DATABASE_URL set
import os
import numpy as np
import pandas as pd
from sqlalchemy import create_engine, inspect

START = pd.Timestamp("2026-10-24 06:51:13.862304", tz="UTC")  # window start
REF = "reference_events.csv"    # committed reference (822ba7a)
PIPE = "pipeline_events.csv"    # pipeline output
DB_URL = os.environ["DATABASE_URL"]

def pair_key(df, a="norad_a", b="norad_b"):
    lo = np.minimum(df[a], df[b]).astype(str)
    hi = np.maximum(df[a], df[b]).astype(str)
    return lo + "-" + hi

ref = pd.read_csv(REF)
pipe = pd.read_csv(PIPE)
print("REF columns:", list(ref.columns))
print("PIPE columns:", list(pipe.columns))

ref["rid"] = range(len(ref))
ref["pair"] = pair_key(ref)
pipe["pair"] = pair_key(pipe)

# ---- Item 2: time-matched recall ----
pipe["p_sec"] = (pd.to_datetime(pipe["tca_utc"], utc=True) - START).dt.total_seconds()
m = ref[["rid", "pair", "tca_sec"]].merge(pipe[["pair", "p_sec"]], on="pair")
m["dt"] = (m["tca_sec"] - m["p_sec"]).abs()
print("\n== Item 2: time-matched recall ==")
print("reference encounters:", len(ref))
print("pipeline pairs present in reference:", ref.loc[ref.pair.isin(pipe.pair), "pair"].nunique(),
      "of", pipe.pair.nunique())
for tol in (60, 300):
    hit = m.loc[m.dt <= tol, "rid"].nunique()
    print(f"tol {tol:>3} s: {hit} / {len(ref)} = {100 * hit / len(ref):.2f}%")

# ---- Item 3: TIANHUI 5C/5D encounters below 5 km ----
print("\n== Item 3: TIANHUI ==")
t = ref[ref.name_a.astype(str).str.contains("TIANHUI") &
        ref.name_b.astype(str).str.contains("TIANHUI")]
t = t[t.miss_km < 5.0]
print("pairs:", t.pair.unique())
print("encounters below 5 km:", len(t))
print(t[["name_a", "name_b", "tca_sec", "miss_km"]].to_string(index=False))

# ---- Item 5: formation-pair rows in the database ----
print("\n== Item 5: formation pairs in database ==")
engine = create_engine(DB_URL)
insp = inspect(engine)
terms = ["INTELSAT", "MEV", "TERRASAR", "TANDEM"]
for table in insp.get_table_names():
    df = pd.read_sql_table(table, engine)
    text = df.astype(str).apply(lambda c: c.str.upper())
    mask = np.zeros(len(df), dtype=bool)
    for term in terms:
        mask |= text.apply(lambda c: c.str.contains(term)).any(axis=1).values
    if mask.any():
        print(f"\n-- {table}: {mask.sum()} matching rows")
        print("columns:", list(df.columns))
        print(df.loc[mask].head(20).to_string(index=False))