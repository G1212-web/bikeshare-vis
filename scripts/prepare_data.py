"""Convert UCI's hourly Bike Sharing CSV to the browser dataset."""
import csv
import json
import sys
from pathlib import Path

fields = ("yr", "mnth", "weekday", "hr", "workingday", "weathersit",
          "cnt", "registered", "casual")
target = Path(__file__).resolve().parents[1] / "data" / "rides.js"
with Path(sys.argv[1]).open(encoding="utf-8-sig", newline="") as source:
    rows = [[int(row[field]) for field in fields] for row in csv.DictReader(source)]
assert len(rows) == 17379
assert all(total == registered + casual for *_, total, registered, casual in rows)
target.write_text("window.RIDES = [\n" + ",\n".join(
    json.dumps(row, separators=(",", ":")) for row in rows
) + "\n];\n", encoding="utf-8")
