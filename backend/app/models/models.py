"""
SQLAlchemy ORM models for OrbitalAid.
Satellites, stations, and debris all live in one SpaceObject table,
differentiated by `type` — this is what lets risk-screening compare
across categories in a single query.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def new_uuid():
    return str(uuid.uuid4())


class SpaceObject(Base):
    """A tracked object: satellite, station, or debris fragment."""
    __tablename__ = "objects"

    id = Column(String, primary_key=True, default=new_uuid)
    norad_cat_id = Column(Integer, unique=True, index=True, nullable=False)
    object_name = Column(String, nullable=False)
    object_id = Column(String, nullable=True)  # COSPAR ID, e.g. "1998-067A"
    type = Column(Enum("satellite", "station", "debris", name="object_type"), nullable=False)
    source_file = Column(String, nullable=False)  # e.g. "starlink.csv"
    classification_type = Column(String, nullable=True)

    # No dataset provides real fleet ownership — this defaults False for
    # everything ingested. Flip to True manually (or via a future admin UI)
    # for objects that represent your own assets, so maneuver planning has
    # something real to target instead of guessing.
    is_own_asset = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    elements = relationship("OrbitalElement", back_populates="object", cascade="all, delete-orphan")


class OrbitalElement(Base):
    """One epoch's mean orbital elements for a SpaceObject (CelesTrak OMM format)."""
    __tablename__ = "orbital_elements"

    id = Column(String, primary_key=True, default=new_uuid)
    object_id = Column(String, ForeignKey("objects.id"), nullable=False, index=True)

    epoch = Column(DateTime, nullable=False, index=True)
    mean_motion = Column(Float, nullable=False)         # revs/day
    eccentricity = Column(Float, nullable=False)
    inclination = Column(Float, nullable=False)          # degrees
    ra_of_asc_node = Column(Float, nullable=False)        # degrees
    arg_of_pericenter = Column(Float, nullable=False)     # degrees
    mean_anomaly = Column(Float, nullable=False)          # degrees
    ephemeris_type = Column(Integer, nullable=True)
    element_set_no = Column(Integer, nullable=True)
    rev_at_epoch = Column(Integer, nullable=True)
    bstar = Column(Float, nullable=True)
    mean_motion_dot = Column(Float, nullable=True)
    mean_motion_ddot = Column(Float, nullable=True)

    ingested_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    object = relationship("SpaceObject", back_populates="elements")


class ConjunctionEvent(Base):
    """A detected close-approach pair between two objects."""
    __tablename__ = "conjunction_events"

    id = Column(String, primary_key=True, default=new_uuid)
    object_a_id = Column(String, ForeignKey("objects.id"), nullable=False, index=True)
    object_b_id = Column(String, ForeignKey("objects.id"), nullable=False, index=True)

    tca = Column(DateTime, nullable=False)  # time of closest approach
    miss_distance_km = Column(Float, nullable=False)
    relative_velocity_kmps = Column(Float, nullable=True)
    status = Column(Enum("active", "resolved", "expired", name="conjunction_status"), default="active")

    detected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    object_a = relationship("SpaceObject", foreign_keys=[object_a_id])
    object_b = relationship("SpaceObject", foreign_keys=[object_b_id])
    risk_assessments = relationship(
        "RiskAssessment", back_populates="conjunction_event", cascade="all, delete-orphan"
    )
    maneuvers = relationship(
        "Maneuver", back_populates="conjunction_event", cascade="all, delete-orphan"
    )
    alerts = relationship(
        "Alert", back_populates="conjunction_event", cascade="all, delete-orphan"
    )


class RiskAssessment(Base):
    """Computed probability-of-collision score for a ConjunctionEvent, at a point in time."""
    __tablename__ = "risk_assessments"

    id = Column(String, primary_key=True, default=new_uuid)
    conjunction_event_id = Column(String, ForeignKey("conjunction_events.id"), nullable=False, index=True)

    pc = Column(Float, nullable=False)  # probability of collision, 0.0-1.0
    risk_tier = Column(Enum("critical", "high", "watch", "low", name="risk_tier"), nullable=False)
    method = Column(String, default="approx_gaussian_no_covariance")
    computed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    conjunction_event = relationship("ConjunctionEvent", back_populates="risk_assessments")


class Maneuver(Base):
    """
    A proposed/executed avoidance maneuver for one asset in a ConjunctionEvent.

    fuel_cost_kg is nullable — computing it for real needs object mass and
    thruster Isp, neither of which exist in the source datasets. Delta-v is
    real orbital-mechanics math; fuel cost is intentionally left blank
    rather than guessed.
    """
    __tablename__ = "maneuvers"

    id = Column(String, primary_key=True, default=new_uuid)
    conjunction_event_id = Column(String, ForeignKey("conjunction_events.id"), nullable=False, index=True)
    asset_id = Column(String, ForeignKey("objects.id"), nullable=False, index=True)

    delta_v_mps = Column(Float, nullable=False)  # required delta-v, meters/second
    predicted_new_miss_distance_km = Column(Float, nullable=False)
    fuel_cost_kg = Column(Float, nullable=True)  # left null — see docstring

    status = Column(
        Enum("proposed", "under_review", "approved", "executed", "verified", "rejected",
             name="maneuver_status"),
        default="proposed",
    )

    proposed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    decided_by = Column(String, nullable=True)
    decided_at = Column(DateTime, nullable=True)
    notes = Column(String, nullable=True)

    conjunction_event = relationship("ConjunctionEvent", back_populates="maneuvers")
    asset = relationship("SpaceObject", foreign_keys=[asset_id])


class Alert(Base):
    """
    A notification raised for a risky ConjunctionEvent, delivered through
    one or more channels (console always; email/SMS/Slack/webhook are
    pluggable but unconfigured by default — see alerts/notifier.py).
    """
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, default=new_uuid)
    conjunction_event_id = Column(String, ForeignKey("conjunction_events.id"), nullable=False, index=True)

    severity = Column(Enum("critical", "high", "watch", name="alert_severity"), nullable=False)
    message = Column(String, nullable=False)
    channels_sent = Column(String, nullable=True)  # comma-separated list, e.g. "console,email"

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    acknowledged_by = Column(String, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    
    resolved_by = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    conjunction_event = relationship("ConjunctionEvent", back_populates="alerts")


class EventLog(Base):
    __tablename__ = 'event_logs'
    id = Column(String, primary_key=True, default=new_uuid)
    conjunction_event_id = Column(String, ForeignKey('conjunction_events.id'), nullable=True)
    action = Column(String, nullable=False)
    actor = Column(String, default='system')
    timestamp = Column(DateTime, default=datetime.utcnow)
    details = Column(String, nullable=True)
    
    conjunction_event = relationship('ConjunctionEvent')


class SystemSettings(Base):
    __tablename__ = 'system_settings'
    id = Column(Integer, primary_key=True, default=1)
    screening_distance_km = Column(Float, default=5.0)
    screening_time_window_hours = Column(Integer, default=24)
    auto_screening = Column(Boolean, default=True)
    screening_frequency_minutes = Column(Integer, default=60)
    data_refresh_interval_minutes = Column(Integer, default=30)
    risk_critical_threshold = Column(Float, default=1e-4)
    risk_high_threshold = Column(Float, default=1e-5)
    risk_watch_threshold = Column(Float, default=1e-6)
    alert_enabled = Column(Boolean, default=True)
    alert_critical_enabled = Column(Boolean, default=True)
    alert_high_enabled = Column(Boolean, default=True)
    alert_watch_enabled = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)