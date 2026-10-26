import React, { useState } from 'react';
import { storage } from '../services/storage';
import { OprMeasureItem, RISK_LEVEL_LABELS_RU } from '../types';
import { exportOprPlanToXLSX, formatDateForDisplay } from '../services/excel';

interface OprCardViewProps {
  id: string;
  onNavigate: (view: string, id?: string) => void;
}

export const OprCardView: React.FC<OprCardViewProps> = ({ id, onNavigate }) => {
  const card = storage.getOprCardById(id);
  const [measures, setMeasures] = useState<OprMeasureItem[]>(
    card ? storage.listOprMeasures(card.id) : []
  );

  // Состояние создания нового мероприятия
  const [measureTitle, setMeasureTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [responsible, setResponsible] = useState('');
  const [costEstimate, setCostEstimate] = useState('');
  const [comment, setComment] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!card) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Карта ОПР не найдена</h1>
        <p className="text-slate-600 mb-4">Запись с идентификатором «{id}» отсутствует или удалена.</p>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          onClick={() => onNavigate('opr')}
        >
          К реестру карт ОПР
        </button>
      </div>
    );
  }

  const le = storage.getLegalEntityById(card.legal_entity_id);
  const dept = storage.getDepartmentById(card.department_id);
  const pos = storage.getPositionById(card.position_id);

  const handleArchive = () => {
    if (!window.confirm(`Отправить карту ОПР № ${card.card_number} в архив?`)) return;
    try {
      storage.archiveOprCard(card.id);
      onNavigate('opr');
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestore = () => {
    try {
      storage.restoreOprCard(card.id);
      onNavigate('opr-view', card.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка восстановления');
    }
  };

  const handleAddMeasure = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!measureTitle.trim()) {
      setErrorMsg('Укажите наименование мероприятия по снижению риска.');
      return;
    }

    try {
      storage.createOprMeasure({
        opr_card_id: card.id,
        measure_title: measureTitle.trim(),
        deadline: deadline || null,
        responsible_person: responsible.trim() || null,
        cost_estimate: costEstimate.trim() || null,
        comment: comment.trim() || null,
        status: 'planned',
      });
      setMeasures(storage.listOprMeasures(card.id));
      setMeasureTitle('');
      setDeadline('');
      setResponsible('');
      setCostEstimate('');
      setComment('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка добавления мероприятия');
    }
  };

  const handleToggleMeasureStatus = (m: OprMeasureItem) => {
    const nextStatus: Record<string, 'planned' | 'in_progress' | 'completed'> = {
      planned: 'in_progress',
      in_progress: 'completed',
      completed: 'planned',
    };
    try {
      storage.updateOprMeasure(m.id, { status: nextStatus[m.status] });
      setMeasures(storage.listOprMeasures(card.id));
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка изменения статуса');
    }
  };

  const handleDeleteMeasure = (measureId: string) => {
    if (!window.confirm('Удалить мероприятие из плана?')) return;
    try {
      storage.deleteOprMeasure(measureId);
      setMeasures(storage.listOprMeasures(card.id));
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка удаления мероприятия');
    }
  };

  const handleExportPlan = () => {
    try {
      exportOprPlanToXLSX(measures, `plan_opr_${card.card_number}.xlsx`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка экспорта плана');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Шапка и навигация */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => onNavigate('opr')}
            className="text-sm text-blue-600 hover:underline mb-1 inline-block"
          >
            ← К реестру карт ОПР
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Карта ОПР № {card.card_number}</h1>
            {card.status === 'archived' && (
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-200 text-slate-600">
                В архиве
              </span>
            )}
            <span
              className={`px-3 py-1 rounded text-xs font-bold border ${
                RISK_LEVEL_LABELS_RU[card.overall_risk_level].badgeClass
              }`}
            >
              {RISK_LEVEL_LABELS_RU[card.overall_risk_level].name} (балл: {card.overall_risk_score})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Оценка профессиональных рисков по Приказу Минтруда России № 776н
          </p>
        </div>

        <div className="flex items-center gap-2">
          {card.status === 'active' ? (
            <>
              <button
                onClick={() => onNavigate('opr-edit', card.id)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 rounded text-xs font-semibold hover:bg-slate-50"
              >
                Редактировать
              </button>
              <button
                onClick={handleArchive}
                className="px-3.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs font-semibold hover:bg-rose-100"
              >
                В архив
              </button>
            </>
          ) : (
            <button
              onClick={handleRestore}
              className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs font-semibold hover:bg-emerald-100"
            >
              Восстановить из архива
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded text-sm">
          {errorMsg}
        </div>
      )}

      {/* Панель сведений о рабочем месте */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">
          Общие сведения о рабочем месте
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-6 text-sm">
          <div>
            <span className="text-xs text-slate-500 block">Организация (юрлицо):</span>
            <span className="font-semibold text-slate-800">{le?.full_name || '—'}</span>
            {le?.inn && <span className="text-xs text-slate-500 block">ИНН: {le.inn}</span>}
          </div>

          <div>
            <span className="text-xs text-slate-500 block">Подразделение:</span>
            <span className="font-semibold text-slate-800">{dept?.name || '—'}</span>
          </div>

          <div>
            <span className="text-xs text-slate-500 block">Должность / профессия:</span>
            <span className="font-semibold text-slate-800">{pos?.name || '—'}</span>
          </div>

          <div>
            <span className="text-xs text-slate-500 block">Рабочее место (уточнение):</span>
            <span className="text-slate-800">{card.workplace_label || 'Основное рабочее место'}</span>
          </div>

          <div>
            <span className="text-xs text-slate-500 block">Дата проведения оценки:</span>
            <span className="text-slate-800">{formatDateForDisplay(card.assessment_date) || '—'}</span>
          </div>

          <div>
            <span className="text-xs text-slate-500 block">Методика оценки:</span>
            <span className="text-slate-800">{card.assessment_method}</span>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <span className="text-xs text-slate-500 block">Состав комиссии:</span>
            <span className="text-slate-800">{card.commission_members || 'Не указан'}</span>
          </div>
        </div>
      </div>

      {/* Реестр идентифицированных опасностей */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Идентифицированные опасности и оценка рисков ({card.hazards.length})
          </h2>
          <span className="text-xs text-slate-500">
            {RISK_LEVEL_LABELS_RU[card.overall_risk_level].desc}
          </span>
        </div>

        {card.hazards.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            Опасности не идентифицированы.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3 w-8">№</th>
                  <th className="py-2.5 px-3">Категория</th>
                  <th className="py-2.5 px-3">Опасность</th>
                  <th className="py-2.5 px-3">Источник</th>
                  <th className="py-2.5 px-2 text-center" title="Тяжесть (1..5)">Т</th>
                  <th className="py-2.5 px-2 text-center" title="Вероятность (1..5)">В</th>
                  <th className="py-2.5 px-3 text-center">Балл</th>
                  <th className="py-2.5 px-3">Уровень риска</th>
                  <th className="py-2.5 px-3">Существующие меры</th>
                  <th className="py-2.5 px-3">Рекомендуемые меры</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {card.hazards.map((h, i) => (
                  <tr key={h.id || i} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-500">{i + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">{h.category}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{h.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{h.danger_source || '—'}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-slate-700">{h.severity}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-slate-700">{h.probability}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900">{h.risk_score}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          RISK_LEVEL_LABELS_RU[h.risk_level].badgeClass
                        }`}
                      >
                        {RISK_LEVEL_LABELS_RU[h.risk_level].name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs">{h.existing_measures || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-700 max-w-xs">{h.recommended_measures || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* План мероприятий по снижению рисков */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              План мероприятий по снижению уровней рисков ({measures.length})
            </h2>
            <p className="text-xs text-slate-500">
              Корректирующие и предупреждающие действия согласно ГОСТ 12.0.230.4-2018 и разделу IV Приказа 776н
            </p>
          </div>
          {measures.length > 0 && (
            <button
              onClick={handleExportPlan}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold border border-slate-300"
            >
              📥 Экспорт плана в Excel
            </button>
          )}
        </div>

        {/* Форма быстрого добавления мероприятия */}
        {card.status === 'active' && (
          <form onSubmit={handleAddMeasure} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase">Добавить мероприятие в план:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <input
                  type="text"
                  placeholder="Наименование мероприятия (например: установка защитного кожуха, проведение инструктажа)... *"
                  value={measureTitle}
                  onChange={e => setMeasureTitle(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white focus:outline-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5">Срок исполнения</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1 text-xs bg-white focus:outline-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5">Ответственный</label>
                <input
                  type="text"
                  placeholder="Главный механик, начальник цеха..."
                  value={responsible}
                  onChange={e => setResponsible(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1 text-xs bg-white focus:outline-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5">Ориентировочные затраты</label>
                <input
                  type="text"
                  placeholder="например: 15 000 руб. / без затрат"
                  value={costEstimate}
                  onChange={e => setCostEstimate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1 text-xs bg-white focus:outline-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <input
                type="text"
                placeholder="Комментарий / примечание..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="w-2/3 border border-slate-200 rounded px-2.5 py-1 text-xs bg-white focus:outline-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-sm"
              >
                + Добавить в план
              </button>
            </div>
          </form>
        )}

        {/* Таблица запланированных мероприятий */}
        {measures.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            Мероприятия по снижению профессиональных рисков пока не запланированы.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3 w-8">№</th>
                  <th className="py-2.5 px-3">Мероприятие</th>
                  <th className="py-2.5 px-3">Срок</th>
                  <th className="py-2.5 px-3">Ответственный</th>
                  <th className="py-2.5 px-3">Затраты</th>
                  <th className="py-2.5 px-3 text-center">Статус</th>
                  <th className="py-2.5 px-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {measures.map((m, i) => {
                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      Запланировано
                    </span>
                  );
                  if (m.status === 'in_progress') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        В работе
                      </span>
                    );
                  } else if (m.status === 'completed') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Выполнено
                      </span>
                    );
                  }

                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-500">{i + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {m.measure_title}
                        {m.comment && <span className="block text-[11px] font-normal text-slate-500">{m.comment}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        {formatDateForDisplay(m.deadline) || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{m.responsible_person || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{m.cost_estimate || '—'}</td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleMeasureStatus(m)}
                          title="Нажмите, чтобы сменить статус"
                          className="hover:opacity-80 transition-opacity"
                        >
                          {statusBadge}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteMeasure(m.id)}
                          className="text-rose-500 hover:text-rose-700 text-xs font-semibold"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
