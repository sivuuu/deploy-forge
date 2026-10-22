import React, { useState } from 'react';
import { X, Plus, FolderGit2 } from 'lucide-react';

export default function RegisterProjectModal({ isOpen, onClose, onRegister }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [runtime, setRuntime] = useState('podman');
  const [deploymentTarget, setDeploymentTarget] = useState('staging');
  const [jenkinsJob, setJenkinsJob] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleNameChange = (val) => {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, '-')) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    }
  };

  const handleLoadSample = () => {
    setName('Sample Microservice API');
    setSlug('sample-microservice-api');
    setRepoUrl('https://github.com/deployforge/sample-microservice.git');
    setDefaultBranch('main');
    setRuntime('podman');
    setDeploymentTarget('staging');
    setJenkinsJob('deployforge-sample-pipeline');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onRegister({
        name,
        slug,
        repo_url: repoUrl,
        default_branch: defaultBranch,
        runtime,
        deployment_target: deploymentTarget,
        jenkins_job_name: jenkinsJob || `${slug}-pipeline`,
        jenkins_url: 'http://localhost:8080'
      });
      onClose();
    } catch (err) {
      alert(`Registration failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderGit2 size={18} style={{ color: 'var(--accent-cyan)' }} />
            Register New Repository
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={handleLoadSample}
            style={{ fontSize: '0.75rem', borderColor: 'rgba(0, 242, 254, 0.4)', color: 'var(--accent-cyan)' }}
          >
            ⚡ Populate Sample Microservice Defaults
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input 
              type="text" 
              className="form-input" 
              value={name} 
              onChange={(e) => handleNameChange(e.target.value)} 
              placeholder="e.g. Payments Gateway" 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Identifier Slug *</label>
            <input 
              type="text" 
              className="form-input" 
              value={slug} 
              onChange={(e) => setSlug(e.target.value)} 
              placeholder="payments-gateway" 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Repository URL *</label>
            <input 
              type="text" 
              className="form-input" 
              value={repoUrl} 
              onChange={(e) => setRepoUrl(e.target.value)} 
              placeholder="https://github.com/org/repo.git or local path" 
              required 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Container Engine *</label>
              <select className="form-select" value={runtime} onChange={(e) => setRuntime(e.target.value)}>
                <option value="podman">Podman Engine (Rootless)</option>
                <option value="docker">Docker Community Engine</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Deployment Target *</label>
              <select className="form-select" value={deploymentTarget} onChange={(e) => setDeploymentTarget(e.target.value)}>
                <option value="staging">Isolated Staging (Port 8085)</option>
                <option value="development">Dev Sandbox</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Jenkins Pipeline Job Name</label>
            <input 
              type="text" 
              className="form-input" 
              value={jenkinsJob} 
              onChange={(e) => setJenkinsJob(e.target.value)} 
              placeholder="deployforge-sample-pipeline" 
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !name || !repoUrl}>
              <Plus size={14} />
              <span>{isSubmitting ? 'Registering...' : 'Register Project'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
