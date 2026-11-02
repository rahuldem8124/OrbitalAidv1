"""
Analytics: snapshot-in-time metrics computed directly from current data.

SCOPE NOTE: this module intentionally only computes metrics meaningful from
a SINGLE point-in-time snapshot (risk tier distribution, altitude
distribution, response-time averages). True trend-over-time analytics (e.g.
"debris growth over the last 6 months") require repeated scheduled
screening runs accumulated over real calendar time, which this project does
not yet have — the pipeline has been run by hand a handful of times, not on
an ongoing schedule. Building a scheduler (e.g. a Railway cron job) to run
ingestion/screening/risk assessment on a recurring basis is a prerequisite
for real trend analytics, not something this module can substitute for.
"""

import logging
from collections import Counter

from app.db import SessionLocal
from app.models.models import SpaceObject, ConjunctionEvent, Alert, Maneuver
from app.screening.conjunction import approx_altitude_km

logger = logging.getLogger(__name__)

ALTITUDE_BINS_KM = [
    (0, 500, "0-500 km (Low LEO)"),
    (500, 1000, "500-1,000 km (Mid LEO)"),
    (1000, 2000, "1,000-2,000 km (High LEO)"),
    (2000, 20000, "2,000-20,000 km (MEO)"),
    (20000, 40000, "20,000-40,000 km (GEO region)"),
    (40000, float("inf"), "40,000+ km (beyond GEO)"),
]


def risk_tier_distribution(status: str = "active") -> dict:
    """Count of conjunction events per risk tier, using each event's most recent assessment."""
    session = SessionLocal()
    try:
        events = session.query(ConjunctionEvent).filter_by(status=status).all()
        counts = Counter()
        for event in events:
            if not event.risk_assessments:
                counts["unassessed"] += 1
                continue
            latest = max(event.risk_assessments, key=lambda ra: ra.computed_at)
            counts[latest.risk_tier] += 1
        return dict(counts)
    finally:
        session.close()


def altitude_distribution(object_type: str | None = None) -> dict:
    """
    Count of tracked objects per altitude band. Computed live from orbital
    elements on each call — with ~17,700 objects this takes a few seconds;
    worth caching if this becomes a frequently-hit endpoint.
    """
    session = SessionLocal()
    try:
        query = session.query(SpaceObject)
        if object_type:
            query = query.filter_by(type=object_type)
        objects = query.all()

        counts = {label: 0 for _, _, label in ALTITUDE_BINS_KM}
        skipped = 0

        for obj in objects:
            alt = approx_altitude_km(obj)
            if alt is None:
                skipped += 1
                continue
            for low, high, label in ALTITUDE_BINS_KM:
                if low <= alt < high:
                    counts[label] += 1
                    break

        return {"bins": counts, "skipped_no_elements": skipped, "total": len(objects)}
    finally:
        session.close()


def _seconds_between(start, end) -> float | None:
    """Safe duration in seconds, handling SQLite's naive-datetime quirk (see maneuvers/planner.py)."""
    if start is None or end is None:
        return None
    if start.tzinfo is not None:
        start = start.replace(tzinfo=None)
    if end.tzinfo is not None:
        end = end.replace(tzinfo=None)
    return (end - start).total_seconds()


def response_time_metrics() -> dict:
    """
    Average/median time-to-acknowledge for alerts, and time-to-decision for
    maneuvers. Only includes items actually acted on — pending items are
    excluded rather than counted as zero.
    """
    session = SessionLocal()
    try:
        alerts = session.query(Alert).filter(Alert.acknowledged_at.isnot(None)).all()
        maneuvers = session.query(Maneuver).filter(Maneuver.decided_at.isnot(None)).all()

        alert_times = [
            s for a in alerts
            if (s := _seconds_between(a.created_at, a.acknowledged_at)) is not None
        ]
        maneuver_times = [
            s for m in maneuvers
            if (s := _seconds_between(m.proposed_at, m.decided_at)) is not None
        ]

        def summarize(values: list[float]) -> dict:
            if not values:
                return {"count": 0, "avg_seconds": None, "median_seconds": None}
            sorted_values = sorted(values)
            mid = len(sorted_values) // 2
            median = (
                sorted_values[mid] if len(sorted_values) % 2 == 1
                else (sorted_values[mid - 1] + sorted_values[mid]) / 2
            )
            return {
                "count": len(values),
                "avg_seconds": round(sum(values) / len(values), 1),
                "median_seconds": round(median, 1),
            }

        return {
            "alert_acknowledgement": summarize(alert_times),
            "maneuver_decision": summarize(maneuver_times),
        }
    finally:
        session.close()