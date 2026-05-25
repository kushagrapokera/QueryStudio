"""Test Step 2.3 — SQL Generation via LLM."""
import json

# 1. Test prompt builder
print("=== Testing SQL Prompt Builder ===")
from app.services.code_generator import build_sql_prompt, extract_sql

schema = """-- Database: doctor_finder
-- Tables: 8

appointments(id:int PK, patient_id:int FK->users.id, doctor_name:varchar, ...)
users(id:int PK, name:varchar, email:varchar, ...)
doctor_profiles(id:int PK, user_id:int FK->users.id, specialty:varchar, ...)
  appointments.patient_id -> users.id
  doctor_profiles.user_id -> users.id"""

system_prompt, user_prompt = build_sql_prompt(schema, "How many appointments does each doctor have?", "mysql")
print(f"System prompt length: {len(system_prompt)}")
print(f"User prompt length: {len(user_prompt)}")
assert "SQL" in system_prompt
assert "SELECT" in system_prompt
assert "mysql" in system_prompt.lower()
assert schema in user_prompt
print("[PASS] Prompt builder works correctly")

# 2. Test SQL extraction
print("\n=== Testing SQL Extraction ===")

test_cases = [
    # Standard sql block
    ("```sql\nSELECT * FROM users LIMIT 5;\n```", "SELECT * FROM users LIMIT 5;"),
    # Generic code block
    ("```\nSELECT COUNT(*) FROM appointments;\n```", "SELECT COUNT(*) FROM appointments;"),
    # Raw SQL without fences
    ("SELECT name, email FROM users WHERE role = 'doctor'", "SELECT name, email FROM users WHERE role = 'doctor'"),
    # WITH clause
    ("WITH cte AS (SELECT * FROM users) SELECT * FROM cte", "WITH cte AS (SELECT * FROM users) SELECT * FROM cte"),
    # Empty
    ("", None),
    # With surrounding text
    ("Here's the SQL:\n```sql\nSELECT doctor_name, COUNT(*) as cnt FROM appointments GROUP BY doctor_name;\n```\nLet me know if you need changes.", "SELECT doctor_name, COUNT(*) as cnt FROM appointments GROUP BY doctor_name;"),
]

for i, (input_sql, expected) in enumerate(test_cases):
    result = extract_sql(input_sql)
    if result == expected:
        print(f"  [PASS] Test case {i+1}")
    else:
        print(f"  [FAIL] Test case {i+1}: got '{result}', expected '{expected}'")

# 3. Test LLM-based SQL generation
print("\n=== Testing LLM SQL Generation ===")
from app.services.llm_client import generate

result = generate(user_prompt, system_prompt=system_prompt)
if result:
    print(f"LLM response received ({len(result)} chars)")
    sql = extract_sql(result)
    if sql:
        print(f"[PASS] Extracted SQL:\n{sql}")
    else:
        print(f"[WARN] Could not extract SQL from response:\n{result[:300]}...")
else:
    print("[WARN] LLM returned None — check OLLAMA_API_KEY and server status")

print("\nDone!")
