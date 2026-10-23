import React from 'react';
import { storage } from '../services/storage';
import { formatDateForDisplay } from '../services/excel';

interface EmployeeCardProps {
  id: string;
  onNavigate: (view: string, id?: string) => void;
}

export const EmployeeCard: React.FC<EmployeeCardProps> = ({ id, onNavigate }) => {
  const item = storage.getEmployeeById(id);

  if (!item) {
    return (
      <div>
        <p>
          <a
            href="#back"
            onClick={e => {
              e.preventDefault();
              onNavigate('employees');
            }}
          >
            ← К реестру работников
          </a>
        </p>
        <div className="alert">
          <p>Работник не найден.</p>
        </div>
      </div>
    );
  }

  const le = storage.getLegalEntityById(item.legal_entity_id);
  const dept = storage.getDepartmentById(item.department_id);
  const pos = storage.getPositionById(item.position_id);
  const contingentRec = item.contingent_record_id
    ? storage.getContingentRecordById(item.contingent_record_id)
    : null;
  const history = storage.listEmploymentHistory(item.id);
  const auditLogs = storage
    .getAuditLogs()
    .filter(a => a.entity_id === item.id || (a.before_data && a.before_data.employee_id === item.id) || (a.after_data && a.after_data.employee_id === item.id));

  const allDepts = storage.getDepartmentsRaw();
  const allPositions = storage.getPositionsRaw();
  const allContingent = storage.getContingentRaw();

  const fullName = `${item.last_name} ${item.first_name}${item.middle_name ? ' ' + item.middle_name : ''}`;

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return (
        d.toLocaleDateString('ru-RU') +
        ' ' +
        d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      );
    } catch {
      return isoString;
    }
  };

  const handleArchive = () => {
    const confirmed = window.confirm(
      `Отправить работника «${fullName}» в архив? Вся история перемещений будет сохранена.`
    );
    if (!confirmed) return;

    try {
      storage.archiveEmployee(item.id);
      onNavigate('employees');
    } catch (err: any) {
      alert(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestore = () => {
    try {
      storage.restoreEmployee(item.id);
      onNavigate('employees');
    } catch (err: any) {
      alert(err.message || 'Ошибка восстановления');
    }
  };

  return (
    <div>
      <p>
        <a
          href="#back"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}
          onClick={e => {
            e.preventDefault();
            onNavigate('employees');
          }}
        >
          ← К реестру работников
        </a>
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.2rem' }}>
            {fullName}{' '}
            {item.status === 'archived' && (
              <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.85rem' }}>
                В архиве
              </span>
            )}
          </h1>
          <p style={{ color: '#4b5563', fontSize: '1rem', marginTop: 0 }}>
            {pos?.name || 'Должность не указана'} • {dept?.name || 'Подразделение не указано'} •{' '}
            {le ? (
              <a
                href={`#legal-entities/${le.id}`}
                onClick={e => {
                  e.preventDefault();
                  onNavigate('legal-entities-view', le.id);
                }}
                style={{ color: 'var(--accent)' }}
              >
                {le.short_name || le.full_name}
              </a>
            ) : (
              'Организация не указана'
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn" onClick={() => onNavigate('employees-edit', item.id)}>
            Редактировать
          </button>
          {item.status === 'active' ? (
            <button className="btn btn-secondary" onClick={handleArchive}>
              В архив
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={handleRestore}>
              Восстановить
            </button>
          )}
        </div>
      </div>

      <h2>Учётные данные работника</h2>
      <table className="detail">
        <tbody>
          <tr>
            <th>Фамилия, Имя, Отчество</th>
            <td>{fullName}</td>
          </tr>
          <tr>
            <th>СНИЛС (D-007)</th>
            <td>
              {item.snils ? (
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  {item.snils}
                </span>
              ) : (
                <span style={{ color: '#9ca3af' }}>Не указан</span>
              )}
            </td>
          </tr>
          <tr>
            <th>Дата рождения</th>
            <td>{formatDateForDisplay(item.birth_date) || '—'}</td>
          </tr>
          <tr>
            <th>Дата приёма на работу</th>
            <td>{formatDateForDisplay(item.hire_date) || '—'}</td>
          </tr>
          <tr>
            <th>Юридическое лицо</th>
            <td>
              {le ? (
                <a
                  href={`#legal-entities/${le.id}`}
                  onClick={e => {
                    e.preventDefault();
                    onNavigate('legal-entities-view', le.id);
                  }}
                  style={{ color: 'var(--accent)' }}
                >
                  {le.full_name} {le.inn ? `(ИНН: ${le.inn})` : ''}
                </a>
              ) : (
                '—'
              )}
            </td>
          </tr>
          <tr>
            <th>Структурное подразделение</th>
            <td>{dept?.name || '—'}</td>
          </tr>
          <tr>
            <th>Должность</th>
            <td>{pos?.name || '—'}</td>
          </tr>
          <tr>
            <th>Позиция контингента (FR-09)</th>
            <td>
              {contingentRec ? (
                <div>
                  <a
                    href={`#contingent/${contingentRec.id}`}
                    onClick={e => {
                      e.preventDefault();
                      onNavigate('contingent-view', contingentRec.id);
                    }}
                    style={{ fontWeight: 600, color: 'var(--accent)' }}
                  >
                    {contingentRec.workplace_label || 'Основное рабочее место'} (карточка #{contingentRec.id.slice(0, 8)})
                  </a>
                  <div style={{ fontSize: '0.88rem', color: '#4b5563', marginTop: '0.2rem' }}>
                    {contingentRec.sout_card_number && `Карта СОУТ: ${contingentRec.sout_card_number}; `}
                    {contingentRec.risk_card_number && `Карта ОПР: ${contingentRec.risk_card_number}; `}
                    {(contingentRec.medical_items_29n || []).length > 0 && (
                      <span>Пункты 29н: {(contingentRec.medical_items_29n || []).join(', ')}; </span>
                    )}
                    {(contingentRec.medical_items_342n || []).length > 0 && (
                      <span>Пункты 342н: {(contingentRec.medical_items_342n || []).join(', ')}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ color: '#d97706' }}>
                  ⚠️ Не привязан к позиции контингента охраны труда.
                  <button
                    className="btn-sm btn-secondary"
                    style={{ marginLeft: '0.5rem' }}
                    onClick={() => onNavigate('employees-edit', item.id)}
                  >
                    Привязать
                  </button>
                </div>
              )}
            </td>
          </tr>
          <tr>
            <th>Статус</th>
            <td>
              {item.status === 'active' ? (
                <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>
                  Активен
                </span>
              ) : (
                <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>
                  В архиве
                </span>
              )}
            </td>
          </tr>
          <tr>
            <th>Создано в системе</th>
            <td>{formatDateTime(item.created_at)}</td>
          </tr>
          <tr>
            <th>Последнее изменение</th>
            <td>{formatDateTime(item.updated_at)}</td>
          </tr>
        </tbody>
      </table>

      {/* История кадровых перемещений D-005 */}
      <h2>История кадровых перемещений (D-005)</h2>
      <p style={{ color: '#4b5563', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
        Фиксация перемещений по подразделениям, должностям и прикреплению к контингенту. Исторические периоды неизменяемы.
      </p>

      {history.length === 0 ? (
        <div style={{ padding: '1rem', background: '#fff', border: '1px solid var(--border)', borderRadius: '4px' }}>
          <p style={{ color: '#6b7280', margin: 0 }}>История перемещений пока не зафиксирована.</p>
        </div>
      ) : (
        <div className="table-container" style={{ marginBottom: '1.5rem' }}>
          <table>
            <thead>
              <tr>
                <th>Период работы</th>
                <th>Подразделение</th>
                <th>Должность</th>
                <th>Контингент</th>
                <th>Основание / Причина</th>
                <th>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, idx) => {
                const hDept = allDepts.find(d => d.id === h.department_id);
                const hPos = allPositions.find(p => p.id === h.position_id);
                const hCont = h.contingent_record_id
                  ? allContingent.find(c => c.id === h.contingent_record_id)
                  : null;

                const isCurrent = !h.end_date;

                return (
                  <tr key={h.id || idx} style={isCurrent ? { background: '#f8fafc' } : {}}>
                    <td>
                      <span style={{ fontWeight: 600 }}>
                        {formatDateForDisplay(h.start_date) || '—'}
                      </span>
                      {' — '}
                      {h.end_date ? (
                        <span>{formatDateForDisplay(h.end_date)}</span>
                      ) : (
                        <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>
                          По наст. время
                        </span>
                      )}
                    </td>
                    <td>{hDept?.name || '—'}</td>
                    <td>{hPos?.name || '—'}</td>
                    <td>
                      {hCont ? (
                        <span>{hCont.workplace_label || 'Основное рабочее место'}</span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Не привязан</span>
                      )}
                    </td>
                    <td>{h.reason || '—'}</td>
                    <td>{h.comment || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Аудит действий */}
      <h2>Журнал изменений карточки</h2>
      {auditLogs.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Записей в журнале аудита нет.</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Дата и время</th>
                <th>Действие</th>
                <th>Инициатор</th>
                <th>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.slice(0, 10).map(log => {
                let actionLabel: string = log.action;
                if (log.action === 'employee_create') actionLabel = 'Создание работника';
                else if (log.action === 'employee_update') actionLabel = 'Обновление данных';
                else if (log.action === 'employee_archive') actionLabel = 'Архивирование';
                else if (log.action === 'employee_restore') actionLabel = 'Восстановление из архива';
                else if (log.action === 'employee_import') actionLabel = 'Импорт из Excel';
                else if (log.action === 'employment_history_close') actionLabel = 'Закрытие периода работы';
                else if (log.action === 'employment_history_open') actionLabel = 'Открытие нового периода работы';

                return (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.changed_at)}</td>
                    <td>
                      <strong>{actionLabel}</strong>
                    </td>
                    <td>{log.actor}</td>
                    <td>{log.comment || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
