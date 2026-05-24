import os
import logging
from flask import Blueprint, request, jsonify
from app.routes.upload import datasets
from app.services.llm_client import generate
from app.services.code_generator import build_python_prompt, extract_code
from app.services.python_executor import execute_python_code

logger = logging.getLogger(__name__)

python_query_bp = Blueprint("python_query", __name__)


@python_query_bp.route("/query", methods=["POST"])
def run_python_query():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    dataset_id = data.get("dataset_id")
    query = data.get("query")

    if not dataset_id or not query:
        return jsonify({"error": "dataset_id and query are required"}), 400

    # Look up dataset
    dataset = datasets.get(dataset_id)
    if not dataset:
        return jsonify({"error": f"Dataset '{dataset_id}' not found"}), 404

    profile = dataset.get("profile")
    if not profile:
        return jsonify({"error": "Dataset profile not available"}), 400

    # Build prompt from profile + user query
    system_prompt, user_prompt = build_python_prompt(profile, query)

    # Call LLM
    response = generate(user_prompt, system_prompt=system_prompt)
    if response is None:
        return jsonify({
            "type": "error",
            "message": "Failed to generate Python code. Check your OLLAMA_API_KEY and model availability.",
        }), 500

    # Extract code block
    code = extract_code(response)
    if not code:
        return jsonify({
            "type": "error",
            "message": "Model returned empty or unparseable response.",
        }), 500

    # Get the dataset file path for execution
    csv_path = dataset.get("path")
    if not csv_path or not os.path.isfile(csv_path):
        return jsonify({
            "type": "error",
            "message": "Dataset file not found on disk.",
        }), 500

    # Execute the generated code in a sandboxed subprocess
    result = execute_python_code(code, csv_path)

    # Attach the generated code for debugging / display
    result["_generated_code"] = code

    return jsonify(result)
