import logging
import time
from flask import Flask, request
from flask_cors import CORS
from app.config import Config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    CORS(app)

    # Request logging
    @app.before_request
    def start_timer():
        request._start_time = time.time()

    @app.after_request
    def log_request(response):
        elapsed = time.time() - request._start_time
        logger.info(
            "%s %s → %s (%.2fs)",
            request.method,
            request.path,
            response.status_code,
            elapsed,
        )
        return response

    from app.routes.upload import upload_bp
    from app.routes.python_query import python_query_bp

    app.register_blueprint(upload_bp, url_prefix="/api")
    app.register_blueprint(python_query_bp, url_prefix="/api")

    @app.route("/api/health")
    def health():
        return {"status": "ok"}

    return app
