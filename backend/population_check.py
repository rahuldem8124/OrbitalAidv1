from collections import Counter
from app.db import SessionLocal
from app.models.models import SpaceObject
from app.screening.conjunction import latest_element
from app.propagation.propagator import build_satrec

s = SessionLocal()
objs = s.query(SpaceObject).all()
print("total objects:", len(objs))
print("by type:", Counter(o.type for o in objs))

no_el = 0
bad = []
for o in objs:
    el = latest_element(o)
    if el is None:
        no_el += 1
        continue
    try:
        build_satrec(el)
    except Exception as ex:
        bad.append((o.object_name, repr(ex)))
print("no elements:", no_el)
print("satrec failures:", len(bad))
for b in bad[:10]:
    print("  ", b)

for o in objs:
    if "5426" in o.object_name or "34304" in o.object_name:
        el = latest_element(o)
        print(o.object_name, o.norad_cat_id, "n_elements:", len(o.elements),
              "latest epoch:", el.epoch if el else None)
s.close()