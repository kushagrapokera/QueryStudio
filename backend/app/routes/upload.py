import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from app.services.profiler import profile_dataset

upload_bp = Blueprint("upload", __name__)

# In-memory store for dataset references. In production, use a DB.
datasets = {}


@upload_bp.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".csv", ".xlsx", ".xls"):
        return jsonify({"error": "Only CSV and Excel (.xlsx, .xls) files are supported"}), 400

    dataset_id = str(uuid.uuid4())[:8]
    safe_name = f"{dataset_id}{ext}"
    upload_dir = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, safe_name)
    file.save(filepath)

    # Profile the dataset
    try:
        profile = profile_dataset(filepath)
    except Exception as e:
        return jsonify({"error": f"Failed to profile dataset: {str(e)}"}), 500

    datasets[dataset_id] = {
        "id": dataset_id,
        "filename": file.filename,
        "path": filepath,
        "profile": profile,
    }

    return jsonify({
        "dataset_id": dataset_id,
        "filename": file.filename,
        "profile": profile,
    }), 201


@upload_bp.route("/datasets", methods=["GET"])
def list_datasets():
    return jsonify([
        {
            "dataset_id": ds["id"],
            "filename": ds["filename"],
            "profile": ds.get("profile"),
        }
        for ds in datasets.values()
    ])
