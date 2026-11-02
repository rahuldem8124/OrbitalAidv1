"""Loads data/stations/*.csv (space_stations.csv) as type='station'."""

import glob
from app.ingestion.loaders.common import load_omm_csv

def load_all(data_dir: str = "../data/stations"):
    results = []
    for filepath in glob.glob(f"{data_dir}/*.csv"):
        results.extend(load_omm_csv(filepath, object_type="station"))
    return results