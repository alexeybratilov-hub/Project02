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
import { OprList } from './components/OprList';
import { OprForm } from './components/OprForm';
import { OprCardView } from './components/OprCardView';
import { OprImport } from './components/OprImport';
import { MedicalList } from './components/MedicalList';
import { MedicalForm } from './components/MedicalForm';
import { MedicalCardView } from './components/MedicalCardView';
import { MedicalImport } from './components/MedicalImport';
import { PpeList } from './components/PpeList';
import { PpeCardView } from './components/PpeCardView';
import { PpeCardForm } from './components/PpeCardForm';
import { PpeNormForm } from './components/PpeNormForm';
import { PpeImport } from './components/PpeImport';
import { TrainingList } from './components/TrainingList';
import { TrainingProtocolView } from './components/TrainingProtocolView';
import { TrainingProtocolForm } from './components/TrainingProtocolForm';
import { TrainingProgramForm } from './components/TrainingProgramForm';
import { TrainingImport } from './components/TrainingImport';
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
  const [trainingImportType, setTrainingImportType] = useState<'programs' | 'protocols'>('programs');

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
      } else if (hash.startsWith('opr/')) {
        const id = hash.replace('opr/', '');
        setCurrentView('opr-view');
        setTargetId(id);
      } else if (hash === 'opr') {
        setCurrentView('opr');
      } else if (hash === 'opr-new' || hash === 'opr-edit' || hash === 'opr-import') {
        setCurrentView(hash);
      } else if (hash.startsWith('medical/')) {
        const id = hash.replace('medical/', '');
        setCurrentView('medical-view');
        setTargetId(id);
      } else if (hash === 'medical') {
        setCurrentView('medical');
      } else if (hash === 'medical-new' || hash === 'medical-edit' || hash === 'medical-import') {
        setCurrentView(hash);
      } else if (hash.startsWith('ppe/')) {
        const id = hash.replace('ppe/', '');
        setCurrentView('ppe-view');
        setTargetId(id);
      } else if (hash === 'ppe') {
        setCurrentView('ppe');
      } else if (hash === 'ppe-card-new' || hash === 'ppe-card-edit' || hash === 'ppe-norm-new' || hash === 'ppe-norm-edit' || hash === 'ppe-import') {
        setCurrentView(hash);
      } else if (hash.startsWith('training-protocol/')) {
        const id = hash.replace('training-protocol/', '');
        setCurrentView('training-protocol-view');
        setTargetId(id);
      } else if (hash.startsWith('training-import/')) {
        setTrainingImportType(hash.replace('training-import/', '') === 'protocols' ? 'protocols' : 'programs');
        setCurrentView('training-import');
      } else if (hash === 'training') {
        setCurrentView('training');
      } else if (
        hash === 'training-protocol-new' ||
        hash === 'training-protocol-edit' ||
        hash === 'training-protocol-view' ||
        hash === 'training-program-new' ||
        hash === 'training-program-edit' ||
        hash === 'training-import'
      ) {
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
    } else if (view === 'opr-view' && id) {
      window.location.hash = `opr/${id}`;
    } else if (view === 'medical-view' && id) {
      window.location.hash = `medical/${id}`;
    } else if (view === 'ppe-view' && id) {
      window.location.hash = `ppe/${id}`;
    } else if (view === 'training-protocol-view' && id) {
      window.location.hash = `training-protocol/${id}`;
    } else if (view === 'training-import') {
      if (id === 'protocols' || id === 'programs') setTrainingImportType(id);
      window.location.hash = `training-import/${id === 'protocols' ? 'protocols' : 'programs'}`;
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
        soutEnabled={storage.isModuleEnabled('sout')}
        oprEnabled={storage.isModuleEnabled('opr')}
        medicalEnabled={storage.isModuleEnabled('medical')}
        ppeEnabled={storage.isModuleEnabled('ppe')}
        trainingEnabled={storage.isModuleEnabled('training')}
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

        {/* OPR (Stage 7) */}
        {currentView === 'opr' && (
          <OprList onNavigate={handleNavigate} filterLeId={targetId} />
        )}

        {currentView === 'opr-new' && <OprForm onNavigate={handleNavigate} />}

        {currentView === 'opr-edit' && (
          <OprForm id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'opr-view' && targetId && (
          <OprCardView id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'opr-import' && <OprImport onNavigate={handleNavigate} />}

        {/* Медосмотры (Этап 8) */}
        {currentView === 'medical' && (
          <MedicalList onNavigate={handleNavigate} filterLeId={targetId} />
        )}

        {currentView === 'medical-new' && <MedicalForm onNavigate={handleNavigate} />}

        {currentView === 'medical-edit' && (
          <MedicalForm id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'medical-view' && targetId && (
          <MedicalCardView id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'medical-import' && <MedicalImport onNavigate={handleNavigate} />}

        {/* СИЗ (Этап 9) */}
        {currentView === 'ppe' && (
          <PpeList onNavigate={handleNavigate} filterLeId={targetId} />
        )}

        {currentView === 'ppe-card-new' && <PpeCardForm onNavigate={handleNavigate} />}

        {currentView === 'ppe-card-edit' && (
          <PpeCardForm id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'ppe-norm-new' && <PpeNormForm onNavigate={handleNavigate} />}

        {currentView === 'ppe-norm-edit' && (
          <PpeNormForm id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'ppe-view' && targetId && (
          <PpeCardView id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'ppe-import' && <PpeImport onNavigate={handleNavigate} />}

        {/* Обучение по охране труда (Этап 10) */}
        {currentView === 'training' && (
          <TrainingList onNavigate={handleNavigate} filterLeId={targetId} />
        )}

        {currentView === 'training-protocol-new' && <TrainingProtocolForm onNavigate={handleNavigate} />}

        {currentView === 'training-protocol-edit' && targetId && (
          <TrainingProtocolForm id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'training-program-new' && <TrainingProgramForm onNavigate={handleNavigate} />}

        {currentView === 'training-program-edit' && targetId && (
          <TrainingProgramForm id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'training-protocol-view' && targetId && (
          <TrainingProtocolView id={targetId} onNavigate={handleNavigate} />
        )}

        {currentView === 'training-import' && (
          <TrainingImport onNavigate={handleNavigate} initialType={trainingImportType} />
        )}

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
