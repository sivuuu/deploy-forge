import React from 'react';
import { RefreshCw, Play, Shield, Activity } from 'lucide-react';

export default function Header({ title, onRefresh, isRefreshing, onQuickTrigger, activeVersion, stagingHealthy }) {
  return (
    <header className="top-header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
        {activeVersion && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>
            <span className={`status-dot ${stagingHealthy ? 'active' : 'danger'}`}></span>
            <span style={{ color: 'var(--text-muted)' }}>Staging:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>{activeVersion}</span>
          </div>
        )}
      </div>

      <div className="header-right">
        {onRefresh && (
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={onRefresh} 
            disabled={isRefreshing}
            title="Refresh Data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        )}

        {onQuickTrigger && (
          <button 
            className="btn btn-primary btn-sm"
            onClick={onQuickTrigger}
          >
            <Play size={14} fill="currentColor" />
            <span>Trigger Pipeline</span>
          </button>
        )}
      </div>
    </header>
  );
}
