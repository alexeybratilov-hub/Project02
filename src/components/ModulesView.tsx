import React, { useState } from 'react';
import { storage } from '../services/storage';

export const ModulesView: React.FC = () => {
  const [modules, setModules] = useState(storage.getModules());

  const handleToggle = (moduleId: string) => {
    storage.toggleModule(moduleId);
    setModules(storage.getModules());
  };

  return (
    <div>
      <h1>Реестр модулей</h1>
      <p style={{ color: '#4b5563' }}>
        Управление модулями системы (T1-06, FR-15). Отключение необязательного модуля не нарушает
        работу ядра и сохраняет ранее введённые данные.
      </p>

      <ul className="module-list" style={{ marginTop: '1.25rem' }}>
        {modules.map(m => (
          <li key={m.module_id} className="module-item">
            <div className="module-info">
              <h3>
                {m.title} <span className="muted">v{m.version}</span>
              </h3>
              <p>{m.description}</p>
              <p className="muted" style={{ marginTop: '4px' }}>
                Зависимости ядра: {m.requires_core.join(', ')}
              </p>
            </div>
            <div>
              <button
                type="button"
                className={m.enabled ? 'secondary' : ''}
                onClick={() => handleToggle(m.module_id)}
              >
                {m.enabled ? 'Отключить' : 'Включить'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
