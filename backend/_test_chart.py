"""Test chart figure data structure."""
import os, json, tempfile
from app import create_app

app = create_app()

csv_content = "city,sales\nNYC,100\nLA,200\nSF,150\nChicago,175"
with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
    f.write(csv_content)
    csv_path = f.name

with app.test_client() as client:
    with open(csv_path, "rb") as f:
        resp = client.post("/api/upload", data={"file": (f, "sales.csv")})
    ds = resp.get_json()["dataset_id"]

    resp = client.post("/api/query", json={"dataset_id": ds, "query": "Bar chart of sales by city"})
    r = resp.get_json()

    print(f"Type: {r['type']}")
    if r['type'] == 'chart':
        fig_json = r.get('figure_json', '')
        print(f"figure_json exists: {bool(fig_json)}")
        print(f"figure_json length: {len(fig_json)}")
        print(f"figure_json first 300 chars: {fig_json[:300]}")
        # Check if bdata is present
        if 'bdata' in fig_json:
            print("WARNING: bdata present in figure_json")
        else:
            print("OK: no bdata in figure_json")
        # Parse and check
        import json as _j
        fig = _j.loads(fig_json)
        print(f"Data traces: {len(fig.get('data', []))}")
    elif r['type'] == 'text':
        print(f"Content: {r['content'][:200]}")
    else:
        print(f"Result: {json.dumps(r, indent=2)[:500]}")

os.unlink(csv_path)
