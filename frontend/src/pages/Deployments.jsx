import React, { useState, useEffect } from 'react';
import { 
  Server, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Zap, 
  Activity, 
  Clock, 
  Play, 
  ShieldCheck, 
  AlertTriangle 
} from 'lucide-react';
import { api } from '../api';

export default function Deployments({ onRollbackModal }) {
  const [deployments, setDeployments] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deployingId, setDeployingId] = useState(null);
  const [liveHealth, setLiveHealth] = useState(null);
  const [probing, setProbing] = useState(false);

  const loadData = async () => {
    try {
      const [deps, arts] = await Promise.all([
        api.getDeployments(),
        api.getArtifacts()
      ]);
      setDeployments(deps);
      setArtifacts(arts);
    } catch (err) {
      console.error("Failed to load deployments:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProbe = async () => {
    setProbing(true);
    try {
      const res = await api.getLiveHealth();
      setLiveHealth(res);
    } catch (err) {
      setLiveHealth({ is_healthy: false, error: err.message });
    } finally {
      setProbing(false);
    }
  };

  const handleManualDeploy = async (artifact) => {
    if (!confirm(`Deploy image tag ${artifact.image_tag} to Staging Environment? Health checks will execute immediately.`)) {
      return;
    }
    setDeployingId(artifact.id);
    try {
      await api.deployVersion({
        artifact_id: artifact.id,
        environment: 'staging',
        confirmed: true,
        deployed_by: 'release_manager'
      });
      await loadData();
      await handleProbe();
    } catch (err) {
      alert(`Deployment failed: ${err.message}`);
    } finally {
      setDeployingId(null);
    }
  };

  useEffect(() => {
    loadData();
    handleProbe();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  const activeDeployment = deployments.find(d => d.is_active);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Staging Environment & Releases</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Orchestrate container deployments to isolated staging port 8085 with live health probing and smoke verification.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={handleProbe} disabled={probing}>
            <Zap size={15} style={{ color: 'var(--accent-cyan)' }} />
            <span>{probing ? 'Probing...' : 'Check Health'}</span>
          </button>

          <button 
            className="btn btn-danger" 
            onClick={() => onRollbackModal({ version: activeDeployment?.version_tag })}
          >
            <RotateCcw size={15} />
            <span>Emergency Rollback</span>
          </button>
        </div>
      </div>

      {/* Active Deployment Hero Card */}
      <div className="glass-card" style={{ marginBottom: '28px', borderColor: activeDeployment?.status === 'healthy' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)' }}>
        <div className="card-header">
          <div className="card-title">
            <Server size={18} style={{ color: 'var(--accent-cyan)' }} />
            Current Live Staging Container Release
          </div>
          <span className={`badge badge-${activeDeployment?.status || 'idle'}`}>
            {activeDeployment?.status === 'healthy' ? 'VERIFIED HEALTHY' : (activeDeployment?.status || 'NO RELEASE')}
          </span>
        </div>

        {activeDeployment ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Active Version Tag</div>
              <div className="mono-text" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeDeployment.version_tag}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Image: {activeDeployment.image_name}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Deployment Timestamp</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                {new Date(activeDeployment.deployed_at).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Operator: {activeDeployment.deployed_by}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Health Check Probe</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-healthy">HTTP {activeDeployment.health_check_status || 200} OK</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activeDeployment.health_check_latency_ms}ms</span>
              </div>
              <div className="mono-text" style={{ fontSize: '0.72rem', color: 'var(--text-accent)', marginTop: '4px' }}>
                {activeDeployment.health_check_url}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Telemetry State</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                Uptime: {liveHealth?.response?.uptime_seconds ? `${liveHealth.response.uptime_seconds}s` : 'Active'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
                Container ID: deployforge-staging-app
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px', color: 'var(--text-muted)' }}>
            No active release currently deployed to staging environment. Select an approved artifact below to deploy.
          </div>
        )}
      </div>

      {/* Approved Versioned Artifacts Available for Deployment */}
      <div className="glass-card" style={{ marginBottom: '28px' }}>
        <div className="card-header">
          <div className="card-title">
            <ShieldCheck size={18} style={{ color: '#10b981' }} />
            Approved Artifact Repository
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Only security-cleared container images can be deployed
          </span>
        </div>

        <div className="table-container">
          <table className="forge-table">
            <thead>
              <tr>
                <th>Image Tag</th>
                <th>Full Reference</th>
                <th>Security Gate</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {artifacts.length > 0 ? (
                artifacts.map((art) => {
                  const isCurrent = activeDeployment?.version_tag === art.image_tag;
                  return (
                    <tr key={art.id}>
                      <td>
                        <span className="mono-text" style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                          {art.image_tag}
                        </span>
                      </td>
                      <td className="mono-text" style={{ fontSize: '0.75rem' }}>
                        {art.full_reference}
                      </td>
                      <td>
                        <span className="badge badge-healthy">
                          <CheckCircle2 size={12} /> Approved
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(art.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        {isCurrent ? (
                          <span className="badge badge-running">Currently Live</span>
                        ) : (
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleManualDeploy(art)}
                            disabled={deployingId === art.id}
                          >
                            <Play size={12} fill="currentColor" />
                            <span>{deployingId === art.id ? 'Deploying...' : 'Deploy to Staging'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No artifacts found. Run a pipeline to build versioned images.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deployment History Table */}
      <div className="glass-card">
        <div className="card-header">
          <div className="card-title">
            <Clock size={18} />
            Staging Release & Deployment History
          </div>
        </div>

        <div className="table-container">
          <table className="forge-table">
            <thead>
              <tr>
                <th>Version Tag</th>
                <th>Environment</th>
                <th>Status</th>
                <th>Deployed By</th>
                <th>Timestamp</th>
                <th>Health Response</th>
              </tr>
            </thead>
            <tbody>
              {deployments.length > 0 ? (
                deployments.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className="commit-chip">{d.version_tag}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>{d.environment}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${d.status}`}>
                        {d.status === 'healthy' && <CheckCircle2 size={12} />}
                        {d.status === 'unhealthy' && <XCircle size={12} />}
                        {d.status === 'rolled_back' && <RotateCcw size={12} />}
                        {d.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{d.deployed_by}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(d.deployed_at).toLocaleString()}
                    </td>
                    <td>
                      {d.health_check_error ? (
                        <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>{d.health_check_error}</span>
                      ) : (
                        <span style={{ color: '#10b981', fontSize: '0.75rem' }}>HTTP {d.health_check_status || 200} OK ({d.health_check_latency_ms}ms)</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No deployment history recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
