#!/usr/bin/env python3
"""
DeployForge End-to-End Real Integration Pipeline Runner
Executes actual local pipeline stages:
1. Checkout
2. Lint & Pytest Unit Tests
3. Semgrep SAST scan
4. Podman/Docker Container packaging & immutable tagging
5. Trivy vulnerability & dependency scanning
6. Isolated Staging Deployment
7. Post-deployment live HTTP health check verification
"""

import os
import sys
import time
import argparse
import django

# Setup Django environment
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'deployforge_core.settings')
django.setup()

from core.models import Project, PipelineRun, Deployment, Artifact
from core.services.jenkins_service import pipeline_orchestrator
from core.services.deployment_service import deployment_service


def main():
    parser = argparse.ArgumentParser(description="Run DeployForge Real Local Pipeline")
    parser.add_argument("--project", default="sample-service", help="Project slug")
    parser.add_argument("--branch", default="main", help="Git branch to release")
    parser.add_argument("--simulate-failure", choices=['lint_test', 'sast_scan', 'build_package', 'trivy_scan', 'health_check'],
                        help="Optional stage to simulate failure for testing rollback/gates")
    args = parser.parse_args()

    project = Project.objects.filter(slug=args.project).first()
    if not project:
        print(f"Project '{args.project}' not found. Please run scripts/init_demo.py first.")
        sys.exit(1)

    last_run = PipelineRun.objects.filter(project=project).order_by('-run_number').first()
    next_num = (last_run.run_number + 1) if last_run else 1

    print("=" * 70)
    print(f"🚀 DeployForge CI/CD Engine: Initiating Run #{next_num}")
    print(f"Project: {project.name} | Target: {project.deployment_target} | Runtime: {project.runtime}")
    print(f"Branch: {args.branch} | Commit: git-cli-local-{int(time.time())}")
    if args.simulate_failure:
        print(f"⚠️  Failure Injection Active on stage: {args.simulate_failure}")
    print("=" * 70)

    run = PipelineRun.objects.create(
        project=project,
        run_number=next_num,
        branch=args.branch,
        commit_sha=f"git{int(time.time())}"[:8],
        commit_message=f"release: deployment build #{next_num} via DeployForge CLI",
        trigger_source='manual',
        status='queued'
    )

    success = pipeline_orchestrator.run_pipeline(run, simulate_failure_stage=args.simulate_failure)
    run.refresh_from_db()

    print("\n" + "=" * 70)
    print(f"🏁 Pipeline Run #{run.run_number} Finished!")
    print(f"Final Status: {run.status.upper()}")
    print(f"Duration: {run.duration_seconds}s")
    print("Stage Breakdown:")
    for st in run.stages.all().order_by('order'):
        icon = "✅" if st.status == 'successful' else ("❌" if st.status == 'failed' else "⏭️")
        print(f"  {icon} {st.display_name:<32} [{st.status.upper()}] ({st.duration_seconds}s)")
        if st.error_message:
            print(f"     Error: {st.error_message}")

    active_dep = Deployment.objects.filter(project=project, is_active=True).first()
    if active_dep:
        print(f"\n📦 Active Staging Release: {active_dep.version_tag}")
        print(f"🌐 Health Status: {active_dep.status.upper()} (HTTP {active_dep.health_check_status})")
    print("=" * 70)

    if not success:
        sys.exit(2)


if __name__ == '__main__':
    main()
