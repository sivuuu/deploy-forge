import pytest
from core.models import (
    Project, SecurityGatePolicy, PipelineRun, StageExecution,
    Artifact, SecurityFinding, Deployment, RollbackHistory, AuditEvent
)


@pytest.mark.django_db
def test_project_and_policy_creation():
    project = Project.objects.create(
        name="Test Microservice",
        slug="test-microservice",
        repo_url="https://github.com/org/repo.git",
        default_branch="main",
        deployment_target="staging",
        runtime="podman",
        jenkins_job_name="test-job"
    )
    assert project.slug == "test-microservice"

    policy = SecurityGatePolicy.objects.create(
        project=project,
        block_on_critical=True,
        max_allowed_critical=0,
        max_allowed_high=2
    )
    assert policy.block_on_critical is True
    assert policy.max_allowed_critical == 0


@pytest.mark.django_db
def test_pipeline_run_and_stages():
    project = Project.objects.create(
        name="Payments API",
        slug="payments-api",
        repo_url="https://github.com/org/payments.git"
    )
    run = PipelineRun.objects.create(
        project=project,
        run_number=1,
        commit_sha="c0ffee12",
        branch="main",
        status="running"
    )
    stage = StageExecution.objects.create(
        pipeline_run=run,
        name="checkout",
        display_name="Checkout Code",
        order=1,
        status="successful",
        duration_seconds=1.8
    )
    assert run.stages.count() == 1
    assert stage.pipeline_run == run
    assert run.status == "running"


@pytest.mark.django_db
def test_artifact_and_security_finding():
    project = Project.objects.create(name="Auth API", slug="auth-api", repo_url="https://github.com/org/auth.git")
    run = PipelineRun.objects.create(project=project, run_number=1, commit_sha="abc1234")

    artifact = Artifact.objects.create(
        pipeline_run=run,
        project=project,
        image_name="auth-service",
        image_tag="v1.0.0-abc1234",
        is_approved=True
    )
    assert artifact.full_reference == "localhost:5000/auth-service:v1.0.0-abc1234"

    finding = SecurityFinding.objects.create(
        pipeline_run=run,
        artifact=artifact,
        tool="semgrep",
        rule_id="deployforge-hardcoded-secret",
        severity="CRITICAL",
        title="Secret found",
        description="AWS API secret token committed",
        status="open"
    )
    assert finding.severity == "CRITICAL"
    assert finding.artifact == artifact
