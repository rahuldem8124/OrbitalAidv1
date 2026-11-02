import sqlite3
con = sqlite3.connect("orbital_oct2026_orig.db")
print("risk_assessments by tier:")
for row in con.execute("select risk_tier, count(*) from risk_assessments group by risk_tier"):
    print("  ", row)
print("conjunction_events total:", con.execute("select count(*) from conjunction_events").fetchone()[0])
print("alerts total:", con.execute("select count(*) from alerts").fetchone()[0])