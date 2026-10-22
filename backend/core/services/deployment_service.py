import os
import time
import json
import logging
import requests
from typing import Dict, Any, Tuple, Optional
from django.utils import timezone
from django.conf import settings

from core.models import Deployment, Artifact, Project, RollbackHistory, AuditEvent
from core.services.container_runtime import runtime_adapter

logger = logging.getLogger(__name__)


class DeploymentService:
    """
    Manages controlled deployment of approved versioned artifacts to staging environments,
    performs automated health verification, and coordinates zero-loss rollbacks.
    """

    def deploy_artifact(
        self,
        artifact: Artifact,
        environment: str = "staging",
        deployed_by: str = "platform_admin",
        simulate_crash: bool = False
    ) -> Tuple[bool, Deployment, str]:
        project = artifact.project
        version_tag = artifact.image_tag

        logger.info(f"Initiating deployment of {artifact.image_name}:{version_tag} to {environment}")

        # Create Deployment record in 'deploying' status
        deployment = Deployment.objects.create(
            project=project,
            pipeline_run=artifact.pipeline_run,
            artifact=artifact,
            environment=environment,
            version_tag=version_tag,
            status='deploying',
            deployed_by=deployed_by,
            health_check_url=getattr(settings, 'STAGING_HEALTH_URL', 'http://localhost:8085/health'),
            logs=f"Starting deployment for {version_tag}...\n"
        )

        env_vars = {
            "ENVIRONMENT": environment,
            "APP_VERSION": version_tag,
            "COMMIT_SHA": artifact.pipeline_run.commit_sha if artifact.pipeline_run else "unknown",
            "PORT": "8085"
        }
        if simulate_crash:
            env_vars["SIMULATE_HEALTH_FAILURE"] = "true"

        # Check full image tag: check if localhost/ prefix exists in podman images
        image_ref = f"{artifact.image_name}:{artifact.image_tag}"
        if runtime_adapter.runtime_binary == "podman":
            image_ref = f"localhost/{image_ref}"

        # Run container
        run_ok, run_out = runtime_adapter.run_staging_container(
            image_tag=image_ref,
            container_name="deployforge-staging-app",
            port_mapping="8085:8085",
            env_vars=env_vars
        )

        deployment.logs += f"Container Launch output:\n{run_out}\n"
        deployment.save()

        if not run_ok:
            deployment.status = 'unhealthy'
            deployment.health_check_error = f"Container failed to start: {run_out}"
            deployment.save()
            return False, deployment, f"Container launch failed: {run_out}"

        # Post-deployment health verification probe
        is_healthy, health_resp, probe_logs = self.verify_health(
            health_url=deployment.health_check_url,
            max_retries=8,
            retry_interval=1.5
        )

        deployment.logs += f"\nHealth Check Probes:\n{probe_logs}\n"
        deployment.health_check_status = health_resp.get("status_code", 0)
        deployment.health_check_latency_ms = health_resp.get("latency_ms", 0.0)
        deployment.health_check_response = health_resp.get("body", {})

        if is_healthy:
            # Atomic swap: Deactivate old active deployments
            Deployment.objects.filter(project=project, environment=environment, is_active=True).update(is_active=False)
            deployment.status = 'healthy'
            deployment.is_active = True
            deployment.save()

            AuditEvent.objects.create(
                user=deployed_by,
                action="deployment_healthy",
                target_type="Deployment",
                target_id=str(deployment.id),
                details={"version": version_tag, "environment": environment, "latency_ms": deployment.health_check_latency_ms}
            )
            return True, deployment, f"Deployment {version_tag} verified healthy (HTTP {deployment.health_check_status})"
        else:
            deployment.status = 'unhealthy'
            deployment.is_active = False
            deployment.health_check_error = health_resp.get("error", "Health check probe failed or timed out")
            deployment.save()

            AuditEvent.objects.create(
                user=deployed_by,
                action="deployment_unhealthy",
                target_type="Deployment",
                target_id=str(deployment.id),
                details={"version": version_tag, "environment": environment, "error": deployment.health_check_error}
            )
            return False, deployment, f"Deployment {version_tag} health check FAILED: {deployment.health_check_error}"

    def verify_health(
        self,
        health_url: str = "http://localhost:8085/health",
        max_retries: int = 10,
        retry_interval: float = 1.5
    ) -> Tuple[bool, Dict[str, Any], str]:
        logs = []
        logs.append(f"Starting health check polling against {health_url} (Max {max_retries} attempts)")

        last_status = 0
        last_body = {}
        last_error = ""

        for attempt in range(1, max_retries + 1):
            t0 = time.time()
            try:
                resp = requests.get(health_url, timeout=3)
                latency = round((time.time() - t0) * 1000, 2)
                last_status = resp.status_code
                try:
                    last_body = resp.json()
                except Exception:
                    last_body = {"raw": resp.text[:200]}

                if resp.status_code == 200 and last_body.get("status") == "healthy":
                    logs.append(f"Attempt {attempt}/{max_retries}: Health probe PASSED (HTTP 200, {latency}ms) - {last_body}")
                    return True, {"status_code": 200, "latency_ms": latency, "body": last_body}, "\n".join(logs)
                else:
                    logs.append(f"Attempt {attempt}/{max_retries}: Received HTTP {resp.status_code} - Body: {last_body}")
            except requests.exceptions.RequestException as e:
                latency = round((time.time() - t0) * 1000, 2)
                last_error = str(e)
                logs.append(f"Attempt {attempt}/{max_retries}: Connection failed ({last_error})")

            time.sleep(retry_interval)

        logs.append(f"Health verification TIMED OUT after {max_retries} attempts.")
        return False, {"status_code": last_status, "latency_ms": 0.0, "body": last_body, "error": last_error or "Probe timed out"}, "\n".join(logs)

    def execute_rollback(
        self,
        project: Project,
        target_artifact: Artifact,
        initiated_by: str,
        reason: str
    ) -> Tuple[bool, Optional[RollbackHistory], str]:
        """
        Rolls back staging environment to the designated target artifact.
        Ensures safety confirmation and post-rollback health verification.
        """
        # Find current active deployment or most recent deployment
        current_dep = Deployment.objects.filter(project=project, environment='staging', is_active=True).first()
        if not current_dep:
            current_dep = Deployment.objects.filter(project=project, environment='staging').first()

        if not current_dep:
            return False, None, "No previous deployment found to roll back from."

        logger.info(f"Executing rollback from {current_dep.version_tag} to {target_artifact.image_tag}")

        rollback_record = RollbackHistory.objects.create(
            project=project,
            source_deployment=current_dep,
            target_artifact=target_artifact,
            initiated_by=initiated_by,
            reason=reason,
            status='verifying_health',
            logs=f"Rollback initiated by {initiated_by} due to: {reason}\nTarget artifact: {target_artifact.image_tag}\n"
        )

        # Deploy target artifact
        ok, new_dep, deploy_msg = self.deploy_artifact(
            artifact=target_artifact,
            environment='staging',
            deployed_by=f"rollback-by-{initiated_by}"
        )

        rollback_record.logs += f"\nDeployment outcome:\n{deploy_msg}\n"

        if ok and new_dep.status == 'healthy':
            # Mark old deployment as rolled_back
            current_dep.status = 'rolled_back'
            current_dep.is_active = False
            current_dep.save()

            rollback_record.status = 'healthy'
            rollback_record.health_verification_passed = True
            rollback_record.save()

            AuditEvent.objects.create(
                user=initiated_by,
                action="rollback_succeeded",
                target_type="RollbackHistory",
                target_id=str(rollback_record.id),
                details={"from_version": current_dep.version_tag, "to_version": target_artifact.image_tag, "reason": reason}
            )
            return True, rollback_record, f"Rollback to {target_artifact.image_tag} succeeded and verified healthy."
        else:
            rollback_record.status = 'failed'
            rollback_record.health_verification_passed = False
            rollback_record.save()

            AuditEvent.objects.create(
                user=initiated_by,
                action="rollback_failed",
                target_type="RollbackHistory",
                target_id=str(rollback_record.id),
                details={"from_version": current_dep.version_tag, "to_version": target_artifact.image_tag, "reason": reason}
            )
            return False, rollback_record, f"Rollback to {target_artifact.image_tag} failed health verification."

    def get_last_known_healthy(self, project: Project, environment: str = "staging") -> Optional[Artifact]:
        dep = Deployment.objects.filter(
            project=project,
            environment=environment,
            status='healthy'
        ).order_by('-deployed_at').first()
        return dep.artifact if dep else None


deployment_service = DeploymentService()
