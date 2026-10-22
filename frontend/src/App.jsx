import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Pipelines from './pages/Pipelines';
import PipelineDetail from './pages/PipelineDetail';
import SecurityGates from './pages/SecurityGates';
import Deployments from './pages/Deployments';
import RollbackCenter from './pages/RollbackCenter';
import AuditLogs from './pages/AuditLogs';

import TriggerPipelineModal from './components/TriggerPipelineModal';
import RegisterProjectModal from './components/RegisterProjectModal';
import RollbackModal from './components/RollbackModal';
import { api } from './api';

function AppContent() {
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [targetRollbackArtifact, setTargetRollbackArtifact] = useState(null);

  const loadGlobalData = async () => {
    setIsRefreshing(true);
    try {
      const [statsData, projectsData] = await Promise.all([
        api.getStats().catch(() => null),
        api.getProjects().catch(() => [])
      ]);
      if (statsData) setStats(statsData);
      if (projectsData) setProjects(projectsData);
    } catch (err) {
      console.error("Global refresh error:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadGlobalData();
  }, []);

  const getPageTitle = (pathname) => {
    if (pathname === '/') return 'Mission Control Dashboard';
    if (pathname.startsWith('/projects')) return 'Source Repositories & Adapters';
    if (pathname.startsWith('/pipelines/') && pathname.length > 11) return 'Pipeline Execution Telemetry';
    if (pathname.startsWith('/pipelines')) return 'CI/CD Pipelines';
    if (pathname.startsWith('/security')) return 'Security Gates & Vulnerability Audit';
    if (pathname.startsWith('/deployments')) return 'Staging Deployment Management';
    if (pathname.startsWith('/rollback')) return 'Emergency Rollback Center';
    if (pathname.startsWith('/audit')) return 'Tamper-Evident Audit Trail';
    return 'DeployForge Platform';
  };

  const handleTriggerPipeline = async (projectId, data) => {
    const res = await api.triggerPipeline(projectId, data);
    await loadGlobalData();
    return res;
  };

  const handleRegisterProject = async (data) => {
    const res = await api.createProject(data);
    await loadGlobalData();
    return res;
  };

  const handleExecuteRollback = async (data) => {
    const res = await api.rollback(data);
    await loadGlobalData();
    return res;
  };

  const activeRelease = stats?.stats?.active_version;
  const isHealthy = stats?.stats?.staging_status === 'healthy';

  return (
    <div className="app-container">
      <Sidebar environmentHealth={stats?.environment_health} />

      <div className="main-wrapper">
        <Header 
          title={getPageTitle(location.pathname)}
          onRefresh={loadGlobalData}
          isRefreshing={isRefreshing}
          onQuickTrigger={() => setTriggerModalOpen(true)}
          activeVersion={activeRelease}
          stagingHealthy={isHealthy}
        />

        <main className="page-content">
          <Routes>
            <Route 
              path="/" 
              element={
                <Dashboard 
                  onTriggerModal={() => setTriggerModalOpen(true)}
                  onRollbackModal={() => setRollbackModalOpen(true)}
                />
              } 
            />
            <Route 
              path="/projects" 
              element={
                <Projects 
                  onRegisterModal={() => setRegisterModalOpen(true)}
                  onTriggerModal={() => setTriggerModalOpen(true)}
                />
              } 
            />
            <Route 
              path="/pipelines" 
              element={<Pipelines onTriggerModal={() => setTriggerModalOpen(true)} />} 
            />
            <Route path="/pipelines/:id" element={<PipelineDetail />} />
            <Route path="/security" element={<SecurityGates />} />
            <Route 
              path="/deployments" 
              element={<Deployments onRollbackModal={() => setRollbackModalOpen(true)} />} 
            />
            <Route 
              path="/rollback" 
              element={<RollbackCenter onRollbackModal={() => setRollbackModalOpen(true)} />} 
            />
            <Route path="/audit" element={<AuditLogs />} />
          </Routes>
        </main>
      </div>

      {/* Global Modals */}
      <TriggerPipelineModal 
        isOpen={triggerModalOpen}
        onClose={() => setTriggerModalOpen(false)}
        projects={projects}
        onTrigger={handleTriggerPipeline}
      />

      <RegisterProjectModal 
        isOpen={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        onRegister={handleRegisterProject}
      />

      <RollbackModal 
        isOpen={rollbackModalOpen}
        onClose={() => setRollbackModalOpen(false)}
        project={projects[0] || { id: 'sample-project' }}
        targetArtifact={targetRollbackArtifact}
        currentVersion={activeRelease}
        onConfirm={handleExecuteRollback}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
