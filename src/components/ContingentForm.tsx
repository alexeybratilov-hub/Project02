import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';

interface ContingentFormProps {
  id?: string;
  onNavigate: (view: string, id?: string) => void;
}

export const ContingentForm: React.FC<ContingentFormProps> = ({ id, onNavigate }) => {
  const isEdit = Boolean(id);
  const currentLe = storage.getCurrentLegalEntity();

  const [legalEntityId, setLegalEntityId] = useState<string>(
    currentLe ? currentLe.id : ''
  );
  const [departmentId, setDepartmentId] = useState<string>('');
  const [positionId, setPositionId] = useState<string>('');
  const [workplaceLabel, setWorkplaceLabel] = useState<string>('');
  const [workScheduleId, setWorkScheduleId] = useState<string>('');
  const [shiftPatternId, setShiftPatternId] = useState<string>('');
  const [riskCardNumber, setRiskCardNumber] = useState<string>('');
  const [soutCardNumber, setSoutCardNumber] = useState<string>('');
  const [workConditionSubclassId, setWorkConditionSubclassId] = useState<string>('');
  const [items29nStr, setItems29nStr] = useState<string>('');
  const [items342nStr, setItems342nStr] = useState<string>('');
  const [trainingProgram, setTrainingProgram] = useState<string>('');
  const [internshipProgram, setInternshipProgram] = useState<string>('');
  const [electricalSafetyGroupId, setElectricalSafetyGroupId] = useState<string>('');

  const [errors, setErrors] = useState<string[]>([]);

  // Inline add helpers
  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [showAddPos, setShowAddPos] = useState(false);
  const [newPosName, setNewPosName] = useState('');

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const departments = storage.getDepartments(legalEntityId || undefined);
  const positions = storage.getPositions();
  const schedules = storage.getWorkSchedules();
  const shifts = storage.getShiftPatterns();
  const subclasses = storage.getWorkConditionSubclasses();
  const elecGroups = storage.getElectricalSafetyGroups();

  useEffect(() => {
    if (id) {
      const existing = storage.getContingentRecordById(id);
      if (existing) {
        setLegalEntityId(existing.legal_entity_id);
        setDepartmentId(existing.department_id);
        setPositionId(existing.position_id);
        setWorkplaceLabel(existing.workplace_label || '');
        setWorkScheduleId(existing.work_schedule_id || '');
        setShiftPatternId(existing.shift_pattern_id || '');
        setRiskCardNumber(existing.risk_card_number || '');
        setSoutCardNumber(existing.sout_card_number || '');
        setWorkConditionSubclassId(existing.work_condition_subclass_id || '');
        setItems29nStr((existing.medical_items_29n || []).join('; '));
        setItems342nStr((existing.medical_items_342n || []).join('; '));
        setTrainingProgram(existing.training_program || '');
        setInternshipProgram(existing.internship_program || '');
        setElectricalSafetyGroupId(existing.electrical_safety_group_id || '');
      }
    } else if (!legalEntityId && legalEntities.length > 0) {
      setLegalEntityId(legalEntities[0].id);
    }
  }, [id]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const items29n = items29nStr
      .split(/[;,]/)
      .map(s => s.trim())
      .filter(Boolean);
    const items342n = items342nStr
      .split(/[;,]/)
      .map(s => s.trim())
      .filter(Boolean);

    try {
      if (isEdit && id) {
        const updated = storage.updateContingentRecord(id, {
          legal_entity_id: legalEntityId,
          department_id: departmentId,
          position_id: positionId,
          workplace_label: workplaceLabel || null,
          work_schedule_id: workScheduleId || null,
          shift_pattern_id: shiftPatternId || null,
          risk_card_number: riskCardNumber || null,
          sout_card_number: soutCardNumber || null,
          work_condition_subclass_id: workConditionSubclassId || null,
          medical_items_29n: items29n,
          medical_items_342n: items342n,
          training_program: trainingProgram || null,
          internship_program: internshipProgram || null,
          electrical_safety_group_id: electricalSafetyGroupId || null,
        });
        onNavigate('contingent-view', updated.id);
      } else {
        const created = storage.createContingentRecord({
          legal_entity_id: legalEntityId,
          department_id: departmentId,
          position_id: positionId,
          workplace_label: workplaceLabel || null,
          work_schedule_id: workScheduleId || null,
          shift_pattern_id: shiftPatternId || null,
          risk_card_number: riskCardNumber || null,
          sout_card_number: soutCardNumber || null,
          work_condition_subclass_id: workConditionSubclassId || null,
          medical_items_29n: items29n,
          medical_items_342n: items342n,
          training_program: trainingProgram || null,
          internship_program: internshipProgram || null,
          electrical_safety_group_id: electricalSafetyGroupId || null,
        });
        onNavigate('contingent-view', created.id);
      }
    } catch (err: any) {
      setErrors([err.message || 'Ошибка сохранения']);
    }
  };

  return (
    <div>
      <h1>
        {isEdit ? 'Изменение позиции контингента' : 'Новая запись в реестр контингента'}
      </h1>

      {errors.length > 0 && (
        <div className="alert">
          {errors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="legal_entity">Юридическое лицо *</label>
          <select
            id="legal_entity"
            required
            value={legalEntityId}
            onChange={e => {
              setLegalEntityId(e.target.value);
              setDepartmentId('');
            }}
          >
            <option value="">-- Выберите юридическое лицо --</option>
            {legalEntities.map(le => (
              <option key={le.id} value={le.id}>
                {le.full_name} ({le.inn || 'без ИНН'})
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="department">Структурное подразделение *</label>
            <button
              type="button"
              className="link-action"
              style={{ fontSize: '0.85rem' }}
              onClick={() => setShowAddDept(v => !v)}
            >
              + Добавить новое подразделение
            </button>
          </div>
          {showAddDept && (
            <div style={{ background: '#f8fafc', padding: '0.5rem', border: '1px solid #d0d7de', borderRadius: '4px', marginBottom: '0.4rem', display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Название подразделения..."
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
              />
              <button type="button" onClick={handleCreateDept}>
                Создать
              </button>
            </div>
          )}
          <select
            id="department"
            required
            value={departmentId}
            onChange={e => setDepartmentId(e.target.value)}
          >
            <option value="">-- Выберите подразделение --</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="position">Должность (профессия) *</label>
            <button
              type="button"
              className="link-action"
              style={{ fontSize: '0.85rem' }}
              onClick={() => setShowAddPos(v => !v)}
            >
              + Добавить новую должность
            </button>
          </div>
          {showAddPos && (
            <div style={{ background: '#f8fafc', padding: '0.5rem', border: '1px solid #d0d7de', borderRadius: '4px', marginBottom: '0.4rem', display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Наименование должности..."
                value={newPosName}
                onChange={e => setNewPosName(e.target.value)}
              />
              <button type="button" onClick={handleCreatePos}>
                Создать
              </button>
            </div>
          )}
          <select
            id="position"
            required
            value={positionId}
            onChange={e => setPositionId(e.target.value)}
          >
            <option value="">-- Выберите должность --</option>
            {positions.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="workplace_label">Рабочее место (уточнение)</label>
          <input
            id="workplace_label"
            type="text"
            placeholder="например: Кабинет 204, Участок упаковки, Автокран №3"
            value={workplaceLabel}
            onChange={e => setWorkplaceLabel(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '640px' }}>
          <div className="form-row" style={{ margin: 0 }}>
            <label htmlFor="work_schedule">График работы</label>
            <select
              id="work_schedule"
              value={workScheduleId}
              onChange={e => setWorkScheduleId(e.target.value)}
            >
              <option value="">-- Не указан --</option>
              {schedules.map(ws => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row" style={{ margin: 0 }}>
            <label htmlFor="shift_pattern">Сменность</label>
            <select
              id="shift_pattern"
              value={shiftPatternId}
              onChange={e => setShiftPatternId(e.target.value)}
            >
              <option value="">-- Не указана --</option>
              {shifts.map(sp => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '640px', marginTop: '0.75rem' }}>
          <div className="form-row" style={{ margin: 0 }}>
            <label htmlFor="sout_card">Номер карты СОУТ</label>
            <input
              id="sout_card"
              type="text"
              placeholder="например: 14/2023"
              value={soutCardNumber}
              onChange={e => setSoutCardNumber(e.target.value)}
            />
          </div>

          <div className="form-row" style={{ margin: 0 }}>
            <label htmlFor="subclass">Подкласс условий труда (СОУТ)</label>
            <select
              id="subclass"
              value={workConditionSubclassId}
              onChange={e => setWorkConditionSubclassId(e.target.value)}
            >
              <option value="">-- Не установлен --</option>
              {subclasses.map(sc => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="risk_card">Номер карты оценки профрисков (ОПР)</label>
          <input
            id="risk_card"
            type="text"
            placeholder="например: ОПР-2024-045"
            value={riskCardNumber}
            onChange={e => setRiskCardNumber(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="items29n">Номера пунктов по приказу № 29н (медосмотры)</label>
          <input
            id="items29n"
            type="text"
            placeholder="например: 1.1; 4.2.1; 18 (через точку с запятой)"
            value={items29nStr}
            onChange={e => setItems29nStr(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="items342n">Номера пунктов по приказу № 342н (психосвидетельствование)</label>
          <input
            id="items342n"
            type="text"
            placeholder="например: 1; 3; 8 (через точку с запятой)"
            value={items342nStr}
            onChange={e => setItems342nStr(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="training_program">Программа первичного инструктажа на рабочем месте</label>
          <textarea
            id="training_program"
            rows={2}
            placeholder="например: Программа проведения первичного инструктажа для слесаря-ремонтника № ПИ-04"
            value={trainingProgram}
            onChange={e => setTrainingProgram(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="internship_program">Программа стажировки на рабочем месте</label>
          <textarea
            id="internship_program"
            rows={2}
            placeholder="например: Программа стажировки № ПС-02 (2-14 смен)"
            value={internshipProgram}
            onChange={e => setInternshipProgram(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="elec_group">Группа по электробезопасности</label>
          <select
            id="elec_group"
            value={electricalSafetyGroupId}
            onChange={e => setElectricalSafetyGroupId(e.target.value)}
          >
            <option value="">-- Без группы --</option>
            {elecGroups.map(eg => (
              <option key={eg.id} value={eg.id}>
                {eg.name}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar" style={{ marginTop: '1.5rem' }}>
          <button className="btn" type="submit">
            Сохранить
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              if (isEdit && id) {
                onNavigate('contingent-view', id);
              } else {
                onNavigate('contingent');
              }
            }}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};
