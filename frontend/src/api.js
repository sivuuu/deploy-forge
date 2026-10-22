const API_BASE = 'http://localhost:8008/api';

export async function fetchJson(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errBody = {};
    try {
      errBody = await response.json();
    } catch {
      errBody = { error: response.statusText };
    }
    const err = new Error(errBody.error || errBody.message || `HTTP ${response.status}`);
    err.status = response.status;
    err.data = errBody;
    throw err;
  }

  return response.json();
}

export const api = {
  getStats: () => fetchJson('/dashboard/stats/'),
  getProjects: () => fetchJson('/projects/'),
  createProject: (data) => fetchJson('/projects/', { method: 'POST', body: JSON.stringify(data) }),
  testProjectConnection: (id) => fetchJson(`/projects/${id}/test_connection/`),
  triggerPipeline: (id, data) => fetchJson(`/projects/${id}/trigger/`, { method: 'POST', body: JSON.stringify(data) }),
  
  getPipelines: (params = '') => fetchJson(`/pipelines/${params}`),
  getPipelineDetail: (id) => fetchJson(`/pipelines/${id}/`),
  getPipelineLogs: (id, page = 1, pageSize = 100) => fetchJson(`/pipelines/${id}/logs/?page=${page}&page_size=${pageSize}`),
  cancelPipeline: (id) => fetchJson(`/pipelines/${id}/cancel/`, { method: 'POST' }),

  getArtifacts: () => fetchJson('/artifacts/'),
  approveArtifact: (id, approver) => fetchJson(`/artifacts/${id}/approve/`, { method: 'POST', body: JSON.stringify({ approved_by: approver }) }),

  getSecurityFindings: (params = '') => fetchJson(`/security-findings/${params}`),
  approveException: (id, data) => fetchJson(`/security-findings/${id}/approve_exception/`, { method: 'POST', body: JSON.stringify(data) }),

  getDeployments: () => fetchJson('/deployments/'),
  deployVersion: (data) => fetchJson('/deployments/deploy/', { method: 'POST', body: JSON.stringify(data) }),
  rollback: (data) => fetchJson('/deployments/rollback/', { method: 'POST', body: JSON.stringify(data) }),
  getLiveHealth: () => fetchJson('/deployments/live_health/'),

  getRollbacks: () => fetchJson('/rollbacks/'),
  getAuditLogs: () => fetchJson('/audit-logs/'),
};
