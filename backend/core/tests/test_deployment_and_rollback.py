import pytest
from unittest.mock import patch
from django.utils import timezone
from core.models import Project, Artifact, Deployment, RollbackHistory, AuditEvent
from core.services.deployment_service import DeploymentService


@pytest.fixture
def test_setup(db):
    project = Project.objects.create(name="Store API", slug="store-api", repo_url="https://github.com/org/store.git")
    art_v1 = Artifact.objects.create(
        project=project,
        image_name="store-api",
        image_tag="v1.0.0",
        is_approved=True
    )
    art_v2 = Artifact.objects.create(
        project=project,
        image_name="store-api",
        image_tag="v2.0.0-broken",
        is_approved=True
    )
    # Healthy deployment of v1
    dep_v1 = Deployment.objects.create(
        project=project,
        artifact=art_v1,
        environment="staging",
        version_tag="v1.0.0",
        status="healthy",
        is_active=True
    )
    return project, art_v1, art_v2, dep_v1


@pytest.mark.django_db
@patch.object(DeploymentService, "verify_health")
@patch("core.services.container_runtime.runtime_adapter.run_staging_container")
def test_successful_deployment(mock_run, mock_health, test_setup):
    project, art_v1, art_v2, dep_v1 = test_setup
    mock_run.return_value = (True, "container-id-1234")
    mock_health.return_value = (True, {"status_code": 200, "latency_ms": 15.0, "body": {"status": "healthy"}}, "Logs OK")

    svc = DeploymentService()
    ok, new_dep, msg = svc.deploy_artifact(artifact=art_v2, environment="staging", deployed_by="tester")

    assert ok is True
    assert new_dep.status == "healthy"
    assert new_dep.is_active is True

    # Check that previous deployment is deactivated
    dep_v1.refresh_from_db()
    assert dep_v1.is_active is False


@pytest.mark.django_db
@patch.object(DeploymentService, "verify_health")
@patch("core.services.container_runtime.runtime_adapter.run_staging_container")
def test_failed_healthcheck_deployment(mock_run, mock_health, test_setup):
    project, art_v1, art_v2, dep_v1 = test_setup
    mock_run.return_value = (True, "container-id-5678")
    mock_health.return_value = (False, {"status_code": 500, "latency_ms": 0.0, "body": {}, "error": "HTTP 500 Internal Error"}, "Healthcheck failed")

    svc = DeploymentService()
    ok, new_dep, msg = svc.deploy_artifact(artifact=art_v2, environment="staging", deployed_by="tester")

    assert ok is False
    assert new_dep.status == "unhealthy"
    assert new_dep.is_active is False


@pytest.mark.django_db
@patch.object(DeploymentService, "deploy_artifact")
def test_controlled_rollback(mock_deploy, test_setup):
    project, art_v1, art_v2, dep_v1 = test_setup
    # Suppose current deployment is failed v2
    dep_v2 = Deployment.objects.create(
        project=project,
        artifact=art_v2,
        environment="staging",
        version_tag="v2.0.0-broken",
        status="unhealthy",
        is_active=True
    )

    # Mock deploy_artifact outcome for rollback target v1
    dep_rolled = Deployment.objects.create(
        project=project,
        artifact=art_v1,
        environment="staging",
        version_tag="v1.0.0",
        status="healthy",
        is_active=True
    )
    mock_deploy.return_value = (True, dep_rolled, "Rollback verified healthy")

    svc = DeploymentService()
    ok, rb_record, msg = svc.execute_rollback(
        project=project,
        target_artifact=art_v1,
        initiated_by="sre_operator",
        reason="Incident #402: Production staging 500 crash in v2"
    )

    assert ok is True
    assert rb_record.status == "healthy"
    assert rb_record.health_verification_passed is True
    assert rb_record.target_artifact == art_v1

    # Check AuditEvent
    assert AuditEvent.objects.filter(action="rollback_succeeded").exists()
