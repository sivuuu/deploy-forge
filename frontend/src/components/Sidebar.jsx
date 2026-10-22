import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderGit2, 
  GitBranch, 
  ShieldAlert, 
  Server, 
  RotateCcw, 
  History, 
  Cpu
} from 'lucide-react';

export default function Sidebar({ environmentHealth }) {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Projects', path: '/projects', icon: FolderGit2 },
    { name: 'Pipelines', path: '/pipelines', icon: GitBranch },
    { name: 'Security Gates', path: '/security', icon: ShieldAlert },
    { name: 'Deployments', path: '/deployments', icon: Server },
    { name: 'Rollback Center', path: '/rollback', icon: RotateCcw },
    { name: 'Audit Trail', path: '/audit', icon: History },
  ];

  const runtimeName = environmentHealth?.container_runtime?.engine || 'podman';
  const runtimeOk = environmentHealth?.container_runtime?.available ?? true;

  return (
    <aside className="sidebar">
      <div className="brand-section">
        <div className="brand-icon">
          <Cpu size={22} />
        </div>
        <div>
          <div className="brand-title">DeployForge</div>
          <span className="brand-badge">DevOps Platform</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="runtime-badge">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`status-dot ${runtimeOk ? 'active' : 'danger'}`}></span>
            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{runtimeName} Engine</span>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>Local VM</span>
        </div>
      </div>
    </aside>
  );
}
