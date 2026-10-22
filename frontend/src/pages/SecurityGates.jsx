import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Check, 
  ExternalLink,
  Filter,
  Lock
} from 'lucide-react';
import { api } from '../api';

export default function SecurityGates() {
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [selectedTool, setSelectedTool] = useState('');
  const [exceptionModalFinding, setExceptionModalFinding] = useState(null);
  const [exceptionReason, setExceptionReason] = useState('');
  const [approverName, setApproverName] = useState('Security Lead');
  const [submittingException, setSubmittingException] = useState(false);

  const loadFindings = async () => {
    try {
      let query = [];
      if (selectedSeverity) query.push(`severity=${selectedSeverity}`);
      if (selectedTool) query.push(`tool=${selectedTool}`);
      const qs = query.length > 0 ? `?${query.join('&')}` : '';
      const data = await api.getSecurityFindings(qs);
      setFindings(data);
    } catch (err) {
      console.error("Failed to load security findings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFindings();
  }, [selectedSeverity, selectedTool]);

  const handleApproveException = async (e) => {
    e.preventDefault();
    if (!exceptionReason.trim()) {
      alert("A documented justification reason is required to approve a security exception.");
      return;
    }
    setSubmittingException(true);
    try {
      await api.approveException(exceptionModalFinding.id, {
        reason: exceptionReason.trim(),
        approved_by: approverName
      });
      setExceptionModalFinding(null);
      setExceptionReason('');
      await loadFindings();
    } catch (err) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setSubmittingException(false);
    }
  };

  const counts = {
    CRITICAL: findings.filter(f => f.severity === 'CRITICAL' && f.status === 'open').length,
    HIGH: findings.filter(f => f.severity === 'HIGH' && f.status === 'open').length,
    MEDIUM: findings.filter(f => f.severity === 'MEDIUM' && f.status === 'open').length,
    EXCEPTIONS: findings.filter(f => f.status === 'approved_exception').length,
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Security Gates & Vulnerability Audit</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Static code analysis (Semgrep) and container CVE vulnerability scanning (Trivy) with exception authorization.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            className="form-select" 
            value={selectedSeverity} 
            onChange={(e) => setSelectedSeverity(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select 
            className="form-select" 
            value={selectedTool} 
            onChange={(e) => setSelectedTool(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="">All Scanners</option>
            <option value="semgrep">Semgrep SAST</option>
            <option value="trivy">Trivy Image Scan</option>
          </select>
        </div>
      </div>

      {/* Security Gate Summary Cards */}
      <div className="metrics-grid">
        <div className="metric-card" style={{ borderColor: counts.CRITICAL > 0 ? 'rgba(239, 68, 68, 0.4)' : undefined }}>
          <div className="metric-label">Critical Gate Blockers</div>
          <div className="metric-value" style={{ color: counts.CRITICAL > 0 ? '#ef4444' : '#10b981' }}>
            {counts.CRITICAL}
          </div>
          <div className="metric-sub">
            Policy threshold: 0 allowed
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">High Severity Vulnerabilities</div>
          <div className="metric-value" style={{ color: counts.HIGH > 2 ? '#f59e0b' : '#38bdf8' }}>
            {counts.HIGH}
          </div>
          <div className="metric-sub">
            Policy threshold: Max 2 allowed
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Medium & Low Advisories</div>
          <div className="metric-value">
            {counts.MEDIUM}
          </div>
          <div className="metric-sub">
            Informational and non-blocking findings
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Approved Security Exceptions</div>
          <div className="metric-value" style={{ color: '#8b5cf6' }}>
            {counts.EXCEPTIONS}
          </div>
          <div className="metric-sub">
            Audited & documented risk acceptances
          </div>
        </div>
      </div>

      {/* Findings Table */}
      <div className="glass-card">
        <div className="card-header">
          <div className="card-title">
            <ShieldAlert size={18} />
            Security Gate Findings Matrix
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {findings.length} findings
          </span>
        </div>

        <div className="table-container">
          <table className="forge-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Tool</th>
                <th>CVE / Rule ID</th>
                <th>Finding Title & Remediation</th>
                <th>File / Layer</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {findings.length > 0 ? (
                findings.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <span className={`badge ${f.severity === 'CRITICAL' ? 'badge-failed' : (f.severity === 'HIGH' ? 'badge-rolled_back' : 'badge-healthy')}`}>
                        {f.severity}
                      </span>
                    </td>
                    <td>
                      <span style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>{f.tool}</span>
                    </td>
                    <td>
                      <span className="mono-text" style={{ fontSize: '0.78rem', color: 'var(--text-accent)' }}>
                        {f.cve_id || f.rule_id}
                      </span>
                    </td>
                    <td style={{ maxWidth: '380px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{f.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{f.description}</div>
                      {f.remediation && (
                        <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
                          <strong>Fix:</strong> {f.remediation}
                        </div>
                      )}
                      {f.status === 'approved_exception' && (
                        <div style={{ fontSize: '0.75rem', color: '#8b5cf6', marginTop: '4px', background: 'rgba(139, 92, 246, 0.08)', padding: '4px 8px', borderRadius: '4px' }}>
                          <strong>Exception by {f.exception_approved_by}:</strong> {f.exception_reason}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="mono-text" style={{ fontSize: '0.75rem' }}>
                        {f.file_path}{f.line_number ? `:${f.line_number}` : ''}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${f.status === 'open' ? 'badge-failed' : 'badge-healthy'}`}>
                        {f.status === 'approved_exception' ? 'Exception' : f.status}
                      </span>
                    </td>
                    <td>
                      {f.status === 'open' && (
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => setExceptionModalFinding(f)}
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        >
                          <Lock size={12} />
                          <span>Approve Exception</span>
                        </button>
                      )}
                      {f.status === 'approved_exception' && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Audited ✓
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                    {loading ? 'Evaluating security findings...' : 'No security findings matching filter criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exception Approval Modal */}
      {exceptionModalFinding && (
        <div className="modal-overlay" onClick={() => setExceptionModalFinding(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={18} style={{ color: 'var(--accent-purple)' }} />
                Document Security Gate Exception
              </h2>
              <button onClick={() => setExceptionModalFinding(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="alert-banner info" style={{ marginBottom: '16px' }}>
              <div>
                <strong>Rule: {exceptionModalFinding.rule_id}</strong>
                <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>{exceptionModalFinding.title}</div>
              </div>
            </div>

            <form onSubmit={handleApproveException}>
              <div className="form-group">
                <label className="form-label">Auditing Lead / Approver *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={approverName} 
                  onChange={(e) => setApproverName(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Justification Rationale *</label>
                <textarea 
                  className="form-textarea" 
                  rows={3} 
                  placeholder="e.g. Verified internal isolated development script. Compensating controls in place."
                  value={exceptionReason} 
                  onChange={(e) => setExceptionReason(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setExceptionModalFinding(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingException || !exceptionReason.trim()}>
                  <Check size={14} />
                  <span>{submittingException ? 'Saving...' : 'Authorize Exception'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
