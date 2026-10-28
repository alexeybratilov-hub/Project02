import React, { useState } from 'react';
import { storage } from '../services/storage';
import {
  PPE_CATEGORY_LABELS_RU,
  PpeCategory,
} from '../types';

interface PpeNormFormProps {
  id?: string; // If edit mode
  onNavigate: (view: string, id?: string) => void;
}

export const PpeNormForm: React.FC<PpeNormFormProps> = ({ id, onNavigate }) => {
  const isEdit = !!id;
  const existingNorm = id ? storage.getPpeNormById(id) : null;
  const currentLe = storage.getCurrentLegalEntity();

  const [legalEntityId, setLegalEntityId] = useState<string>(
    existingNorm ? existingNorm.legal_entity_id : currentLe ? currentLe.id : ''
  );
  const [departmentId, setDepartmentId] = useState<string>(
    existingNorm?.department_id || ''
  );
  const [positionId, setPositionId] = useState<string>(
    existingNorm ? existingNorm.position_id : ''
  );
  const [ppeType, setPpeType] = useState<PpeCategory>(
    existingNorm ? existingNorm.ppe_type : 'clothing'
  );
  const [ppeName, setPpeName] = useState<string>(
    existingNorm ? existingNorm.ppe_name : ''
  );
  const [protectionProps, setProtectionProps] = useState<string>(
    existingNorm?.protection_properties || ''
  );
  const [quantity, setQuantity] = useState<string>(
    existingNorm ? String(existingNorm.quantity_per_period) : '1'
  );
  const [periodMonths, setPeriodMonths] = useState<string>(
    existingNorm ? String(existingNorm.period_months) : '12'
  );
  const [unit, setUnit] = useState<string>(
    existingNorm ? existingNorm.unit : 'шт.'
  );
  const [isDuty, setIsDuty] = useState<boolean>(
    existingNorm ? existingNorm.is_duty : false
  );
  const [normBasis, setNormBasis] = useState<string>(
    existingNorm?.norm_basis || ''
  );
  const [hazardOrFactor, setHazardOrFactor] = useState<string>(
    existingNorm?.hazard_or_factor || ''
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const departments = storage.getDepartments(legalEntityId);
  const positions = storage.getPositions();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      if (isEdit && existingNorm) {
        storage.updatePpeNorm(existingNorm.id, {
          legal_entity_id: legalEntityId,
          department_id: departmentId || null,
          position_id: positionId,
          ppe_type: ppeType,
          ppe_name: ppeName,
          protection_properties: protectionProps,
          quantity_per_period: Number(quantity) || 1,
          period_months: Number(periodMonths) || 0,
          unit,
          is_duty: isDuty,
          norm_basis: normBasis,
          hazard_or_factor: hazardOrFactor,
        });
        onNavigate('ppe');
      } else {
        storage.createPpeNorm({
          legal_entity_id: legalEntityId,
          department_id: departmentId || null,
          position_id: positionId,
          ppe_type: ppeType,
          ppe_name: ppeName,
          protection_properties: protectionProps,
          quantity_per_period: Number(quantity) || 1,
          period_months: Number(periodMonths) || 0,
          unit,
          is_duty: isDuty,
          norm_basis: normBasis,
          hazard_or_factor: hazardOrFactor,
        });
        onNavigate('ppe');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка сохранения нормы СИЗ');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => onNavigate('ppe')}
        className="text-sm text-blue-600 hover:underline mb-1 inline-block"
      >
        ← К реестру СИЗ
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {isEdit ? 'Редактирование нормы выдачи СИЗ' : 'Новая норма бесплатной выдачи СИЗ (ЕТН)'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Единые типовые нормы выдачи СИЗ и смывающих средств согласно Приказу Минтруда России № 767н
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg border border-slate-200 shadow-sm space-y-6">
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            1. Привязка к штатной структуре
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Юридическое лицо *
              </label>
              <select
                required
                value={legalEntityId}
                onChange={e => {
                  setLegalEntityId(e.target.value);
                  setDepartmentId('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
              >
                <option value="">-- Выберите организацию --</option>
                {legalEntities.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.short_name || l.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Подразделение (необязательно)
              </label>
              <select
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
              >
                <option value="">-- Для всей организации --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Должность / Профессия по ЕТН *
              </label>
              <select
                required
                value={positionId}
                onChange={e => setPositionId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
              >
                <option value="">-- Выберите должность из справочника --</option>
                {positions.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            2. Характеристики СИЗ и нормы выдачи
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Наименование СИЗ *
              </label>
              <input
                type="text"
                required
                value={ppeName}
                onChange={e => setPpeName(e.target.value)}
                placeholder="Например: Костюм для защиты от механических воздействий и истирания"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Вид (категория) СИЗ *
              </label>
              <select
                value={ppeType}
                onChange={e => setPpeType(e.target.value as PpeCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
              >
                {Object.entries(PPE_CATEGORY_LABELS_RU).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Защитные свойства / Маркировка
              </label>
              <input
                type="text"
                value={protectionProps}
                onChange={e => setProtectionProps(e.target.value)}
                placeholder="Ми, З, Мун200, Тн, Вн, К50"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Количество на период *
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                required
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Единица измерения *
              </label>
              <input
                type="text"
                required
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="шт., пар, компл., мл, туб"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Срок носки (период в месяцах) *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={periodMonths}
                onChange={e => setPeriodMonths(e.target.value)}
                placeholder="12 (0 — до износа)"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
              <span className="text-[11px] text-slate-500">
                0 означает «до износа» (для дежурных СИЗ, касок, очков)
              </span>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={isDuty}
                  onChange={e => setIsDuty(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>Дежурное СИЗ (общего пользования на рабочем месте)</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Основание нормы (пункт ЕТН / ЛНА)
              </label>
              <input
                type="text"
                value={normBasis}
                onChange={e => setNormBasis(e.target.value)}
                placeholder="Приказ 767н, Прил. 1, п. 12"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Опасность или вредный фактор (связь с ОПР/СОУТ)
              </label>
              <input
                type="text"
                value={hazardOrFactor}
                onChange={e => setHazardOrFactor(e.target.value)}
                placeholder="Механические воздействия, падение предметов..."
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onNavigate('ppe')}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded text-sm hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 shadow-sm"
          >
            {isEdit ? 'Сохранить изменения' : 'Добавить норму СИЗ'}
          </button>
        </div>
      </form>
    </div>
  );
};
