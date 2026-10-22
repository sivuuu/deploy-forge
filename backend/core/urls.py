from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import (
    ProjectViewSet, PipelineRunViewSet, ArtifactViewSet,
    SecurityFindingViewSet, DeploymentViewSet, RollbackHistoryViewSet,
    AuditEventViewSet, DashboardStatsView
)

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'pipelines', PipelineRunViewSet, basename='pipelinerun')
router.register(r'artifacts', ArtifactViewSet, basename='artifact')
router.register(r'security-findings', SecurityFindingViewSet, basename='securityfinding')
router.register(r'deployments', DeploymentViewSet, basename='deployment')
router.register(r'rollbacks', RollbackHistoryViewSet, basename='rollback')
router.register(r'audit-logs', AuditEventViewSet, basename='auditevent')

urlpatterns = [
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('', include(router.urls)),
]
