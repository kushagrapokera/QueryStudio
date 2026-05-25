"""SQL execution — direct (psycopg2/pymysql) and MCP paths.

Read-only enforcement: all direct queries run inside a transaction that is
rolled back after fetching results.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
#  Direct SQL execution
# ──────────────────────────────────────────────

def _connect_direct(params: dict):
    """Open a direct DB connection. Caller must close()."""
    db_type = params["db_type"]
    if db_type == "postgres":
        import psycopg2
        return psycopg2.connect(
            host=params["host"],
            port=int(params["port"]),
            dbname=params["database"],
            user=params["user"],
            password=params["password"],
            connect_timeout=10,
        )
    elif db_type == "mysql":
        import pymysql
        return pymysql.connect(
            host=params["host"],
            port=int(params["port"]),
            database=params["database"],
            user=params["user"],
            password=params["password"],
            connect_timeout=10,
            autocommit=False,
        )
    raise ValueError(f"Unsupported db_type: {db_type}")


def _format_results(columns: list[str], rows: list[tuple], db_type: str) -> dict:
    """Format query results into structured JSON."""
    data = {
        "type": "table",
        "columns": columns,
        "rows": [list(r) for r in rows],
        "row_count": len(rows),
    }

    # Detect chart-ready data: at least one numeric column + at least 2 rows
    numeric_types = {"int", "integer", "bigint", "smallint", "tinyint",
                     "decimal", "numeric", "float", "double", "real"}
    numeric_cols = []
    date_cols = []
    date_types = {"date", "datetime", "timestamp", "year"}

    if len(rows) >= 2:
        for i, col in enumerate(columns):
            if rows and i < len(rows[0]) and rows[0][i] is not None:
                col_type = _infer_column_type(rows, i, db_type)
                if col_type in numeric_types:
                    numeric_cols.append(col)
                elif col_type in date_types:
                    date_cols.append(col)

    data["_chart_ready"] = {
        "has_chart_data": len(numeric_cols) > 0,
        "numeric_columns": numeric_cols,
        "date_columns": date_cols,
    }

    return data


def _infer_column_type(rows: list[tuple], col_idx: int, db_type: str) -> str:
    """Infer column type from actual data values."""
    for row in rows:
        val = row[col_idx] if col_idx < len(row) else None
        if val is None:
            continue
        if isinstance(val, int):
            return "integer"
        elif isinstance(val, float):
            return "float"
        elif isinstance(val, (datetime, date)):
            return "date"
        elif isinstance(val, str):
            return "string"
        elif isinstance(val, bool):
            return "boolean"
        elif isinstance(val, Decimal):
            return "decimal"
    return "string"


from datetime import date, datetime
from decimal import Decimal


def execute_direct(sql: str, params: dict, timeout: int = 30) -> dict:
    """Execute SQL directly via psycopg2/pymysql with read-only enforcement.

    Runs inside a transaction and always rolls back.
    Returns structured JSON result.
    """
    db_type = params["db_type"]
    conn = _connect_direct(params)
    try:
        # Read-only: start transaction, will rollback
        if db_type == "postgres":
            conn.set_session(autocommit=False, readonly=True)
        # MySQL: autocommit=False already set in connect

        cur = conn.cursor()
        try:
            # Set statement timeout
            if db_type == "postgres":
                cur.execute(f"SET statement_timeout = {timeout * 1000}")
            elif db_type == "mysql":
                cur.execute(f"SET max_execution_time = {timeout * 1000}")

            cur.execute(sql)

            # Fetch column names
            columns = [desc[0] for desc in cur.description] if cur.description else []
            rows = cur.fetchall() if cur.description else []

            result = _format_results(columns, rows, db_type)

        finally:
            cur.close()

        # Rollback — ensures read-only even for engines that ignore readonly flag
        conn.rollback()

        return result

    except Exception as e:
        logger.error("SQL execution error: %s", e)
        return {
            "type": "error",
            "ename": type(e).__name__,
            "message": str(e),
        }
    finally:
        try:
            conn.close()
        except Exception:
            pass


# ──────────────────────────────────────────────
#  MCP SQL execution
# ──────────────────────────────────────────────

def _mcp_request(url: str, api_key: str, tool: str, args: dict = None) -> dict:
    """Call an MCP tool and return the result."""
    import urllib.request, urllib.error, json

    payload = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool,
            "arguments": args or {},
        },
    }).encode()

    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    if api_key:
        req.add_header("Authorization", f"Bearer {api_key}")

    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"MCP request failed (HTTP {e.code}): {e.read().decode()}")
    except Exception as e:
        raise RuntimeError(f"MCP request failed: {e}")


import json as _json


def execute_mcp(sql: str, params: dict, timeout: int = 30) -> dict:
    """Execute SQL via MCP tool call (run_sql or execute_query)."""
    url = params["url"].rstrip("/")
    api_key = params.get("api_key", "")

    try:
        # Try run_sql first, fall back to execute_query
        tool = "run_sql"
        result = _mcp_request(url, api_key, tool, {"sql": sql})
        if "result" not in result:
            tool = "execute_query"
            result = _mcp_request(url, api_key, tool, {"query": sql})

        content = result.get("result", {})

        # Handle different MCP response formats
        columns = content.get("columns", content.get("headers", []))
        rows = content.get("rows", content.get("data", []))

        if not columns and isinstance(content, list):
            # If result is directly a list of rows
            rows = content
            columns = list(content[0].keys()) if content and isinstance(content[0], dict) else []

        if isinstance(rows, list) and rows and isinstance(rows[0], dict):
            # List of dicts format
            columns = list(rows[0].keys())
            rows = [list(r.values()) for r in rows]

        return _format_results(columns, rows, "mcp")

    except Exception as e:
        logger.error("MCP SQL execution error: %s", e)
        return {
            "type": "error",
            "ename": type(e).__name__,
            "message": str(e),
        }


# ──────────────────────────────────────────────
#  Public API — dispatcher
# ──────────────────────────────────────────────

def execute(sql: str, conn: dict, timeout: int = 30) -> dict:
    """Execute SQL against a connection (direct or MCP).

    Returns structured JSON result ({type, columns, rows, ...}).
    """
    if conn["type"] == "direct":
        return execute_direct(sql, conn["params"], timeout)
    elif conn["type"] == "mcp":
        return execute_mcp(sql, conn["params"], timeout)
    else:
        return {
            "type": "error",
            "message": f"Unknown connection type: {conn['type']}",
        }
