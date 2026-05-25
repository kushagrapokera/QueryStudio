"""Test Step 2.4 — SQL Validation Layer."""
from app.services.sql_validator import validate

tests = [
    # (test_name, input_sql, expected_valid, check_in_sql)

    # --- Should PASS ---
    ("Simple SELECT", "SELECT * FROM users;", True, None),
    ("SELECT with WHERE", 'SELECT name, email FROM users WHERE role = "patient";', True, None),
    ("SELECT with LIMIT", "SELECT * FROM appointments LIMIT 5;", True, None),
    ("WITH clause", "WITH cte AS (SELECT * FROM users) SELECT * FROM cte;", True, None),
    ("JOIN query", 'SELECT u.name, a.doctor_name FROM users u JOIN appointments a ON u.id = a.patient_id WHERE a.status = "completed" LIMIT 10;', True, None),
    ("GROUP BY + HAVING", "SELECT doctor_name, COUNT(*) as cnt FROM appointments GROUP BY doctor_name HAVING cnt > 1;", True, None),

    # --- Should FAIL ---
    ("INSERT rejected", "INSERT INTO users VALUES (1, 'test');", False, None),
    ("UPDATE rejected", "UPDATE users SET name = 'hacker' WHERE id = 1;", False, None),
    ("DELETE rejected", "DELETE FROM users WHERE id = 1;", False, None),
    ("DROP rejected", "DROP TABLE users;", False, None),
    ("ALTER rejected", "ALTER TABLE users ADD COLUMN hack text;", False, None),
    ("TRUNCATE rejected", "TRUNCATE TABLE users;", False, None),
    ("CREATE rejected", "CREATE TABLE hack (id int);", False, None),
    ("Multiple statements", "SELECT * FROM users; SELECT * FROM appointments;", False, None),
    ("Empty SQL", "", False, None),
    ("Whitespace only", "   ", False, None),

    # --- Dangerous patterns ---
    ("pg_sleep rejected", "SELECT pg_sleep(10);", False, None),
    ("Cartesian join (no WHERE)", "SELECT * FROM users, appointments;", False, None),

    # --- LIMIT auto-inject ---
    ("SELECT without LIMIT", "SELECT * FROM users", True, "LIMIT 100"),
    ("SELECT with existing LIMIT", "SELECT * FROM users LIMIT 5;", True, "LIMIT 5"),

    # --- Edge cases ---
    ("SQL with comments", "SELECT * -- get all\nFROM users;", True, None),
    ("Multi-line SQL", "SELECT u.name,\n       a.doctor_name\nFROM users u\nJOIN appointments a ON u.id = a.patient_id\nWHERE a.status = 'completed'\nLIMIT 5;", True, None),
]

passed = 0
failed = 0

for name, sql, expected_valid, check_sql in tests:
    result = validate(sql)
    ok = result.valid == expected_valid
    if ok and check_sql and expected_valid:
        ok = check_sql in result.sql

    if ok:
        passed += 1
        status = "PASS"
    else:
        failed += 1
        status = "FAIL"

    details = ""
    if not result.valid:
        details = f" -> error: {result.error}"
    elif check_sql:
        details = f' -> has "{check_sql}"'

    print(f"  [{status}] {name}{details}")

print(f"\nResults: {passed} passed, {failed} failed")
if failed > 0:
    exit(1)
