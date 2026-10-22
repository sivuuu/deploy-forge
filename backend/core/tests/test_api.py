import hmac
import hashlib
import json
import pytest
from rest_framework.test import APIClient
from core.models import Project, Artifact, Deployment, SecurityFinding, PipelineRun


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def api_setup(db):
    project = Project.objects.create(
        name="Cart Service",
        slug="cart-service",
        repo_url="https://github.com/org/cart.git",
        webhook_secret="super-secret-webhook-key-42"
    )
    run = PipelineRun.objects.create(
        project=project,
        run_number=1,
        commit_sha="fe1234a",
        status="successful",
        raw_logs="Line 1: Checkout\nLine 2: Test\nLine 3: Build\nLine 4: Done"
    )
    art = Artifact.objects.create(
        pipeline_run=run,
        project=project,
        image_name="cart-service",
        image_tag="v1.0.0",
        is_approved=True
    )
    dep = Deployment.objects.create(
        project=project,
        artifact=art,
        environment="staging",
        version_tag="v1.0.0",
        status="healthy",
        is_active=True
    )
    finding = SecurityFinding.objects.create(
        pipeline_run=run,
        tool="semgrep",
        rule_id="deployforge-unsafe-eval",
        severity="HIGH",
        title="Dynamic eval",
        description="Eval call in cart calculation",
        status="open"
    )
    return project, run, art, dep, finding


@pytest.mark.django_db
def test_dashboard_stats_endpoint(client, api_setup):
    res = client.get("/api/dashboard/stats/")
    assert res.status_code == 200
    data = res.json()
    assert "stats" in data
    assert data["stats"]["total_runs"] == 1
    assert data["stats"]["active_version"] == "v1.0.0"
    assert "environment_health" in data


@pytest.mark.django_db
def test_paginated_logs_endpoint(client, api_setup):
    _, run, _, _, _ = api_setup
    res = client.get(f"/api/pipelines/{run.id}/logs/?page=1&page_size=2")
    assert res.status_code == 200
    data = res.json()
    assert data["total_lines"] == 4
    assert len(data["lines"]) == 2
    assert "Line 1" in data["lines"][0]


@pytest.mark.django_db
def test_security_exception_approval(client, api_setup):
    _, _, _, _, finding = api_setup
    # Attempt without reason fails
    res_bad = client.post(f"/api/security-findings/{finding.id}/approve_exception/", {})
    assert res_bad.status_code == 400

    # With valid reason
    res_ok = client.post(f"/api/security-findings/{finding.id}/approve_exception/", {
        "reason": "Audited safe mathematical expression parser",
        "approved_by": "sec_auditor"
    })
    assert res_ok.status_code == 200
    finding.refresh_from_db()
    assert finding.status == "approved_exception"
    assert finding.exception_approved_by == "sec_auditor"


@pytest.mark.django_db
def test_deployment_confirmation_safety(client, api_setup):
    project, _, art, _, _ = api_setup
    # Fails without confirmed: true
    res = client.post("/api/deployments/deploy/", {
        "artifact_id": str(art.id),
        "confirmed": False
    }, format="json")
    assert res.status_code == 400
    assert "confirmation" in res.json()["error"]


@pytest.mark.django_db
def test_rollback_confirmation_safety(client, api_setup):
    project, _, art, _, _ = api_setup
    # Fails without reason or confirmed: true
    res = client.post("/api/deployments/rollback/", {
        "project_id": str(project.id),
        "confirmed": False
    }, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
def test_webhook_hmac_signature_validation(client, api_setup):
    project, _, _, _, _ = api_setup
    payload = json.dumps({"ref": "refs/heads/main", "head_commit": {"id": "abcdef123456", "message": "test push"}}).encode('utf-8')

    # Valid signature
    secret = project.webhook_secret.encode('utf-8')
    sig = "sha256=" + hmac.new(secret, payload, hashlib.sha256).hexdigest()

    res_ok = client.post(
        f"/api/projects/{project.id}/webhook/",
        data=payload,
        content_type="application/json",
        HTTP_X_HUB_SIGNATURE_256=sig
    )
    assert res_ok.status_code == 200

    # Invalid signature rejected
    res_bad = client.post(
        f"/api/projects/{project.id}/webhook/",
        data=payload,
        content_type="application/json",
        HTTP_X_HUB_SIGNATURE_256="sha256=invalid-tampered-signature"
    )
    assert res_bad.status_code == 401
