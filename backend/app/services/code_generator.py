import re
import logging

logger = logging.getLogger(__name__)


def build_python_prompt(profile: dict, user_query: str) -> tuple[str, str]:
    """Build the system prompt and user prompt for Python code generation.

    Returns (system_prompt, user_prompt).
    """
    columns = profile.get("columns", [])
    dtypes = profile.get("dtypes", {})
    shape = profile.get("shape", [0, 0])
    sample_rows = profile.get("sample_rows", [])
    numeric_stats = profile.get("numeric_stats", {})

    # Build a compact schema description
    col_desc = "\n".join(
        f"  - {col} ({dtypes.get(col, 'unknown')})"
        for col in columns
    )

    # Build sample rows as a compact table
    sample_table = _format_sample_table(columns, sample_rows)

    # Build numeric stats summary
    stats_lines = []
    for col, s in numeric_stats.items():
        stats_lines.append(f"  - {col}: min={s['min']}, max={s['max']}, mean={s['mean']}")
    stats_desc = "\n".join(stats_lines)

    system_prompt = (
        "You are a data analysis Python code generator. "
        "Generate Python code that answers the user's question about their dataset. "
        "Rules:\n"
        "1. Output ONLY valid Python code inside a single ```python code block.\n"
        "2. The dataframe is already loaded as the variable `df`.\n"
        "3. Use `print()` for any text answers or summaries.\n"
        "4. For charts, create a Plotly figure and store it in a variable named `fig`. "
        "Do NOT call fig.show(). The system will render it automatically.\n"
        "5. For tables, use `print(df.to_json(orient='records'))` to output the data as JSON.\n"
        "6. Only use these imports if needed: pandas, numpy, plotly.express, plotly.graph_objects.\n"
        "7. Do not include any explanatory text before or after the code.\n"
        "8. Handle missing values gracefully with fillna() or dropna().\n"
        "9. Keep the code concise and focused on answering the specific question."
    )

    stats_section = f"Numeric column stats:\n{stats_desc}\n\n" if stats_lines else ""

    user_prompt = (
        f"Dataset shape: {shape[0]} rows x {shape[1]} columns\n\n"
        f"Columns and types:\n{col_desc}\n\n"
        f"Sample rows:\n{sample_table}\n\n"
        f"{stats_section}"
        f"User question: {user_query}"
    )

    return system_prompt, user_prompt


def _format_sample_table(columns: list[str], rows: list[list]) -> str:
    """Format sample rows as a compact pipe-delimited table."""
    header = " | ".join(columns)
    separator = " | ".join(["---"] * len(columns))
    body = "\n".join(
        " | ".join(str(cell) if cell is not None else "" for cell in row)
        for row in rows
    )
    return f"{header}\n{separator}\n{body}"


def build_sql_prompt(
    schema_compact: str,
    user_query: str,
    db_type: str = "mysql",
) -> tuple[str, str]:
    """Build system and user prompts for SQL code generation.

    Returns (system_prompt, user_prompt).
    """
    system_prompt = (
        "You are a SQL query generator. Generate SQL that answers the user's question "
        "about their database. Rules:\n"
        "1. Output ONLY valid SQL inside a single ```sql code block.\n"
        "2. Use only SELECT or WITH queries (read-only).\n"
        "3. Always include a LIMIT clause (default 100 if the user doesn't specify).\n"
        "4. Use proper table and column names exactly as shown in the schema.\n"
        "5. Use appropriate JOINs, GROUP BY, aggregations (COUNT, SUM, AVG, etc.) as needed.\n"
        "6. Do not include any explanatory text before or after the SQL.\n"
        f"7. The database is {db_type.upper()}. Use syntax compatible with {db_type.upper()}.\n"
        "8. For date columns, use standard SQL date functions.\n"
        "9. Keep queries concise and focused on the specific question."
    )

    user_prompt = (
        f"Database schema:\n{schema_compact}\n\n"
        f"User question: {user_query}"
    )

    return system_prompt, user_prompt


def extract_sql(model_output: str) -> str | None:
    """Extract SQL from a ```sql ... ``` code block.

    Falls back to extracting from any ``` ... ``` block, then to using the
    entire output as-is if no code fences are found.
    Returns None if output is empty.
    """
    if not model_output or not model_output.strip():
        return None

    text = model_output.strip()

    # Try ```sql ... ``` block
    pattern = r"```sql\s*\n(.*?)```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Try generic ``` ... ``` block
    pattern = r"```\s*\n(.*?)```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # If no code fences, check if the whole output looks like SQL
    upper = text.upper()
    if upper.startswith("SELECT") or upper.startswith("WITH"):
        return text

    return None


def extract_code(model_output: str) -> str | None:
    """Extract Python code from a ```python ... ``` code block.

    Falls back to extracting any ``` ... ``` block, then to using the
    entire output as-is if no code fences are found.
    Returns None if output is empty.
    """
    if not model_output or not model_output.strip():
        return None

    text = model_output.strip()

    # Try ```python ... ``` block
    pattern = r"```python\s*\n(.*?)```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Try generic ``` ... ``` block
    pattern = r"```\s*\n(.*?)```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # If no code fences but contains python-like statements, use whole output
    code = text
    return code
