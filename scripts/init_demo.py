import os
import sys
import django
from django.utils import timezone

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'deployforge_core.settings')
django.setup()

from core.models import (
    Project, SecurityGatePolicy, PipelineRun, StageExecution,
    Artifact, SecurityFinding, Deployment, AuditEvent
)

def seed():
    print("Seeding initial DeployForge demo project and baseline release...")

    project, created = Project.objects.get_or_create(
        slug='sample-service',
        defaults={
            'name': 'DeployForge Core Microservice',
            'description': 'Containerized cloud microservice with automated Jenkins CI/CD, Semgrep SAST, Trivy scanning, and staging deployment.',
            'repo_url': 'https://github.com/deployforge/sample-service.git',
            'repo_type': 'local_git',
            'default_branch': 'main',
            'deployment_target': 'staging',
            'runtime': 'podman',
            'jenkins_job_name': 'deployforge-sample-pipeline',
            'jenkins_url': 'http://localhost:8080',
            'jenkins_user': 'admin',
            'jenkins_token': 'deployforge-api-token-77492048',
            'is_active': True,
        }
    )

    policy, _ = SecurityGatePolicy.objects.get_or_create(
        project=project,
        defaults={
            'block_on_critical': True,
            'block_on_high': True,
            'max_allowed_critical': 0,
            'max_allowed_high': 2,
            'allow_exception_workflow': True,
            'require_scan_pass': True,
        }
    )

    # Check if run #1 already exists
    run = PipelineRun.objects.filter(project=project, run_number=1).first()
    if not run:
        run = PipelineRun.objects.create(
            project=project,
            run_number=1,
            jenkins_build_number=101,
            commit_sha='a1b2c3d',
            commit_message='feat: initial service baseline with production healthcheck probe',
            branch='main',
            trigger_source='manual',
            status='successful',
            started_at=timezone.now() - timezone.timedelta(minutes=45),
            finished_at=timezone.now() - timezone.timedelta(minutes=42),
            duration_seconds=184.2,
            raw_logs="DeployForge Pipeline Run #1 initialized successfully.\nAll stages passed: Checkout, Lint, SAST, Image Packaging, Trivy Scan, Staging Deployment, Health Verification.\nStatus: SUCCESSFUL"
        )

        stages_data = [
            ('checkout', 'Checkout Repository', 1, 'successful', 2.1),
            ('lint_test', 'Lint & Unit Tests', 2, 'successful', 4.8),
            ('sast_scan', 'Semgrep SAST Scan', 3, 'successful', 6.2),
            ('build_package', 'Container Image Packaging', 4, 'successful', 24.1),
            ('trivy_scan', 'Trivy Vulnerability Scan', 5, 'successful', 12.5),
            ('deploy_staging', 'Deploy to Staging', 6, 'successful', 8.4),
            ('health_check', 'Smoke & Health Check Probe', 7, 'successful', 3.2),
        ]
        for name, disp, ord_num, st, dur in stages_data:
            StageExecution.objects.create(
                pipeline_run=run,
                name=name,
                display_name=disp,
                order=ord_num,
                status=st,
                duration_seconds=dur,
                started_at=run.started_at,
                finished_at=run.finished_at,
                logs=f"Stage {disp} completed successfully with exit code 0."
            )

        # Baseline artifact
        art = Artifact.objects.create(
            pipeline_run=run,
            project=project,
            image_name='deployforge/sample-app',
            image_tag='v1.0.0-initial',
            registry_url='local-registry:5000',
            size_bytes=142600000,
            is_approved=True,
            approved_by='security_gate_auto',
            approved_at=timezone.now() - timezone.timedelta(minutes=42),
            build_metadata={'runtime': 'podman', 'exit_code': 0, 'layers': 14}
        )

        # Baseline healthy deployment
        Deployment.objects.create(
            project=project,
            pipeline_run=run,
            artifact=art,
            environment='staging',
            version_tag='v1.0.0-initial',
            status='healthy',
            deployed_by='pipeline_orchestrator',
            health_check_url='http://localhost:8085/health',
            health_check_status=200,
            health_check_latency_ms=12.4,
            health_check_response={"status": "healthy", "version": "v1.0.0-initial", "environment": "staging"},
            is_active=True,
            logs="Deployment verified healthy (HTTP 200 OK)."
        )

        # Demo security findings
        SecurityFinding.objects.create(
            pipeline_run=run,
            artifact=art,
            tool='trivy',
            rule_id='CVE-2024-37890',
            severity='LOW',
            title='urllib3 proxy authorization redirect advisory',
            description='urllib3 before 2.2.2 does not strip Proxy-Authorization header on HTTP cross-origin redirect.',
            file_path='sample_app/requirements.txt (urllib3)',
            remediation='Update urllib3 dependency in requirements.txt.',
            cve_id='CVE-2024-37890',
            status='open'
        )

        SecurityFinding.objects.create(
            pipeline_run=run,
            tool='semgrep',
            rule_id='deployforge-unsafe-os-system',
            severity='MEDIUM',
            title='Insecure os.system call parameter',
            description='Potential shell injection risk if unsanitized user inputs reach os.system.',
            file_path='sample_app/app.py',
            line_number=24,
            remediation='Use subprocess.run with argument array instead of os.system shell invocation.',
            cve_id='CWE-78',
            status='approved_exception',
            exception_approved_by='security_lead',
            exception_reason='Verified internal script with strictly constant hardcoded arguments.'
        )

        AuditEvent.objects.create(
            user="admin",
            action="baseline_seeded",
            target_type="Project",
            target_id=str(project.id),
            details={"version": "v1.0.0-initial", "environment": "staging"}
        )

    print("Seeding completed successfully!")

if __name__ == '__main__':
    seed()
