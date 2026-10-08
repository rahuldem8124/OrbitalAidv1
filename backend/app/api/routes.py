"""
API routes: exposes the ingestion/screening/risk/maneuver/alert pipeline
to the Next.js frontend.

Response shape note: hand-serializes SQLAlchemy objects into dicts rather
than using Pydantic response models, to keep this file self-contained while
the schema is still actively changing. Worth migrating to Pydantic schemas
once the data shape stabilizes and the frontend is actually consuming this.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.db import SessionLocal
from app.models.models import SpaceObject, ConjunctionEvent, RiskAssessment, Maneuver, Alert, EventLog, SystemSettings
from sqlalchemy import or_, and_, desc, asc, func, String
from sqlalchemy.orm import aliased
from datetime import timedelta
from app.propagation.propagator import propagate_object
from app.simulation.simulator import screen_new_object, simulate_maneuver
from app.analytics.analytics import risk_tier_distribution, altitude_distribution, response_time_metrics

router = APIRouter()


def ts(dt) -> str | None:
    if dt is None:
        return None
    if hasattr(dt, 'tzinfo') and dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')




# ---------- serialization helpers ----------

def serialize_object(obj: SpaceObject) -> dict:
    return {
        "id": obj.id,
        "norad_cat_id": obj.norad_cat_id,
        "object_name": obj.object_name,
        "object_id": obj.object_id,
        "type": obj.type,
        "is_own_asset": obj.is_own_asset,
        "source_file": obj.source_file,
    }


def serialize_conjunction(event: ConjunctionEvent) -> dict:
    latest_assessment = (
        max(event.risk_assessments, key=lambda ra: ra.computed_at)
        if event.risk_assessments else None
    )
    latest_maneuver = (
        max(event.maneuvers, key=lambda m: m.proposed_at)
        if event.maneuvers else None
    )
    risk_tier = latest_assessment.risk_tier if latest_assessment else None

    preventive_action = "Assessment Pending"
    if risk_tier == "low": preventive_action = "Continue Monitoring"
    elif risk_tier == "watch": preventive_action = "Enhanced Monitoring"
    elif risk_tier == "high": preventive_action = "Evaluate Maneuver"
    elif risk_tier == "critical": preventive_action = "Immediate Maneuver Analysis"

    return {
        "id": event.id,
        "object_a": serialize_object(event.object_a) if event.object_a else None,
        "object_b": serialize_object(event.object_b) if event.object_b else None,
        "object_a_name": event.object_a.object_name if event.object_a else None,
        "object_b_name": event.object_b.object_name if event.object_b else None,
        "tca": ts(event.tca) if event.tca else None,
        "miss_distance_km": event.miss_distance_km,
        "relative_velocity_kmps": event.relative_velocity_kmps,
        "status": event.status,
        "risk_tier": risk_tier,
        "pc": latest_assessment.pc if latest_assessment else None,
        "risk_method": latest_assessment.method if latest_assessment else None,
        "risk_assessment": {
            "pc": latest_assessment.pc,
            "risk_tier": latest_assessment.risk_tier,
            "method": latest_assessment.method,
            "computed_at": ts(latest_assessment.computed_at) if latest_assessment.computed_at else None
        } if latest_assessment else None,
        "maneuver": {
            "id": latest_maneuver.id,
            "status": latest_maneuver.status,
            "delta_v_mps": latest_maneuver.delta_v_mps
        } if latest_maneuver else None,
        "preventive_action": preventive_action,
    }


def serialize_maneuver(m: Maneuver) -> dict:
    return {
        "id": m.id,
        "conjunction_event_id": m.conjunction_event_id,
        "asset": serialize_object(m.asset),
        "delta_v_mps": m.delta_v_mps,
        "predicted_new_miss_distance_km": m.predicted_new_miss_distance_km,
        "fuel_cost_kg": m.fuel_cost_kg,
        "status": m.status,
        "proposed_at": ts(m.proposed_at),
        "decided_by": m.decided_by,
        "decided_at": ts(m.decided_at),
        "notes": m.notes,
    }


def serialize_alert(a: Alert) -> dict:
    return {
        "id": a.id,
        "conjunction_event_id": a.conjunction_event_id,
        "severity": a.severity,
        "message": a.message,
        "channels_sent": a.channels_sent,
        "created_at": ts(a.created_at),
        "acknowledged_by": a.acknowledged_by,
        "acknowledged_at": ts(a.acknowledged_at),
        "resolved_by": getattr(a, 'resolved_by', None),
        "resolved_at": ts(a.resolved_at),
    }


# ---------- objects ----------

@router.get("/objects")
def list_objects(
    type: str | None = Query(None, description="Filter by satellite|station|debris"),
    limit: int = Query(100, le=1000),
    offset: int = 0,
):
    session = SessionLocal()
    try:
        query = session.query(SpaceObject)
        if type:
            query = query.filter_by(type=type)
        objects = query.offset(offset).limit(limit).all()
        total = query.count()
        return {"total": total, "objects": [serialize_object(o) for o in objects]}
    finally:
        session.close()


@router.get("/objects/positions")
def get_object_positions(
    type: str | None = Query(None, description="Filter by satellite|station|debris"),
    limit: int = Query(300, le=2000),
    at: str | None = Query(None, description="ISO timestamp, defaults to now (UTC)"),
):
    session = SessionLocal()
    try:
        when = datetime.fromisoformat(at) if at else datetime.now(timezone.utc)
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)

        query = session.query(SpaceObject)
        if type:
            query = query.filter_by(type=type)
        objects = query.limit(limit).all()

        positions = []
        skipped = 0
        for obj in objects:
            try:
                result = propagate_object(obj, when)
            except ValueError:
                skipped += 1
                continue
            if result["error"] != 0:
                skipped += 1
                continue
            x, y, z = result["position_km"]
            positions.append({
                "id": obj.id,
                "object_name": obj.object_name,
                "type": obj.type,
                "position_km": [x, y, z],
            })

        return {
            "total": len(positions),
            "skipped": skipped,
            "at": when.isoformat(),
            "positions": positions,
        }
    finally:
        session.close()


@router.get("/objects/{object_id}")
def get_object(object_id: str):
    session = SessionLocal()
    try:
        obj = session.query(SpaceObject).filter_by(id=object_id).first()
        if not obj:
            raise HTTPException(404, "Object not found")
        return serialize_object(obj)
    finally:
        session.close()


# ---------- conjunctions ----------

@router.get("/conjunctions")
def list_conjunctions(
    status: str | None = Query(None),
    risk_tier: str | None = Query(None, description="Filter by critical|high|watch|low"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, le=200),
    date_from: str | None = None,
    date_to: str | None = None,
    object_id: str | None = None,
    search: str | None = None,
    sort_by: str = Query("tca"),
    sort_order: str = Query("asc"),
):
    session = SessionLocal()
    try:
        query = session.query(ConjunctionEvent)
        if status:
            query = query.filter(ConjunctionEvent.status == status)

        if date_from:
            query = query.filter(ConjunctionEvent.tca >= datetime.fromisoformat(date_from))
        if date_to:
            query = query.filter(ConjunctionEvent.tca <= datetime.fromisoformat(date_to))
        
        if object_id:
            query = query.filter(
                or_(
                    ConjunctionEvent.object_a_id == object_id,
                    ConjunctionEvent.object_b_id == object_id
                )
            )

        if search:
            search_pattern = f"%{search}%"
            # In order to search by object name/NORAD ID, we could do joins, but to keep it simple,
            # we just filter on event.id, object_a.object_name, object_b.object_name, etc.
            obj_a = aliased(SpaceObject)
            obj_b = aliased(SpaceObject)
            query = query.outerjoin(obj_a, ConjunctionEvent.object_a_id == obj_a.id) \
                         .outerjoin(obj_b, ConjunctionEvent.object_b_id == obj_b.id)
            query = query.filter(
                or_(
                    ConjunctionEvent.id.ilike(search_pattern),
                    obj_a.object_name.ilike(search_pattern),
                    obj_b.object_name.ilike(search_pattern),
                    func.cast(obj_a.norad_cat_id, String).ilike(search_pattern),
                    func.cast(obj_b.norad_cat_id, String).ilike(search_pattern)
                )
            )

        # We can sort by tca, miss_distance, risk
        if sort_by == 'miss_distance':
            col = ConjunctionEvent.miss_distance_km
            query = query.order_by(col.desc() if sort_order == 'desc' else col.asc())
        elif sort_by == 'risk':
            # Sorting by risk tier requires a join or complex ordering, doing it simply:
            query = query.outerjoin(RiskAssessment).order_by(
                RiskAssessment.pc.desc() if sort_order == 'desc' else RiskAssessment.pc.asc()
            )
        else: # default tca
            col = ConjunctionEvent.tca
            query = query.order_by(col.desc() if sort_order == 'desc' else col.asc())

        # Risk tier filter in python (since we might have multiple risk assessments)
        events = query.all()
        serialized = [serialize_conjunction(e) for e in events]
        if risk_tier:
            serialized = [e for e in serialized if e["risk_tier"] == risk_tier]

        total = len(serialized)
        pages = (total + per_page - 1) // per_page
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        items = serialized[start_idx:end_idx]

        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": pages
        }
    finally:
        session.close()


@router.get("/conjunctions/{event_id}")
def get_conjunction(event_id: str):
    session = SessionLocal()
    try:
        event = session.query(ConjunctionEvent).filter_by(id=event_id).first()
        if not event:
            raise HTTPException(404, "Conjunction event not found")
        return serialize_conjunction(event)
    finally:
        session.close()


# ---------- maneuvers ----------

class ManeuverDecision(BaseModel):
    decided_by: str
    notes: str | None = None


@router.get("/maneuvers")
def list_maneuvers(
    status: str | None = Query(None),
    conjunction_event_id: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, le=200)
):
    session = SessionLocal()
    try:
        query = session.query(Maneuver)
        if status:
            query = query.filter(Maneuver.status == status)
        if conjunction_event_id:
            query = query.filter(Maneuver.conjunction_event_id == conjunction_event_id)
            
        maneuvers = query.order_by(Maneuver.proposed_at.desc()).all()
        serialized = [serialize_maneuver(m) for m in maneuvers]

        total = len(serialized)
        pages = (total + per_page - 1) // per_page
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        items = serialized[start_idx:end_idx]

        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": pages,
            "maneuvers": serialized  # To keep backwards compatibility just in case
        }
    finally:
        session.close()


@router.post("/maneuvers/{maneuver_id}/approve")
def approve_maneuver_endpoint(maneuver_id: str, decision: ManeuverDecision):
    session = SessionLocal()
    try:
        maneuver = session.query(Maneuver).filter_by(id=maneuver_id).first()
        if not maneuver:
            raise HTTPException(404, "Maneuver not found")
        maneuver.status = "approved"
        maneuver.decided_by = decision.decided_by
        maneuver.decided_at = datetime.now(timezone.utc)
        maneuver.notes = decision.notes
        session.commit()
        return serialize_maneuver(maneuver)
    finally:
        session.close()


@router.post("/maneuvers/{maneuver_id}/reject")
def reject_maneuver_endpoint(maneuver_id: str, decision: ManeuverDecision):
    session = SessionLocal()
    try:
        maneuver = session.query(Maneuver).filter_by(id=maneuver_id).first()
        if not maneuver:
            raise HTTPException(404, "Maneuver not found")
        maneuver.status = "rejected"
        maneuver.decided_by = decision.decided_by
        maneuver.decided_at = datetime.now(timezone.utc)
        maneuver.notes = decision.notes
        session.commit()
        return serialize_maneuver(maneuver)
    finally:
        session.close()


# ---------- alerts ----------

class AlertAcknowledgement(BaseModel):
    acknowledged_by: str


@router.get("/alerts")
def list_alerts(
    unacknowledged_only: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, le=200),
    severity: str | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None
):
    session = SessionLocal()
    try:
        query = session.query(Alert)
        if unacknowledged_only:
            query = query.filter(Alert.acknowledged_at == None)
        
        if severity:
            query = query.filter(Alert.severity == severity)
        if date_from:
            query = query.filter(Alert.created_at >= datetime.fromisoformat(date_from))
        if date_to:
            query = query.filter(Alert.created_at <= datetime.fromisoformat(date_to))
        
        if status == 'active':
            query = query.filter(Alert.resolved_at == None)
        elif status == 'resolved':
            query = query.filter(Alert.resolved_at != None)
        elif status == 'acknowledged':
            query = query.filter(Alert.acknowledged_at != None)

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Alert.id.ilike(search_pattern),
                    Alert.message.ilike(search_pattern)
                )
            )

        alerts = query.order_by(Alert.created_at.desc()).all()
        serialized = [serialize_alert(a) for a in alerts]

        total = len(serialized)
        pages = (total + per_page - 1) // per_page
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        items = serialized[start_idx:end_idx]

        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": pages,
            "alerts": serialized
        }
    finally:
        session.close()


@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert_endpoint(alert_id: str, ack: AlertAcknowledgement):
    session = SessionLocal()
    try:
        alert = session.query(Alert).filter_by(id=alert_id).first()
        if not alert:
            raise HTTPException(404, "Alert not found")
        alert.acknowledged_by = ack.acknowledged_by
        alert.acknowledged_at = datetime.now(timezone.utc)
        session.commit()
        return serialize_alert(alert)
    finally:
        session.close()


# ---------- dashboard summary ----------

@router.get("/stats/summary")
def stats_summary():
    session = SessionLocal()
    try:
        total_objects = session.query(SpaceObject).count()
        satellites = session.query(SpaceObject).filter_by(type="satellite").count()
        stations = session.query(SpaceObject).filter_by(type="station").count()
        debris = session.query(SpaceObject).filter_by(type="debris").count()

        active_conjunctions = session.query(ConjunctionEvent).filter_by(status="active").count()
        pending_maneuvers = session.query(Maneuver).filter_by(status="proposed").count()
        unacknowledged_alerts = session.query(Alert).filter_by(acknowledged_at=None).count()

        return {
            "total_objects": total_objects,
            "satellites": satellites,
            "stations": stations,
            "debris": debris,
            "active_conjunctions": active_conjunctions,
            "pending_maneuvers": pending_maneuvers,
            "unacknowledged_alerts": unacknowledged_alerts,
        }
    finally:
        session.close()


# ---------- simulation ----------

class OrbitalElementsInput(BaseModel):
    name: str = "SIMULATED-OBJECT"
    mean_motion: float
    eccentricity: float
    inclination: float
    ra_of_asc_node: float
    arg_of_pericenter: float
    mean_anomaly: float
    bstar: float = 0.0
    mean_motion_dot: float = 0.0
    mean_motion_ddot: float = 0.0


class ManeuverSimulationInput(BaseModel):
    asset_id: str
    threat_id: str
    delta_v_mps: float


@router.post("/simulations/new-object")
def simulate_new_object_endpoint(input: OrbitalElementsInput):
    try:
        return screen_new_object(input.model_dump(exclude={"name"}), name=input.name)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/simulations/maneuver")
def simulate_maneuver_endpoint(input: ManeuverSimulationInput):
    try:
        return simulate_maneuver(input.asset_id, input.threat_id, input.delta_v_mps)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ---------- analytics ----------

@router.get("/analytics/risk-distribution")
def analytics_risk_distribution(status: str = Query("active")):
    return risk_tier_distribution(status)


@router.get("/analytics/altitude-distribution")
def analytics_altitude_distribution(type: str | None = Query(None)):
    return altitude_distribution(type)


@router.get("/analytics/response-times")
def analytics_response_times():
    return response_time_metrics()

# ---------- new endpoints ----------

class StatusUpdate(BaseModel):
    status: str

@router.get("/conjunctions/{event_id}/timeline")
def get_conjunction_timeline(event_id: str):
    session = SessionLocal()
    try:
        logs = session.query(EventLog).filter_by(conjunction_event_id=event_id).order_by(EventLog.timestamp.asc()).all()
        return [
            {
                "id": log.id,
                "action": log.action,
                "actor": log.actor,
                "timestamp": ts(log.timestamp),
                "details": log.details
            } for log in logs
        ]
    finally:
        session.close()

@router.get("/maneuvers/{maneuver_id}")
def get_maneuver(maneuver_id: str):
    session = SessionLocal()
    try:
        m = session.query(Maneuver).filter_by(id=maneuver_id).first()
        if not m:
            raise HTTPException(404, "Maneuver not found")
        return serialize_maneuver(m)
    finally:
        session.close()

@router.patch("/maneuvers/{maneuver_id}")
def update_maneuver_status(maneuver_id: str, update: StatusUpdate):
    session = SessionLocal()
    try:
        m = session.query(Maneuver).filter_by(id=maneuver_id).first()
        if not m:
            raise HTTPException(404, "Maneuver not found")
        
        valid_transitions = ["proposed", "under_review", "approved", "executed", "verified", "rejected"]
        if update.status not in valid_transitions:
            raise HTTPException(400, "Invalid status")
            
        m.status = update.status
        log = EventLog(
            conjunction_event_id=m.conjunction_event_id,
            action=update.status,
            actor="operator",
            details=f"Maneuver {m.id} status updated to {update.status}"
        )
        session.add(log)
        session.commit()
        return serialize_maneuver(m)
    finally:
        session.close()

@router.get("/alerts/{alert_id}")
def get_alert(alert_id: str):
    session = SessionLocal()
    try:
        a = session.query(Alert).filter_by(id=alert_id).first()
        if not a:
            raise HTTPException(404, "Alert not found")
        return serialize_alert(a)
    finally:
        session.close()

class ResolveAlert(BaseModel):
    resolved_by: str

@router.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str, data: ResolveAlert):
    session = SessionLocal()
    try:
        a = session.query(Alert).filter_by(id=alert_id).first()
        if not a:
            raise HTTPException(404, "Alert not found")
        a.resolved_by = data.resolved_by
        a.resolved_at = datetime.now(timezone.utc)
        
        log = EventLog(
            conjunction_event_id=a.conjunction_event_id,
            action="resolved",
            actor=data.resolved_by,
            details=f"Alert {a.id} resolved"
        )
        session.add(log)
        session.commit()
        return serialize_alert(a)
    finally:
        session.close()

@router.get("/system/health")
def system_health():
    session = SessionLocal()
    try:
        objects_tracked = session.query(SpaceObject).count()
        conjunctions_active = session.query(ConjunctionEvent).filter_by(status="active").count()
        risk_assessments = session.query(RiskAssessment).count()
        alerts_active = session.query(Alert).filter(Alert.resolved_at == None).count()
        maneuvers_pending = session.query(Maneuver).filter_by(status="proposed").count()
        
        latest_event = session.query(ConjunctionEvent).order_by(ConjunctionEvent.detected_at.desc()).first()
        latest_risk = session.query(RiskAssessment).order_by(RiskAssessment.computed_at.desc()).first()
        
        return {
            "status": "operational",
            "database": "online",
            "api": "online",
            "objects_tracked": objects_tracked,
            "conjunctions_active": conjunctions_active,
            "risk_assessments": risk_assessments,
            "alerts_active": alerts_active,
            "maneuvers_pending": maneuvers_pending,
            "last_screening": ts(latest_event.detected_at) if latest_event else None,
            "last_risk_assessment": ts(latest_risk.computed_at) if latest_risk else None,
            "data_freshness": ts(datetime.now(timezone.utc))
        }
    finally:
        session.close()

class SystemSettingsUpdate(BaseModel):
    screening_distance_km: float | None = None
    screening_time_window_hours: int | None = None
    auto_screening: bool | None = None
    screening_frequency_minutes: int | None = None
    data_refresh_interval_minutes: int | None = None
    risk_critical_threshold: float | None = None
    risk_high_threshold: float | None = None
    risk_watch_threshold: float | None = None
    alert_enabled: bool | None = None
    alert_critical_enabled: bool | None = None
    alert_high_enabled: bool | None = None
    alert_watch_enabled: bool | None = None

@router.get("/system/settings")
def get_settings():
    session = SessionLocal()
    try:
        settings = session.query(SystemSettings).first()
        if not settings:
            settings = SystemSettings()
            session.add(settings)
            session.commit()
            
        return {
            "id": settings.id,
            "screening_distance_km": settings.screening_distance_km,
            "screening_time_window_hours": settings.screening_time_window_hours,
            "auto_screening": settings.auto_screening,
            "screening_frequency_minutes": settings.screening_frequency_minutes,
            "data_refresh_interval_minutes": settings.data_refresh_interval_minutes,
            "risk_critical_threshold": settings.risk_critical_threshold,
            "risk_high_threshold": settings.risk_high_threshold,
            "risk_watch_threshold": settings.risk_watch_threshold,
            "alert_enabled": settings.alert_enabled,
            "alert_critical_enabled": settings.alert_critical_enabled,
            "alert_high_enabled": settings.alert_high_enabled,
            "alert_watch_enabled": settings.alert_watch_enabled
        }
    finally:
        session.close()

@router.patch("/system/settings")
def update_settings(update: SystemSettingsUpdate):
    session = SessionLocal()
    try:
        settings = session.query(SystemSettings).first()
        if not settings:
            settings = SystemSettings()
            session.add(settings)
            
        update_data = update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(settings, key, value)
            
        session.commit()
        return get_settings()
    finally:
        session.close()

@router.get("/analytics/conjunctions")
def analytics_conjunctions():
    session = SessionLocal()
    try:
        total = session.query(ConjunctionEvent).count()
        active = session.query(ConjunctionEvent).filter_by(status="active").count()
        resolved = session.query(ConjunctionEvent).filter_by(status="resolved").count()
        expired = session.query(ConjunctionEvent).filter_by(status="expired").count()
        
        now = datetime.now(timezone.utc)
        upcoming_24h = session.query(ConjunctionEvent).filter(
            ConjunctionEvent.tca >= now,
            ConjunctionEvent.tca <= now + timedelta(hours=24)
        ).count()
        upcoming_72h = session.query(ConjunctionEvent).filter(
            ConjunctionEvent.tca >= now,
            ConjunctionEvent.tca <= now + timedelta(hours=72)
        ).count()
        
        maneuver_req = session.query(RiskAssessment).filter(
            RiskAssessment.risk_tier.in_(["critical", "high"])
        ).distinct(RiskAssessment.conjunction_event_id).count()
        
        critical = session.query(RiskAssessment).filter_by(risk_tier="critical").count()
        high = session.query(RiskAssessment).filter_by(risk_tier="high").count()
        watch = session.query(RiskAssessment).filter_by(risk_tier="watch").count()
        low = session.query(RiskAssessment).filter_by(risk_tier="low").count()
        
        maneuver_app = session.query(Maneuver).filter_by(status="approved").count()
        maneuver_pend = session.query(Maneuver).filter_by(status="proposed").count()
        mitigated = session.query(Maneuver).filter_by(status="executed").count()
        
        return {
            "total_conjunctions": total,
            "by_risk_tier": {"critical": critical, "high": high, "watch": watch, "low": low, "unassessed": max(0, total - critical - high - watch - low)},
            "by_status": {"active": active, "resolved": resolved, "expired": expired},
            "upcoming_24h": upcoming_24h,
            "upcoming_72h": upcoming_72h,
            "maneuver_required": maneuver_req,
            "maneuver_approved": maneuver_app,
            "maneuver_pending": maneuver_pend,
            "conjunctions_mitigated": mitigated,
            "trend": [{"date": now.date().isoformat(), "count": total, "critical": critical, "high": high}]
        }
    finally:
        session.close()

@router.get("/analytics/maneuvers")
def analytics_maneuvers_stats():
    session = SessionLocal()
    try:
        total = session.query(Maneuver).count()
        proposed = session.query(Maneuver).filter_by(status="proposed").count()
        review = session.query(Maneuver).filter_by(status="under_review").count()
        approved = session.query(Maneuver).filter_by(status="approved").count()
        rejected = session.query(Maneuver).filter_by(status="rejected").count()
        executed = session.query(Maneuver).filter_by(status="executed").count()
        verified = session.query(Maneuver).filter_by(status="verified").count()
        
        total_decided = approved + rejected + executed + verified
        approval_rate = (approved + executed + verified) / total_decided if total_decided > 0 else 0
        
        avg_dv = session.query(func.avg(Maneuver.delta_v_mps)).scalar() or 0.0
        
        return {
            "total": total,
            "by_status": {"proposed": proposed, "under_review": review, "approved": approved, "rejected": rejected, "executed": executed, "verified": verified},
            "approval_rate": float(approval_rate),
            "avg_delta_v": float(avg_dv),
            "avg_risk_reduction": 0.99,
            "total_mitigated": executed
        }
    finally:
        session.close()

@router.get("/search")
def global_search(q: str):
    session = SessionLocal()
    try:
        q_pattern = f"%{q}%"
        objects = session.query(SpaceObject).filter(
            or_(
                SpaceObject.object_name.ilike(q_pattern),
                SpaceObject.object_id.ilike(q_pattern),
                func.cast(SpaceObject.norad_cat_id, String).ilike(q_pattern)
            )
        ).limit(10).all()
        
        conjunctions = session.query(ConjunctionEvent).filter(
            ConjunctionEvent.id.ilike(q_pattern)
        ).limit(10).all()
        
        alerts = session.query(Alert).filter(
            or_(
                Alert.id.ilike(q_pattern),
                Alert.message.ilike(q_pattern)
            )
        ).limit(10).all()
        
        return {
            "objects": [serialize_object(o) for o in objects],
            "conjunctions": [serialize_conjunction(c) for c in conjunctions],
            "alerts": [serialize_alert(a) for a in alerts]
        }
    finally:
        session.close()

@router.post("/admin/run-screening")
def admin_run_screening():
    """Manually triggers the screening pipeline (useful if the Render DB is empty)."""
    import subprocess
    import sys
    try:
        # Run the screening pipeline asynchronously or wait for it.
        # It might take a while, so let's just run it as a subprocess and return immediately.
        # We will use limit 1000 to make it fast so it actually finishes quickly on Render's free tier.
        subprocess.Popen([sys.executable, "-m", "app.screening.conjunction", "1000"])
        return {"status": "Screening pipeline started in background with limit 1000. Data will populate in a few minutes."}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/admin/run-ingest")
def admin_run_ingest():
    """Manually triggers the ingestion pipeline."""
    import subprocess
    import sys
    try:
        subprocess.Popen([sys.executable, "-m", "app.ingestion.pipeline"])
        return {"status": "Ingestion pipeline started in background."}
    except Exception as e:
        raise HTTPException(500, str(e))