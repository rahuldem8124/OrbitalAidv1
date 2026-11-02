import pandas as pd
e = pd.read_csv("pipeline_events.csv")
print("events:", len(e))
print("max rel vel (km/s):", e.rel_vel_kmps.max())
print("distinct NORAD pairs:", e.groupby(["norad_a", "norad_b"]).ngroups)
print("miss distance range (km):", e.miss_km.min(), e.miss_km.max())