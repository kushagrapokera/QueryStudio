"""Test Step 2.1 — Connection Management endpoints."""
import urllib.request, urllib.error
import json

BASE = "http://localhost:5000/api"


def post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())
    except Exception as e:
        return None, str(e)


def get(path):
    try:
        resp = urllib.request.urlopen(f"{BASE}{path}", timeout=10)
        return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())
    except Exception as e:
        return None, str(e)


def delete(path):
    req = urllib.request.Request(f"{BASE}{path}", method="DELETE")
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())
    except Exception as e:
        return None, str(e)


def put(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=data, method="PUT")
    req.add_header("Content-Type", "application/json")
    try:
        resp = urllib.request.urlopen(req, timeout=10)
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


# 1. Health
s, d = get("/health")
check("GET /api/health", s == 200 and d.get("status") == "ok", str(d))

# 2. List connections (empty)
s, d = get("/connections")
check("GET /api/connections (empty)", s == 200 and d == [], str(d))

# 3. Test connection — fails gracefully (no server)
s, d = post("/connections/test", {
    "type": "direct",
    "params": {"db_type": "postgres", "host": "127.0.0.1", "port": 65432, "database": "x", "user": "x", "password": "x"},
})
check("POST /api/connections/test (no server)", s == 200 and "success" in d, str(d))

# 4. Test MCP connection — fails gracefully
s, d = post("/connections/test", {
    "type": "mcp",
    "params": {"url": "http://localhost:9999"},
})
check("POST /api/connections/test (mcp, no server)", s == 200 and "success" in d, str(d))

# 5. Test with missing params
s, d = post("/connections/test", {"type": "direct", "params": {}})
check("POST /api/connections/test (missing params)", s == 200 and d.get("success") is False, str(d))

# 6. Save connection — fails because no DB running
s, d = post("/connections", {
    "type": "direct", "label": "test-pg",
    "params": {"db_type": "postgres", "host": "127.0.0.1", "port": 5432, "database": "testdb", "user": "test", "password": "test"},
})
check("POST /api/connections (no server) returns 400", s == 400, str(d))

# 7. Delete nonexistent
s, d = delete("/connections/nonexistent")
check("DELETE /api/connections/nonexistent", s == 404, str(d))

# 8. Get nonexistent
s, d = get("/connections/nonexistent")
check("GET /api/connections/nonexistent", s == 404, str(d))

# 9. Update mode on nonexistent
s, d = put("/connections/nonexistent/mode", {"mode": "direct"})
check("PUT /api/connections/nonexistent/mode", s == 404, str(d))

# 10. Missing body validation
s, d = post("/connections", None)
check("POST /api/connections (no body)", s == 400, str(d))

print(f"\n{'='*40}")
print(f"Results: {passed} passed, {failed} failed")
if failed > 0:
    exit(1)
