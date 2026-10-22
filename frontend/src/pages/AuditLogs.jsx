import React, { useState, useEffect } from 'react';
import { History, Shield, User, Clock, FileText, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';
import { api } from '../api';

export default function AuditLogs() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAudits = async () => {
    try {
      const data = await api.getAuditLogs();
      setAudits(data);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudits();
    const interval = setInterval(loadAudits, 10000);
    return () => clearInterval(interval);
  }, []);

  const getActionBadge = (action) => {
    if (action.includes('healthy') || action.includes('succeeded') || action.includes('approved')) {
      return <span className="badge badge-healthy">{action}</span>;
    }
    if (action.includes('unhealthy') || action.includes('failed') || action.includes('blocked')) {
      return <span className="badge badge-failed">{action}</span>;
    }
    if (action.includes('rollback')) {
      return <span className="badge badge-rolled_back">{action}</span>;
    }
    return <span className="badge badge-running">{action}</span>;
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Tamper-Evident Audit Trail</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Immutable chronological ledger of all pipeline executions, security gate exceptions, releases, and rollbacks.
        </p>
      </div>

      <div className="glass-card">
        <div className="card-header">
          <div className="card-title">
            <History size={18} />
            System Audit Log Records
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Total Events: {audits.length}
          </span>
        </div>

        <div className="table-container">
          <table className="forge-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Operator</th>
                <th>Action Event</th>
                <th>Target Entity</th>
                <th>IP Address</th>
                <th>Metadata & Details</th>
              </tr>
            </thead>
            <tbody>
              {audits.length > 0 ? (
                audits.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(a.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} style={{ color: 'var(--text-accent)' }} />
                        {a.user}
                      </span>
                    </td>
                    <td>
                      {getActionBadge(a.action)}
                    </td>
                    <td>
                      <span className="mono-text" style={{ fontSize: '0.78rem' }}>
                        {a.target_type}:{a.target_id?.substring(0, 8)}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {a.ip_address}
                    </td>
                    <td>
                      <pre className="mono-text" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px', maxWidth: '340px', overflowX: 'auto' }}>
                        {JSON.stringify(a.details)}
                      </pre>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                    {loading ? 'Fetching audit events...' : 'No audit records logged yet.'}
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
