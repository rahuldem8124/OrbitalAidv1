"""
Shared CSV parsing logic for CelesTrak/Space-Track OMM-format files.
All five datasets (active_sat, starlink, fengyun, iridium, space_stations)
use the exact same column schema, so every loader delegates here.
"""

import pandas as pd
from app.models.models import SpaceObject, OrbitalElement, new_uuid

REQUIRED_COLUMNS = [
    "OBJECT_NAME", "OBJECT_ID", "EPOCH", "MEAN_MOTION", "ECCENTRICITY",
    "INCLINATION", "RA_OF_ASC_NODE", "ARG_OF_PERICENTER", "MEAN_ANOMALY",
    "EPHEMERIS_TYPE", "CLASSIFICATION_TYPE", "NORAD_CAT_ID",
    "ELEMENT_SET_NO", "REV_AT_EPOCH", "BSTAR", "MEAN_MOTION_DOT", "MEAN_MOTION_DDOT",
]


def load_omm_csv(filepath: str, object_type: str) -> list[tuple[SpaceObject, OrbitalElement]]:
    """
    Parse one CelesTrak-style OMM CSV into (SpaceObject, OrbitalElement) pairs.
    object_type: "satellite" | "station" | "debris"
    """
    df = pd.read_csv(filepath)

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"{filepath} is missing expected columns: {missing}")

    source_file = filepath.replace("\\", "/").split("/")[-1]
    results = []

    for _, row in df.iterrows():
        obj = SpaceObject(
            id=new_uuid(),
            norad_cat_id=int(row["NORAD_CAT_ID"]),
            object_name=str(row["OBJECT_NAME"]).strip(),
            object_id=str(row["OBJECT_ID"]) if pd.notna(row["OBJECT_ID"]) else None,
            type=object_type,
            source_file=source_file,
            classification_type=row.get("CLASSIFICATION_TYPE"),
        )

        element = OrbitalElement(
            id=new_uuid(),
            object_id=obj.id,
            epoch=pd.to_datetime(row["EPOCH"]),
            mean_motion=float(row["MEAN_MOTION"]),
            eccentricity=float(row["ECCENTRICITY"]),
            inclination=float(row["INCLINATION"]),
            ra_of_asc_node=float(row["RA_OF_ASC_NODE"]),
            arg_of_pericenter=float(row["ARG_OF_PERICENTER"]),
            mean_anomaly=float(row["MEAN_ANOMALY"]),
            ephemeris_type=int(row["EPHEMERIS_TYPE"]) if pd.notna(row["EPHEMERIS_TYPE"]) else None,
            element_set_no=int(row["ELEMENT_SET_NO"]) if pd.notna(row["ELEMENT_SET_NO"]) else None,
            rev_at_epoch=int(row["REV_AT_EPOCH"]) if pd.notna(row["REV_AT_EPOCH"]) else None,
            bstar=float(row["BSTAR"]) if pd.notna(row["BSTAR"]) else None,
            mean_motion_dot=float(row["MEAN_MOTION_DOT"]) if pd.notna(row["MEAN_MOTION_DOT"]) else None,
            mean_motion_ddot=float(row["MEAN_MOTION_DDOT"]) if pd.notna(row["MEAN_MOTION_DDOT"]) else None,
        )
        results.append((obj, element))

    return results