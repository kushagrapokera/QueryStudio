"""Test edge cases that might cause 500 errors."""
import os, json, tempfile
from app import create_app

app = create_app()

# Test 1: CSV without a "salary" column
csv1 = "name,age,city\nAlice,30,NYC\nBob,25,LA\n"
with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
    f.write(csv1); p1 = f.name

# Test 2: CSV with special characters
csv2 = "product,price,description\nLaptop,999.99,Laptop with \"speakers\"\nMouse,24.99,USB-C\n"
with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
    f.write(csv2); p2 = f.name

with app.test_client() as client:
    # Upload CSV1 (no salary column)
    with open(p1, "rb") as f:
        resp = client.post("/api/upload", data={"file": (f, "people.csv")})
    ds1 = resp.get_json()["dataset_id"]

    # Query about salary on a dataset without salary column
    resp = client.post("/api/query", json={"dataset_id": ds1, "query": "tell the with highest salary;"})
    r = resp.get_json()
    print(f"Test 1 (no salary col): status={resp.status_code} type={r.get('type')} message={r.get('message','')[:80]}")

    # Upload CSV2 (special chars)
    with open(p2, "rb") as f:
        resp = client.post("/api/upload", data={"file": (f, "products.csv")})
    ds2 = resp.get_json()["dataset_id"]

    resp = client.post("/api/query", json={"dataset_id": ds2, "query": "tell the with highest price;"})
    r = resp.get_json()
    print(f"Test 2 (special chars): status={resp.status_code} type={r.get('type')}")

    # Test 3: empty query
    resp = client.post("/api/query", json={"dataset_id": ds1, "query": ""})
    print(f"Test 3 (empty query): status={resp.status_code}")

for p in [p1, p2]:
    os.unlink(p)
