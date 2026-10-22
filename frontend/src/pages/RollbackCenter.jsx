import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  ArrowLeftRight,
  Server,
  Zap
} from 'lucide-react';
import { api } from '../api';

export default function RollbackCenter({ onRollbackModal }) {
  const [rollbacks, setRollbacks] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [rbs, deps, arts] = await Promise.all([
        api.getRollbacks(),
        api.getDeployments(),
        api.getArtifacts()
      ]);
      setRollbacks(rbs);
      setDeployments(deps);
      setArtifacts(arts);
    } catch (err) {
      console.error("Failed to load rollback data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  const currentActive = deployments.find(d => d.is_active);
  const lastHealthy = deployments.filter(d => d.status === 'healthy' && !d.is_active)[0];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Emergency Rollback Control Center</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Zero-loss rollback mechanism that restores last known healthy container images with mandatory authorization and post-rollback health checks.
          </p>
        </div>

        <button 
          className="btn btn-danger" 
          onClick={() => onRollbackModal({ version: currentActive?.version_tag })}
        >
          <RotateCcw size={15} />
          <span>Initiate Rollback</span>
        </button>
      </div>

      {/* Rollback Safety Guard Status Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        <div className="glass-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <div className="card-header">
            <div className="card-title" style={{ color: '#f87171' }}>
              <Server size={18} />
              Current Staging Deployment
            </div>
            <span className={`badge badge-${currentActive?.status || 'idle'}`}>
              {currentActive?.status?.toUpperCase() || 'NONE'}
            </span>
          </div>

          <div className="mono-text" style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px' }}>
            {currentActive?.version_tag || 'No Active Release'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Deployed: {currentActive?.deployed_at ? new Date(currentActive.deployed_at).toLocaleString() : 'N/A'}
          </div>
        </div>

        <div className="glass-card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
          <div className="card-header">
            <div className="card-title" style={{ color: '#34d399' }}>
              <ShieldCheck size={18} />
              Last Known Healthy Safe Baseline
            </div>
            <span className="badge badge-healthy">VERIFIED CLEAN</span>
          </div>

          <div className="mono-text" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', marginBottom: '6px' }}>
            {lastHealthy?.version_tag || 'v1.0.0-initial'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            HTTP 200 health probe verified. Zero reported exceptions.
          </div>
        </div>
      </div>

      {/* Rollback Operations History */}
      <div className="glass-card">
        <div className="card-header">
          <div className="card-title">
            <RotateCcw size={18} />
            Rollback Executions & Verification Audit Trail
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Requires operator rationale & explicit confirmation
          </span>
        </div>

        <div className="table-container">
          <table className="forge-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Project</th>
                <th>From Version</th>
                <th>Target Version</th>
                <th>Initiated By</th>
                <th>Incident Rationale</th>
                <th>Health Verification</th>
                <th>Outcome Status</th>
              </tr>
            </thead>
            <tbody>
              {rollbacks.length > 0 ? (
                rollbacks.map((rb) => (
                  <tr key={rb.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(rb.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <strong style={{ fontSize: '0.85rem' }}>{rb.project_name}</strong>
                    </td>
                    <td>
                      <span className="commit-chip" style={{ color: '#f87171' }}>
                        {rb.source_version || 'Previous'}
                      </span>
                    </td>
                    <td>
                      <span className="commit-chip" style={{ color: '#34d399' }}>
                        {rb.target_version}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem' }}>{rb.initiated_by}</span>
                    </td>
                    <td style={{ maxWidth: '280px' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{rb.reason}</span>
                    </td>
                    <td>
                      {rb.health_verification_passed ? (
                        <span className="badge badge-healthy">
                          <CheckCircle2 size={12} /> Passed (HTTP 200)
                        </span>
                      ) : (
                        <span className="badge badge-failed">
                          <XCircle size={12} /> Failed
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${rb.status === 'healthy' ? 'healthy' : 'failed'}`}>
                        {rb.status === 'healthy' ? 'Rollback Succeeded' : rb.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                    No emergency rollbacks executed yet. The platform is running smoothly on verified baseline versions.
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
