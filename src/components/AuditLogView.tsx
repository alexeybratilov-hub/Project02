import React, { useState } from 'react';
import { storage } from '../services/storage';

export const AuditLogView: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const logs = storage.getAuditLogs();

  const actionLabels: Record<string, string> = {
    create: 'Создание',
    update: 'Изменение',
    archive: 'Архивирование',
    restore_from_archive: 'Возврат из архива',
    import_create: 'Импорт (создание)',
    import_update: 'Импорт (обновление)',
    restore: 'Восстановление БД',
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return (
        d.toLocaleDateString('ru-RU') +
        ' ' +
        d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    } catch {
      return isoString;
    }
  };

  return (
    <div>
      <h1>Журнал аудита</h1>
      <p style={{ color: '#4b5563' }}>
        Фиксация всех значимых изменений в системе (T1-08, FR-13). Исторические записи не перезаписываются.
      </p>

      {logs.length > 0 ? (
        <table style={{ marginTop: '1.25rem' }}>
          <thead>
            <tr>
              <th style={{ width: '160px' }}>Дата и время</th>
              <th style={{ width: '120px' }}>Тип объекта</th>
              <th style={{ width: '160px' }}>Действие</th>
              <th style={{ width: '100px' }}>Автор</th>
              <th>Примечание / Данные</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => {
              const isExpanded = selectedItem === log.id;
              return (
                <React.Fragment key={log.id}>
                  <tr>
                    <td>{formatDate(log.changed_at)}</td>
                    <td>
                      <span className="badge">
                        {log.entity_type === 'legal_entity' ? 'Юрлицо' : log.entity_type}
                      </span>
                    </td>
                    <td>
                      <strong>{actionLabels[log.action] || log.action}</strong>
                    </td>
                    <td>{log.actor}</td>
                    <td>
                      {log.comment && <div>{log.comment}</div>}
                      {log.after_data?.full_name && (
                        <div style={{ fontWeight: 500 }}>
                          «{log.after_data.full_name}»
                        </div>
                      )}
                      {(log.before_data || log.after_data) && (
                        <button
                          type="button"
                          className="link-action"
                          style={{ fontSize: '0.82rem', marginTop: '3px' }}
                          onClick={() => setSelectedItem(isExpanded ? null : log.id)}
                        >
                          {isExpanded ? 'Скрыть детали' : 'Показать снимок изменений'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={5} style={{ background: '#f8fafc', padding: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <strong>Снимок ДО:</strong>
                            <pre
                              style={{
                                background: '#ffffff',
                                border: '1px solid #d0d7de',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                maxHeight: '200px',
                                overflow: 'auto',
                              }}
                            >
                              {log.before_data
                                ? JSON.stringify(log.before_data, null, 2)
                                : '— (нет предшествующего состояния)'}
                            </pre>
                          </div>
                          <div>
                            <strong>Снимок ПОСЛЕ:</strong>
                            <pre
                              style={{
                                background: '#ffffff',
                                border: '1px solid #d0d7de',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                maxHeight: '200px',
                                overflow: 'auto',
                              }}
                            >
                              {log.after_data
                                ? JSON.stringify(log.after_data, null, 2)
                                : '—'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="empty" style={{ marginTop: '1.25rem' }}>
          Записей в журнале аудита пока нет.
        </p>
      )}
    </div>
  );
};
