import os
import sys
import time
import json

VERSION = os.environ.get("APP_VERSION", "v1.0.0")
COMMIT_SHA = os.environ.get("COMMIT_SHA", "unknown")
ENVIRONMENT = os.environ.get("ENVIRONMENT", "staging")
BUILD_TIMESTAMP = os.environ.get("BUILD_TIMESTAMP", str(int(time.time())))
START_TIME = time.time()
IS_CRASHED = False

try:
    from flask import Flask, jsonify, request
    HAS_FLASK = True
    app = Flask(__name__)

    @app.route("/", methods=["GET"])
    def index():
        return jsonify({
            "service": "DeployForge Sample Microservice",
            "description": "Production-grade microservice with health probes and telemetry",
            "version": VERSION,
            "commit": COMMIT_SHA,
            "environment": ENVIRONMENT,
            "uptime_seconds": round(time.time() - START_TIME, 2),
        })

    @app.route("/health", methods=["GET"])
    def health():
        if IS_CRASHED or os.environ.get("SIMULATE_HEALTH_FAILURE") == "true":
            return jsonify({
                "status": "unhealthy",
                "error": "Service simulated failure or crash condition active",
                "version": VERSION,
                "environment": ENVIRONMENT,
            }), 500

        return jsonify({
            "status": "healthy",
            "version": VERSION,
            "commit": COMMIT_SHA,
            "environment": ENVIRONMENT,
            "uptime_seconds": round(time.time() - START_TIME, 2),
            "build_timestamp": BUILD_TIMESTAMP,
        }), 200

    @app.route("/ready", methods=["GET"])
    def ready():
        if IS_CRASHED:
            return jsonify({"ready": False, "reason": "Crashed"}), 503
        return jsonify({"ready": True, "dependencies": {"database": "connected", "cache": "connected"}}), 200

    @app.route("/version", methods=["GET"])
    def version():
        return jsonify({
            "version": VERSION,
            "commit": COMMIT_SHA,
            "environment": ENVIRONMENT,
            "build_timestamp": BUILD_TIMESTAMP,
        }), 200

    @app.route("/metrics", methods=["GET"])
    def metrics():
        return jsonify({
            "requests_total": 42,
            "latency_p95_ms": 14.2,
            "cpu_usage_pct": 1.8,
            "memory_mb": 48.5,
            "version": VERSION,
        }), 200

    @app.route("/api/crash", methods=["POST"])
    def trigger_crash():
        global IS_CRASHED
        IS_CRASHED = True
        return jsonify({"message": "Crash state triggered for rollback testing", "crashed": True}), 200

except ImportError:
    HAS_FLASK = False
    app = None

    from http.server import HTTPServer, BaseHTTPRequestHandler

    class FallbackHTTPHandler(BaseHTTPRequestHandler):
        def _send_json(self, data, status=200):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode("utf-8"))

        def do_GET(self):
            global IS_CRASHED
            if self.path == "/health":
                if IS_CRASHED or os.environ.get("SIMULATE_HEALTH_FAILURE") == "true":
                    self._send_json({
                        "status": "unhealthy",
                        "error": "Service simulated failure or crash condition active",
                        "version": VERSION,
                        "environment": ENVIRONMENT,
                    }, status=500)
                else:
                    self._send_json({
                        "status": "healthy",
                        "version": VERSION,
                        "commit": COMMIT_SHA,
                        "environment": ENVIRONMENT,
                        "uptime_seconds": round(time.time() - START_TIME, 2),
                        "build_timestamp": BUILD_TIMESTAMP,
                    }, status=200)
            elif self.path == "/version":
                self._send_json({
                    "version": VERSION,
                    "commit": COMMIT_SHA,
                    "environment": ENVIRONMENT,
                    "build_timestamp": BUILD_TIMESTAMP,
                }, status=200)
            elif self.path == "/ready":
                if IS_CRASHED:
                    self._send_json({"ready": False, "reason": "Crashed"}, status=503)
                else:
                    self._send_json({"ready": True, "dependencies": {"database": "connected", "cache": "connected"}}, status=200)
            elif self.path == "/metrics":
                self._send_json({
                    "requests_total": 42,
                    "latency_p95_ms": 14.2,
                    "cpu_usage_pct": 1.8,
                    "memory_mb": 48.5,
                    "version": VERSION,
                }, status=200)
            else:
                self._send_json({
                    "service": "DeployForge Sample Microservice",
                    "description": "Production-grade microservice with health probes and telemetry",
                    "version": VERSION,
                    "commit": COMMIT_SHA,
                    "environment": ENVIRONMENT,
                    "uptime_seconds": round(time.time() - START_TIME, 2),
                }, status=200)

        def do_POST(self):
            global IS_CRASHED
            if self.path == "/api/crash":
                IS_CRASHED = True
                self._send_json({"message": "Crash state triggered for rollback testing", "crashed": True}, status=200)
            else:
                self._send_json({"error": "Not Found"}, status=404)

        def log_message(self, format, *args):
            return

def get_status_dict():
    """Helper for unit tests without network call."""
    return {
        "status": "healthy" if not (IS_CRASHED or os.environ.get("SIMULATE_HEALTH_FAILURE") == "true") else "unhealthy",
        "version": VERSION,
        "commit": COMMIT_SHA,
        "environment": ENVIRONMENT,
        "uptime_seconds": round(time.time() - START_TIME, 2),
        "build_timestamp": BUILD_TIMESTAMP,
    }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8085))
    if HAS_FLASK:
        app.run(host="0.0.0.0", port=port)
    else:
        server = HTTPServer(("0.0.0.0", port), FallbackHTTPHandler)
        print(f"DeployForge Sample Service running on port {port} (native http.server)...")
        server.serve_forever()
