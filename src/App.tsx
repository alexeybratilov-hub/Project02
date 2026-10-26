import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Dashboard } from './components/Dashboard';
import { LegalEntitiesList } from './components/LegalEntitiesList';
import { LegalEntityCard } from './components/LegalEntityCard';
import { LegalEntityForm } from './components/LegalEntityForm';
import { LegalEntitiesImport } from './components/LegalEntitiesImport';
import { ContingentList } from './components/ContingentList';
import { ContingentCard } from './components/ContingentCard';
import { ContingentForm } from './components/ContingentForm';
import { ContingentImport } from './components/ContingentImport';
import { EmployeesList } from './components/EmployeesList';
import { EmployeeCard } from './components/EmployeeCard';
import { EmployeeForm } from './components/EmployeeForm';
import { EmployeesImport } from './components/EmployeesImport';
import { SoutList } from './components/SoutList';
import { SoutForm } from './components/SoutForm';
import { SoutCardView } from './components/SoutCardView';
import { SoutImport } from './components/SoutImport';
import { DictionariesView } from './components/DictionariesView';
import { AuditLogView } from './components/AuditLogView';
import { BackupView } from './components/BackupView';
import { ModulesView } from './components/ModulesView';
import { storage } from './services/storage';
import { LegalEntity } from './types';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>('home');
  const [targetId, setTargetId] = useState<string | undefined>(undefined);
  const [currentLe, setCurrentLe] = useState<LegalEntity | null>(null);

  const refreshCurrentLe = () => {
    setCurrentLe(storage.getCurrentLegalEntity());
  };

  useEffect(() => {
    refreshCurrentLe();
    storage.checkPeriodicAutoBackup();

    const hash = window.location.hash.replace('#', '');
    if (hash) {
      if (hash.startsWith('legal-entities/')) {
        const id = hash.replace('legal-entities/', '');
        setCurrentView('legal-entities-view');
        setTargetId(id);
      } else if (hash.startsWith('contingent/')) {
        const id = hash.replace('contingent/', '');
        setCurrentView('contingent-view');
        setTargetId(id);
      } else if (hash.startsWith('employees/')) {
        const id = hash.replace('employees/', '');
        setCurrentView('employees-view');
        setTargetId(id);
      } else if (hash === 'legal-entities') {
        setCurrentView('legal-entities');
      } else if (hash === 'contingent') {
        setCurrentView('contingent');
      } else if (hash === 'employees') {
        setCurrentView('employees');
      } else if (hash.startsWith('sout/')) {
        const id = hash.replace('sout/', '');
        setCurrentView('sout-view');
        setTargetId(id);
      } else if (hash === 'sout') {
        setCurrentView('sout');
      } else if (hash === 'sout-new' || hash === 'sout-edit' || hash === 'sout-import') {
        setCurrentView(hash);
      } else if (hash === 'dictionaries') {
        setCurrentView('dictionaries');
      } else if (hash === 'modules') {
        setCurrentView('modules');
      } else if (hash === 'backup') {
        setCurrentView('backup');
      } else if (hash === 'audit') {
        setCurrentView('audit');
      }
    }
  }, []);

  const handleNavigate = (view: string, id?: string) => {
    setCurrentView(view);
    setTargetId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (view === 'legal-entities-view' && id) {
      window.location.hash = `legal-entities/${id}`;
    } else if (view === 'contingent-view' && id) {
      window.location.hash = `contingent/${id}`;
    } else if (view === 'employees-view' && id) {
      window.location.hash = `employees/${id}`;
    } else if (view === 'sout-view' && id) {
      window.location.hash = `sout/${id}`;
    } else if (view === 'home') {
      window.location.hash = '';
    } else {
      window.location.hash = view;
    }
  };

  const handleClearCurrentLe = () => {
    storage.setCurrentLegalEntityId(null);
    refreshCurrentLe();
  };

  return (
    <div>
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        currentLe={currentLe}
        onClearCurrentLe={handleClearCurrentLe}
      />

      <main>
        {currentView === 'home' && <Dashboard onNavigate={handleNavigate} />}

        {/* Legal Entities */}
        {currentView === 'legal-entities' && (
          <LegalEntitiesList
            onNavigate={handleNavigate}
            onRefreshCurrentLe={refreshCurrentLe}
          />
        )}

        {currentView === 'legal-entities-new' && (
          <LegalEntityForm
            onNavigate={handleNavigate}
            onRefreshCurrentLe={refreshCurrentLe}
          />
        )}

        {currentView === 'legal-entities-edit' && (
          <LegalEntityForm
            id={targetId}
            onNavigate={handleNavigate}
            onRefreshCurrentLe={refreshCurrentLe}
          />
        )}

        {currentView === 'legal-entities-view' && targetId && (
          <LegalEntityCard
            id={targetId}
            onNavigate={handleNavigate}
            onRefreshCurrentLe={refreshCurrentLe}
          />
        )}

        {currentView === 'legal-entities-import' && (
          <LegalEntitiesImport
            onNavigate={handleNavigate}
            onRefreshCurrentLe={refreshCurrentLe}
          />
        )}

        {/* Contingent */}
        {currentView === 'contingent' && (
          <ContingentList
            onNavigate={handleNavigate}
            filterLeId={targetId}
          />
        )}

        {currentView === 'contingent-new' && (
          <ContingentForm onNavigate={handleNavigate} />
        )}

        {currentView === 'contingent-edit' && (
          <ContingentForm id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'contingent-view' && targetId && (
          <ContingentCard id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'contingent-import' && (
          <ContingentImport onNavigate={handleNavigate} />
        )}

        {/* Employees (Stage 4) */}
        {currentView === 'employees' && (
          <EmployeesList
            onNavigate={handleNavigate}
            filterLeId={targetId}
          />
        )}

        {currentView === 'employees-new' && (
          <EmployeeForm onNavigate={handleNavigate} />
        )}

        {currentView === 'employees-edit' && (
          <EmployeeForm id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'employees-view' && targetId && (
          <EmployeeCard id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'employees-import' && (
          <EmployeesImport onNavigate={handleNavigate} />
        )}

        {/* SOUT (Stage 6) */}
        {currentView === 'sout' && (
          <SoutList onNavigate={handleNavigate} filterLeId={targetId} />
        )}

        {currentView === 'sout-new' && <SoutForm onNavigate={handleNavigate} />}

        {currentView === 'sout-edit' && (
          <SoutForm id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'sout-view' && targetId && (
          <SoutCardView id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'sout-import' && <SoutImport onNavigate={handleNavigate} />}

        {/* Dictionaries */}
        {currentView === 'dictionaries' && <DictionariesView />}

        {/* System & Modules */}
        {currentView === 'modules' && <ModulesView />}

        {currentView === 'backup' && (
          <BackupView onRefreshCurrentLe={refreshCurrentLe} />
        )}

        {currentView === 'audit' && <AuditLogView />}
      </main>

      <Footer />
    </div>
  );
};

export default App;
