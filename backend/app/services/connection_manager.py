import uuid
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# In-memory store for connections. In production, use a DB.
connections: dict[str, dict] = {}


def validate_direct_params(params: dict) -> Optional[str]:
    """Validate direct connection parameters. Returns error message or None."""
    required = ["host", "port", "database", "user", "password"]
    for field in required:
        if not params.get(field):
            return f"Missing required field: {field}"
    db_type = params.get("db_type", "postgres")
    if db_type not in ("postgres", "mysql"):
        return "db_type must be 'postgres' or 'mysql'"
    try:
        int(params["port"])
    except (ValueError, TypeError):
        return "port must be an integer"
    return None


def validate_mcp_params(params: dict) -> Optional[str]:
    """Validate MCP connection parameters."""
    if not params.get("url"):
        return "Missing required field: url"
    return None


def test_direct_connection(params: dict) -> tuple[bool, str]:
    """Test a direct database connection by actually connecting."""
    db_type = params.get("db_type", "postgres")
    host = params["host"]
    port = int(params["port"])
    database = params["database"]
    user = params["user"]
    password = params["password"]

    try:
        if db_type == "postgres":
            import psycopg2
            conn = psycopg2.connect(
                host=host, port=port, dbname=database,
                user=user, password=password, connect_timeout=10,
            )
            conn.close()
        elif db_type == "mysql":
            import pymysql
            conn = pymysql.connect(
                host=host, port=port, database=database,
                user=user, password=password, connect_timeout=10,
            )
            conn.close()
        return True, "Connection successful"
    except ImportError:
        return False, f"Driver not installed for {db_type}"
    except Exception as e:
        return False, str(e)


def test_mcp_connection(params: dict) -> tuple[bool, str]:
    """Test an MCP connection by checking if the URL is reachable."""
    import urllib.request
    import urllib.error

    url = params["url"].rstrip("/")
    try:
        req = urllib.request.Request(url, method="GET")
        req.add_header("Content-Type", "application/json")
        if params.get("api_key"):
            req.add_header("Authorization", f"Bearer {params['api_key']}")

        urllib.request.urlopen(req, timeout=10)
        return True, "MCP endpoint reachable"
    except urllib.error.HTTPError as e:
        # A 4xx/5xx means the server is reachable — that's enough for a basic test
        if 400 <= e.code < 500:
            return True, f"MCP endpoint reachable (HTTP {e.code})"
        return False, f"Server error (HTTP {e.code})"
    except Exception as e:
        return False, str(e)


def create_connection(data: dict) -> dict:
    """Create and store a new connection. Returns the connection record."""
    conn_type = data.get("type", "direct")
    label = data.get("label", "").strip() or f"{conn_type}-{str(uuid.uuid4())[:8]}"

    if conn_type == "direct":
        params = data.get("params", {})
        err = validate_direct_params(params)
        if err:
            raise ValueError(err)
        record = {
            "id": str(uuid.uuid4())[:8],
            "type": "direct",
            "label": label,
            "params": {
                "db_type": params.get("db_type", "postgres"),
                "host": params["host"],
                "port": int(params["port"]),
                "database": params["database"],
                "user": params["user"],
                "password": params["password"],
            },
            "read_only_reminder": True,
        }
    elif conn_type == "mcp":
        params = data.get("params", {})
        err = validate_mcp_params(params)
        if err:
            raise ValueError(err)
        record = {
            "id": str(uuid.uuid4())[:8],
            "type": "mcp",
            "label": label,
            "params": {
                "url": params["url"],
                "api_key": params.get("api_key", ""),
            },
        }
    else:
        raise ValueError(f"Unknown connection type: {conn_type}")

    # Test before saving
    ok, msg = test_connection(record)
    if not ok:
        raise ValueError(f"Connection test failed: {msg}")

    connections[record["id"]] = record
    logger.info("Created connection %s (%s)", record["id"], label)
    return _sanitize(record)


def test_connection(conn: dict) -> tuple[bool, str]:
    """Test a connection record."""
    if conn["type"] == "direct":
        return test_direct_connection(conn["params"])
    elif conn["type"] == "mcp":
        return test_mcp_connection(conn["params"])
    return False, "Unknown connection type"


def get_connection(conn_id: str) -> Optional[dict]:
    """Get a connection by ID (sanitized — no password)."""
    conn = connections.get(conn_id)
    return _sanitize(conn) if conn else None


def get_connection_raw(conn_id: str) -> Optional[dict]:
    """Get raw connection (includes password for execution)."""
    return connections.get(conn_id)


def list_connections() -> list[dict]:
    """List all saved connections (sanitized)."""
    return [_sanitize(c) for c in connections.values()]


def delete_connection(conn_id: str) -> bool:
    """Delete a connection by ID."""
    if conn_id in connections:
        del connections[conn_id]
        logger.info("Deleted connection %s", conn_id)
        return True
    return False


def update_connection_mode(conn_id: str, mode: str) -> Optional[dict]:
    """Update the type/mode of an existing connection."""
    conn = connections.get(conn_id)
    if not conn:
        return None
    if mode not in ("direct", "mcp"):
        raise ValueError("Mode must be 'direct' or 'mcp'")
    conn["type"] = mode
    return _sanitize(conn)


def _sanitize(conn: dict) -> dict:
    """Return a copy with sensitive fields removed for API responses."""
    if not conn:
        return conn
    c = {k: v for k, v in conn.items() if k != "params"}
    c["params"] = {}
    for k, v in conn.get("params", {}).items():
        if k not in ("password", "api_key"):
            c["params"][k] = v
    c["params"]["has_password"] = bool(conn.get("params", {}).get("password"))
    c["params"]["has_api_key"] = bool(conn.get("params", {}).get("api_key"))
    return c
