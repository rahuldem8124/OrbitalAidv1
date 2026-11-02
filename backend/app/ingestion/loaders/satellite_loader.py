"""Loads data/satellites/*.csv (active_sat.csv, starlink.csv) as type='satellite'."""

import glob
from app.ingestion.loaders.common import load_omm_csv

def load_all(data_dir: str = "../data/satellites"):
    results = []
    for filepath in glob.glob(f"{data_dir}/*.csv"):
        results.extend(load_omm_csv(filepath, object_type="satellite"))
    return results