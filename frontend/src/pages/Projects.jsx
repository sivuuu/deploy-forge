import React, { useState, useEffect } from 'react';
import { 
  FolderGit2, 
  Plus, 
  Play, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  Cpu, 
  Radio, 
  ShieldCheck 
} from 'lucide-react';
import { api } from '../api';

export default function Projects({ onRegisterModal, onTriggerModal }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (project) => {
    setTestingId(project.id);
    try {
      const res = await api.testProjectConnection(project.id);
      setTestResults(prev => ({ ...prev, [project.id]: res }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, [project.id]: { error: err.message } }));
    } finally {
      setTestingId(null);
    }
  };

  const handleCopyWebhook = (project) => {
    const url = `http://localhost:8000/api/projects/${project.id}/webhook/`;
    navigator.clipboard.writeText(url);
    setCopiedId(project.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading configured repositories...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Registered Projects & Pipelines</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Manage source code repositories, Jenkins integrations, container runtime adapters, and security policies.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onRegisterModal}>
          <Plus size={16} />
          <span>Register Repository</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '20px' }}>
        {projects.map((p) => {
          const testRes = testResults[p.id];
          return (
            <div key={p.id} className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FolderGit2 size={18} style={{ color: 'var(--accent-cyan)' }} />
                    {p.name}
                  </h3>
                  <div className="mono-text" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Slug: {p.slug} · Target: {p.deployment_target}
                  </div>
                </div>

                <span className="badge badge-healthy" style={{ textTransform: 'capitalize' }}>
                  {p.runtime} engine
                </span>
              </div>

              <div style={{ background: 'rgba(7,9,14,0.5)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Repository URL:</span>
                  <span className="mono-text" style={{ color: 'var(--text-accent)' }}>{p.repo_url}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Default Branch:</span>
                  <span className="commit-chip">{p.default_branch}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Jenkins Job:</span>
                  <span className="mono-text">{p.jenkins_job_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Active Staging Release:</span>
                  <span className="commit-chip" style={{ color: '#10b981' }}>{p.active_version || 'None'}</span>
                </div>
              </div>

              {testRes && (
                <div style={{ background: 'rgba(0, 242, 254, 0.05)', padding: '10px 12px', borderRadius: 'var(--radius-md)', marginBottom: '14px', border: '1px solid rgba(0, 242, 254, 0.2)', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00f2fe', fontWeight: 600, marginBottom: '4px' }}>
                    <CheckCircle2 size={14} /> Integration Verification:
                  </div>
                  <div>Container Runtime: <strong>{testRes.container_runtime?.detected_engine}</strong> ({testRes.container_runtime?.message})</div>
                  <div>Jenkins CI: <strong>{testRes.jenkins?.message}</strong></div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => onTriggerModal(p.id)}
                >
                  <Play size={14} fill="currentColor" />
                  <span>Trigger Run</span>
                </button>

                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleTestConnection(p)}
                  disabled={testingId === p.id}
                >
                  <Radio size={14} />
                  <span>{testingId === p.id ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleCopyWebhook(p)}
                  title="Copy GitHub/GitLab Webhook URL"
                >
                  {copiedId === p.id ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                  <span>{copiedId === p.id ? 'Copied' : 'Webhook URL'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
