"""Route: natural-language SQL query execution against a saved connection.

POST /api/connections/<conn_id>/query
  Body: {"query": "how many appointments per doctor?"}
  Returns: {type, columns, rows, row_count, _generated_sql, ...}
"""

import logging
from flask import Blueprint, request, jsonify
from app.services import connection_manager

logger = logging.getLogger(__name__)

sql_query_bp = Blueprint("sql_query", __name__)


@sql_query_bp.route("/connections/<conn_id>/query", methods=["POST"])
def run_sql_query(conn_id: str):
    """Run a natural-language SQL query against a saved connection."""
    data = request.get_json()
    if not data or not data.get("query"):
        return jsonify({"error": "Request body with 'query' field is required"}), 400

    user_query = data["query"].strip()
    if not user_query:
        return jsonify({"error": "query must not be empty"}), 400

    # 1. Load connection
    conn = connection_manager.get_connection_raw(conn_id)
    if not conn:
        return jsonify({"error": "Connection not found"}), 404

    db_type = conn["params"].get("db_type", "postgres")

    try:
        # 2. Introspect schema
        from app.services.schema import get_schema, format_schema_compact
        schema = get_schema(conn)
        schema_compact = format_schema_compact(schema)

        # 3. Generate SQL via LLM
        from app.services.code_generator import build_sql_prompt, extract_sql
        from app.services.llm_client import generate

        system_prompt, user_prompt = build_sql_prompt(schema_compact, user_query, db_type)
        llm_response = generate(user_prompt, system_prompt=system_prompt)

        if not llm_response:
            return jsonify({
                "error": "LLM failed to generate SQL. Check OLLAMA_API_KEY and model availability.",
                "type": "error",
            }), 502

        generated_sql = extract_sql(llm_response)
        if not generated_sql:
            return jsonify({
                "error": "Could not extract SQL from LLM response",
                "type": "error",
                "_llm_raw": llm_response,
            }), 422

        # 4. Validate the generated SQL
        from app.services.sql_validator import validate
        validation = validate(generated_sql)
        if not validation.valid:
            return jsonify({
                "error": f"SQL validation failed: {validation.error}",
                "type": "error",
                "_generated_sql": generated_sql,
            }), 422

        # 5. Execute the validated SQL
        from app.services.sql_executor import execute
        timeout = data.get("timeout", 30)
        result = execute(validation.sql, conn, timeout)

        # Attach the generated SQL for debugging / display
        result["_generated_sql"] = validation.sql

        # Handle execution errors gracefully
        if result.get("type") == "error":
            return jsonify(result), 422

        return jsonify(result)

    except ValueError as e:
        return jsonify({"error": str(e), "type": "error"}), 400
    except ImportError as e:
        return jsonify({"error": f"Missing driver: {str(e)}", "type": "error"}), 500
    except Exception as e:
        logger.exception("SQL query failed for %s", conn_id)
        return jsonify({"error": f"SQL query failed: {str(e)}", "type": "error"}), 500
