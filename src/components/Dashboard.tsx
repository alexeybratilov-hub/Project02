import React from 'react';
import { storage } from '../services/storage';

interface DashboardProps {
  onNavigate: (view: string, id?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const stats = storage.getStats();
  const modules = storage.getModules();
  const contingentRaw = storage.getContingentRaw();
  const contingentActive = contingentRaw.filter(c => c.status === 'active').length;
  const contingentArchived = contingentRaw.filter(c => c.status === 'archived').length;
  const employeesCount = storage.getEmployeesRaw().filter(e => e.status === 'active').length;

  const soutEnabled = storage.isModuleEnabled('sout');
  const soutCardsRaw = soutEnabled ? storage.getSoutCardsRaw() : [];
  const soutActive = soutCardsRaw.filter(c => c.status === 'active');
  const soutHarmful = soutActive.filter(c => ['3.1', '3.2', '3.3', '3.4', '4'].includes(c.final_class)).length;

  const oprEnabled = storage.isModuleEnabled('opr');
  const oprCardsRaw = oprEnabled ? storage.getOprCardsRaw() : [];
  const oprActive = oprCardsRaw.filter(c => c.status === 'active');
  const oprHighOrUnacceptable = oprActive.filter(
    c => c.overall_risk_level === 'high' || c.overall_risk_level === 'unacceptable'
  ).length;

  const widgets = [
    {
      id: 'legal_entities',
      title: 'Юридические лица',
      value: stats.active,
      caption: `активных; в архиве: ${stats.archived}`,
      empty_hint: 'Пока нет ни одного юридического лица — создайте первое.',
      onClick: () => onNavigate('legal-entities'),
    },
    {
      id: 'contingent',
      title: 'Реестр контингента',
      value: contingentActive,
      caption: `позиций; в архиве: ${contingentArchived}`,
      empty_hint: 'Пока нет записей контингента — создайте первую позицию.',
      onClick: () => onNavigate('contingent'),
    },
    {
      id: 'employees',
      title: 'Работники',
      value: employeesCount,
      caption: `${employeesCount} человек в поимённом списке`,
      empty_hint: 'Пока нет работников — добавьте первого или импортируйте из Excel.',
      onClick: () => onNavigate('employees'),
    },
    ...(soutEnabled
      ? [
          {
            id: 'sout',
            title: 'СОУТ (426-ФЗ)',
            value: soutActive.length,
            caption: `карт; вредные/опасные условия (3.x–4): ${soutHarmful}`,
            empty_hint: 'Пока нет карт СОУТ — создайте первую или импортируйте из Excel.',
            onClick: () => onNavigate('sout'),
          },
        ]
      : []),
    ...(oprEnabled
      ? [
          {
            id: 'opr',
            title: 'Оценка рисков (776н)',
            value: oprActive.length,
            caption: `карт; высокий/недопустимый риск: ${oprHighOrUnacceptable}`,
            empty_hint: 'Пока нет карт ОПР — создайте первую или импортируйте из Excel.',
            onClick: () => onNavigate('opr'),
          },
        ]
      : []),
  ];

  return (
    <div>
      <h1>Система автоматизации охраны труда</h1>
      <p style={{ color: '#4b5563', marginBottom: '1.25rem' }}>
        Приложение на этапе разработки (этап 7 — оценка профессиональных рисков по Приказу 776н). Показатели ниже — фактические данные из базы.
      </p>

      <div className="widgets">
        {widgets.map(w => (
          <div
            key={w.id}
            className="widget"
            onClick={w.onClick}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter') w.onClick();
            }}
          >
            <div className="value">{w.value}</div>
            <div className="title">{w.title}</div>
            <div className="caption">
              {w.value > 0 ? w.caption : w.empty_hint}
            </div>
          </div>
        ))}
      </div>

      <div className="toolbar" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
        <button className="btn" onClick={() => onNavigate('employees-new')}>
          + Добавить работника
        </button>
        <button className="btn" onClick={() => onNavigate('contingent-new')}>
          + Создать запись контингента
        </button>
        <button className="btn" onClick={() => onNavigate('legal-entities-new')}>
          + Создать юридическое лицо
        </button>
        {oprEnabled && (
          <button className="btn" onClick={() => onNavigate('opr-new')}>
            + Создать карту ОПР
          </button>
        )}
        <button className="btn secondary" onClick={() => onNavigate('employees-import')}>
          Импорт работников из Excel
        </button>
        <button className="btn secondary" onClick={() => onNavigate('contingent-import')}>
          Импорт контингента из Excel
        </button>
        {oprEnabled && (
          <button className="btn secondary" onClick={() => onNavigate('opr-import')}>
            Импорт карт ОПР
          </button>
        )}
        <button className="btn secondary" onClick={() => onNavigate('dictionaries')}>
          Справочники
        </button>
        <button className="btn secondary" onClick={() => onNavigate('backup')}>
          Резервное копирование
        </button>
      </div>

      <h2>Модули</h2>
      {modules.length > 0 ? (
        <ul className="module-list">
          {modules.map(m => (
            <li key={m.module_id} className="module-item">
              <div className="module-info">
                <h3>
                  {m.title} <span className="muted">v{m.version}</span>
                </h3>
                <p>{m.description || 'без описания'}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <span className={`badge ${m.enabled ? 'ok' : 'warn'}`}>
                  {m.enabled ? 'Включён' : 'Отключён'}
                </span>
                {m.module_id === 'employees' && (
                  <button
                    type="button"
                    className="btn-sm btn-secondary"
                    onClick={() => onNavigate('employees')}
                  >
                    Перейти
                  </button>
                )}
                {m.module_id === 'contingent' && (
                  <button
                    type="button"
                    className="btn-sm btn-secondary"
                    onClick={() => onNavigate('contingent')}
                  >
                    Перейти
                  </button>
                )}
                {m.module_id === 'legal_entities' && (
                  <button
                    type="button"
                    className="btn-sm btn-secondary"
                    onClick={() => onNavigate('legal-entities')}
                  >
                    Перейти
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Модули ещё не подключены — здесь появится навигация по включённым модулям.</p>
      )}
    </div>
  );
};
