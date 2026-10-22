import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  GitBranch, 
  Terminal, 
  Copy, 
  Check, 
  ShieldAlert, 
  Package, 
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Server
} from 'lucide-react';
import { api } from '../api';

export default function PipelineDetail() {
  const { id } = useParams();
  const [run, setRun] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal', 'security', 'artifacts'
  const [logsData, setLogsData] = useState({ lines: [], total_lines: 0, page: 1, total_pages: 1 });
  const [logPage, setLogPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const terminalEndRef = useRef(null);

  const loadRunDetail = async () => {
    try {
      const data = await api.getPipelineDetail(id);
      setRun(data);
      if (!selectedStage && data.stages?.length > 0) {
        // Select failed stage or first stage
        const failed = data.stages.find(s => s.status === 'failed');
        setSelectedStage(failed || data.stages[0]);
      }
    } catch (err) {
      console.error("Failed to load pipeline run detail:", err);
    }
  };

  const loadLogs = async (page = 1) => {
    try {
      const logs = await api.getPipelineLogs(id, page, 150);
      setLogsData(logs);
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRunDetail();
    loadLogs(logPage);
    const interval = setInterval(() => {
      loadRunDetail();
      loadLogs(logPage);
    }, 5000);
    return () => clearInterval(interval);
  }, [id, logPage]);

  const handleCopyLogs = () => {
    if (run?.raw_logs) {
      navigator.clipboard.writeText(run.raw_logs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to abort and cancel this running pipeline?")) return;
    setCancelling(true);
    try {
      await api.cancelPipeline(id);
      await loadRunDetail();
    } catch (err) {
      alert(`Cancel failed: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !run) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading pipeline run execution telemetry...</div>;
  }

  if (!run) {
    return (
      <div style={{ padding: '40px' }}>
        <p>Pipeline run not found.</p>
        <Link to="/pipelines" className="btn btn-secondary" style={{ marginTop: '12px' }}>Back to Pipelines</Link>
      </div>
    );
  }

  return (
    <div>
      {/* Top Back Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <Link to="/pipelines" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
          <ArrowLeft size={16} />
          <span>Back to All Pipelines</span>
        </Link>
      </div>

      {/* Main Execution Header Card */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                {run.project_name} — Run #{run.run_number}
              </h2>
              <span className={`badge badge-${run.status}`}>
                {run.status === 'successful' && <CheckCircle2 size={13} />}
                {run.status === 'failed' && <XCircle size={13} />}
                {run.status === 'running' && <span className="status-dot active"></span>}
                {run.status.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <div>Branch: <strong style={{ color: 'var(--text-primary)' }}>{run.branch}</strong></div>
              <div>Commit: <span className="commit-chip">{run.commit_sha}</span></div>
              <div>Trigger: <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{run.trigger_source}</strong></div>
              <div>Duration: <strong style={{ color: 'var(--text-primary)' }}>{run.duration_seconds}s</strong></div>
              {run.started_at && <div>Started: {new Date(run.started_at).toLocaleTimeString()}</div>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { loadRunDetail(); loadLogs(logPage); }}>
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>

            {run.status === 'running' && (
              <button className="btn btn-danger btn-sm" onClick={handleCancel} disabled={cancelling}>
                <XCircle size={14} />
                <span>{cancelling ? 'Cancelling...' : 'Abort Build'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Visual Pipeline DAG Flow */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <GitBranch size={18} style={{ color: 'var(--accent-cyan)' }} />
            Pipeline Stages Workflow (DAG)
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click any stage to inspect output logs</span>
        </div>

        <div className="pipeline-flow">
          {run.stages?.map((st, idx) => {
            const isSelected = selectedStage?.id === st.id;
            return (
              <React.Fragment key={st.id}>
                <div 
                  className={`flow-stage ${st.status} ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedStage(st)}
                  style={{ 
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--accent-cyan)' : undefined,
                    boxShadow: isSelected ? '0 0 15px rgba(0, 242, 254, 0.3)' : undefined
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Stage {st.order}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', textAlign: 'center', marginBottom: '8px' }}>
                    {st.display_name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`badge badge-${st.status}`} style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                      {st.status}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {st.duration_seconds}s
                    </span>
                  </div>
                </div>

                {idx < run.stages.length - 1 && (
                  <div className="flow-arrow">→</div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Selected Stage Detail Drawer */}
        {selectedStage && (
          <div style={{ background: 'rgba(7,9,14,0.6)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={15} />
                Stage Logs: {selectedStage.display_name} ({selectedStage.status.toUpperCase()})
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Duration: {selectedStage.duration_seconds}s</span>
            </div>

            {selectedStage.error_message && (
              <div className="alert-banner danger" style={{ marginBottom: '10px', padding: '8px 12px' }}>
                <AlertTriangle size={15} />
                <span><strong>Failure Cause:</strong> {selectedStage.error_message}</span>
              </div>
            )}

            <pre className="mono-text" style={{ background: '#030508', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: '#cbd5e1', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
              {selectedStage.logs || 'No stage-specific logs recorded.'}
            </pre>
          </div>
        )}
      </div>

      {/* Tabs Row: Terminal Logs, Security Findings, Artifacts */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button 
          className={`btn btn-sm ${activeTab === 'terminal' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('terminal')}
        >
          <Terminal size={14} />
          <span>Console Execution Terminal</span>
        </button>

        <button 
          className={`btn btn-sm ${activeTab === 'security' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('security')}
        >
          <ShieldAlert size={14} />
          <span>Security Gate Findings ({run.security_findings?.length || 0})</span>
        </button>

        <button 
          className={`btn btn-sm ${activeTab === 'artifacts' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('artifacts')}
        >
          <Package size={14} />
          <span>Packaged Artifacts ({run.artifacts?.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: Console Terminal */}
      {activeTab === 'terminal' && (
        <div className="glass-card">
          <div className="card-header" style={{ marginBottom: '12px' }}>
            <div className="card-title">
              <Terminal size={16} />
              Progressive Console Output (Page {logsData.page} of {logsData.total_pages})
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleCopyLogs}>
                {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy All Logs'}</span>
              </button>
            </div>
          </div>

          <div className="terminal-box">
            {logsData.lines?.length > 0 ? (
              logsData.lines.map((line, idx) => {
                let color = '#e2e8f0';
                if (line.includes('PASSED') || line.includes('SUCCESSFUL') || line.includes('Finished')) color = '#34d399';
                if (line.includes('FAILED') || line.includes('Error:') || line.includes('Failure')) color = '#f87171';
                if (line.includes('==>') || line.includes('DeployForge:')) color = '#38bdf8';
                if (line.includes('WARNING') || line.includes('Alert')) color = '#fbbf24';

                return (
                  <div key={idx} style={{ color }}>
                    {line}
                  </div>
                );
              })
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>Waiting for progressive console logs...</div>
            )}
            <div ref={terminalEndRef} />
          </div>

          {/* Log Pagination */}
          {logsData.total_pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                Showing lines {(logsData.page - 1) * 150 + 1} - {Math.min(logsData.page * 150, logsData.total_lines)} of {logsData.total_lines}
              </span>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setLogPage(p => Math.max(1, p - 1))}
                  disabled={logPage <= 1}
                >
                  Previous
                </button>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setLogPage(p => Math.min(logsData.total_pages, p + 1))}
                  disabled={logPage >= logsData.total_pages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Security Findings */}
      {activeTab === 'security' && (
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">
              <ShieldAlert size={18} />
              Semgrep & Trivy Vulnerability Findings
            </div>
          </div>

          <div className="table-container">
            <table className="forge-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Tool</th>
                  <th>Rule / CVE</th>
                  <th>Finding Title</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {run.security_findings?.length > 0 ? (
                  run.security_findings.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <span className={`badge ${f.severity === 'CRITICAL' ? 'badge-failed' : (f.severity === 'HIGH' ? 'badge-rolled_back' : 'badge-healthy')}`}>
                          {f.severity}
                        </span>
                      </td>
                      <td>
                        <strong style={{ textTransform: 'capitalize' }}>{f.tool}</strong>
                      </td>
                      <td className="mono-text" style={{ fontSize: '0.78rem' }}>
                        {f.cve_id || f.rule_id}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{f.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{f.description}</div>
                      </td>
                      <td className="mono-text" style={{ fontSize: '0.75rem', color: 'var(--text-accent)' }}>
                        {f.file_path}{f.line_number ? `:${f.line_number}` : ''}
                      </td>
                      <td>
                        <span className={`badge ${f.status === 'open' ? 'badge-failed' : 'badge-healthy'}`}>
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#10b981', padding: '28px' }}>
                      ✨ Zero security findings detected. Semgrep SAST and Trivy scans clean.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Packaged Artifacts */}
      {activeTab === 'artifacts' && (
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">
              <Package size={18} />
              Built Immutable Container Images
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {run.artifacts?.length > 0 ? (
              run.artifacts.map((art) => (
                <div key={art.id} style={{ background: 'rgba(7,9,14,0.6)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 600 }}>{art.image_name}</div>
                    <span className="badge badge-healthy">Approved</span>
                  </div>
                  <div className="mono-text" style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem', marginBottom: '8px' }}>
                    Tag: {art.image_tag}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Registry: {art.registry_url}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Engine: {art.build_metadata?.runtime || 'podman'}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)', padding: '24px' }}>
                No container artifacts generated for this run.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
