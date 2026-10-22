# Multi-stage build for DeployForge Microservice
FROM python:3.11-slim AS builder

WORKDIR /build

COPY requirements.txt .
# Pure Python wheels do not require build tools
RUN pip install --no-cache-dir --user -r requirements.txt

# Final minimal runtime stage
FROM python:3.11-slim AS runner

ARG APP_VERSION="v1.0.0"
ARG COMMIT_SHA="local-dev"
ARG BUILD_TIMESTAMP="0"

LABEL maintainer="DeployForge Platform Engineering <devops@deployforge.local>" \
      version="${APP_VERSION}" \
      commit="${COMMIT_SHA}" \
      org.opencontainers.image.source="https://github.com/deployforge/sample-microservice"

# Create unprivileged non-root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/sh -m appuser

WORKDIR /app

# Copy installed dependencies
COPY --from=builder /root/.local /home/appuser/.local
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_VERSION=${APP_VERSION} \
    COMMIT_SHA=${COMMIT_SHA} \
    BUILD_TIMESTAMP=${BUILD_TIMESTAMP} \
    PORT=8085

# Copy application source
COPY --chown=appuser:appgroup app.py /app/app.py

USER appuser

EXPOSE 8085

HEALTHCHECK --interval=5s --timeout=3s --start-period=3s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8085/health').read()" || exit 1

CMD ["python3", "/app/app.py"]
