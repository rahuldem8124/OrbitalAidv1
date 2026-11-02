"""
(keep your existing docstring)
"""

import csv
import logging
from datetime import datetime, timedelta, timezone

from app.db import SessionLocal, init_db
from app.models.models import SpaceObject
from app.ingestion.loaders import satellite_loader, station_loader, debris_loader

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# UTC time the element files were downloaded. Update this for each dataset.
DOWNLOAD_UTC = datetime(2026, 10, 24, 9, 15, tzinfo=timezone.utc)
CLOCK_SLACK = timedelta(hours=1)
FUTURE_SKIP_FILE = "future_dated_skipped.csv"


def is_future_dated(epoch) -> bool:
    if epoch.tzinfo is None:
        epoch = epoch.replace(tzinfo=timezone.utc)
    return epoch > DOWNLOAD_UTC + CLOCK_SLACK


def run_pipeline():
    init_db()
    session = SessionLocal()

    loaders = [
        ("stations", station_loader),
        ("satellites", satellite_loader),
        ("debris", debris_loader),
    ]

    seen_norad_ids = {row[0] for row in session.query(SpaceObject.norad_cat_id).all()}

    total_new = 0
    total_duplicates = 0
    future_skipped = []

    try:
        for label, loader in loaders:
            logger.info(f"Loading {label}...")
            pairs = loader.load_all()
            new_this_batch = 0

            for obj, element in pairs:
                # Check the date first, so a skipped object is never added.
                if is_future_dated(element.epoch):
                    future_skipped.append((obj.norad_cat_id, element.epoch.isoformat()))
                    continue

                if obj.norad_cat_id in seen_norad_ids:
                    total_duplicates += 1
                    continue

                seen_norad_ids.add(obj.norad_cat_id)
                session.add(obj)
                session.add(element)
                new_this_batch += 1

            session.commit()
            total_new += new_this_batch
            logger.info(f"  → {new_this_batch} new objects added for {label}")

        logger.info(f"Future-dated element sets skipped: {len(future_skipped)}")
        logger.info(f"Done. New objects: {total_new}, duplicates skipped: {total_duplicates}")

        with open(FUTURE_SKIP_FILE, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["norad_id", "epoch"])
            w.writerows(future_skipped)

    except Exception:
        session.rollback()
        logger.exception("Pipeline failed, rolled back this batch.")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    run_pipeline()