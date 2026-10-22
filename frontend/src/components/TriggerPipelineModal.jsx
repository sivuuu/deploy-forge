import React, { useState } from 'react';
import { X, Play, AlertTriangle } from 'lucide-react';

export default function TriggerPipelineModal({ isOpen, onClose, projects, onTrigger }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [branch, setBranch] = useState('main');
  const [commitSha, setCommitSha] = useState('');
  const [simulateFailure, setSimulateFailure] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onTrigger(projectId || projects[0]?.id, {
        branch,
        commit_sha: commitSha || `git-${Math.random().toString(36).substring(2, 9)}`,
        simulate_failure_stage: simulateFailure || null,
        trigger_source: 'manual'
      });
      onClose();
    } catch (err) {
      alert(`Trigger failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Trigger Jenkins / CI/CD Pipeline</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Target Project</label>
            <select 
              className="form-select" 
              value={projectId} 
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.runtime})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Git Branch</label>
            <input 
              type="text" 
              className="form-input" 
              value={branch} 
              onChange={(e) => setBranch(e.target.value)} 
              placeholder="main" 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Commit SHA (Optional)</label>
            <input 
              type="text" 
              className="form-input" 
              value={commitSha} 
              onChange={(e) => setCommitSha(e.target.value)} 
              placeholder="Leave blank to generate simulated git commit" 
            />
          </div>

          <div className="form-group" style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <label className="form-label" style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={14} />
              Demonstration Failure Injection
            </label>
            <select 
              className="form-select" 
              value={simulateFailure} 
              onChange={(e) => setSimulateFailure(e.target.value)}
            >
              <option value="">None (Execute Normal Successful Pipeline)</option>
              <option value="lint_test">Fail Stage 2: Lint & Pytest Unit Tests</option>
              <option value="sast_scan">Fail Stage 3: Semgrep SAST Security Gate</option>
              <option value="build_package">Fail Stage 4: Container Packaging</option>
              <option value="trivy_scan">Fail Stage 5: Trivy Critical Vulnerability Gate</option>
              <option value="health_check">Fail Stage 7: Staging HTTP 500 Healthcheck (For Rollback Demo)</option>
            </select>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Allows evaluating security blocking policies and automated staging healthcheck failure defenses.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <Play size={14} fill="currentColor" />
              <span>{isSubmitting ? 'Starting Run...' : 'Execute Pipeline'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
