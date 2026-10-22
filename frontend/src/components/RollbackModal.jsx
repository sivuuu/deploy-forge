import React, { useState } from 'react';
import { X, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function RollbackModal({ isOpen, onClose, project, targetArtifact, currentVersion, onConfirm }) {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirmed) {
      alert("Please check the confirmation box to authorize this rollback.");
      return;
    }
    if (!reason.trim()) {
      alert("Please provide an operational rationale for this rollback.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        project_id: project.id,
        target_artifact_id: targetArtifact?.id || null,
        reason: reason.trim(),
        confirmed: true,
        initiated_by: 'on_call_engineer'
      });
      onClose();
    } catch (err) {
      alert(`Rollback failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw size={18} className="text-warning" />
            Emergency Staging Rollback
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div className="alert-banner danger">
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Release Modification Authorization Required</strong>
            <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>
              This operation will atomically replace the running staging container with the designated healthy version. Post-rollback smoke tests will execute immediately.
            </div>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '18px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Current Version:</span>
            <span className="commit-chip" style={{ color: '#ef4444' }}>{currentVersion || 'Unknown'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Target Rollback Image:</span>
            <span className="commit-chip" style={{ color: '#10b981' }}>{targetArtifact ? targetArtifact.image_tag : 'Last Known Healthy Version'}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Operational Rationale / Incident ID *</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="e.g., Incident #502: HTTP 500 error spike detected after v2 release."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <input 
              type="checkbox" 
              id="confirm-rollback" 
              checked={confirmed} 
              onChange={(e) => setConfirmed(e.target.checked)} 
              style={{ marginTop: '4px', cursor: 'pointer', accentColor: '#00f2fe' }} 
            />
            <label htmlFor="confirm-rollback" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              I confirm authorization of this immediate rollback and verify that target artifacts satisfy baseline security compliance.
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={isSubmitting || !confirmed || !reason.trim()}>
              <RotateCcw size={14} />
              <span>{isSubmitting ? 'Verifying & Rolling back...' : 'Execute Rollback'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
