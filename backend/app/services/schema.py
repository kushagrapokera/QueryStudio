"""Schema introspection service — extracts database schema metadata.

Supports two modes:
  - **Direct**: connects via psycopg2 (Postgres) or pymysql (MySQL)
  - **MCP**: retrieves schema via MCP tool calls (list_tables, describe_table)
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
#  Direct schema introspection
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
        )
    raise ValueError(f"Unsupported db_type: {db_type}")


def _fetch_tables_direct(conn, db_type: str) -> list[dict]:
    """Fetch table list: name, type, estimated row count."""
    tables = []
    if db_type == "postgres":
        cur = conn.cursor()
        cur.execute("""
            SELECT table_name, table_type,
                   (SELECT reltuples::bigint FROM pg_class WHERE oid = quote_ident(table_name)::regclass) AS row_estimate
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        for row in cur.fetchall():
            tables.append({"name": row[0], "type": row[1], "estimated_rows": row[2] or 0})
        cur.close()
    elif db_type == "mysql":
        cur = conn.cursor()
        cur.execute("""
            SELECT table_name, table_type,
                   (SELECT table_rows FROM information_schema.tables t2
                    WHERE t2.table_schema = DATABASE() AND t2.table_name = t.table_name) AS row_estimate
            FROM information_schema.tables t
            WHERE table_schema = DATABASE()
            ORDER BY table_name
        """)
        for row in cur.fetchall():
            tables.append({"name": row[0], "type": row[1], "estimated_rows": row[2] or 0})
        cur.close()
    return tables


def _fetch_columns_direct(conn, table: str, db_type: str) -> list[dict]:
    """Fetch column metadata for a single table."""
    columns = []
    if db_type == "postgres":
        cur = conn.cursor()
        cur.execute("""
            SELECT column_name, data_type, is_nullable, COALESCE(character_maximum_length, 0)
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position
        """, (table,))
        for row in cur.fetchall():
            col_type = row[1]
            if row[3] > 0:
                col_type = f"{col_type}({row[3]})"
            columns.append({
                "name": row[0],
                "type": col_type,
                "nullable": row[2] == "YES",
            })
        cur.close()
    elif db_type == "mysql":
        cur = conn.cursor()
        cur.execute("""
            SELECT column_name, column_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = %s
            ORDER BY ordinal_position
        """, (table,))
        for row in cur.fetchall():
            columns.append({
                "name": row[0],
                "type": row[1],
                "nullable": row[2] == "YES",
            })
        cur.close()
    return columns


def _fetch_primary_keys_direct(conn, table: str, db_type: str) -> list[str]:
    """Fetch primary key column names."""
    pk_cols = []
    if db_type == "postgres":
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'public'
              AND tc.table_name = %s
              AND tc.constraint_type = 'PRIMARY KEY'
            ORDER BY kcu.column_name
        """, (table,))
        pk_cols = [r[0] for r in cur.fetchall()]
        cur.close()
    elif db_type == "mysql":
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = DATABASE()
              AND tc.table_name = %s
              AND tc.constraint_type = 'PRIMARY KEY'
            ORDER BY kcu.column_name
        """, (table,))
        pk_cols = [r[0] for r in cur.fetchall()]
        cur.close()
    return pk_cols


def _fetch_foreign_keys_direct(conn, table: str, db_type: str) -> list[dict]:
    """Fetch foreign key relationships."""
    fks = []
    if db_type == "postgres":
        cur = conn.cursor()
        cur.execute("""
            SELECT kcu.column_name,
                   ccu.table_name AS referenced_table,
                   ccu.column_name AS referenced_column,
                   tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name
                AND tc.table_schema = ccu.table_schema
            WHERE tc.table_schema = 'public'
              AND tc.table_name = %s
              AND tc.constraint_type = 'FOREIGN KEY'
        """, (table,))
        for row in cur.fetchall():
            fks.append({
                "column": row[0],
                "references_table": row[1],
                "references_column": row[2],
                "constraint": row[3],
            })
        cur.close()
    elif db_type == "mysql":
        cur = conn.cursor()
        cur.execute("""
            SELECT kcu.column_name,
                   kcu.referenced_table_name,
                   kcu.referenced_column_name,
                   kcu.constraint_name
            FROM information_schema.key_column_usage kcu
            WHERE kcu.table_schema = DATABASE()
              AND kcu.table_name = %s
              AND kcu.referenced_table_name IS NOT NULL
        """, (table,))
        for row in cur.fetchall():
            fks.append({
                "column": row[0],
                "references_table": row[1],
                "references_column": row[2],
                "constraint": row[3],
            })
        cur.close()
    return fks


def _fetch_indexes_direct(conn, table: str, db_type: str) -> list[dict]:
    """Fetch index information."""
    indexes = []
    if db_type == "postgres":
        cur = conn.cursor()
        cur.execute("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = %s
            ORDER BY indexname
        """, (table,))
        for row in cur.fetchall():
            indexes.append({
                "name": row[0],
                "definition": row[1],
            })
        cur.close()
    elif db_type == "mysql":
        cur = conn.cursor()
        cur.execute("SHOW INDEXES FROM `%s`" % table)
        seen = set()
        for row in cur.fetchall():
            idx_name = row[2]
            if idx_name not in seen:
                seen.add(idx_name)
                indexes.append({
                    "name": idx_name,
                    "unique": not row[1],  # NonUnique = 0 means unique
                    "column": row[4],
                })
        cur.close()
    return indexes


def _fetch_sample_rows_direct(conn, table: str, db_type: str, limit: int = 3) -> list[dict]:
    """Fetch sample rows from a table."""
    try:
        cur = conn.cursor()
        import psycopg2
        if db_type == "postgres":
            cur.execute(f"SELECT * FROM {table} LIMIT %s", (limit,))
        elif db_type == "mysql":
            cur.execute(f"SELECT * FROM `{table}` LIMIT %s", (limit,))
        columns = [desc[0] for desc in cur.description]
        rows = [dict(zip(columns, row)) for row in cur.fetchall()]
        cur.close()
        return rows
    except Exception as e:
        logger.warning("Failed to fetch sample rows from %s: %s", table, e)
        return []


# ──────────────────────────────────────────────
#  Direct introspection — public entry point
# ──────────────────────────────────────────────

def introspect_direct(params: dict) -> dict:
    """Full schema introspection for a direct DB connection."""
    conn = _connect_direct(params)
    db_type = params["db_type"]
    try:
        tables_raw = _fetch_tables_direct(conn, db_type)
        tables = []
        for t in tables_raw:
            name = t["name"]
            cols = _fetch_columns_direct(conn, name, db_type)
            pk = _fetch_primary_keys_direct(conn, name, db_type)
            fks = _fetch_foreign_keys_direct(conn, name, db_type)
            indexes = _fetch_indexes_direct(conn, name, db_type)
            samples = _fetch_sample_rows_direct(conn, name, db_type)
            tables.append({
                "name": name,
                "type": t["type"],
                "estimated_rows": t["estimated_rows"],
                "columns": cols,
                "primary_key": pk,
                "foreign_keys": fks,
                "indexes": indexes,
                "sample_rows": samples,
            })
        return {
            "db_type": db_type,
            "database": params["database"],
            "tables": tables,
        }
    finally:
        try:
            conn.close()
        except Exception:
            pass


# ──────────────────────────────────────────────
#  MCP schema introspection
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


def introspect_mcp(params: dict) -> dict:
    """Full schema introspection via MCP tool calls."""
    url = params["url"].rstrip("/")
    api_key = params.get("api_key", "")

    # 1. List tables via MCP
    result = _mcp_request(url, api_key, "list_tables")
    table_names = []
    raw_tables = []

    # Handle different MCP response formats
    if "result" in result and "tables" in result["result"]:
        raw_tables = result["result"]["tables"]
        table_names = [t.get("name", t) for t in raw_tables]
    elif "result" in result and isinstance(result["result"], list):
        raw_tables = result["result"]
        table_names = [t.get("name", t) if isinstance(t, dict) else str(t) for t in raw_tables]
    else:
        raise RuntimeError(f"Unexpected MCP list_tables response format: {result}")

    # 2. Describe each table
    tables = []
    for name in table_names:
        try:
            desc = _mcp_request(url, api_key, "describe_table", {"table": name})
            columns = []
            schema_content = desc.get("result", {})
            schema_cols = schema_content.get("columns", schema_content.get("schema", []))

            if isinstance(schema_cols, list):
                for col in schema_cols:
                    if isinstance(col, dict):
                        columns.append({
                            "name": col.get("name", ""),
                            "type": col.get("type", col.get("data_type", "unknown")),
                            "nullable": col.get("nullable", col.get("is_nullable", True)),
                        })
                    else:
                        columns.append({"name": str(col), "type": "unknown", "nullable": True})

            tables.append({
                "name": name,
                "type": "TABLE",
                "estimated_rows": 0,
                "columns": columns,
                "primary_key": schema_content.get("primary_key", []),
                "foreign_keys": schema_content.get("foreign_keys", []),
                "indexes": schema_content.get("indexes", []),
                "sample_rows": [],
            })
        except Exception as e:
            logger.warning("Failed to describe table '%s' via MCP: %s", name, e)
            tables.append({
                "name": name,
                "type": "TABLE",
                "estimated_rows": 0,
                "columns": [],
                "primary_key": [],
                "foreign_keys": [],
                "indexes": [],
                "sample_rows": [],
            })

    return {
        "db_type": "mcp",
        "database": params.get("url", "mcp"),
        "tables": tables,
    }


# ──────────────────────────────────────────────
#  Public API — dispatcher
# ──────────────────────────────────────────────

def get_schema(conn: dict) -> dict:
    """Introspect the schema for a given connection record."""
    if conn["type"] == "direct":
        return introspect_direct(conn["params"])
    elif conn["type"] == "mcp":
        return introspect_mcp(conn["params"])
    else:
        raise ValueError(f"Unknown connection type: {conn['type']}")


# ──────────────────────────────────────────────
#  Compact formatter (for LLM prompts)
# ──────────────────────────────────────────────

def format_schema_compact(schema: dict) -> str:
    """Format schema into a compact string suitable for LLM prompts.

    Example:
        customers(id:int PK, name:varchar, country:varchar, created_at:timestamp)
        orders(id:int PK, customer_id:int FK→customers.id, amount:decimal, order_date:date)
    """
    lines = []
    db_label = schema.get("database", schema.get("db_type", "db"))
    lines.append(f"-- Database: {db_label}")
    lines.append(f"-- Tables: {len(schema.get('tables', []))}")
    lines.append("")

    for table in schema.get("tables", []):
        col_parts = []
        for col in table.get("columns", []):
            col_str = col["name"]
            col_type = col.get("type", "unknown")
            col_str += f":{col_type}"
            if col["name"] in table.get("primary_key", []):
                col_str += " PK"
            # Check FK
            for fk in table.get("foreign_keys", []):
                if fk.get("column") == col["name"]:
                    col_str += f" FK→{fk['references_table']}.{fk['references_column']}"
            col_parts.append(col_str)

        line = f"{table['name']}({', '.join(col_parts)})"
        lines.append(line)

        # FK-only lines for readability
        for fk in table.get("foreign_keys", []):
            lines.append(
                f"  {table['name']}.{fk['column']} → "
                f"{fk['references_table']}.{fk['references_column']}"
            )

    return "\n".join(lines)
