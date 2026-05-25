"""SQL validation layer — validates generated SQL before execution.

Checks:
  - Must begin with SELECT or WITH
  - Rejects DDL/DML statements (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE)
  - Rejects chained/multiple statements
  - Auto-injects LIMIT 100 when absent
  - Checks for dangerous patterns (pg_sleep, heavy cartesian joins)
"""

import re
import logging

logger = logging.getLogger(__name__)

# Statements that are never allowed
FORBIDDEN_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER",
    "TRUNCATE", "CREATE", "REPLACE", "MERGE", "EXEC", "EXECUTE",
]

# Dangerous patterns to flag
DANGEROUS_PATTERNS = [
    (r"pg_sleep", "Use of pg_sleep detected (potential DoS)"),
    (r"WAITFOR\s+DELAY", "Use of WAITFOR DELAY detected (potential DoS)"),
    (r"BENCHMARK\s*\(", "Use of BENCHMARK detected (potential DoS)"),
    (r"xp_cmdshell", "Use of xp_cmdshell detected (shell access)"),
    (r"INTO\s+(OUT|DUMP)FILE", "Use of INTO OUTFILE/DUMPFILE detected (file write)"),
    (r"LOAD\s+(DATA|FILE)", "Use of LOAD DATA/FILE detected (file read)"),
    (r"INFORMATION_SCHEMA\.(?:COLUMNS|TABLES)\s+WHERE\s+.*?=\s*(?:NULL|'')\s+OR\s+1\s*=\s*1",
     "Potential information_schema injection"),
]


def _strip_comments(sql: str) -> str:
    """Remove SQL comments before validation."""
    # Remove single-line comments (-- ...)
    sql = re.sub(r"--[^\n]*", "", sql)
    # Remove multi-line comments (/* ... */)
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    return sql


def _normalize(sql: str) -> str:
    """Normalize SQL for analysis: strip comments, condense whitespace."""
    sql = _strip_comments(sql)
    sql = re.sub(r"\s+", " ", sql).strip()
    return sql


def _split_statements(sql: str) -> list[str]:
    """Split potential multi-statement SQL by semicolons outside string literals."""
    statements = []
    current = []
    in_string = False
    string_char = None

    for ch in sql:
        if in_string:
            current.append(ch)
            if ch == string_char:
                in_string = False
        elif ch in ("'", '"'):
            in_string = True
            string_char = ch
            current.append(ch)
        elif ch == ";":
            stmt = "".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
        else:
            current.append(ch)

    stmt = "".join(current).strip()
    if stmt:
        statements.append(stmt)

    return statements


class ValidationResult:
    """Result of SQL validation."""

    def __init__(self, valid: bool, sql: str = "", error: str = ""):
        self.valid = valid
        self.sql = sql
        self.error = error

    def to_dict(self) -> dict:
        return {
            "valid": self.valid,
            "sql": self.sql,
            "error": self.error,
        }


def validate(sql: str) -> ValidationResult:
    """Validate generated SQL and auto-inject LIMIT.

    Returns a ValidationResult with the (possibly modified) SQL and any errors.
    """
    if not sql or not sql.strip():
        return ValidationResult(False, error="Empty SQL query")

    # Normalize for analysis
    normalized = _normalize(sql)

    # Check for multiple statements
    statements = _split_statements(normalized)
    if len(statements) > 1:
        return ValidationResult(
            False, error=f"Multiple statements detected ({len(statements)}). Only single SELECT/WITH queries are allowed."
        )

    # Extract the leading keyword
    leading = normalized.upper().split()[0] if normalized.split() else ""

    # Must begin with SELECT or WITH
    if leading not in ("SELECT", "WITH"):
        if leading in FORBIDDEN_KEYWORDS:
            return ValidationResult(
                False, error=f"Forbidden statement type: {leading}. Only SELECT/WITH queries are allowed."
            )
        return ValidationResult(
            False, error=f"Query must begin with SELECT or WITH, got '{leading}'"
        )

    # Check for forbidden keywords anywhere in the statement (for multi-keyword statements)
    upper_sql = normalized.upper()
    # Remove the leading SELECT/WITH to avoid false positives on "WITH cte AS (SELECT ...)"
    remaining = re.sub(r"^(SELECT|WITH)\s+", "", upper_sql, count=1)
    for kw in FORBIDDEN_KEYWORDS:
        # Check as a word boundary, but not inside string literals
        pattern = rf"\b{kw}\b"
        if re.search(pattern, remaining):
            # Verify it's not inside a string literal by doing a simple check
            return ValidationResult(
                False, error=f"Forbidden statement type '{kw}' found in query body."
            )

    # Check for dangerous patterns
    for pattern, msg in DANGEROUS_PATTERNS:
        if re.search(pattern, normalized, re.IGNORECASE):
            return ValidationResult(False, error=msg)

    # Check for cartesian join (FROM with multiple tables but no WHERE JOIN conditions)
    # Basic heuristic: FROM clause with multiple comma-separated tables
    from_match = re.search(r"\bFROM\b\s+(.*?)(?:\bWHERE\b|\bGROUP\b|\bORDER\b|\bHAVING\b|\bLIMIT\b|$)", normalized, re.IGNORECASE)
    if from_match:
        from_clause = from_match.group(1)
        tables = [t.strip() for t in from_clause.split(",")]
        if len(tables) > 1:
            # Multiple comma-joined tables without WHERE could be an accidental cartesian join
            has_where = re.search(r"\bWHERE\b", normalized, re.IGNORECASE)
            has_join = re.search(r"\b(JOIN|CROSS\s+JOIN)\b", normalized, re.IGNORECASE)
            if not has_where and not has_join:
                return ValidationResult(
                    False, error="Potential cartesian join detected: multiple tables in FROM with no JOIN or WHERE clause. Add JOIN conditions or a WHERE clause."
                )

    # Auto-inject LIMIT 100 for SELECT queries missing LIMIT
    if leading == "SELECT":
        has_limit = re.search(r"\bLIMIT\s+\d+", normalized, re.IGNORECASE)
        if not has_limit:
            # Inject LIMIT 100 before the last semicolon or end
            sql = sql.rstrip().rstrip(";") + " LIMIT 100;"
            logger.info("Auto-injected LIMIT 100 into SQL query")

    return ValidationResult(valid=True, sql=sql)
