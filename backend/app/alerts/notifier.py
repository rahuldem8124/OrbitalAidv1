"""
Alerting: raises Alert records for critical/high/watch risk conjunctions
and delivers them through one or more channels.

DELIVERY CHANNELS: only "console" (structured log output) is actually wired
up right now — no email/SMS/Slack credentials exist in this project yet.
The channel interface below (deliver_console, deliver_email, etc.) is built
so adding a real channel later means writing one new function and adding it
to CHANNELS, not restructuring anything.

DEDUPLICATION: only one active (unacknowledged) alert is raised per
ConjunctionEvent — re-running this after screening/risk assessment won't
spam duplicate alerts for the same ongoing event.

Run directly: python -m app.alerts.notifier
"""

import logging
from datetime import datetime, timezone

from app.db import SessionLocal, init_db
from app.models.models import ConjunctionEvent, Alert, new_uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Which risk tiers actually raise an alert. "low" is intentionally excluded —
# routine, expected close passes shouldn't page anyone.
ALERTABLE_TIERS = ("critical", "high", "watch")


def deliver_console(alert: Alert, event: ConjunctionEvent):
    """Always-available delivery channel: structured log output."""
    logger.info(
        f"[{alert.severity.upper()}] {event.object_a.object_name} <-> "
        f"{event.object_b.object_name} | miss distance {event.miss_distance_km} km | "
        f"TCA {event.tca} | {alert.message}"
    )


def deliver_email(alert: Alert, event: ConjunctionEvent):
    """
    Stub: no email provider configured. Wire this up to something like
    SendGrid/SES/SMTP when ready — the call site below already routes
    critical-severity alerts here, it just no-ops for now.
    """
    logger.debug(f"[email channel not configured] would send alert {alert.id}")


def deliver_slack(alert: Alert, event: ConjunctionEvent):
    """Stub: no Slack webhook URL configured yet."""
    logger.debug(f"[slack channel not configured] would send alert {alert.id}")


# Severity -> which channels to attempt. Only "console" actually does
# anything right now; the others are safe no-ops until configured.
CHANNELS_BY_SEVERITY = {
    "critical": [deliver_console, deliver_email, deliver_slack],
    "high": [deliver_console, deliver_email],
    "watch": [deliver_console],
}


def build_message(event: ConjunctionEvent, risk_tier: str, pc: float) -> str:
    return (
        f"{risk_tier.upper()} risk conjunction: {event.object_a.object_name} and "
        f"{event.object_b.object_name} predicted {event.miss_distance_km} km apart "
        f"at {event.tca} (Pc={pc:.2e})."
    )


def raise_alerts():
    """
    For every active ConjunctionEvent whose latest RiskAssessment tier is
    alertable, raises one Alert (if one doesn't already exist unacknowledged
    for that event) and delivers it through the appropriate channels.
    """
    init_db()
    session = SessionLocal()

    events = session.query(ConjunctionEvent).filter_by(status="active").all()
    raised_count = 0

    try:
        for event in events:
            if not event.risk_assessments:
                continue

            latest_assessment = max(event.risk_assessments, key=lambda ra: ra.computed_at)
            if latest_assessment.risk_tier not in ALERTABLE_TIERS:
                continue

            # Dedup: skip if an unacknowledged alert already exists for this event
            existing = (
                session.query(Alert)
                .filter_by(conjunction_event_id=event.id, acknowledged_at=None)
                .first()
            )
            if existing:
                continue

            message = build_message(event, latest_assessment.risk_tier, latest_assessment.pc)
            channels = CHANNELS_BY_SEVERITY.get(latest_assessment.risk_tier, [deliver_console])

            alert = Alert(
                id=new_uuid(),
                conjunction_event_id=event.id,
                severity=latest_assessment.risk_tier,
                message=message,
                channels_sent=",".join(fn.__name__.replace("deliver_", "") for fn in channels),
            )
            session.add(alert)
            session.flush()  # so alert.id and relationships are available to delivery functions

            for deliver in channels:
                deliver(alert, event)

            raised_count += 1

        session.commit()
    except Exception:
        session.rollback()
        logger.exception("Alert raising failed, rolled back this batch.")
        raise
    finally:
        session.close()

    logger.info(f"Done. {raised_count} alert(s) raised.")
    return raised_count


def acknowledge_alert(alert_id: str, acknowledged_by: str):
    """Mark an alert as acknowledged by a named person/system."""
    session = SessionLocal()
    try:
        alert = session.query(Alert).filter_by(id=alert_id).first()
        if not alert:
            raise ValueError(f"No alert with id {alert_id}")
        alert.acknowledged_by = acknowledged_by
        alert.acknowledged_at = datetime.now(timezone.utc)
        session.commit()
        logger.info(f"Alert {alert_id} acknowledged by {acknowledged_by}")
    finally:
        session.close()


if __name__ == "__main__":
    raise_alerts()