"""Detailed test with 20-column dataset showing every pipeline stage."""
import os, json, tempfile, random
from app import create_app
from app.services.code_generator import build_python_prompt, extract_code
from app.services.llm_client import generate
from app.services.python_executor import execute_python_code

app = create_app()

# Generate a 20-column dataset with 100 rows
random.seed(42)
cols = [
    "employee_id", "name", "department", "role", "city", "state",
    "tenure_years", "age", "salary", "bonus", "stock_units",
    "satisfaction_score", "performance_rating", "projects_completed",
    "absences", "training_hours", "promotions", "manager_id",
    "hire_year", "remote_days"
]

rows = []
departments = ["Engineering", "Design", "Marketing", "Sales", "HR"]
roles = ["Junior", "Mid", "Senior", "Lead", "Manager"]
cities = ["NYC", "SF", "Chicago", "Austin", "Seattle"]
states = ["NY", "CA", "IL", "TX", "WA"]

for i in range(100):
    rows.append([
        f"EMP{i+1:04d}",
        f"Employee_{i+1}",
        random.choice(departments),
        random.choice(roles),
        random.choice(cities),
        random.choice(states),
        round(random.uniform(0.5, 15), 1),
        random.randint(22, 60),
        random.randint(50000, 200000),
        random.randint(0, 50000),
        random.randint(0, 10000),
        round(random.uniform(1, 10), 1),
        random.randint(1, 5),
        random.randint(0, 50),
        random.randint(0, 20),
        random.randint(0, 100),
        random.randint(0, 5),
        f"MGR{random.randint(1,20):04d}",
        random.randint(2015, 2025),
        random.randint(0, 250),
    ])

header = ",".join(cols)
csv_lines = [header] + [",".join(str(v) for v in row) for row in rows]

with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
    f.write("\n".join(csv_lines))
    csv_path = f.name

with app.app_context():
    from app.services.profiler import profile_dataset

    # --- STEP 1: Profile ---
    print("=" * 70)
    print("STEP 1 — DATASET PROFILE")
    print("=" * 70)
    profile = profile_dataset(csv_path)
    print(f"Shape: {profile['shape'][0]} rows x {profile['shape'][1]} columns")
    print(f"\nColumns ({len(profile['columns'])}):")
    for col in profile['columns']:
        print(f"  {col:20s} {profile['dtypes'][col]}")
    print(f"\nNumeric stats ({len(profile['numeric_stats'])} columns):")
    for col, s in profile['numeric_stats'].items():
        print(f"  {col:20s}  min={s['min']:>10}  max={s['max']:>10}  mean={s['mean']:>10.2f}")
    print(f"\nSample rows (first 3 of {len(profile['sample_rows'])}):")
    for row in profile['sample_rows'][:3]:
        print(f"  {row}")
    print(f"\nProfile JSON size: {len(json.dumps(profile))} chars")
    print()

    # --- STEP 2: Build prompts ---
    query = "Show me the average salary and bonus by department, sorted by salary descending"
    print("=" * 70)
    print(f"STEP 2 — USER QUERY")
    print("=" * 70)
    print(f"  {query}")
    print()

    sys_prompt, user_prompt = build_python_prompt(profile, query)

    print("=" * 70)
    print("STEP 3 — SYSTEM PROMPT")
    print("=" * 70)
    print(sys_prompt)
    print()

    print("=" * 70)
    print("STEP 4 — USER PROMPT (compact context)")
    print("=" * 70)
    print(user_prompt)
    print(f"\n(Prompt length: {len(user_prompt)} chars)")
    print()

    # --- STEP 5: LLM call ---
    print("=" * 70)
    print("STEP 5 — RAW LLM RESPONSE")
    print("=" * 70)
    response = generate(user_prompt, system_prompt=sys_prompt)
    print(response)
    print(f"\n(Response length: {len(response)} chars)")
    print()

    # --- STEP 6: Extracted code ---
    print("=" * 70)
    print("STEP 6 — EXTRACTED PYTHON CODE")
    print("=" * 70)
    code = extract_code(response)
    print(code)
    print(f"\n(Code length: {len(code)} chars)")
    print()

    # --- STEP 7: Execution ---
    print("=" * 70)
    print("STEP 7 — EXECUTION RESULT")
    print("=" * 70)
    result = execute_python_code(code, csv_path)
    print(json.dumps(result, indent=2))
    print()

    if result["type"] == "chart":
        fig = result.get("figure", {})
        traces = fig.get("data", [])
        print(f"Chart: {len(traces)} trace(s)")
        for t in traces:
            print(f"  type={t.get('type')}, x={t.get('x')}, y={t.get('y')}")

os.unlink(csv_path)
