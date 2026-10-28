import React, { useState } from 'react';
import { storage } from '../services/storage';
import {
  TRAINING_PROGRAM_CATEGORY_LABELS_RU,
  TRAINING_DEFAULT_RECURRING_MONTHS,
  TrainingProgramCategory,
} from '../types';

interface TrainingProgramFormProps {
  id?: string; // If edit mode
  onNavigate: (view: string, id?: string) => void;
}

export const TrainingProgramForm: React.FC<TrainingProgramFormProps> = ({ id, onNavigate }) => {
  const isEdit = !!id;
  const existingProgram = id ? storage.getTrainingProgramById(id) : null;
  const currentLe = storage.getCurrentLegalEntity();

  const [legalEntityId, setLegalEntityId] = useState<string>(
    existingProgram ? existingProgram.legal_entity_id : currentLe ? currentLe.id : ''
  );
  const [name, setName] = useState<string>(existingProgram ? existingProgram.name : '');
  const [category, setCategory] = useState<TrainingProgramCategory>(
    existingProgram ? existingProgram.category : 'program_a'
  );
  const [hours, setHours] = useState<string>(existingProgram ? String(existingProgram.hours) : '16');
  const [recurringMonths, setRecurringMonths] = useState<string>(
    existingProgram && existingProgram.recurring_months != null
      ? String(existingProgram.recurring_months)
      : ''
  );
  const [positions, setPositions] = useState<string>(existingProgram?.positions || '');
  const [basis, setBasis] = useState<string>(existingProgram?.basis || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;

  const minHoursHint =
    category === 'program_a' || category === 'program_b'
      ? 'Программы А и Б — не менее 16 часов (Постановление № 2464).'
      : category === 'first_aid' || category === 'ppe_use'
        ? 'Обучение первой помощи / применению СИЗ — не менее 8 часов.'
        : null;

  const defaultRecurring = TRAINING_DEFAULT_RECURRING_MONTHS[category];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      const recurring =
        recurringMonths.trim() === '' ? defaultRecurring : Number(recurringMonths);
      if (isEdit && existingProgram) {
        storage.updateTrainingProgram(existingProgram.id, {
          legal_entity_id: legalEntityId,
          name,
          category,
          hours: Number(hours) || 0,
          recurring_months: recurring,
          positions,
          basis,
        });
        onNavigate('training');
      } else {
        storage.createTrainingProgram({
          legal_entity_id: legalEntityId,
          name,
          category,
          hours: Number(hours) || 0,
          recurring_months: recurring,
          positions,
          basis,
        });
        onNavigate('training');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка сохранения программы обучения');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => onNavigate('training')}
        className="text-sm text-blue-600 hover:underline mb-1 inline-block"
      >
        ← К реестру обучения
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {isEdit ? 'Редактирование программы обучения' : 'Новая программа обучения по охране труда'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Программы проверки знаний требований охраны труда согласно Постановлению Правительства РФ от 24.12.2021 № 2464
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
            1. Привязка и наименование
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Юридическое лицо *</label>
              <select
                value={legalEntityId}
                onChange={e => setLegalEntityId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">— Выберите организацию —</option>
                {legalEntities.map(le => (
                  <option key={le.id} value={le.id}>
                    {le.short_name || le.full_name} (ИНН {le.inn})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Категория программы *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as TrainingProgramCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(TRAINING_PROGRAM_CATEGORY_LABELS_RU).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              {minHoursHint && <p className="text-[11px] text-amber-600">{minHoursHint}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Наименование программы *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Программа А. Общие вопросы охраны труда и функционирование СУОТ"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            2. Трудоемкость и периодичность
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Трудоемкость, часов *</label>
              <input
                type="number"
                min={1}
                step={1}
                value={hours}
                onChange={e => setHours(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Периодичность проверки знаний, мес.</label>
              <input
                type="number"
                min={0}
                step={1}
                value={recurringMonths}
                onChange={e => setRecurringMonths(e.target.value)}
                placeholder={defaultRecurring != null ? String(defaultRecurring) : 'без периодичности'}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-500">
                Пусто — значение по умолчанию:{' '}
                {defaultRecurring != null ? `${defaultRecurring} мес.` : 'без периодичности (разовое обучение)'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            3. Область применения
          </h2>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Должности / профессии (текст)</label>
            <textarea
              value={positions}
              onChange={e => setPositions(e.target.value)}
              rows={2}
              placeholder="Электромонтёры, слесари-ремонтники, водители автомобиля…"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Основание разработки</label>
            <input
              type="text"
              value={basis}
              onChange={e => setBasis(e.target.value)}
              placeholder="Постановление Правительства РФ № 2464; ЛНА № … от …"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="px-5 py-2 bg-blue-600 text-white rounded font-semibold text-sm hover:bg-blue-700 shadow-sm"
          >
            {isEdit ? 'Сохранить изменения' : 'Создать программу'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('training')}
            className="px-5 py-2 bg-slate-100 text-slate-700 rounded font-semibold text-sm hover:bg-slate-200"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};
