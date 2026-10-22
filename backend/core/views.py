import hmac
import hashlib
import time
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404

from core.models import (
    Project, SecurityGatePolicy, PipelineRun, StageExecution,
    Artifact, SecurityFinding, Deployment, RollbackHistory, AuditEvent
)
from core.serializers import (
    ProjectSerializer, SecurityGatePolicySerializer,
    PipelineRunListSerializer, PipelineRunDetailSerializer,
    StageExecutionSerializer, ArtifactSerializer, SecurityFindingSerializer,
    DeploymentSerializer, RollbackHistorySerializer, AuditEventSerializer
)
from core.services.jenkins_service import pipeline_orchestrator, jenkins_client
from core.services.container_runtime import runtime_adapter
from core.services.deployment_service import deployment_service


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer

    def perform_create(self, serializer):
        project = serializer.save()
        # Create default security gate policy
        SecurityGatePolicy.objects.get_or_create(
            project=project,
            defaults={
                'block_on_critical': True,
                'block_on_high': True,
                'max_allowed_critical': 0,
                'max_allowed_high': 2,
                'allow_exception_workflow': True,
            }
        )
        AuditEvent.objects.create(
            user="admin",
            action="project_created",
            target_type="Project",
            target_id=str(project.id),
            details={"name": project.name, "slug": project.slug, "repo_url": project.repo_url}
        )

    @action(detail=True, methods=['post'])
    def trigger(self, request, pk=None):
        project = self.get_object()
        branch = request.data.get('branch', project.default_branch)
        commit_sha = request.data.get('commit_sha', 'c0ffee1')
        commit_msg = request.data.get('commit_message', 'Manual trigger from DeployForge console')
        trigger_source = request.data.get('trigger_source', 'manual')
        simulate_failure = request.data.get('simulate_failure_stage', None)

        # Prevent duplicate concurrent deployment runs
        running_count = PipelineRun.objects.filter(project=project, status='running').count()
        if running_count > 0 and not request.data.get('force', False):
            return Response({
                "error": "A pipeline run is currently in progress for this project. Please wait or cancel it before triggering another."
            }, status=status.HTTP_409_CONFLICT)

        # Next run number
        last_run = PipelineRun.objects.filter(project=project).order_by('-run_number').first()
        next_run_number = (last_run.run_number + 1) if last_run else 1

        run = PipelineRun.objects.create(
            project=project,
            run_number=next_run_number,
            branch=branch,
            commit_sha=commit_sha,
            commit_message=commit_msg,
            trigger_source=trigger_source,
            status='queued'
        )

        AuditEvent.objects.create(
            user="operator",
            action="pipeline_triggered",
            target_type="PipelineRun",
            target_id=str(run.id),
            details={"run_number": run.run_number, "branch": branch, "commit": commit_sha}
        )

        # Trigger execution synchronously or via worker
        # Here we run pipeline orchestration directly to provide live real feedback
        pipeline_orchestrator.run_pipeline(run, simulate_failure_stage=simulate_failure)
        run.refresh_from_db()

        return Response(PipelineRunDetailSerializer(run).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def webhook(self, request, pk=None):
        """
        Receives Git push webhooks with HMAC signature validation.
        """
        project = self.get_object()
        signature_header = request.headers.get('X-Hub-Signature-256', '')

        # HMAC verification
        if signature_header:
            expected = "sha256=" + hmac.new(
                project.webhook_secret.encode('utf-8'),
                request.body,
                hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(signature_header, expected):
                return Response({"error": "Invalid webhook HMAC signature"}, status=status.HTTP_401_UNAUTHORIZED)

        branch = request.data.get('ref', 'refs/heads/main').replace('refs/heads/', '')
        head_commit = request.data.get('head_commit', {})
        commit_sha = head_commit.get('id', 'git-webhook-c0ffee')[:8]
        commit_msg = head_commit.get('message', 'Webhook push event')

        last_run = PipelineRun.objects.filter(project=project).order_by('-run_number').first()
        next_run_number = (last_run.run_number + 1) if last_run else 1

        run = PipelineRun.objects.create(
            project=project,
            run_number=next_run_number,
            branch=branch,
            commit_sha=commit_sha,
            commit_message=commit_msg,
            trigger_source='webhook',
            status='queued'
        )

        pipeline_orchestrator.run_pipeline(run)
        return Response({"message": f"Webhook accepted, pipeline #{run.run_number} started", "run_id": str(run.id)})

    @action(detail=True, methods=['get'])
    def test_connection(self, request, pk=None):
        project = self.get_object()
        jenkins_ok, jenkins_msg, jenkins_data = jenkins_client.check_connection()
        runtime_ok, runtime_msg = runtime_adapter.is_available()

        return Response({
            "project": project.name,
            "container_runtime": {
                "configured": project.runtime,
                "detected_engine": runtime_adapter.runtime_binary,
                "available": runtime_ok,
                "message": runtime_msg
            },
            "jenkins": {
                "available": jenkins_ok,
                "message": jenkins_msg,
                "info": jenkins_data
            }
        })


class PipelineRunViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PipelineRun.objects.all()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return PipelineRunDetailSerializer
        return PipelineRunListSerializer

    def get_queryset(self):
        qs = PipelineRun.objects.all()
        project_id = self.request.query_params.get('project')
        status_param = self.request.query_params.get('status')
        if project_id:
            qs = qs.filter(project_id=project_id)
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=True, methods=['get'])
    def logs(self, request, pk=None):
        """
        Retrieves controlled, paginated logs for a pipeline run.
        """
        run = self.get_object()
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 100))
        tail = request.query_params.get('tail', None)

        all_lines = run.raw_logs.splitlines() if run.raw_logs else []
        total_lines = len(all_lines)

        if tail:
            tail_count = int(tail)
            lines_slice = all_lines[-tail_count:]
            return Response({
                "run_id": str(run.id),
                "total_lines": total_lines,
                "lines": lines_slice,
                "tail": tail_count
            })

        start = (page - 1) * page_size
        end = start + page_size
        lines_slice = all_lines[start:end]

        return Response({
            "run_id": str(run.id),
            "page": page,
            "page_size": page_size,
            "total_lines": total_lines,
            "total_pages": (total_lines + page_size - 1) // page_size if total_lines > 0 else 1,
            "lines": lines_slice,
            "status": run.status
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        run = self.get_object()
        if run.status in ('successful', 'failed', 'canceled'):
            return Response({"message": f"Pipeline is already in terminal state '{run.status}'"}, status=status.HTTP_400_BAD_REQUEST)

        run.status = 'canceled'
        run.finished_at = timezone.now()
        run.raw_logs += f"\n[{timezone.now()}] Pipeline execution explicitly canceled by user.\n"
        run.save()

        AuditEvent.objects.create(
            user="operator",
            action="pipeline_canceled",
            target_type="PipelineRun",
            target_id=str(run.id),
            details={"run_number": run.run_number}
        )
        return Response({"message": f"Pipeline run #{run.run_number} canceled successfully"})


class ArtifactViewSet(viewsets.ModelViewSet):
    queryset = Artifact.objects.all()
    serializer_class = ArtifactSerializer

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        artifact = self.get_object()
        approver = request.data.get('approved_by', 'security_officer')
        artifact.is_approved = True
        artifact.approved_by = approver
        artifact.approved_at = timezone.now()
        artifact.save()

        AuditEvent.objects.create(
            user=approver,
            action="artifact_approved",
            target_type="Artifact",
            target_id=str(artifact.id),
            details={"image_tag": artifact.image_tag}
        )
        return Response(ArtifactSerializer(artifact).data)


class SecurityFindingViewSet(viewsets.ModelViewSet):
    queryset = SecurityFinding.objects.all()
    serializer_class = SecurityFindingSerializer

    def get_queryset(self):
        qs = SecurityFinding.objects.all()
        severity = self.request.query_params.get('severity')
        tool = self.request.query_params.get('tool')
        status_param = self.request.query_params.get('status')
        if severity:
            qs = qs.filter(severity=severity)
        if tool:
            qs = qs.filter(tool=tool)
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=True, methods=['post'])
    def approve_exception(self, request, pk=None):
        finding = self.get_object()
        reason = request.data.get('reason', '').strip()
        approver = request.data.get('approved_by', 'security_lead')

        if not reason:
            return Response({"error": "A detailed justification reason is required to approve a security exception."}, status=status.HTTP_400_BAD_REQUEST)

        finding.status = 'approved_exception'
        finding.exception_approved_by = approver
        finding.exception_reason = reason
        finding.save()

        AuditEvent.objects.create(
            user=approver,
            action="security_exception_granted",
            target_type="SecurityFinding",
            target_id=str(finding.id),
            details={"rule_id": finding.rule_id, "severity": finding.severity, "reason": reason}
        )
        return Response(SecurityFindingSerializer(finding).data)


class DeploymentViewSet(viewsets.ModelViewSet):
    queryset = Deployment.objects.all()
    serializer_class = DeploymentSerializer

    @action(detail=False, methods=['post'])
    def deploy(self, request):
        artifact_id = request.data.get('artifact_id')
        environment = request.data.get('environment', 'staging')
        confirmed = request.data.get('confirmed', False) in (True, 'true', 'True', 1, '1')
        deployed_by = request.data.get('deployed_by', 'release_manager')
        simulate_crash = request.data.get('simulate_crash', False) in (True, 'true', 'True', 1, '1')

        if not confirmed:
            return Response({
                "error": "Deployment requires explicit confirmation flag 'confirmed: true'."
            }, status=status.HTTP_400_BAD_REQUEST)

        artifact = get_object_or_404(Artifact, id=artifact_id)

        # Enforce security gate approval
        if not artifact.is_approved:
            return Response({
                "error": f"Artifact {artifact.image_tag} has not passed security approval gate and cannot be deployed."
            }, status=status.HTTP_403_FORBIDDEN)

        ok, dep, msg = deployment_service.deploy_artifact(
            artifact=artifact,
            environment=environment,
            deployed_by=deployed_by,
            simulate_crash=simulate_crash
        )

        return Response({
            "success": ok,
            "message": msg,
            "deployment": DeploymentSerializer(dep).data
        }, status=status.HTTP_200_OK if ok else status.HTTP_502_BAD_GATEWAY)

    @action(detail=False, methods=['post'])
    def rollback(self, request):
        project_id = request.data.get('project_id')
        target_artifact_id = request.data.get('target_artifact_id')
        reason = request.data.get('reason', '').strip()
        confirmed = request.data.get('confirmed', False) in (True, 'true', 'True', 1, '1')
        initiated_by = request.data.get('initiated_by', 'on_call_engineer')

        if not confirmed:
            return Response({
                "error": "Rollback requires explicit operator confirmation flag 'confirmed: true'."
            }, status=status.HTTP_400_BAD_REQUEST)

        if not reason:
            return Response({
                "error": "A valid operational reason is required to execute an emergency rollback."
            }, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(Project, id=project_id)

        # Target artifact
        if target_artifact_id:
            target_artifact = get_object_or_404(Artifact, id=target_artifact_id)
        else:
            target_artifact = deployment_service.get_last_known_healthy(project)
            if not target_artifact:
                return Response({
                    "error": "No last known healthy artifact found for this project."
                }, status=status.HTTP_404_NOT_FOUND)

        ok, rb_record, msg = deployment_service.execute_rollback(
            project=project,
            target_artifact=target_artifact,
            initiated_by=initiated_by,
            reason=reason
        )

        return Response({
            "success": ok,
            "message": msg,
            "rollback": RollbackHistorySerializer(rb_record).data if rb_record else None
        }, status=status.HTTP_200_OK if ok else status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def live_health(self, request):
        """
        Executes immediate live health check probe against staging endpoint.
        """
        health_ok, resp_data, logs = deployment_service.verify_health(
            max_retries=3,
            retry_interval=1.0
        )
        return Response({
            "is_healthy": health_ok,
            "status_code": resp_data.get("status_code"),
            "latency_ms": resp_data.get("latency_ms"),
            "response": resp_data.get("body"),
            "logs": logs
        })


class RollbackHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RollbackHistory.objects.all()
    serializer_class = RollbackHistorySerializer


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.all()
    serializer_class = AuditEventSerializer


class DashboardStatsView(APIView):
    """
    Consolidated metrics and status summary for DeployForge dashboard.
    """

    def get(self, request):
        total_runs = PipelineRun.objects.count()
        successful_runs = PipelineRun.objects.filter(status='successful').count()
        failed_runs = PipelineRun.objects.filter(status='failed').count()
        running_runs = PipelineRun.objects.filter(status='running').count()
        success_rate = round((successful_runs / total_runs * 100), 1) if total_runs > 0 else 100.0

        # Security Findings summary
        critical_count = SecurityFinding.objects.filter(severity='CRITICAL', status='open').count()
        high_count = SecurityFinding.objects.filter(severity='HIGH', status='open').count()
        exceptions_count = SecurityFinding.objects.filter(status='approved_exception').count()

        # Staging deployment
        active_deployment = Deployment.objects.filter(environment='staging', is_active=True).first()
        active_version = active_deployment.version_tag if active_deployment else "No active release"

        # Last healthy version
        last_healthy = Deployment.objects.filter(environment='staging', status='healthy').order_by('-deployed_at').first()
        last_healthy_version = last_healthy.version_tag if last_healthy else None

        # Recent pipeline runs
        recent_runs = PipelineRunListSerializer(PipelineRun.objects.all()[:6], many=True).data

        # Recent audit events
        recent_audits = AuditEventSerializer(AuditEvent.objects.all()[:8], many=True).data

        # Runtime availability
        runtime_ok, runtime_msg = runtime_adapter.is_available()
        jenkins_ok, jenkins_msg, _ = jenkins_client.check_connection()

        return Response({
            "stats": {
                "total_runs": total_runs,
                "successful_runs": successful_runs,
                "failed_runs": failed_runs,
                "running_runs": running_runs,
                "success_rate": success_rate,
                "critical_findings": critical_count,
                "high_findings": high_count,
                "approved_exceptions": exceptions_count,
                "active_version": active_version,
                "last_healthy_version": last_healthy_version,
                "staging_status": active_deployment.status if active_deployment else "idle",
            },
            "environment_health": {
                "container_runtime": {
                    "engine": runtime_adapter.runtime_binary,
                    "available": runtime_ok,
                    "status": runtime_msg
                },
                "jenkins_ci": {
                    "available": jenkins_ok,
                    "status": jenkins_msg
                }
            },
            "recent_runs": recent_runs,
            "recent_audits": recent_audits
        })
