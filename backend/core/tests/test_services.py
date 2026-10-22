import pytest
from unittest.mock import patch, MagicMock
from core.services.container_runtime import ContainerRuntimeAdapter
from core.services.security_scanner import SecurityScannerService
from core.services.jenkins_service import JenkinsClient
from core.models import SecurityGatePolicy, Project


def test_container_runtime_adapter_detection():
    adapter = ContainerRuntimeAdapter(preferred_runtime="podman")
    assert adapter.runtime_binary in ("podman", "docker")


@patch("subprocess.run")
def test_container_build_success(mock_run):
    mock_run.return_value = MagicMock(returncode=0, stdout="Successfully tagged test-image:latest")
    adapter = ContainerRuntimeAdapter()
    ok, out, meta = adapter.build_image("test-image:latest", "Dockerfile", ".")
    assert ok is True
    assert "Successfully tagged" in out
    assert meta["exit_code"] == 0


@patch("subprocess.run")
def test_container_build_failure(mock_run):
    mock_run.return_value = MagicMock(returncode=1, stdout="Error: Dockerfile syntax error")
    adapter = ContainerRuntimeAdapter()
    ok, out, meta = adapter.build_image("test-image:latest", "Dockerfile", ".")
    assert ok is False
    assert meta["exit_code"] == 1


def test_security_scanner_gate_evaluation():
    scanner = SecurityScannerService()
    policy = MagicMock(
        block_on_critical=True,
        block_on_high=True,
        max_allowed_critical=0,
        max_allowed_high=1
    )

    clean_findings = [{"severity": "LOW"}, {"severity": "MEDIUM"}]
    passed, reason, counts = scanner.evaluate_gate(clean_findings, policy)
    assert passed is True

    critical_findings = [{"severity": "CRITICAL", "title": "Hardcoded Token"}]
    passed, reason, counts = scanner.evaluate_gate(critical_findings, policy)
    assert passed is False
    assert "CRITICAL" in reason

    high_findings = [{"severity": "HIGH"}, {"severity": "HIGH"}]
    passed, reason, counts = scanner.evaluate_gate(high_findings, policy)
    assert passed is False
    assert "HIGH" in reason


@patch("requests.get")
def test_jenkins_client_check_connection(mock_get):
    mock_resp = MagicMock(status_code=200)
    mock_resp.json.return_value = {"mode": "NORMAL", "assignedLabels": ["node1"]}
    mock_resp.headers = {"X-Jenkins": "2.440"}
    mock_get.return_value = mock_resp

    client = JenkinsClient("http://jenkins.local:8080", "admin", "token")
    ok, msg, data = client.check_connection()
    assert ok is True
    assert data["version"] == "2.440"


@patch("requests.post")
def test_jenkins_trigger_job(mock_post):
    mock_resp = MagicMock(status_code=201)
    mock_resp.headers = {"Location": "http://jenkins.local:8080/queue/item/42/"}
    mock_post.return_value = mock_resp

    client = JenkinsClient("http://jenkins.local:8080", "admin", "token")
    ok, queue_id, msg = client.trigger_job("sample-job", {"BRANCH": "main"})
    assert ok is True
    assert queue_id == 42
