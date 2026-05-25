"""Test Step 2.2 — Schema Introspection endpoints."""
import urllib.request, urllib.error
import json

BASE = "http://localhost:5000/api"


def get(path):
    try:
        resp = urllib.request.urlopen(f"{BASE}{path}", timeout=10)
        return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())
    except Exception as e:
        return None, str(e)


passed = 0
failed = 0


def check(name, ok, detail=""):
    global passed, failed
    if ok:
        passed += 1
        print(f"  [PASS] {name}")
    else:
        failed += 1
        print(f"  [FAIL] {name} — {detail}")


# 1. Schema for nonexistent connection
s, d = get("/connections/nonexistent/schema")
check("GET nonexistent returns 404", s == 404, str(d))

# 2. Schema module imports correctly
try:
    from app.services.schema import get_schema, format_schema_compact, introspect_direct
    print("  [PASS] schema module imports OK")
    passed += 1

    # 3. Test compact formatter with mock data
    mock_schema = {
        "db_type": "postgres",
        "database": "testdb",
        "tables": [
            {
                "name": "customers",
                "type": "BASE TABLE",
                "estimated_rows": 100,
                "columns": [
                    {"name": "id", "type": "integer", "nullable": False},
                    {"name": "name", "type": "varchar(100)", "nullable": True},
                    {"name": "email", "type": "varchar(255)", "nullable": True},
                ],
                "primary_key": ["id"],
                "foreign_keys": [],
                "indexes": [{"name": "customers_pkey", "definition": "CREATE UNIQUE INDEX ..."}],
                "sample_rows": [],
            },
            {
                "name": "orders",
                "type": "BASE TABLE",
                "estimated_rows": 50,
                "columns": [
                    {"name": "id", "type": "integer", "nullable": False},
                    {"name": "customer_id", "type": "integer", "nullable": True},
                    {"name": "amount", "type": "decimal(10,2)", "nullable": True},
                ],
                "primary_key": ["id"],
                "foreign_keys": [
                    {"column": "customer_id", "references_table": "customers",
                     "references_column": "id", "constraint": "fk_customer"}
                ],
                "indexes": [],
                "sample_rows": [],
            },
        ],
    }

    compact = format_schema_compact(mock_schema)
    assert "-- Database: testdb" in compact
    assert "customers(" in compact
    assert "orders(" in compact
    assert "id:integer PK" in compact
    assert "customer_id:integer FK" in compact
    assert "customers.customer_id" not in compact
    assert "orders.customer_id → customers.id" in compact
    print(f"  [PASS] compact formatter works")
    print(f"  Output:\n{compact}")
    passed += 1

except ImportError as e:
    check("schema module imports", False, str(e))
except Exception as e:
    check("schema module test", False, str(e))

# 4. Server health still works
s, d = get("/health")
check("Server still healthy", s == 200 and d.get("status") == "ok")

print(f"\n{'='*40}")
print(f"Results: {passed} passed, {failed} failed")
if failed > 0:
    exit(1)
