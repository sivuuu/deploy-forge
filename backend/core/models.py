import uuid
from django.db import models
from django.utils import timezone


class Project(models.Model):
    RUNTIME_CHOICES = (
        ('podman', 'Podman Engine'),
        ('docker', 'Docker Engine'),
    )
    DEPLOY_TARGET_CHOICES = (
        ('staging', 'Staging Environment'),
        ('development', 'Development Sandbox'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    description = models.TextField(blank=True, default='')
    repo_url = models.CharField(max_length=255)
    repo_type = models.CharField(max_length=50, default='local_git')
    default_branch = models.CharField(max_length=80, default='main')
    deployment_target = models.CharField(max_length=50, choices=DEPLOY_TARGET_CHOICES, default='staging')
    runtime = models.CharField(max_length=50, choices=RUNTIME_CHOICES, default='podman')
    jenkins_job_name = models.CharField(max_length=120, default='deployforge-sample-pipeline')
    jenkins_url = models.CharField(max_length=255, blank=True, default='')
    jenkins_user = models.CharField(max_length=100, blank=True, default='')
    jenkins_token = models.CharField(max_length=255, blank=True, default='')
    webhook_secret = models.CharField(max_length=128, default=uuid.uuid4)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.slug})"


class SecurityGatePolicy(models.Model):
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='security_policy')
    block_on_critical = models.BooleanField(default=True)
    block_on_high = models.BooleanField(default=True)
    max_allowed_critical = models.IntegerField(default=0)
    max_allowed_high = models.IntegerField(default=2)
    allow_exception_workflow = models.BooleanField(default=True)
    require_scan_pass = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Policy for {self.project.name} (Max Crit: {self.max_allowed_critical})"


class PipelineRun(models.Model):
    STATUS_CHOICES = (
        ('queued', 'Queued'),
        ('running', 'Running'),
        ('successful', 'Successful'),
        ('failed', 'Failed'),
        ('canceled', 'Canceled'),
    )
    TRIGGER_CHOICES = (
        ('manual', 'Manual Trigger'),
        ('webhook', 'Webhook Push'),
        ('rollback', 'Rollback Execution'),
        ('scheduled', 'Scheduled Nightly'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='pipeline_runs')
    run_number = models.PositiveIntegerField()
    jenkins_build_number = models.PositiveIntegerField(null=True, blank=True)
    jenkins_queue_id = models.PositiveIntegerField(null=True, blank=True)
    commit_sha = models.CharField(max_length=64, default='c0ffee1')
    commit_message = models.CharField(max_length=255, default='chore: trigger automated release')
    branch = models.CharField(max_length=80, default='main')
    trigger_source = models.CharField(max_length=50, choices=TRIGGER_CHOICES, default='manual')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='queued')
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.FloatField(default=0.0)
    raw_logs = models.TextField(blank=True, default='')
    log_lines_count = models.IntegerField(default=0)
    is_conflicting = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('project', 'run_number')

    def __str__(self):
        return f"#{self.run_number} - {self.project.name} [{self.status}]"


class StageExecution(models.Model):
    STAGE_NAMES = (
        ('checkout', 'Checkout Repository'),
        ('lint_test', 'Lint & Unit Tests'),
        ('sast_scan', 'Semgrep SAST Scan'),
        ('build_package', 'Container Image Packaging'),
        ('trivy_scan', 'Trivy Vulnerability Scan'),
        ('deploy_staging', 'Deploy to Staging'),
        ('health_check', 'Smoke & Health Check Probe'),
    )
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('successful', 'Successful'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pipeline_run = models.ForeignKey(PipelineRun, on_delete=models.CASCADE, related_name='stages')
    name = models.CharField(max_length=60)
    display_name = models.CharField(max_length=120)
    order = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending')
    duration_seconds = models.FloatField(default=0.0)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    logs = models.TextField(blank=True, default='')
    error_message = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.pipeline_run.run_number}: {self.display_name} ({self.status})"


class Artifact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pipeline_run = models.ForeignKey(PipelineRun, on_delete=models.SET_NULL, null=True, blank=True, related_name='artifacts')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='artifacts')
    image_name = models.CharField(max_length=160)
    image_tag = models.CharField(max_length=100)
    digest = models.CharField(max_length=128, blank=True, default='')
    registry_url = models.CharField(max_length=255, default='localhost:5000')
    size_bytes = models.BigIntegerField(default=0)
    is_approved = models.BooleanField(default=False)
    approved_by = models.CharField(max_length=100, blank=True, default='')
    approved_at = models.DateTimeField(null=True, blank=True)
    build_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.image_name}:{self.image_tag}"

    @property
    def full_reference(self):
        return f"{self.registry_url}/{self.image_name}:{self.image_tag}" if self.registry_url else f"{self.image_name}:{self.image_tag}"


class SecurityFinding(models.Model):
    SEVERITY_CHOICES = (
        ('CRITICAL', 'Critical'),
        ('HIGH', 'High'),
        ('MEDIUM', 'Medium'),
        ('LOW', 'Low'),
        ('INFO', 'Info'),
    )
    STATUS_CHOICES = (
        ('open', 'Open Finding'),
        ('approved_exception', 'Approved Exception'),
        ('remediated', 'Remediated'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pipeline_run = models.ForeignKey(PipelineRun, on_delete=models.CASCADE, related_name='security_findings')
    artifact = models.ForeignKey(Artifact, on_delete=models.SET_NULL, null=True, blank=True, related_name='security_findings')
    tool = models.CharField(max_length=40)  # semgrep, trivy, dependency_check
    rule_id = models.CharField(max_length=140)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    title = models.CharField(max_length=255)
    description = models.TextField()
    file_path = models.CharField(max_length=255, blank=True, default='')
    line_number = models.IntegerField(null=True, blank=True)
    remediation = models.TextField(blank=True, default='')
    cve_id = models.CharField(max_length=50, blank=True, default='')
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default='open')
    exception_approved_by = models.CharField(max_length=100, blank=True, default='')
    exception_reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-severity', '-created_at']

    def __str__(self):
        return f"[{self.severity}] {self.tool}: {self.title}"


class Deployment(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('deploying', 'Deploying'),
        ('healthy', 'Verified Healthy'),
        ('unhealthy', 'Unhealthy / Failed Healthcheck'),
        ('rolled_back', 'Rolled Back'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='deployments')
    pipeline_run = models.ForeignKey(PipelineRun, on_delete=models.SET_NULL, null=True, blank=True, related_name='deployments')
    artifact = models.ForeignKey(Artifact, on_delete=models.CASCADE, related_name='deployments')
    environment = models.CharField(max_length=40, default='staging')
    version_tag = models.CharField(max_length=100)
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default='pending')
    deployed_by = models.CharField(max_length=100, default='pipeline')
    deployed_at = models.DateTimeField(auto_now_add=True)
    health_check_url = models.CharField(max_length=255, default='http://localhost:8085/health')
    health_check_status = models.IntegerField(null=True, blank=True)
    health_check_latency_ms = models.FloatField(default=0.0)
    health_check_response = models.JSONField(default=dict, blank=True)
    health_check_error = models.TextField(blank=True, default='')
    logs = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=False)

    class Meta:
        ordering = ['-deployed_at']

    def __str__(self):
        return f"{self.project.name} -> {self.environment} ({self.version_tag}) [{self.status}]"


class RollbackHistory(models.Model):
    STATUS_CHOICES = (
        ('initiated', 'Initiated'),
        ('verifying_health', 'Verifying Health'),
        ('healthy', 'Rollback Succeeded & Healthy'),
        ('failed', 'Rollback Health Verification Failed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='rollback_events')
    source_deployment = models.ForeignKey(Deployment, on_delete=models.CASCADE, related_name='rollbacks_source')
    target_artifact = models.ForeignKey(Artifact, on_delete=models.CASCADE, related_name='rollbacks_target')
    initiated_by = models.CharField(max_length=100)
    reason = models.TextField()
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default='initiated')
    health_verification_passed = models.BooleanField(default=False)
    logs = models.TextField(blank=True, default='')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Rollback for {self.project.name} to {self.target_artifact.image_tag} [{self.status}]"


class AuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.CharField(max_length=100, default='admin')
    action = models.CharField(max_length=80)
    target_type = models.CharField(max_length=60)
    target_id = models.CharField(max_length=120)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.CharField(max_length=60, default='127.0.0.1')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.timestamp}] {self.user} - {self.action} on {self.target_type}:{self.target_id}"
