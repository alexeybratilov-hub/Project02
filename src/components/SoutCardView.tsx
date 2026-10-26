import React, { useState } from 'react';
import { storage } from '../services/storage';
import { SoutFamiliarization, SOUT_FACTOR_LABELS_RU } from '../types';

interface SoutCardViewProps {
  id: string;
  onNavigate: (view: string, id?: string) => void;
}

const CLASS_NAMES: Record<string, string> = {
  '1': 'Оптимальные условия труда (класс 1)',
  '2': 'Допустимые условия труда (класс 2)',
  '3.1': 'Вредные условия труда (подкласс 3.1)',
  '3.2': 'Вредные условия труда (подкласс 3.2)',
  '3.3': 'Вредные условия труда (подкласс 3.3)',
  '3.4': 'Опасные условия труда (подкласс 3.4)',
  '4': 'Опасные условия труда (класс 4)',
};

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return d;
}

export const SoutCardView: React.FC<SoutCardViewProps> = ({ id, onNavigate }) => {
  const card = storage.getSoutCardById(id);
  const [familiarizations, setFamiliarizations] = useState<SoutFamiliarization[]>(
    card ? storage.listSoutFamiliarizations(card.id) : []
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [signedAt, setSignedAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!card) {
    return (
      <div>
        <h1>Карта СОУТ не найдена</h1>
        <p>Запись с идентификатором «{id}» отсутствует или удалена.</p>
        <button className="btn" onClick={() => onNavigate('sout')}>К реестру карт СОУТ</button>
      </div>
    );
  }

  const le = storage.getLegalEntityById(card.legal_entity_id);
  const dept = storage.getDepartmentById(card.department_id);
  const pos = storage.getPositionById(card.position_id);
  const employees = storage.listEmployees({ legal_entity_id: card.legal_entity_id, pageSize: 10000 }).items;
  const familiarizedIds = new Set(familiarizations.map(f => f.employee_id));

  const isHarmful = ['3.1', '3.2', '3.3', '3.4', '4'].includes(card.final_class);

  const handleArchive = () => {
    if (!window.confirm(`Отправить карту СОУТ № ${card.card_number} в архив?`)) return;
    try {
      storage.archiveSoutCard(card.id);
      onNavigate('sout');
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestore = () => {
    try {
      storage.restoreSoutCard(card.id);
      onNavigate('sout-view', card.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка восстановления');
    }
  };

  const handleFamiliarize = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!selectedEmployeeId) {
      setErrorMsg('Выберите работника для отметки об ознакомлении.');
      return;
    }
    try {
      storage.familiarizeSoutCard(card.id, selectedEmployeeId, signedAt || undefined, comment.trim() || null);
      setFamiliarizations(storage.listSoutFamiliarizations(card.id));
      setSelectedEmployeeId('');
      setComment('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка отметки ознакомления');
    }
  };

  const handleRemoveFamiliarization = (famId: string) => {
    if (!window.confirm('Отменить отметку об ознакомлении?')) return;
    try {
      storage.removeSoutFamiliarization(famId);
      setFamiliarizations(storage.listSoutFamiliarizations(card.id));
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка отмены отметки');
    }
  };

  const g = card.guarantees;
  const infoStyle: React.CSSProperties = { marginBottom: '1rem' };
  const dtStyle: React.CSSProperties = { color: '#6b7280', fontSize: '0.85rem' };
  const ddStyle: React.CSSProperties = { margin: '0 0 0.5rem', fontWeight: 600 };

  return (
    <div>
      <p className="toolbar">
        {card.status === 'active' ? (
          <>
            <button className="btn btn-secondary" onClick={() => onNavigate('sout-edit', card.id)}>
              Редактировать
            </button>{' '}
            <button className="link-action danger" onClick={handleArchive}>
              В архив
            </button>
          </>
        ) : (
          <button className="btn" onClick={handleRestore}>
            Восстановить из архива
          </button>
        )}{' '}
        <button className="link-action" onClick={() => onNavigate('sout')}>
          ← К реестру карт СОУТ
        </button>
      </p>

      <h1>Карта СОУТ № {card.card_number}</h1>
      {card.status === 'archived' && (
        <div className="alert" style={{ background: '#fefce8', borderColor: '#fef08a', color: '#854d0e' }}>
          Карта находится в архиве. Данные сохранены, но карта не участвует в активной аналитике.
        </div>
      )}

      {errorMsg && (
        <div className="alert" style={{ background: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b' }}>
          <strong>Ошибка:</strong> {errorMsg}
        </div>
      )}

      {/* Статус-плашка */}
      <div
        style={{
          display: 'inline-block',
          padding: '0.5rem 1rem',
          borderRadius: '6px',
          fontWeight: 700,
          marginBottom: '1rem',
          background: isHarmful ? '#fef2f2' : '#ecfdf5',
          color: isHarmful ? '#991b1b' : '#065f46',
          border: `1px solid ${isHarmful ? '#fecaca' : '#a7f3d0'}`,
        }}
      >
        {CLASS_NAMES[card.final_class] || `Класс ${card.final_class}`}
        {card.is_analogous && <span style={{ fontWeight: 400 }}> · рабочее место признано аналогичным</span>}
      </div>

      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.5rem 2rem', ...infoStyle }}>
        <div>
          <dt style={dtStyle}>Юридическое лицо</dt>
          <dd style={ddStyle}>{le ? le.full_name : '—'}</dd>
        </div>
        <div>
          <dt style={dtStyle}>Подразделение</dt>
          <dd style={ddStyle}>{dept?.name || '—'}</dd>
        </div>
        <div>
          <dt style={dtStyle}>Должность / рабочее место</dt>
          <dd style={ddStyle}>
            {pos?.name || '—'}
            {card.workplace_label ? <span className="muted"> ({card.workplace_label})</span> : null}
          </dd>
        </div>
        <div>
          <dt style={dtStyle}>Занятых работников</dt>
          <dd style={ddStyle}>
            {card.employees_count}
            <span className="muted" style={{ fontWeight: 400, fontSize: '0.85rem' }}>
              {' '}
              (женщин: {card.women_count}, несовершеннолетних: {card.minors_count}, инвалидов: {card.disabled_count})
            </span>
          </dd>
        </div>
        <div>
          <dt style={dtStyle}>Организация, проводившая измерения</dt>
          <dd style={ddStyle}>{card.measurement_org || '—'}</dd>
        </div>
        <div>
          <dt style={dtStyle}>Протокол измерений</dt>
          <dd style={ddStyle}>{card.protocol_number || '—'}</dd>
        </div>
        <div>
          <dt style={dtStyle}>Дата утверждения отчёта КОУТ</dt>
          <dd style={ddStyle}>{fmtDate(card.report_approved_at)}</dd>
        </div>
        <div>
          <dt style={dtStyle}>Срок действия карты (ст. 8 426-ФЗ)</dt>
          <dd style={ddStyle}>
            {card.declaration_active
              ? 'Бессрочно (декларация соответствия)'
              : card.expires_at
                ? `до ${fmtDate(card.expires_at)}`
                : 'не указан (дата отчёта не заполнена)'}
          </dd>
        </div>
        {card.declaration_active && (
          <div>
            <dt style={dtStyle}>Номер декларации соответствия (ст. 11 426-ФЗ)</dt>
            <dd style={ddStyle}>{card.declaration_number || '—'}</dd>
          </div>
        )}
        {card.is_analogous && card.analogous_basis && (
          <div>
            <dt style={dtStyle}>Основание аналогичности</dt>
            <dd style={ddStyle}>{card.analogous_basis}</dd>
          </div>
        )}
      </dl>

      <h2 style={{ marginTop: '1.5rem' }}>Идентифицированные вредные и опасные производственные факторы</h2>
      {card.factors.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Фактор</th>
              <th>Класс по фактору</th>
              <th>Примечание (результаты измерений)</th>
            </tr>
          </thead>
          <tbody>
            {card.factors.map((f, i) => (
              <tr key={i}>
                <td>{SOUT_FACTOR_LABELS_RU[f.type] || f.type}</td>
                <td>{f.class}</td>
                <td>{f.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">Вредные и опасные производственные факторы не выявлены.</p>
      )}

      <h2 style={{ marginTop: '1.5rem' }}>Гарантии и компенсации по ТК РФ</h2>
      <ul>
        <li>
          Сокращённая продолжительность рабочего времени (не более 36 ч/нед., ст. 92 ТК РФ):{' '}
          <strong>{g.reduced_hours ? 'установлена' : 'не установлена'}</strong>
        </li>
        <li>
          Ежегодный дополнительный оплачиваемый отпуск (ст. 117 ТК РФ):{' '}
          <strong>{g.extra_vacation_days > 0 ? `${g.extra_vacation_days} кал. дн.` : 'не установлен'}</strong>
        </li>
        <li>
          Повышенная оплата труда (ст. 147 ТК РФ):{' '}
          <strong>{g.pay_increase_percent > 0 ? `не менее ${g.pay_increase_percent}%` : 'не установлена'}</strong>
        </li>
        <li>
          Выдача молока / равноценных продуктов (ст. 222 ТК РФ): <strong>{g.milk_issue ? 'да' : 'нет'}</strong>
        </li>
        <li>
          Обеспечение СИЗ (ст. 221 ТК РФ): <strong>{g.ppe_issue ? 'да' : 'нет'}</strong>
        </li>
        <li>
          Досрочное пенсионное обеспечение: <strong>{g.early_pension ? 'применимо' : 'не применимо'}</strong>
        </li>
      </ul>

      <h2 style={{ marginTop: '1.5rem' }}>Ознакомление работников с результатами СОУТ (ст. 7, 5 426-ФЗ)</h2>
      <p className="muted" style={{ fontSize: '0.9rem' }}>
        Работник должен быть ознакомлен с результатами СОУТ его рабочего места в двухмесячный срок со дня подписания отчёта.
      </p>

      {card.status === 'active' && (
        <form onSubmit={handleFamiliarize} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: '260px', flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Работник *</label>
              <select
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', border: '1px solid #d0d7de', borderRadius: '4px' }}
              >
                <option value="">— выберите работника —</option>
                {employees
                  .filter(emp => !familiarizedIds.has(emp.id))
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.last_name} {emp.first_name} {emp.middle_name || ''}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Дата ознакомления</label>
              <input
                type="date"
                value={signedAt}
                onChange={e => setSignedAt(e.target.value)}
                style={{ padding: '0.4rem', border: '1px solid #d0d7de', borderRadius: '4px' }}
              />
            </div>
            <div style={{ minWidth: '200px', flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Комментарий</label>
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Напр. подпись в журнале №…"
                style={{ width: '100%', padding: '0.4rem', border: '1px solid #d0d7de', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <button type="submit" className="btn">Отметить ознакомление</button>
          </div>
        </form>
      )}

      {familiarizations.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Работник</th>
              <th>Дата ознакомления</th>
              <th>Комментарий</th>
              <th style={{ width: '120px' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {familiarizations.map(f => {
              const emp = storage.getEmployeeById(f.employee_id);
              return (
                <tr key={f.id}>
                  <td>{emp ? `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}` : f.employee_id}</td>
                  <td>{fmtDate(f.signed_at)}</td>
                  <td>{f.comment || '—'}</td>
                  <td>
                    <button className="link-action danger" onClick={() => handleRemoveFamiliarization(f.id)}>
                      Отменить
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="muted">Работники ещё не ознакомлены с данной картой СОУТ.</p>
      )}
    </div>
  );
};
