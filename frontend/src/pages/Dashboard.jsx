import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldAlert, 
  Server, 
  ArrowRight, 
  Activity, 
  Play, 
  AlertTriangle,
  RotateCcw,
  Zap,
  Cpu
} from 'lucide-react';
import { api } from '../api';

export default function Dashboard({ onTriggerModal, onRollbackModal }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveHealth, setLiveHealth] = useState(null);
  const [probing, setProbing] = useState(false);

  const loadData = async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProbeHealth = async () => {
    setProbing(true);
    try {
      const res = await api.getLiveHealth();
      setLiveHealth(res);
    } catch (err) {
      setLiveHealth({ is_healthy: false, status_code: 500, error: err.message });
    } finally {
      setProbing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading DeployForge platform telemetry...</div>;
  }

  const s = stats?.stats || {};
  const env = stats?.environment_health || {};
  const isHealthy = s.staging_status === 'healthy';

  return (
    <div>
      {/* Top Banner Alert if Health check is failing */}
      {!isHealthy && s.active_version !== "No active release" && (
        <div className="alert-banner danger">
          <AlertTriangle size={20} />
          <div style={{ flex: 1 }}>
            <strong>Staging Environment Alert: Active Release Unhealthy</strong>
            <p style={{ marginTop: '2px' }}>
              The running release {s.active_version} has failed automated health checks. Initiate an emergency rollback to {s.last_healthy_version || 'previous version'}.
            </p>
          </div>
          <button 
            className="btn btn-danger btn-sm"
            onClick={() => onRollbackModal({ version: s.last_healthy_version })}
          >
            <RotateCcw size={14} />
            Rollback Now
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Pipeline Runs</div>
          <div className="metric-value">
            {s.total_runs || 0}
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>total</span>
          </div>
          <div className="metric-sub" style={{ color: '#10b981' }}>
            {s.successful_runs || 0} successful · {s.failed_runs || 0} failed
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Release Success Rate</div>
          <div className="metric-value">
            {s.success_rate || 100}%
          </div>
          <div className="metric-sub">
            Continuous Integration health rating
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Security Gate Blockers</div>
          <div className="metric-value" style={{ color: (s.critical_findings > 0 ? '#ef4444' : '#10b981') }}>
            {s.critical_findings || 0}
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>crit</span>
          </div>
          <div className="metric-sub">
            {s.high_findings || 0} High severity · {s.approved_exceptions || 0} exceptions
          </div>
        </div>

        <div className="metric-card" style={{ borderColor: isHealthy ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)' }}>
          <div className="metric-label">Active Staging Release</div>
          <div className="metric-value" style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)' }}>
            {s.active_version || 'None'}
          </div>
          <div className="metric-sub" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className={`status-dot ${isHealthy ? 'active' : 'danger'}`}></span>
            <span>Status: {s.staging_status ? s.staging_status.toUpperCase() : 'IDLE'}</span>
          </div>
        </div>
      </div>

      {/* Live Staging Environment Health Widget */}
      <div className="glass-card" style={{ marginBottom: '28px' }}>
        <div className="card-header">
          <div className="card-title">
            <Activity size={18} style={{ color: 'var(--accent-cyan)' }} />
            Staging Environment Live Verification Probe
          </div>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={handleProbeHealth}
            disabled={probing}
          >
            <Zap size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span>{probing ? 'Probing...' : 'Ping Live Staging Probe'}</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'rgba(7,9,14,0.6)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Target Probe URL</div>
            <div className="mono-text" style={{ color: 'var(--text-accent)' }}>http://localhost:8085/health</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Container Port: 8085 (Isolated Network)</div>
          </div>

          <div style={{ background: 'rgba(7,9,14,0.6)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Last Health Check Result</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={`badge badge-${isHealthy ? 'healthy' : 'unhealthy'}`}>
                {isHealthy ? 'HTTP 200 OK' : 'Probe Failure'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Latency: {liveHealth ? `${liveHealth.latency_ms}ms` : '12ms avg'}
              </span>
            </div>
            {liveHealth && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                Response: {JSON.stringify(liveHealth.response || liveHealth.status_code)}
              </div>
            )}
          </div>

          <div style={{ background: 'rgba(7,9,14,0.6)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Last Known Healthy Image</div>
            <div className="mono-text" style={{ color: '#10b981', fontWeight: 600 }}>
              {s.last_healthy_version || 'v1.0.0-initial'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Safeguard target for one-click rollback
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Recent Runs & Infrastructure Health */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* Recent Pipeline Runs Table */}
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">
              <Clock size={18} />
              Recent Pipeline Runs
            </div>
            <Link to="/pipelines" className="btn btn-secondary btn-sm">
              <span>View All</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="table-container">
            <table className="forge-table">
              <thead>
                <tr>
                  <th>Run #</th>
                  <th>Commit</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Stages</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recent_runs?.length > 0 ? (
                  stats.recent_runs.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/pipelines/${r.id}`} style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 600 }}>
                          #{r.run_number}
                        </Link>
                      </td>
                      <td>
                        <span className="commit-chip">{r.commit_sha}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.branch}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${r.status}`}>
                          {r.status === 'successful' && <CheckCircle2 size={12} />}
                          {r.status === 'failed' && <XCircle size={12} />}
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          {r.stages_summary?.map((st, i) => (
                            <span 
                              key={i} 
                              title={`${st.display_name}: ${st.status}`}
                              style={{ 
                                width: '8px', 
                                height: '8px', 
                                borderRadius: '2px', 
                                background: st.status === 'successful' ? '#10b981' : (st.status === 'failed' ? '#ef4444' : (st.status === 'running' ? '#00f2fe' : 'rgba(255,255,255,0.2)'))
                              }}
                            />
                          ))}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {r.duration_seconds}s
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      No pipeline runs recorded yet. Click "Trigger Pipeline" to start the first release run!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Infrastructure & Audit Trail Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Engine Status */}
          <div className="glass-card">
            <div className="card-header">
              <div className="card-title">
                <Cpu size={18} style={{ color: 'var(--accent-cyan)' }} />
                Infrastructure Adapters
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Container Engine ({env?.container_runtime?.engine})</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{env?.container_runtime?.status}</div>
                </div>
                <span className={`badge badge-${env?.container_runtime?.available ? 'healthy' : 'unhealthy'}`}>
                  {env?.container_runtime?.available ? 'ACTIVE' : 'OFFLINE'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Jenkins CI Engine</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{env?.jenkins_ci?.status || 'Direct Pipeline Orchestrator Active'}</div>
                </div>
                <span className={`badge badge-${env?.jenkins_ci?.available ? 'healthy' : 'healthy'}`}>
                  {env?.jenkins_ci?.available ? 'CONNECTED' : 'LOCAL ENGINE'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-card">
            <div className="card-header">
              <div className="card-title">
                <Zap size={18} style={{ color: 'var(--accent-pink)' }} />
                Platform Quick Actions
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => onTriggerModal()}
              >
                <Play size={16} fill="currentColor" />
                <span>Trigger New Pipeline Run</span>
              </button>

              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => onRollbackModal({ version: s.last_healthy_version })}
              >
                <RotateCcw size={16} />
                <span>Execute Emergency Rollback</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
