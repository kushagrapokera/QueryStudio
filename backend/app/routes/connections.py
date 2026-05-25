import logging
from flask import Blueprint, request, jsonify
from app.services import connection_manager

logger = logging.getLogger(__name__)

connections_bp = Blueprint("connections", __name__)


@connections_bp.route("/connections", methods=["POST"])
def create_connection():
    """Save a new database connection."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    try:
        conn = connection_manager.create_connection(data)
        return jsonify(conn), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.exception("Failed to create connection")
        return jsonify({"error": f"Failed to create connection: {str(e)}"}), 500


@connections_bp.route("/connections", methods=["GET"])
def list_connections():
    """List all saved connections."""
    return jsonify(connection_manager.list_connections())


@connections_bp.route("/connections/<conn_id>", methods=["GET"])
def get_connection(conn_id: str):
    """Get a single connection by ID."""
    conn = connection_manager.get_connection(conn_id)
    if not conn:
        return jsonify({"error": "Connection not found"}), 404
    return jsonify(conn)


@connections_bp.route("/connections/<conn_id>", methods=["DELETE"])
def delete_connection(conn_id: str):
    """Remove a connection."""
    if connection_manager.delete_connection(conn_id):
        return jsonify({"message": "Connection deleted"})
    return jsonify({"error": "Connection not found"}), 404


@connections_bp.route("/connections/test", methods=["POST"])
def test_connection():
    """Test a database or MCP connection without saving."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    conn_type = data.get("type", "direct")
    params = data.get("params", {})

    mock_conn = {"type": conn_type, "params": params}

    try:
        ok, msg = connection_manager.test_connection(mock_conn)
        return jsonify({"success": ok, "message": msg})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


@connections_bp.route("/connections/<conn_id>/mode", methods=["PUT"])
def update_connection_mode(conn_id: str):
    """Switch the mode (direct/mcp) of an existing connection."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    mode = data.get("mode")
    if not mode:
        return jsonify({"error": "mode is required"}), 400

    try:
        conn = connection_manager.update_connection_mode(conn_id, mode)
        if not conn:
            return jsonify({"error": "Connection not found"}), 404
        return jsonify(conn)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@connections_bp.route("/connections/<conn_id>/schema", methods=["GET"])
def get_schema(conn_id: str):
    """Fetch full schema for a connection (tables, columns, keys, indexes, sample rows)."""
    conn = connection_manager.get_connection_raw(conn_id)
    if not conn:
        return jsonify({"error": "Connection not found"}), 404

    try:
        from app.services.schema import get_schema, format_schema_compact

        schema = get_schema(conn)
        schema["_compact"] = format_schema_compact(schema)
        return jsonify(schema)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except ImportError as e:
        return jsonify({"error": f"Missing driver: {str(e)}"}), 500
    except Exception as e:
        logger.exception("Schema introspection failed for %s", conn_id)
        return jsonify({"error": f"Schema introspection failed: {str(e)}"}), 500
