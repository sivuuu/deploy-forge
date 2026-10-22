from rest_framework import serializers
from core.models import (
    Project, SecurityGatePolicy, PipelineRun, StageExecution,
    Artifact, SecurityFinding, Deployment, RollbackHistory, AuditEvent
)


class SecurityGatePolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityGatePolicy
        fields = '__all__'
        read_only_fields = ('id', 'project', 'updated_at')


class ProjectSerializer(serializers.ModelSerializer):
    security_policy = SecurityGatePolicySerializer(read_only=True)
    jenkins_token_masked = serializers.SerializerMethodField()
    recent_runs_count = serializers.SerializerMethodField()
    active_version = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'slug', 'description', 'repo_url', 'repo_type',
            'default_branch', 'deployment_target', 'runtime', 'jenkins_job_name',
            'jenkins_url', 'jenkins_user', 'jenkins_token', 'jenkins_token_masked',
            'webhook_secret', 'is_active', 'created_at', 'updated_at',
            'security_policy', 'recent_runs_count', 'active_version'
        ]
        extra_kwargs = {
            'jenkins_token': {'write_only': True, 'required': False},
            'webhook_secret': {'read_only': True},
        }

    def get_jenkins_token_masked(self, obj):
        if obj.jenkins_token:
            return "••••••••" + obj.jenkins_token[-4:] if len(obj.jenkins_token) > 4 else "••••••••"
        return "None configured"

    def get_recent_runs_count(self, obj):
        return obj.pipeline_runs.count()

    def get_active_version(self, obj):
        dep = obj.deployments.filter(is_active=True).first()
        return dep.version_tag if dep else "No active release"


class StageExecutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StageExecution
        fields = '__all__'


class ArtifactSerializer(serializers.ModelSerializer):
    full_reference = serializers.CharField(read_only=True)

    class Meta:
        model = Artifact
        fields = '__all__'


class SecurityFindingSerializer(serializers.ModelSerializer):
    artifact_tag = serializers.CharField(source='artifact.image_tag', read_only=True, default='')

    class Meta:
        model = SecurityFinding
        fields = '__all__'


class PipelineRunListSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    stages_summary = serializers.SerializerMethodField()

    class Meta:
        model = PipelineRun
        fields = [
            'id', 'project', 'project_name', 'run_number', 'jenkins_build_number',
            'commit_sha', 'commit_message', 'branch', 'trigger_source', 'status',
            'started_at', 'finished_at', 'duration_seconds', 'log_lines_count',
            'is_conflicting', 'created_at', 'stages_summary'
        ]

    def get_stages_summary(self, obj):
        return [
            {
                'name': st.name,
                'display_name': st.display_name,
                'status': st.status,
                'duration': st.duration_seconds
            }
            for st in obj.stages.all().order_by('order')
        ]


class PipelineRunDetailSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    stages = StageExecutionSerializer(many=True, read_only=True)
    artifacts = ArtifactSerializer(many=True, read_only=True)
    security_findings = SecurityFindingSerializer(many=True, read_only=True)

    class Meta:
        model = PipelineRun
        fields = '__all__'


class DeploymentSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    image_name = serializers.CharField(source='artifact.image_name', read_only=True)
    full_reference = serializers.CharField(source='artifact.full_reference', read_only=True)

    class Meta:
        model = Deployment
        fields = '__all__'


class RollbackHistorySerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    source_version = serializers.CharField(source='source_deployment.version_tag', read_only=True)
    target_version = serializers.CharField(source='target_artifact.image_tag', read_only=True)

    class Meta:
        model = RollbackHistory
        fields = '__all__'


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = '__all__'
