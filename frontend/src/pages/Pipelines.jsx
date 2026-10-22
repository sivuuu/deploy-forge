import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  GitBranch, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import { api } from '../api';

export default function Pipelines({ onTriggerModal }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const loadRuns = async () => {
    try {
      const data = await api.getPipelines(filterStatus ? `?status=${filterStatus}` : '');
      setRuns(data);
    } catch (err) {
      console.error("Failed to load pipelines:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
    const interval = setInterval(loadRuns, 6000);
    return () => clearInterval(interval);
  }, [filterStatus]);

  const filteredRuns = runs.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.run_number.toString().includes(term) ||
      r.commit_sha.toLowerCase().includes(term) ||
      r.commit_message.toLowerCase().includes(term) ||
      r.branch.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Pipeline Executions & History</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Real-time status, stage durations, and console telemetry from Jenkins and local execution runs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search branch, commit, run..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '34px', width: '220px' }}
            />
          </div>

          <select 
            className="form-select" 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="">All Outcomes</option>
            <option value="successful">Successful</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
            <option value="queued">Queued</option>
          </select>

          <button className="btn btn-primary" onClick={() => onTriggerModal()}>
            <Play size={14} fill="currentColor" />
            <span>Trigger Run</span>
          </button>
        </div>
      </div>

      <div className="glass-card">
        <div className="table-container">
          <table className="forge-table">
            <thead>
              <tr>
                <th>Run #</th>
                <th>Project</th>
                <th>Commit</th>
                <th>Branch</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Stages (Pipeline DAG)</th>
                <th>Duration</th>
                <th>Finished</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.length > 0 ? (
                filteredRuns.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/pipelines/${r.id}`} style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 700, fontSize: '0.95rem' }}>
                        #{r.run_number}
                      </Link>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{r.project_name}</span>
                    </td>
                    <td>
                      <div>
                        <span className="commit-chip">{r.commit_sha}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.commit_message}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{r.branch}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.trigger_source}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${r.status}`}>
                        {r.status === 'successful' && <CheckCircle2 size={12} />}
                        {r.status === 'failed' && <XCircle size={12} />}
                        {r.status === 'running' && <span className="status-dot active"></span>}
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {r.stages_summary?.map((st, i) => (
                          <div
                            key={i}
                            title={`${st.display_name}: ${st.status.toUpperCase()} (${st.duration}s)`}
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '2px',
                              background: st.status === 'successful' ? '#10b981' : (st.status === 'failed' ? '#ef4444' : (st.status === 'running' ? '#00f2fe' : 'rgba(255,255,255,0.15)'))
                            }}
                          />
                        ))}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {r.duration_seconds}s
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {r.finished_at ? new Date(r.finished_at).toLocaleTimeString() : 'In Progress'}
                    </td>
                    <td>
                      <Link to={`/pipelines/${r.id}`} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}>
                        <span>Logs & Trace</span>
                        <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                    {loading ? 'Fetching pipeline telemetry...' : 'No pipeline runs found matching criteria.'}
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
