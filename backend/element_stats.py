import sqlite3
import numpy as np
from datetime import datetime, timezone

START = datetime(2026, 10, 24, 6, 51, 13, tzinfo=timezone.utc)
con = sqlite3.connect("orbital_oct2026_orig.db")
epochs = []
for (e,) in con.execute("select epoch from orbital_elements"):
    t = datetime.fromisoformat(str(e))
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    epochs.append(t)

ages = np.array([(START - t).total_seconds() / 86400 for t in epochs])
print("n element sets:", len(epochs))
print("earliest epoch:", min(epochs))
print("latest epoch:", max(epochs))
print(f"age days: median {np.median(ages):.2f}, p95 {np.percentile(ages, 95):.2f}, "
      f"min {ages.min():.2f}, max {ages.max():.2f}")