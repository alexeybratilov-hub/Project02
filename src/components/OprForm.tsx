import React, { useState, useEffect } from 'react';
import { storage, DEFAULT_OPR_HAZARDS } from '../services/storage';
import { OprHazard, RiskLevel, RISK_LEVEL_LABELS_RU } from '../types';

interface OprFormProps {
  onNavigate: (view: string, id?: string) => void;
  id?: string;
}

const SEVERITY_OPTIONS = [
  { val: 1, label: '1 — Незначительная (микротравма без потери трудоспособности)' },
  { val: 2, label: '2 — Лёгкая (временная утрата трудоспособности до 15 дней)' },
  { val: 3, label: '3 — Средняя (временная утрата более 15 дней, стойкое расстройство)' },
  { val: 4, label: '4 — Тяжёлая (тяжёлая травма, инвалидность)' },
  { val: 5, label: '5 — Катастрофическая (смертельный исход, групповой случай)' },
];

const PROBABILITY_OPTIONS = [
  { val: 1, label: '1 — Маловероятно (крайне редкое событие)' },
  { val: 2, label: '2 — Низкая (возможно в исключительных обстоятельствах)' },
  { val: 3, label: '3 — Средняя (случается периодически на аналогичных производствах)' },
  { val: 4, label: '4 — Высокая (регулярно повторяющаяся ситуация)' },
  { val: 5, label: '5 — Постоянная (опасность присутствует непрерывно)' },
];

export const OprForm: React.FC<OprFormProps> = ({ onNavigate, id }) => {
  const isEdit = Boolean(id);
  const existing = id ? storage.getOprCardById(id) : null;

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const allPositions = storage.getPositionsRaw().filter(p => p.status === 'active');

  const [cardNumber, setCardNumber] = useState(existing?.card_number || '');
  const [leId, setLeId] = useState(existing?.legal_entity_id || (storage.getCurrentLegalEntity()?.id || ''));
  const [deptId, setDeptId] = useState(existing?.department_id || '');
  const [newDeptName, setNewDeptName] = useState('');
  const [posId, setPosId] = useState(existing?.position_id || '');
  const [newPosName, setNewPosName] = useState('');
  const [workplaceLabel, setWorkplaceLabel] = useState(existing?.workplace_label || '');
  const [assessmentDate, setAssessmentDate] = useState(
    existing?.assessment_date || new Date().toISOString().slice(0, 10)
  );
  const [assessmentMethod, setAssessmentMethod] = useState(
    existing?.assessment_method || 'Матричный метод (5x5, Приказ 776н)'
  );
  const [commissionMembers, setCommissionMembers] = useState(existing?.commission_members || '');
  const [hazards, setHazards] = useState<OprHazard[]>(existing?.hazards || []);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (id && !existing) {
      setErrorMsg('Карта ОПР не найдена.');
    }
  }, [id]);

  if (!storage.isModuleEnabled('opr')) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">{isEdit ? 'Редактирование карты ОПР' : 'Новая карта ОПР'}</h1>
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded">
          Модуль «ОПР» отключён. Включите его в реестре модулей.
        </div>
      </div>
    );
  }

  const departments = leId ? storage.getDepartments(leId) : [];

  // Вычисление итогового балла и уровня риска на лету
  const overallRisk = storage.computeOverallRisk(hazards);

  const handleAddTemplateHazard = () => {
    if (selectedTemplateIndex === '') return;
    const idx = parseInt(selectedTemplateIndex, 10);
    const tmpl = DEFAULT_OPR_HAZARDS[idx];
    if (!tmpl) return;

    const newH: OprHazard = {
      id: `hz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category: tmpl.category,
      name: tmpl.name,
      danger_source: tmpl.danger_source || null,
      severity: tmpl.default_severity,
      probability: tmpl.default_probability,
      risk_score: storage.computeRiskScore(tmpl.default_severity, tmpl.default_probability),
      risk_level: storage.computeRiskLevel(storage.computeRiskScore(tmpl.default_severity, tmpl.default_probability)),
      existing_measures: null,
      recommended_measures: tmpl.recommended_measures || null,
    };
    setHazards(prev => [...prev, newH]);
    setSelectedTemplateIndex('');
  };

  const handleAddCustomHazard = () => {
    const newH: OprHazard = {
      id: `hz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category: 'Механическая',
      name: 'Новая идентифицированная опасность',
      danger_source: null,
      severity: 2,
      probability: 2,
      risk_score: 4,
      risk_level: 'low',
      existing_measures: null,
      recommended_measures: null,
    };
    setHazards(prev => [...prev, newH]);
  };

  const handleHazardChange = (idx: number, patch: Partial<OprHazard>) => {
    setHazards(prev =>
      prev.map((h, i) => {
        if (i !== idx) return h;
        const updated = { ...h, ...patch };
        const sev = Number(updated.severity) || 1;
        const prob = Number(updated.probability) || 1;
        const score = storage.computeRiskScore(sev, prob);
        const level = storage.computeRiskLevel(score);
        return {
          ...updated,
          severity: sev,
          probability: prob,
          risk_score: score,
          risk_level: level,
        };
      })
    );
  };

  const handleRemoveHazard = (idx: number) => {
    setHazards(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      let targetDeptId = deptId;
      let targetPosId = posId;

      if (!targetDeptId && newDeptName.trim()) {
        if (!leId) throw new Error('Для создания подразделения выберите юридическое лицо.');
        const created = storage.createDepartment({ legal_entity_id: leId, name: newDeptName.trim() });
        targetDeptId = created.id;
      }

      if (!targetPosId && newPosName.trim()) {
        const created = storage.createPosition(newPosName.trim());
        targetPosId = created.id;
      }

      if (!cardNumber.trim()) throw new Error('Укажите номер карты ОПР.');
      if (!leId) throw new Error('Выберите юридическое лицо.');
      if (!targetDeptId) throw new Error('Выберите или введите структурное подразделение.');
      if (!targetPosId) throw new Error('Выберите или введите должность.');

      if (isEdit && id) {
        const updated = storage.updateOprCard(id, {
          card_number: cardNumber.trim(),
          legal_entity_id: leId,
          department_id: targetDeptId,
          position_id: targetPosId,
          workplace_label: workplaceLabel.trim() || null,
          assessment_date: assessmentDate || null,
          assessment_method: assessmentMethod.trim(),
          commission_members: commissionMembers.trim() || null,
          hazards,
        });
        onNavigate('opr-view', updated.id);
      } else {
        const created = storage.createOprCard({
          card_number: cardNumber.trim(),
          legal_entity_id: leId,
          department_id: targetDeptId,
          position_id: targetPosId,
          workplace_label: workplaceLabel.trim() || null,
          assessment_date: assessmentDate || null,
          assessment_method: assessmentMethod.trim(),
          commission_members: commissionMembers.trim() || null,
          hazards,
        });
        onNavigate('opr-view', created.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка сохранения карты ОПР.');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            type="button"
            onClick={() => onNavigate(isEdit && id ? 'opr-view' : 'opr', id)}
            className="text-sm text-blue-600 hover:underline mb-1 inline-block"
          >
            ← {isEdit ? 'Назад к карте' : 'Назад к реестру ОПР'}
          </button>
          <h1 className="text-2xl font-bold text-slate-800">
            {isEdit ? `Редактирование карты ОПР № ${existing?.card_number}` : 'Новая карта оценки рисков (ОПР)'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Идентификация опасностей и оценка профессиональных рисков по Приказу Минтруда России № 776н (матрица 5×5)
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500 block">Итоговый уровень риска:</span>
          <span
            className={`inline-block px-3 py-1 rounded text-sm font-semibold border ${
              RISK_LEVEL_LABELS_RU[overallRisk.level].badgeClass
            }`}
          >
            {RISK_LEVEL_LABELS_RU[overallRisk.level].name} (балл: {overallRisk.score})
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Секция 1: Основные сведения */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-800 border-b pb-2">1. Рабочее место и организация</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Юридическое лицо <span className="text-rose-500">*</span>
              </label>
              <select
                value={leId}
                onChange={e => {
                  setLeId(e.target.value);
                  setDeptId('');
                }}
                required
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              >
                <option value="">-- Выберите организацию --</option>
                {legalEntities.map(le => (
                  <option key={le.id} value={le.id}>
                    {le.short_name || le.full_name} {le.inn ? `(ИНН: ${le.inn})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Номер карты ОПР <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={cardNumber}
                onChange={e => setCardNumber(e.target.value)}
                placeholder="например: ОПР-001 или 01-ПР"
                required
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Структурное подразделение <span className="text-rose-500">*</span>
              </label>
              <select
                value={deptId}
                onChange={e => setDeptId(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500 mb-1"
              >
                <option value="">-- Выберите подразделение --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="или введите новое подразделение..."
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
                className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Должность / профессия <span className="text-rose-500">*</span>
              </label>
              <select
                value={posId}
                onChange={e => setPosId(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500 mb-1"
              >
                <option value="">-- Выберите должность из справочника --</option>
                {allPositions.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="или введите новую должность..."
                value={newPosName}
                onChange={e => setNewPosName(e.target.value)}
                className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Рабочее место (уточнение, локация)
              </label>
              <input
                type="text"
                value={workplaceLabel}
                onChange={e => setWorkplaceLabel(e.target.value)}
                placeholder="например: Кабинет 204, Токарный станок 16К20, Территория склада"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Дата оценки</label>
              <input
                type="date"
                value={assessmentDate}
                onChange={e => setAssessmentDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Методика оценки риска</label>
              <input
                type="text"
                value={assessmentMethod}
                onChange={e => setAssessmentMethod(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Состав комиссии по оценке</label>
              <input
                type="text"
                value={commissionMembers}
                onChange={e => setCommissionMembers(e.target.value)}
                placeholder="ФИО и должности членов комиссии"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Секция 2: Интерактивная матрица рисков 5х5 */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                2. Идентифицированные опасности и оценка ({hazards.length})
              </h2>
              <p className="text-xs text-slate-500">
                Балл риска = Тяжесть (1..5) × Вероятность (1..5). Градации: 1–4 (Низкий), 5–9 (Умеренный), 10–15 (Высокий), 16–25 (Недопустимый).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedTemplateIndex}
                onChange={e => setSelectedTemplateIndex(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-blue-500 max-w-[220px]"
              >
                <option value="">-- Выбрать типовую (776н) --</option>
                {DEFAULT_OPR_HAZARDS.map((h, i) => (
                  <option key={i} value={i}>
                    [{h.category}] {h.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddTemplateHazard}
                disabled={selectedTemplateIndex === ''}
                className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs hover:bg-blue-100 disabled:opacity-40"
              >
                + Добавить
              </button>
              <button
                type="button"
                onClick={handleAddCustomHazard}
                className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs hover:bg-slate-200"
              >
                + Своя опасность
              </button>
            </div>
          </div>

          {hazards.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-slate-50 border border-dashed rounded text-sm">
              На этом рабочем месте пока не добавлено ни одной опасности.
              <br />
              Выберите типовую опасность из классификатора Минтруда или нажмите «+ Своя опасность».
            </div>
          ) : (
            <div className="space-y-4">
              {hazards.map((h, idx) => (
                <div key={h.id || idx} className="p-4 border rounded-lg bg-slate-50 relative space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={h.category}
                        onChange={e => handleHazardChange(idx, { category: e.target.value })}
                        placeholder="Категория (Механическая, Термическая...)"
                        className="border border-slate-200 rounded px-2 py-0.5 text-xs font-semibold text-slate-700 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded border font-medium ${
                          RISK_LEVEL_LABELS_RU[h.risk_level].badgeClass
                        }`}
                      >
                        {RISK_LEVEL_LABELS_RU[h.risk_level].name} (балл: {h.risk_score})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHazard(idx)}
                        className="text-rose-500 hover:text-rose-700 text-xs font-bold"
                        title="Удалить опасность"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Наименование опасности <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={h.name}
                        onChange={e => handleHazardChange(idx, { name: e.target.value })}
                        required
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Источник опасности
                      </label>
                      <input
                        type="text"
                        value={h.danger_source || ''}
                        onChange={e => handleHazardChange(idx, { danger_source: e.target.value })}
                        placeholder="Оборудование, процессы, предметы труда..."
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-2.5 rounded border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Тяжесть последствий (Т)
                      </label>
                      <select
                        value={h.severity}
                        onChange={e => handleHazardChange(idx, { severity: Number(e.target.value) })}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-blue-500"
                      >
                        {SEVERITY_OPTIONS.map(opt => (
                          <option key={opt.val} value={opt.val}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Вероятность возникновения (В)
                      </label>
                      <select
                        value={h.probability}
                        onChange={e => handleHazardChange(idx, { probability: Number(e.target.value) })}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-blue-500"
                      >
                        {PROBABILITY_OPTIONS.map(opt => (
                          <option key={opt.val} value={opt.val}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Существующие меры контроля
                      </label>
                      <input
                        type="text"
                        value={h.existing_measures || ''}
                        onChange={e => handleHazardChange(idx, { existing_measures: e.target.value })}
                        placeholder="Инструктажи, применение СИЗ, ограждения..."
                        className="w-full border border-slate-200 rounded px-2.5 py-1 text-xs bg-white focus:outline-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Рекомендуемые меры по снижению риска
                      </label>
                      <input
                        type="text"
                        value={h.recommended_measures || ''}
                        onChange={e => handleHazardChange(idx, { recommended_measures: e.target.value })}
                        placeholder="Модернизация, внеочередное обучение, замена оборудования..."
                        className="w-full border border-slate-200 rounded px-2.5 py-1 text-xs bg-white focus:outline-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Секция 3: Наглядная матрица 5х5 */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800 mb-3">
            3. Визуальная матрица распределения рисков (5×5)
          </h2>
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              <div className="grid grid-cols-6 gap-1 text-center text-xs">
                {/* Заголовок столбцов */}
                <div className="p-2 font-bold text-slate-400 text-right">Т \ В</div>
                {[1, 2, 3, 4, 5].map(prob => (
                  <div key={prob} className="p-1 font-semibold text-slate-600 bg-slate-100 rounded">
                    В={prob}
                  </div>
                ))}

                {/* Строки тяжести от 5 до 1 */}
                {[5, 4, 3, 2, 1].map(sev => (
                  <React.Fragment key={sev}>
                    <div className="p-1.5 font-semibold text-slate-600 bg-slate-100 rounded flex items-center justify-end pr-2">
                      Т={sev}
                    </div>
                    {[1, 2, 3, 4, 5].map(prob => {
                      const score = sev * prob;
                      const level = storage.computeRiskLevel(score);
                      const matchingHazards = hazards.filter(h => h.severity === sev && h.probability === prob);
                      const count = matchingHazards.length;

                      let cellBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                      if (level === 'moderate') cellBg = 'bg-amber-50 text-amber-800 border-amber-200';
                      if (level === 'high') cellBg = 'bg-orange-50 text-orange-800 border-orange-200';
                      if (level === 'unacceptable') cellBg = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';

                      return (
                        <div
                          key={prob}
                          className={`p-2 border rounded text-center transition-all ${cellBg} relative flex flex-col items-center justify-center min-h-[46px]`}
                          title={`Тяжесть: ${sev}, Вероятность: ${prob}, Балл: ${score} (${RISK_LEVEL_LABELS_RU[level].name})`}
                        >
                          <span className="text-[10px] opacity-75">{score}</span>
                          {count > 0 && (
                            <span className="mt-0.5 px-1.5 py-0.2 rounded-full bg-slate-900 text-white text-[10px] font-bold shadow-sm">
                              {count} оп.
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-600 border-t pt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block"></span>
              1–4: Низкий
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block"></span>
              5–9: Умеренный
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-orange-100 border border-orange-300 inline-block"></span>
              10–15: Высокий
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-200 border border-rose-300 inline-block"></span>
              16–25: Недопустимый
            </span>
          </div>
        </div>

        {/* Действия формы */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate(isEdit && id ? 'opr-view' : 'opr', id)}
            className="px-4 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-100"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 shadow-sm"
          >
            {isEdit ? 'Сохранить изменения' : 'Создать карту ОПР'}
          </button>
        </div>
      </form>
    </div>
  );
};
