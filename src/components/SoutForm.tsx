import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import {
  SoutHarmfulFactor,
  SoutHarmfulFactorType,
  SOUT_FACTOR_LABELS_RU,
  SoutGuarantees,
} from '../types';

const VALID_CLASSES = ['1', '2', '3.1', '3.2', '3.3', '3.4', '4'];

// Те же правила расчёта гарантий, что и в слое хранения (storage.computeGuarantees)
function computeGuaranteesPreview(finalClass: string): SoutGuarantees {
  const order = VALID_CLASSES;
  const isHarm = (min: string) => order.indexOf(finalClass) >= order.indexOf(min) && finalClass !== '1' && finalClass !== '2';
  return {
    reduced_hours: finalClass === '3.3' || finalClass === '3.4' || finalClass === '4',
    extra_vacation_days: isHarm('3.2') ? 7 : 0,
    pay_increase_percent: isHarm('3.1') ? 4 : 0,
    milk_issue: isHarm('3.1'),
    early_pension: isHarm('3.2'),
    ppe_issue: isHarm('3.1'),
  };
}

function computeExpiryPreview(reportApprovedAt: string, declarationActive: boolean): string | null {
  if (declarationActive) return null;
  if (!reportApprovedAt) return null;
  const d = new Date(reportApprovedAt + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + 5);
  return d.toISOString().slice(0, 10);
}

interface SoutFormProps {
  onNavigate: (view: string, id?: string) => void;
  id?: string;
}

const CLASS_OPTIONS = ['1', '2', '3.1', '3.2', '3.3', '3.4', '4'];

export const SoutForm: React.FC<SoutFormProps> = ({ onNavigate, id }) => {
  const isEdit = Boolean(id);
  const existing = id ? storage.getSoutCardById(id) : null;

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const allPositions = storage.getPositionsRaw().filter(p => p.status === 'active');

  const [cardNumber, setCardNumber] = useState(existing?.card_number || '');
  const [leId, setLeId] = useState(existing?.legal_entity_id || (storage.getCurrentLegalEntity()?.id || ''));
  const [deptId, setDeptId] = useState(existing?.department_id || '');
  const [newDeptName, setNewDeptName] = useState('');
  const [posId, setPosId] = useState(existing?.position_id || '');
  const [newPosName, setNewPosName] = useState('');
  const [workplaceLabel, setWorkplaceLabel] = useState(existing?.workplace_label || '');
  const [isAnalogous, setIsAnalogous] = useState(existing?.is_analogous || false);
  const [analogousBasis, setAnalogousBasis] = useState(existing?.analogous_basis || '');
  const [factors, setFactors] = useState<SoutHarmfulFactor[]>(existing?.factors || []);
  const [finalClass, setFinalClass] = useState(existing?.final_class || '2');
  const [employeesCount, setEmployeesCount] = useState(String(existing?.employees_count ?? 1));
  const [womenCount, setWomenCount] = useState(String(existing?.women_count ?? 0));
  const [minorsCount, setMinorsCount] = useState(String(existing?.minors_count ?? 0));
  const [disabledCount, setDisabledCount] = useState(String(existing?.disabled_count ?? 0));
  const [measurementOrg, setMeasurementOrg] = useState(existing?.measurement_org || '');
  const [protocolNumber, setProtocolNumber] = useState(existing?.protocol_number || '');
  const [reportApprovedAt, setReportApprovedAt] = useState(existing?.report_approved_at || '');
  const [declarationActive, setDeclarationActive] = useState(existing?.declaration_active || false);
  const [declarationNumber, setDeclarationNumber] = useState(existing?.declaration_number || '');
  const [guaranteeOverrides, setGuaranteeOverrides] = useState<Partial<SoutGuarantees>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (id && !existing) {
      setErrorMsg('Карта СОУТ не найдена.');
    }
  }, [id]);

  if (!storage.isModuleEnabled('sout')) {
    return (
      <div>
        <h1>{isEdit ? 'Редактирование карты СОУТ' : 'Новая карта СОУТ'}</h1>
        <div className="alert">Модуль «СОУТ» отключён. Включите его в реестре модулей.</div>
      </div>
    );
  }

  const departments = leId ? storage.getDepartments(leId) : [];
  const autoGuarantees = computeGuaranteesPreview(finalClass);
  const effectiveGuarantees: SoutGuarantees = { ...autoGuarantees, ...guaranteeOverrides };

  const handleAddFactor = () => {
    setFactors(prev => [...prev, { type: 'noise', class: finalClass === '1' ? '2' : finalClass, note: null }]);
  };

  const handleFactorChange = (idx: number, patch: Partial<SoutHarmfulFactor>) => {
    setFactors(prev => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const handleFactorRemove = (idx: number) => {
    setFactors(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      let targetDeptId = deptId;
      let targetPosId = posId;

      // Инлайн-создание подразделения
      if (!targetDeptId && newDeptName.trim()) {
        if (!leId) throw new Error('Для создания подразделения выберите юридическое лицо.');
        const created = storage.createDepartment({ legal_entity_id: leId, name: newDeptName.trim() });
        targetDeptId = created.id;
      }
      // Инлайн-создание должности (D-013: глобальный справочник, дубликат возвращается)
      if (!targetPosId && newPosName.trim()) {
        const created = storage.createPosition(newPosName.trim());
        targetPosId = created.id;
      }

      const payload = {
        card_number: cardNumber,
        legal_entity_id: leId,
        department_id: targetDeptId,
        position_id: targetPosId,
        workplace_label: workplaceLabel || null,
        is_analogous: isAnalogous,
        analogous_basis: analogousBasis || null,
        factors,
        final_class: finalClass,
        employees_count: Number(employeesCount) || 0,
        women_count: Number(womenCount) || 0,
        minors_count: Number(minorsCount) || 0,
        disabled_count: Number(disabledCount) || 0,
        guarantees: guaranteeOverrides,
        measurement_org: measurementOrg || null,
        protocol_number: protocolNumber || null,
        report_approved_at: reportApprovedAt || null,
        declaration_active: declarationActive,
        declaration_number: declarationNumber || null,
      };

      let savedId: string;
      if (isEdit && existing) {
        const updated = storage.updateSoutCard(existing.id, payload);
        savedId = updated.id;
      } else {
        const created = storage.createSoutCard(payload);
        savedId = created.id;
      }
      onNavigate('sout-view', savedId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка сохранения карты СОУТ');
      window.scrollTo({ top: 0 });
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '0.45rem',
    border: '1px solid #d0d7de',
    borderRadius: '4px',
    width: '100%',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.3rem' };

  return (
    <div>
      <p>
        <a
          href="#back"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}
          onClick={e => {
            e.preventDefault();
            onNavigate(isEdit && existing ? 'sout-view' : 'sout', isEdit && existing ? existing.id : undefined);
          }}
        >
          ← Назад к карте
        </a>
      </p>

      <h1>{isEdit ? `Редактирование карты СОУТ № ${existing?.card_number || ''}` : 'Новая карта СОУТ'}</h1>
      <p style={{ color: '#4b5563', marginBottom: '1rem' }}>
        Специальная оценка условий труда (426-ФЗ). Гарантии и компенсации по ТК РФ рассчитываются автоматически по итоговому классу условий труда.
      </p>

      {errorMsg && (
        <div className="alert" style={{ background: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b' }}>
          <strong>Ошибка:</strong> {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '1.25rem' }}>
        {/* Привязка */}
        <fieldset style={{ border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '1rem', padding: '1rem' }}>
          <legend style={{ fontWeight: 700 }}>Рабочее место</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Номер карты СОУТ *</label>
              <input style={inputStyle} value={cardNumber} onChange={e => setCardNumber(e.target.value)} required placeholder="Напр. СОУТ-001" />
            </div>
            <div>
              <label style={labelStyle}>Юридическое лицо *</label>
              <select
                style={inputStyle}
                value={leId}
                onChange={e => {
                  setLeId(e.target.value);
                  setDeptId('');
                  setNewDeptName('');
                }}
                required
              >
                <option value="">— выберите —</option>
                {legalEntities.map(le => (
                  <option key={le.id} value={le.id}>{le.short_name || le.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Подразделение *</label>
              <select style={inputStyle} value={deptId} onChange={e => setDeptId(e.target.value)}>
                <option value="">— выберите или создайте ниже —</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <input
                style={{ ...inputStyle, marginTop: '0.4rem' }}
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
                placeholder="…или новое подразделение (будет создано)"
              />
            </div>
            <div>
              <label style={labelStyle}>Должность *</label>
              <select style={inputStyle} value={posId} onChange={e => setPosId(e.target.value)}>
                <option value="">— выберите или создайте ниже —</option>
                {allPositions.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                style={{ ...inputStyle, marginTop: '0.4rem' }}
                value={newPosName}
                onChange={e => setNewPosName(e.target.value)}
                placeholder="…или новая должность (в справочник)"
              />
            </div>
            <div>
              <label style={labelStyle}>Рабочее место (уточнение)</label>
              <input style={inputStyle} value={workplaceLabel} onChange={e => setWorkplaceLabel(e.target.value)} placeholder="Напр. Станок №3" />
            </div>
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={isAnalogous} onChange={e => setIsAnalogous(e.target.checked)} />
                Рабочее место признано аналогичным
              </label>
              {isAnalogous && (
                <input
                  style={inputStyle}
                  value={analogousBasis}
                  onChange={e => setAnalogousBasis(e.target.value)}
                  placeholder="Основание / реквизиты карты основного места"
                />
              )}
            </div>
          </div>
        </fieldset>

        {/* Факторы */}
        <fieldset style={{ border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '1rem', padding: '1rem' }}>
          <legend style={{ fontWeight: 700 }}>Идентифицированные вредные и опасные производственные факторы</legend>
          {factors.length === 0 && (
            <p className="muted" style={{ margin: '0 0 0.75rem' }}>Факторы не указаны (для классов 1–2 это допустимо).</p>
          )}
          {factors.map((f, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                style={{ ...inputStyle, width: '240px' }}
                value={f.type}
                onChange={e => handleFactorChange(idx, { type: e.target.value as SoutHarmfulFactorType })}
              >
                {(Object.keys(SOUT_FACTOR_LABELS_RU) as SoutHarmfulFactorType[]).map(t => (
                  <option key={t} value={t}>{SOUT_FACTOR_LABELS_RU[t]}</option>
                ))}
              </select>
              <select
                style={{ ...inputStyle, width: '120px' }}
                value={f.class}
                onChange={e => handleFactorChange(idx, { class: e.target.value })}
              >
                {CLASS_OPTIONS.map(c => (
                  <option key={c} value={c}>Класс {c}</option>
                ))}
              </select>
              <input
                style={{ ...inputStyle, flex: 1, minWidth: '180px' }}
                value={f.note || ''}
                onChange={e => handleFactorChange(idx, { note: e.target.value || null })}
                placeholder="Результаты измерений, ПДК/ПДУ…"
              />
              <button type="button" className="link-action danger" onClick={() => handleFactorRemove(idx)}>
                Удалить
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary" onClick={handleAddFactor}>
            + Добавить фактор
          </button>
        </fieldset>

        {/* Класс и численность */}
        <fieldset style={{ border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '1rem', padding: '1rem' }}>
          <legend style={{ fontWeight: 700 }}>Класс условий труда и занятые работники</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Итоговый класс условий труда *</label>
              <select style={inputStyle} value={finalClass} onChange={e => setFinalClass(e.target.value)} required>
                {CLASS_OPTIONS.map(c => (
                  <option key={c} value={c}>{c === '1' ? '1 — оптимальные' : c === '2' ? '2 — допустимые' : c === '4' ? '4 — опасные' : `3.${c.slice(2)} — вредные`}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Занятых работников</label>
              <input style={inputStyle} type="number" min={0} value={employeesCount} onChange={e => setEmployeesCount(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Из них женщин</label>
              <input style={inputStyle} type="number" min={0} value={womenCount} onChange={e => setWomenCount(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Из них несовершеннолетних</label>
              <input style={inputStyle} type="number" min={0} value={minorsCount} onChange={e => setMinorsCount(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Из них инвалидов</label>
              <input style={inputStyle} type="number" min={0} value={disabledCount} onChange={e => setDisabledCount(e.target.value)} />
            </div>
          </div>
        </fieldset>

        {/* Гарантии */}
        <fieldset style={{ border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '1rem', padding: '1rem', background: '#f8fafc' }}>
          <legend style={{ fontWeight: 700 }}>Гарантии и компенсации по ТК РФ (автоподстановка по классу {finalClass})</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.6rem', fontSize: '0.92rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={effectiveGuarantees.reduced_hours}
                onChange={e => setGuaranteeOverrides(p => ({ ...p, reduced_hours: e.target.checked }))}
              />
              Сокращённая рабочая неделя 36 ч (ст. 92 ТК РФ)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Доп. отпуск (ст. 117 ТК РФ), дней:</span>
              <input
                type="number"
                min={0}
                style={{ width: '80px', padding: '0.3rem', border: '1px solid #d0d7de', borderRadius: '4px' }}
                value={effectiveGuarantees.extra_vacation_days}
                onChange={e => setGuaranteeOverrides(p => ({ ...p, extra_vacation_days: Math.max(0, Number(e.target.value) || 0) }))}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Повышенная оплата (ст. 147 ТК РФ), %:</span>
              <input
                type="number"
                min={0}
                step={0.5}
                style={{ width: '80px', padding: '0.3rem', border: '1px solid #d0d7de', borderRadius: '4px' }}
                value={effectiveGuarantees.pay_increase_percent}
                onChange={e => setGuaranteeOverrides(p => ({ ...p, pay_increase_percent: Math.max(0, Number(e.target.value) || 0) }))}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={effectiveGuarantees.milk_issue}
                onChange={e => setGuaranteeOverrides(p => ({ ...p, milk_issue: e.target.checked }))}
              />
              Молоко / равноценные продукты (ст. 222 ТК РФ)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={effectiveGuarantees.ppe_issue}
                onChange={e => setGuaranteeOverrides(p => ({ ...p, ppe_issue: e.target.checked }))}
              />
              Обеспечение СИЗ (ст. 221 ТК РФ)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={effectiveGuarantees.early_pension}
                onChange={e => setGuaranteeOverrides(p => ({ ...p, early_pension: e.target.checked }))}
              />
              Досрочное пенсионное обеспечение
            </label>
          </div>
          <p className="muted" style={{ fontSize: '0.82rem', margin: '0.6rem 0 0' }}>
            Значения подставляются автоматически по классу условий труда; при необходимости скорректируйте вручную (не менее норм ТК РФ: отпуск ≥ 7 дн. для 3.2–4, оплата ≥ 4% для 3.1–4).
          </p>
        </fieldset>

        {/* Оформление и срок действия */}
        <fieldset style={{ border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '1rem', padding: '1rem' }}>
          <legend style={{ fontWeight: 700 }}>Оформление СОУТ и срок действия карты</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Организация, проводившая измерения</label>
              <input style={inputStyle} value={measurementOrg} onChange={e => setMeasurementOrg(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Номер протокола измерений</label>
              <input style={inputStyle} value={protocolNumber} onChange={e => setProtocolNumber(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Дата утверждения отчёта КОУТ</label>
              <input style={inputStyle} type="date" value={reportApprovedAt} onChange={e => setReportApprovedAt(e.target.value)} />
              {!declarationActive && reportApprovedAt && (
                <p className="muted" style={{ fontSize: '0.82rem', margin: '0.3rem 0 0' }}>
                  Карта действует 5 лет со дня утверждения отчёта (ст. 8 426-ФЗ) — до{' '}
                  {computeExpiryPreview(reportApprovedAt, false) || '—'}
                </p>
              )}
            </div>
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={declarationActive} onChange={e => setDeclarationActive(e.target.checked)} />
                Декларация соответствия зарегистрирована (ст. 11 426-ФЗ)
              </label>
              {declarationActive && (
                <input
                  style={inputStyle}
                  value={declarationNumber}
                  onChange={e => setDeclarationNumber(e.target.value)}
                  placeholder="Номер декларации"
                />
              )}
              {declarationActive && (
                <p style={{ fontSize: '0.82rem', margin: '0.3rem 0 0', color: '#065f46' }}>
                  Карта действует бессрочно при отсутствии несчастных случаев и предписаний ГИТ.
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <p>
          <button type="submit" className="btn">{isEdit ? 'Сохранить изменения' : 'Создать карту СОУТ'}</button>{' '}
          <button type="button" className="secondary" onClick={() => onNavigate(isEdit && existing ? 'sout-view' : 'sout', isEdit && existing ? existing.id : undefined)}>
            Отмена
          </button>
        </p>
      </form>
    </div>
  );
};
