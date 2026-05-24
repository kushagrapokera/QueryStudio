import subprocess
import tempfile
import os
import sys
import json
import logging

from app.services.output_parser import parse_text_output

logger = logging.getLogger(__name__)

# Wrapper script executed in a subprocess. Safe imports only — no os, no subprocess,
# no network libraries. The user's generated code runs via exec() in this context.
_WRAPPER = r'''import base64, pandas as pd, numpy as np, json, sys, io, traceback, math, statistics
import plotly.express as px
import plotly.graph_objects as go

csv_path = sys.argv[1]
df = pd.read_csv(csv_path)

sys.stdout = io.StringIO()

try:
    exec(sys.stdin.read())
except Exception as e:
    sys.stdout = sys.__stdout__
    print(json.dumps({"type": "error", "ename": type(e).__name__, "message": str(e), "traceback": traceback.format_exc()}))
    sys.exit(1)

printed = sys.stdout.getvalue()
sys.stdout = sys.__stdout__


def _numpy_to_list(obj):
    """Recursively convert numpy arrays to Python lists for JSON serialization."""
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, np.generic):
        return obj.item()
    if isinstance(obj, tuple):
        return [_numpy_to_list(i) for i in obj]
    if isinstance(obj, dict):
        if set(obj.keys()) == {"dtype", "bdata"} and isinstance(obj["bdata"], str):
            try:
                raw = base64.b64decode(obj["bdata"])
                return np.frombuffer(raw, dtype=np.dtype(obj["dtype"])).tolist()
            except Exception:
                return obj
        return {k: _numpy_to_list(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_numpy_to_list(i) for i in obj]
    return obj


def _parse_printed(text):
    if text.startswith("["):
        try:
            records = json.loads(text)
            if isinstance(records, list) and len(records) > 0 and isinstance(records[0], dict):
                cols = list(records[0].keys())
                rows = [[row.get(c, "") for c in cols] for row in records]
                return {"type": "table", "columns": cols, "rows": rows}
        except (json.JSONDecodeError, TypeError):
            pass
    return {"type": "text", "content": text}


result = None
try:
    _fig = locals().get("fig")
    if _fig is not None:
        clean_fig = _numpy_to_list(_fig.to_dict())
        if isinstance(clean_fig, dict):
            layout = clean_fig.get("layout")
            if isinstance(layout, dict):
                layout.pop("template", None)
        result = {"type": "chart", "library": "plotly", "figure": json.loads(json.dumps(clean_fig))}
except Exception:
    pass

if result is None:
    result = _parse_printed(printed.strip()) if printed.strip() else {"type": "text", "content": ""}

print(json.dumps(result, ensure_ascii=False))
'''


def _get_python_path() -> str:
    """Find the correct Python executable, respecting conda/virtual environments."""
    # First check QS_PYTHON (set by run.py before reloader can interfere)
    qs_python = os.environ.get("QS_PYTHON")
    if qs_python and os.path.isfile(qs_python):
        return qs_python

    conda_prefix = os.environ.get("CONDA_PREFIX", "")
    if conda_prefix:
        candidate = os.path.join(conda_prefix, "python.exe")
        if os.path.isfile(candidate):
            return candidate
    if sys.prefix != sys.base_prefix:
        candidate = os.path.join(sys.prefix, "python.exe")
        if os.path.isfile(candidate):
            return candidate
    return sys.executable


def execute_python_code(code: str, csv_path: str, timeout: int = 60) -> dict:
    """Execute generated Python code in a sandboxed subprocess.

    Args:
        code: The Python code string to execute.
        csv_path: Absolute path to the dataset CSV file.
        timeout: Max execution time in seconds (default 60).

    Returns:
        A structured result dict: {type: "text"|"chart"|"error", ...}
    """
    if not code or not code.strip():
        return {"type": "error", "ename": "EmptyCode", "message": "No code to execute."}

    if not os.path.isfile(csv_path):
        return {"type": "error", "ename": "FileNotFound", "message": f"Dataset file not found: {csv_path}"}

    python_path = _get_python_path()

    # Write wrapper script to a temp file
    wrapper_fd, wrapper_path = tempfile.mkstemp(suffix=".py", prefix="qs_wrapper_")
    os.close(wrapper_fd)

    try:
        with open(wrapper_path, "w", encoding="utf-8") as f:
            f.write(_WRAPPER)

        logger.info("Subprocess using python=%s", python_path)
        proc = subprocess.run(
            [python_path, wrapper_path, csv_path],
            input=code,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        stdout = proc.stdout or ""
        stderr = proc.stderr or ""

        result = _parse_result(stdout, stderr, proc.returncode)
        return result

    except subprocess.TimeoutExpired:
        logger.warning("Subprocess timed out after %ss", timeout)
        return {"type": "error", "ename": "TimeoutError", "message": f"Execution timed out after {timeout} seconds."}
    except Exception as e:
        logger.exception("Subprocess execution failed")
        return {"type": "error", "ename": type(e).__name__, "message": str(e)}
    finally:
        _safe_unlink(wrapper_path)


def _parse_result(stdout: str, stderr: str, returncode: int) -> dict:
    """Parse the wrapper script's stdout/stderr into a structured result."""
    # Try to parse the wrapper's JSON output
    if stdout.strip():
        for line in reversed(stdout.strip().split("\n")):
            line = line.strip()
            try:
                parsed = json.loads(line)
                if isinstance(parsed, dict) and "type" in parsed:
                    return parsed
            except (json.JSONDecodeError, ValueError):
                continue

    # Non-zero exit without parseable JSON → error
    if returncode != 0:
        msg = stderr.strip() or f"Process exited with code {returncode}"
        return {"type": "error", "ename": "ExecutionError", "message": msg, "traceback": stderr.strip()}

    # Fallback: try table/text parsing on stdout
    if stdout.strip():
        return parse_text_output(stdout)

    # Fallback: stderr
    if stderr.strip():
        return {"type": "error", "ename": "StderrOutput", "message": stderr.strip()}

    return {"type": "text", "content": ""}


def _safe_unlink(path: str) -> None:
    """Remove a temp file, ignoring errors."""
    try:
        os.unlink(path)
    except OSError:
        pass
