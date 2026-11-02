import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("events_clean_run.csv")
fig, ax = plt.subplots(1, 2, figsize=(8, 3.2))
ax[0].hist(df["miss_distance_km"], bins=20, color="#1f77b4", edgecolor="k")
ax[0].set_xlabel("Miss distance (km)")
ax[0].set_ylabel("Number of events")
ax[1].hist(df["relative_velocity_kmps"], bins=20, color="#ff7f0e", edgecolor="k")
ax[1].set_xlabel("Relative velocity (km/s)")
plt.tight_layout()
plt.savefig("fig_histograms.pdf")
plt.savefig("fig_histograms.png", dpi=300)
print(len(df), "events plotted")