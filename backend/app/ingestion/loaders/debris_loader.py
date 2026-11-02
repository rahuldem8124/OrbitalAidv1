"""Loads data/debris/*.csv (fengyun.csv, iridium.csv) as type='debris'."""

import glob
from app.ingestion.loaders.common import load_omm_csv

def load_all(data_dir: str = "../data/debris"):
    results = []
    for filepath in glob.glob(f"{data_dir}/*.csv"):
        results.extend(load_omm_csv(filepath, object_type="debris"))
    return results