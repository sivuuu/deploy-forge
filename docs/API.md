# DeployForge REST API Documentation

Base URL: `http://localhost:8000/api`

## Authentication & Headers
- Standard Content-Type: `application/json`
- Webhook Ingestion: `X-Hub-Signature-256: sha256=<HMAC-SHA256-HEX>`

---

## 1. Projects API

### List Projects
- **Endpoint**: `GET /api/projects/`
- **Description**: Returns all registered projects, default branch, active release, and runtime adapter info.

### Register New Project
- **Endpoint**: `POST /api/projects/`
- **Body**:
```json
{
  "name": "Payments Service",
  "slug": "payments-service",
  "repo_url": "https://github.com/org/payments.git",
  "default_branch": "main",
  "deployment_target": "staging",
  "runtime": "podman",
  "jenkins_job_name": "payments-pipeline",
  "jenkins_url": "http://localhost:8080"
}
```

### Trigger Pipeline Run
- **Endpoint**: `POST /api/projects/{id}/trigger/`
- **Description**: Triggers an execution run. Prevents duplicate concurrent deployments unless forced.
- **Body**:
```json
{
  "branch": "main",
  "commit_sha": "c0ffee1",
  "commit_message": "release: v1.1.0 update",
  "simulate_failure_stage": null
}
```
*Note: `simulate_failure_stage` can be set to `'health_check'`, `'sast_scan'`, or `'trivy_scan'` for testing gates and rollback defenses.*

### Test Connections
- **Endpoint**: `GET /api/projects/{id}/test_connection/`
- **Returns**: Health connectivity checks for Jenkins CI and the local container runtime (Podman/Docker).

### Webhook Ingestion
- **Endpoint**: `POST /api/projects/{id}/webhook/`
- **Headers**: `X-Hub-Signature-256: sha256=...`
- **Description**: Idempotent Git push trigger with HMAC signature validation.

---

## 2. Pipeline Runs API

### List Pipeline Executions
- **Endpoint**: `GET /api/pipelines/`
- **Query Params**:
  - `status`: filter by `successful`, `failed`, `running`, `queued`
  - `project`: filter by project UUID

### Pipeline Detail
- **Endpoint**: `GET /api/pipelines/{id}/`
- **Returns**: Full execution details, ordered stages DAG, artifacts, and security findings.

### Progressive Console Logs
- **Endpoint**: `GET /api/pipelines/{id}/logs/?page=1&page_size=100`
- **Query Params**:
  - `page`: Page index (1-based)
  - `page_size`: Number of lines per page (default: 100)
  - `tail`: If set, returns only the last N lines

### Cancel Running Pipeline
- **Endpoint**: `POST /api/pipelines/{id}/cancel/`
- **Description**: Stops pipeline execution and marks status as `canceled`.

---

## 3. Security Findings & Gates API

### List Findings
- **Endpoint**: `GET /api/security-findings/`
- **Query Params**: `severity=CRITICAL`, `tool=semgrep|trivy`, `status=open|approved_exception`

### Approve Security Exception
- **Endpoint**: `POST /api/security-findings/{id}/approve_exception/`
- **Body**:
```json
{
  "reason": "Audited safe internal script with static parameters",
  "approved_by": "Security Officer"
}
```

---

## 4. Deployments & Rollback API

### List Deployments
- **Endpoint**: `GET /api/deployments/`

### Deploy Approved Version
- **Endpoint**: `POST /api/deployments/deploy/`
- **Body**:
```json
{
  "artifact_id": "<uuid>",
  "environment": "staging",
  "confirmed": true,
  "deployed_by": "release_manager"
}
```

### Emergency Rollback
- **Endpoint**: `POST /api/deployments/rollback/`
- **Body**:
```json
{
  "project_id": "<uuid>",
  "target_artifact_id": "<optional-uuid>",
  "reason": "Incident #502: HTTP 500 error spike post-release",
  "confirmed": true,
  "initiated_by": "on_call_engineer"
}
```

### Live Staging Health Probe
- **Endpoint**: `GET /api/deployments/live_health/`
- **Returns**: Immediate live HTTP probe to `http://localhost:8085/health` with status code, latency (ms), and payload.

---

## 5. Dashboard Telemetry API
- **Endpoint**: `GET /api/dashboard/stats/`
- **Returns**: Success rates, active release, blocker counts, container engine availability, and recent runs.
