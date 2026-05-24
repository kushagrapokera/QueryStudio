import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key")
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads")
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB

    # Ollama Cloud API
    OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY", "")
    OLLAMA_API_URL = os.environ.get("OLLAMA_API_URL", "https://ollama.com/v1/chat/completions")
    PRIMARY_MODEL = os.environ.get("PRIMARY_MODEL", "minimax")
    FALLBACK_MODEL = os.environ.get("FALLBACK_MODEL", "qwen3-coder:480b")
