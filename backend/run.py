import os
import sys
from dotenv import load_dotenv

# Load .env BEFORE anything else — ensures Flask reloader children get it too
load_dotenv(override=True)

# Pin the correct Python path so the subprocess runner uses the conda env's Python,
# even after the Werkzeug reloader spawns a child process.
os.environ["QS_PYTHON"] = sys.executable

from app import create_app

app = create_app()

if __name__ == "__main__":
    # Quick sanity check at startup
    model = os.environ.get("PRIMARY_MODEL", "NOT SET")
    key_prefix = os.environ.get("OLLAMA_API_KEY", "")[:20] if os.environ.get("OLLAMA_API_KEY") else "NOT SET"
    qs_python = os.environ.get("QS_PYTHON", "NOT SET")
    print(f"[startup] PRIMARY_MODEL={model}, QS_PYTHON={qs_python}")
    app.run(debug=True, port=5000)
