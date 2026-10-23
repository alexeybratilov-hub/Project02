import React from 'react';
import { storage } from '../services/storage';

interface ContingentCardProps {
  id: string;
  onNavigate: (view: string, id?: string) => void;
}

export const ContingentCard: React.FC<ContingentCardProps> = ({ id, onNavigate }) => {
  const item = storage.getContingentRecordById(id);

  if (!item) {
    return (
      <div>
        <p>
          <a
            href="#back"
            onClick={e => {
              e.preventDefault();
              onNavigate('contingent');
            }}
          >
            ← К реестру контингента
          </a>
        </p>
        <div className="alert">
          <p>Запись контингента не найдена.</p>
        </div>
      </div>
    );
  }

  const le = storage.getLegalEntityById(item.legal_entity_id);
  const dept = storage.getDepartmentById(item.department_id);
  const pos = storage.getPositionById(item.position_id);
  const schedule = storage.getWorkSchedules().find(w => w.id === item.work_schedule_id);
  const shift = storage.getShiftPatterns().find(s => s.id === item.shift_pattern_id);
  const subclass = storage.getWorkConditionSubclasses().find(w => w.id === item.work_condition_subclass_id);
  const elecGroup = storage.getElectricalSafetyGroups().find(e => e.id === item.electrical_safety_group_id);
  const employees = storage.getEmployeesByContingentId(item.id);

  const formatDate = (isoString: string) => {
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
      'Отправить в архив данную позицию контингента? Связанные данные будут сохранены.'
    );
    if (!confirmed) return;

    try {
      storage.archiveContingentRecord(item.id);
      onNavigate('contingent');
    } catch (err: any) {
      alert(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestore = () => {
    try {
      storage.restoreContingentRecord(item.id);
      onNavigate('contingent');
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
            onNavigate('contingent');
          }}
        >
          ← К реестру контингента
        </a>
      </p>

      <h1>
        {pos?.name || 'Должность не указана'}
        {item.workplace_label && ` (${item.workplace_label})`}
      </h1>
      <p style={{ color: '#4b5563', fontSize: '1rem', marginTop: '-0.3rem' }}>
        {dept?.name || 'Подразделение не указано'} —{' '}
        <strong>{le?.short_name || le?.full_name || 'Юридическое лицо'}</strong>
      </p>

      {item.status === 'archived' && <p className="badge warn">В архиве</p>}

      <table className="detail" style={{ marginTop: '1.25rem' }}>
        <tbody>
          <tr>
            <th>Юридическое лицо</th>
            <td>{le?.full_name || '—'}</td>
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
            <th>Уточнение рабочего места</th>
            <td>{item.workplace_label || '—'}</td>
          </tr>
          <tr>
            <th>График работы</th>
            <td>{schedule?.name || '—'}</td>
          </tr>
          <tr>
            <th>Сменность</th>
            <td>{shift?.name || '—'}</td>
          </tr>
          <tr>
            <th>Номер карты оценки профрисков (ОПР)</th>
            <td>{item.risk_card_number || '—'}</td>
          </tr>
          <tr>
            <th>Номер карты СОУТ</th>
            <td>{item.sout_card_number || '—'}</td>
          </tr>
          <tr>
            <th>Подкласс условий труда</th>
            <td>{subclass ? `${subclass.code} — ${subclass.name}` : '—'}</td>
          </tr>
          <tr>
            <th>Пункты приказа № 29н (медосмотры)</th>
            <td>
              {item.medical_items_29n && item.medical_items_29n.length > 0 ? (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {item.medical_items_29n.map((pt, i) => (
                    <span key={i} className="badge">
                      {pt}
                    </span>
                  ))}
                </div>
              ) : (
                '—'
              )}
            </td>
          </tr>
          <tr>
            <th>Пункты приказа № 342н (психосвид.)</th>
            <td>
              {item.medical_items_342n && item.medical_items_342n.length > 0 ? (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {item.medical_items_342n.map((pt, i) => (
                    <span key={i} className="badge ok">
                      {pt}
                    </span>
                  ))}
                </div>
              ) : (
                '—'
              )}
            </td>
          </tr>
          <tr>
            <th>Программа инструктажа на рабочем месте</th>
            <td>{item.training_program || '—'}</td>
          </tr>
          <tr>
            <th>Программа стажировки на рабочем месте</th>
            <td>{item.internship_program || '—'}</td>
          </tr>
          <tr>
            <th>Группа по электробезопасности</th>
            <td>{elecGroup?.name || '—'}</td>
          </tr>
          <tr>
            <th>Создано</th>
            <td>{formatDate(item.created_at)}</td>
          </tr>
          <tr>
            <th>Изменено</th>
            <td>{formatDate(item.updated_at)}</td>
          </tr>
        </tbody>
      </table>

      <h2>Связанные работники</h2>
      {employees.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>ФИО работника</th>
              <th>СНИЛС</th>
              <th>Дата приёма</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id}>
                <td>{`${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`}</td>
                <td>{emp.snils || '—'}</td>
                <td>{emp.hire_date || '—'}</td>
                <td>
                  <span className={`badge ${emp.status === 'active' ? 'ok' : 'warn'}`}>
                    {emp.status === 'active' ? 'Работает' : 'В архиве'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty" style={{ margin: '0.5rem 0 1.5rem' }}>
          К данной позиции контингента пока не привязаны работники (этап 4 — поимённый список работников).
        </p>
      )}

      <div className="toolbar" style={{ marginTop: '1.5rem' }}>
        <button className="btn" onClick={() => onNavigate('contingent-edit', item.id)}>
          Изменить
        </button>

        {item.status === 'active' ? (
          <button className="danger" onClick={handleArchive}>
            В архив
          </button>
        ) : (
          <button className="btn" onClick={handleRestore}>
            Вернуть из архива
          </button>
        )}
      </div>
    </div>
  );
};
