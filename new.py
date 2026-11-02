import csv
from datetime import datetime
from backend.app.db import SessionLocal

# This is the STRUCTURE you need to follow
# Run this script to generate events_clean_run.csv from your database

def generate_events_clean_run_csv(db_session, output_file='events_clean_run.csv'):
    """
    Export all 204 conjunction events from the clean run to CSV.
    
    Required fields (in order):
    1. object_a_norad_id
    2. object_a_name
    3. object_b_norad_id
    4. object_b_name
    5. tca (Time of Closest Approach)
    6. miss_distance_km
    7. relative_velocity_kmps
    8. risk_tier
    9. pc (probability of collision)
    10. method (propagation, docking_exclusion, excluded)
    """
    
    from app.database import ConjunctionEvent, RiskAssessment, SpaceObject
    
    # Query all events with their risk assessments
    events = db_session.query(
        ConjunctionEvent,
        RiskAssessment,
        SpaceObject
    ).join(
        RiskAssessment,
        ConjunctionEvent.id == RiskAssessment.conjunction_event_id
    ).join(
        SpaceObject,
        ConjunctionEvent.object_a_id == SpaceObject.id
    ).all()
    
    with open(output_file, 'w', newline='') as f:
        writer = csv.writer(f)
        
        # Header row
        writer.writerow([
            'object_a_norad_id',
            'object_a_name',
            'object_b_norad_id',
            'object_b_name',
            'tca_utc',
            'miss_distance_km',
            'relative_velocity_kmps',
            'risk_tier',
            'pc',
            'method'
        ])
        
        # Data rows
        for event, risk, obj_a in events:
            obj_b = db_session.query(SpaceObject)\
                .filter(SpaceObject.id == event.object_b_id).first()
            
            writer.writerow([
                obj_a.norad_cat_id,
                obj_a.object_name,
                obj_b.norad_cat_id,
                obj_b.object_name,
                event.tca.isoformat() + 'Z',  # ISO 8601 format
                round(event.miss_distance_km, 4),
                round(event.relative_velocity_kmps, 6),
                risk.risk_tier,
                f"{risk.pc:.6e}",  # Scientific notation
                risk.method
            ])
    
    print(f"Exported {len(events)} conjunctions to {output_file}")
    return output_file


# TEMPLATE FOR MANUAL CSV IF YOU WANT TO EDIT:
MANUAL_CSV_TEMPLATE = """object_a_norad_id,object_a_name,object_b_norad_id,object_b_name,tca_utc,miss_distance_km,relative_velocity_kmps,risk_tier,pc,method
25544,ISS,45678,STARLINK-30195,2026-06-13T14:22:15Z,1.201,0.596,high,2.36e-05,propagation
45679,STARLINK-31605,45680,STARLINK-32947,2026-06-13T15:45:30Z,1.512,1.053,high,1.02e-05,propagation
...
[continue with your 204 events]
"""


# QUICK EXPORT FROM COMMAND LINE:
if __name__ == "__main__":
    
    
    db = SessionLocal()
    try:
        generate_events_clean_run_csv(db, 'events_clean_run.csv')
        print("✓ CSV generated successfully")
    except Exception as e:
        print(f"✗ Error: {e}")
    finally:
        db.close()