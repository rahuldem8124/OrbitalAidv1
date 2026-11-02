import sqlite3, sys

db = sys.argv[1]
con = sqlite3.connect(db)
tables = [r[0] for r in con.execute("select name from sqlite_master where type='table'")]
print("TABLES:", tables)
for t in tables:
    n = con.execute(f"select count(*) from {t}").fetchone()[0]
    print(f"  {t}: {n} rows")