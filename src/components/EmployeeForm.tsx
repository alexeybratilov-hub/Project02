import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { normalizeSnils, validateDateNotFuture, findEmployeeDuplicates } from '../services/validation';

interface EmployeeFormProps {
  id?: string;
  onNavigate: (view: string, id?: string) => void;
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({ id, onNavigate }) => {
  const isEdit = Boolean(id);
  const currentLe = storage.getCurrentLegalEntity();

  const [legalEntityId, setLegalEntityId] = useState<string>(
    currentLe ? currentLe.id : ''
  );
  const [departmentId, setDepartmentId] = useState<string>('');
  const [positionId, setPositionId] = useState<string>('');
  const [contingentRecordId, setContingentRecordId] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [middleName, setMiddleName] = useState<string>('');
  const [hireDate, setHireDate] = useState<string>('');
  const [birthDate, setBirthDate] = useState<string>('');
  const [snils, setSnils] = useState<string>('');

  // Transfer metadata when editing
  const [originalDeptId, setOriginalDeptId] = useState<string>('');
  const [originalPosId, setOriginalPosId] = useState<string>('');
  const [originalContingentId, setOriginalContingentId] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('Кадровое перемещение');
  const [transferComment, setTransferComment] = useState<string>('');

  // Inline creation
  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [showAddPos, setShowAddPos] = useState(false);
  const [newPosName, setNewPosName] = useState('');

  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const departments = storage.getDepartments(legalEntityId || undefined);
  const positions = storage.getPositions();
  const contingentRecords = storage
    .getContingentRaw()
    .filter(c => c.status === 'active' && (!legalEntityId || c.legal_entity_id === legalEntityId));

  useEffect(() => {
    if (id) {
      const existing = storage.getEmployeeById(id);
      if (existing) {
        setLegalEntityId(existing.legal_entity_id);
        setDepartmentId(existing.department_id);
        setPositionId(existing.position_id);
        setContingentRecordId(existing.contingent_record_id || '');
        setLastName(existing.last_name);
        setFirstName(existing.first_name);
        setMiddleName(existing.middle_name || '');
        setHireDate(existing.hire_date || '');
        setBirthDate(existing.birth_date || '');
        setSnils(existing.snils || '');

        setOriginalDeptId(existing.department_id);
        setOriginalPosId(existing.position_id);
        setOriginalContingentId(existing.contingent_record_id || '');
      }
    } else if (!legalEntityId && legalEntities.length > 0) {
      setLegalEntityId(legalEntities[0].id);
    }
  }, [id]);

  // Check live duplicate warnings
  useEffect(() => {
    if (lastName.trim() && firstName.trim() && legalEntityId) {
      const all = storage.getEmployeesRaw();
      const dup = findEmployeeDuplicates(all, {
        legal_entity_id: legalEntityId,
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        middle_name: middleName.trim() || undefined,
        birth_date: birthDate || undefined,
        snils: snils.trim() || undefined,
        exclude_id: id,
      });
      setWarnings(dup.warnings);
    } else {
      setWarnings([]);
    }
  }, [legalEntityId, lastName, firstName, middleName, birthDate, snils, id]);

  const handleCreateDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    try {
      const created = storage.createDepartment({
        legal_entity_id: legalEntityId,
        name: newDeptName.trim(),
      });
      setDepartmentId(created.id);
      setNewDeptName('');
      setShowAddDept(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreatePos = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPosName.trim()) return;
    try {
      const created = storage.createPosition(newPosName.trim());
      setPositionId(created.id);
      setNewPosName('');
      setShowAddPos(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSnilsBlur = () => {
    if (!snils.trim()) return;
    try {
      const formatted = normalizeSnils(snils);
      if (formatted) setSnils(formatted);
    } catch (err: any) {
      // Don't wipe input on blur, user will see error on submit or can edit
    }
  };

  const isTransfer =
    isEdit &&
    (departmentId !== originalDeptId ||
      positionId !== originalPosId ||
      contingentRecordId !== originalContingentId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];

    if (!legalEntityId) errs.push('Выберите юридическое лицо.');
    if (!lastName.trim()) errs.push('Укажите фамилию работника.');
    if (!firstName.trim()) errs.push('Укажите имя работника.');
    if (!departmentId) errs.push('Выберите подразделение.');
    if (!positionId) errs.push('Выберите должность.');

    let normalizedSnilsVal: string | null = null;
    if (snils.trim()) {
      try {
        normalizedSnilsVal = normalizeSnils(snils);
      } catch (err: any) {
        errs.push(`СНИЛС: ${err.message}`);
      }
    }

    if (hireDate) {
      try {
        validateDateNotFuture(hireDate, 'Дата приёма');
      } catch (err: any) {
        errs.push(err.message);
      }
    }

    if (birthDate) {
      try {
        validateDateNotFuture(birthDate, 'Дата рождения');
      } catch (err: any) {
        errs.push(err.message);
      }
    }

    if (errs.length > 0) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      if (isEdit && id) {
        const res = storage.updateEmployee(id, {
          legal_entity_id: legalEntityId,
          department_id: departmentId,
          position_id: positionId,
          contingent_record_id: contingentRecordId || null,
          last_name: lastName.trim(),
          first_name: firstName.trim(),
          middle_name: middleName.trim() || null,
          hire_date: hireDate || null,
          birth_date: birthDate || null,
          snils: normalizedSnilsVal,
          transfer_reason: isTransfer ? transferReason.trim() : undefined,
          transfer_comment: isTransfer ? transferComment.trim() : undefined,
        });

        if (res.warnings.length > 0) {
          alert('Предупреждения:\n' + res.warnings.join('\n'));
        }
        onNavigate('employees-view', id);
      } else {
        const res = storage.createEmployee({
          legal_entity_id: legalEntityId,
          department_id: departmentId,
          position_id: positionId,
          contingent_record_id: contingentRecordId || null,
          last_name: lastName.trim(),
          first_name: firstName.trim(),
          middle_name: middleName.trim() || null,
          hire_date: hireDate || null,
          birth_date: birthDate || null,
          snils: normalizedSnilsVal,
        });

        if (res.warnings.length > 0) {
          alert('Работник сохранён с предупреждениями:\n' + res.warnings.join('\n'));
        }
        onNavigate('employees-view', res.employee.id);
      }
    } catch (err: any) {
      setErrors([err.message || 'Ошибка сохранения данных']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
            if (isEdit && id) onNavigate('employees-view', id);
            else onNavigate('employees');
          }}
        >
          ← {isEdit ? 'К карточке работника' : 'К реестру работников'}
        </a>
      </p>

      <h1>{isEdit ? 'Редактирование работника' : 'Новый работник'}</h1>
      <p style={{ color: '#4b5563', marginBottom: '1.25rem' }}>
        Заполните карточку работника. Согласно D-007 СНИЛС проверяется по контрольной сумме. Согласно D-005 смена подразделения или должности фиксируется в истории кадровых перемещений.
      </p>

      {errors.length > 0 && (
        <div className="alert" style={{ background: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b', marginBottom: '1rem' }}>
          <strong>Ошибки валидации:</strong>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="alert" style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#92400e', marginBottom: '1rem' }}>
          <strong>Обратите внимание (возможные дубликаты):</strong>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '1.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
        {/* Организация */}
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem' }}>
            Юридическое лицо *
          </label>
          <select
            value={legalEntityId}
            onChange={e => {
              setLegalEntityId(e.target.value);
              setDepartmentId('');
              setContingentRecordId('');
            }}
            style={{ width: '100%', padding: '0.5rem' }}
            required
            disabled={isEdit}
          >
            <option value="">-- Выберите организацию --</option>
            {legalEntities.map(le => (
              <option key={le.id} value={le.id}>
                {le.full_name} {le.inn ? `(ИНН: ${le.inn})` : ''}
              </option>
            ))}
          </select>
          {isEdit && (
            <small style={{ color: '#6b7280' }}>
              Юридическое лицо зафиксировано. Для смены организации переведите работника через увольнение и приём.
            </small>
          )}
        </div>

        {/* ФИО */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem' }}>
              Фамилия *
            </label>
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Иванов"
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem' }}>
              Имя *
            </label>
            <input
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="Иван"
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem' }}>
              Отчество
            </label>
            <input
              type="text"
              value={middleName}
              onChange={e => setMiddleName(e.target.value)}
              placeholder="Иванович"
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
        </div>

        {/* СНИЛС и Даты */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem' }}>
              СНИЛС (D-007)
            </label>
            <input
              type="text"
              value={snils}
              onChange={e => setSnils(e.target.value)}
              onBlur={handleSnilsBlur}
              placeholder="112-233-445 95"
              style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace' }}
            />
            <small style={{ color: '#6b7280' }}>
              11 цифр с контрольной суммой. Форматируется автоматически.
            </small>
          </div>

          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem' }}>
              Дата рождения
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem' }}>
              Дата приёма на работу
            </label>
            <input
              type="date"
              value={hireDate}
              onChange={e => setHireDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
        </div>

        <hr style={{ border: '0', borderTop: '1px solid #e5e7eb', margin: '1.5rem 0' }} />

        {/* Подразделение и должность */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          {/* Подразделение */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <label style={{ fontWeight: 600 }}>Подразделение *</label>
              <button
                type="button"
                className="link-action"
                style={{ fontSize: '0.85rem' }}
                onClick={() => setShowAddDept(!showAddDept)}
              >
                {showAddDept ? 'Отмена' : '+ Новое подразделение'}
              </button>
            </div>

            {showAddDept && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Название нового отдела..."
                  value={newDeptName}
                  onChange={e => setNewDeptName(e.target.value)}
                  style={{ flex: 1, padding: '0.4rem' }}
                />
                <button type="button" className="btn btn-secondary" onClick={handleCreateDept}>
                  Добавить
                </button>
              </div>
            )}

            <select
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
              required
            >
              <option value="">-- Выберите подразделение --</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Должность */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <label style={{ fontWeight: 600 }}>Должность *</label>
              <button
                type="button"
                className="link-action"
                style={{ fontSize: '0.85rem' }}
                onClick={() => setShowAddPos(!showAddPos)}
              >
                {showAddPos ? 'Отмена' : '+ Новая должность'}
              </button>
            </div>

            {showAddPos && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Название новой должности..."
                  value={newPosName}
                  onChange={e => setNewPosName(e.target.value)}
                  style={{ flex: 1, padding: '0.4rem' }}
                />
                <button type="button" className="btn btn-secondary" onClick={handleCreatePos}>
                  Добавить
                </button>
              </div>
            )}

            <select
              value={positionId}
              onChange={e => setPositionId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
              required
            >
              <option value="">-- Выберите должность --</option>
              {positions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Связь с контингентом (FR-09) */}
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem' }}>
            Позиция контингента охраны труда (FR-09)
          </label>
          <select
            value={contingentRecordId}
            onChange={e => setContingentRecordId(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option value="">-- Не привязан к позиции контингента --</option>
            {contingentRecords.map(c => {
              const cDept = departments.find(d => d.id === c.department_id);
              const cPos = positions.find(p => p.id === c.position_id);
              const label = c.workplace_label ? ` [${c.workplace_label}]` : '';
              return (
                <option key={c.id} value={c.id}>
                  {cPos?.name || 'Должность'} ({cDept?.name || 'Отдел'}){label}
                </option>
              );
            })}
          </select>
          <small style={{ color: '#6b7280' }}>
            Привязка к контингенту задаётся явно (FR-09). Автоматическое назначение без выбора пользователя отключено.
          </small>
        </div>

        {/* Блок кадрового перемещения при редактировании (D-005) */}
        {isTransfer && (
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '1rem', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem', color: '#0369a1' }}>
              Фиксация кадрового перемещения (D-005)
            </h4>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', color: '#0c4a6e' }}>
              Вы изменили подразделение, должность или привязку к контингенту. Предыдущий период работы будет закрыт текущей датой, и откроется новая запись в истории перемещений.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.2rem' }}>
                  Основание перевода / Приказ
                </label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  placeholder="Приказ о переводе №..."
                  style={{ width: '100%', padding: '0.4rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.2rem' }}>
                  Комментарий к перемещению
                </label>
                <input
                  type="text"
                  value={transferComment}
                  onChange={e => setTransferComment(e.target.value)}
                  placeholder="Служебная записка / соглашение..."
                  style={{ width: '100%', padding: '0.4rem' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Кнопки */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button type="submit" className="btn">
            {isEdit ? 'Сохранить изменения' : 'Создать работника'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (isEdit && id) onNavigate('employees-view', id);
              else onNavigate('employees');
            }}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};
