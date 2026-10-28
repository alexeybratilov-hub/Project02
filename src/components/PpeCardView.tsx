import React, { useState } from 'react';
import { storage } from '../services/storage';
import {
  PPE_CATEGORY_LABELS_RU,
  PPE_RETURN_REASON_LABELS_RU,
  PpeCategory,
  PpeReturnReason,
  PpeIssuanceRecord,
} from '../types';

interface PpeCardViewProps {
  id: string;
  onNavigate: (view: string, id?: string) => void;
}

export const PpeCardView: React.FC<PpeCardViewProps> = ({ id, onNavigate }) => {
  const card = storage.getPpeCardById(id);
  const [, setRefreshTick] = useState(0);

  // Modal states for issue and return
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedIssuanceForReturn, setSelectedIssuanceForReturn] = useState<PpeIssuanceRecord | null>(null);

  // New issuance form state
  const [selectedNormId, setSelectedNormId] = useState<string>('');
  const [issuePpeName, setIssuePpeName] = useState('');
  const [issuePpeType, setIssuePpeType] = useState<PpeCategory>('clothing');
  const [issueProps, setIssueProps] = useState('');
  const [issueModel, setIssueModel] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [issueQty, setIssueQty] = useState('1');
  const [issueUnit, setIssueUnit] = useState('шт.');
  const [issueWearMonths, setIssueWearMonths] = useState('12');
  const [issueDoc, setIssueDoc] = useState('');
  const [issueError, setIssueError] = useState('');

  // Return form state
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnReason, setReturnReason] = useState<PpeReturnReason>('wear');
  const [returnComment, setReturnComment] = useState('');
  const [returnError, setReturnError] = useState('');

  if (!card) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Личная карточка СИЗ не найдена</h1>
        <p className="text-slate-600 mb-4">Запись с идентификатором «{id}» отсутствует или удалена.</p>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          onClick={() => onNavigate('ppe')}
        >
          ← К реестру СИЗ
        </button>
      </div>
    );
  }

  const le = storage.getLegalEntityById(card.legal_entity_id);
  const employee = storage.getEmployeeById(card.employee_id);
  const dept = employee ? storage.getDepartmentById(employee.department_id) : null;
  const pos = employee ? storage.getPositionById(employee.position_id) : null;

  // Applicable norms for employee's position
  const positionNorms = employee
    ? storage.listPpeNorms({
        legal_entity_id: card.legal_entity_id,
        position_id: employee.position_id,
        status: 'active',
        pageSize: 1000,
      }).items
    : [];

  // All issuances for this card
  const issuances = storage.listPpeIssuances(card.id);
  const today = new Date().toISOString().slice(0, 10);

  const handleNormSelect = (normId: string) => {
    setSelectedNormId(normId);
    if (!normId) return;
    const norm = positionNorms.find(n => n.id === normId);
    if (norm) {
      setIssuePpeName(norm.ppe_name);
      setIssuePpeType(norm.ppe_type);
      setIssueProps(norm.protection_properties || '');
      setIssueQty(String(norm.quantity_per_period));
      setIssueUnit(norm.unit);
      setIssueWearMonths(String(norm.period_months));
    }
  };

  const handleCreateIssuance = (e: React.FormEvent) => {
    e.preventDefault();
    setIssueError('');
    try {
      storage.createPpeIssuance({
        ppe_card_id: card.id,
        ppe_norm_item_id: selectedNormId || null,
        ppe_name: issuePpeName,
        ppe_type: issuePpeType,
        protection_properties: issueProps,
        model_or_article: issueModel,
        issue_date: issueDate,
        quantity: Number(issueQty) || 1,
        unit: issueUnit,
        wear_period_months: Number(issueWearMonths) || 0,
        doc_number: issueDoc,
      });
      setShowIssueModal(false);
      // Reset form
      setSelectedNormId('');
      setIssuePpeName('');
      setIssueProps('');
      setIssueModel('');
      setIssueDoc('');
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      setIssueError(err.message || 'Ошибка выдачи СИЗ');
    }
  };

  const openReturnModal = (iss: PpeIssuanceRecord) => {
    setSelectedIssuanceForReturn(iss);
    setReturnDate(new Date().toISOString().slice(0, 10));
    setReturnReason('wear');
    setReturnComment('');
    setReturnError('');
    setShowReturnModal(true);
  };

  const handleConfirmReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssuanceForReturn) return;
    setReturnError('');
    try {
      storage.returnPpeIssuance(selectedIssuanceForReturn.id, {
        actual_return_date: returnDate,
        return_reason: returnReason,
        return_reason_text: returnComment,
      });
      setShowReturnModal(false);
      setSelectedIssuanceForReturn(null);
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      setReturnError(err.message || 'Ошибка сдачи СИЗ');
    }
  };

  const handleArchiveCard = () => {
    if (!window.confirm(`Отправить карточку СИЗ № ${card.card_number} в архив?`)) return;
    try {
      storage.archivePpeCard(card.id);
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      alert(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestoreCard = () => {
    try {
      storage.restorePpeCard(card.id);
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      alert(err.message || 'Ошибка восстановления');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Шапка и навигация */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => onNavigate('ppe')}
            className="text-sm text-blue-600 hover:underline mb-1 inline-block"
          >
            ← К реестру СИЗ
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">
              Личная карточка № {card.card_number}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold border border-blue-200">
              Приказ Минтруда 766н
            </span>
            {card.status === 'archived' && (
              <span className="text-xs px-2.5 py-0.5 rounded bg-slate-200 text-slate-600 font-semibold">
                В архиве
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Учёт выдачи средств индивидуальной защиты и смывающих средств
          </p>
        </div>

        <div className="flex items-center gap-2">
          {card.status === 'active' && (
            <button
              onClick={() => setShowIssueModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5"
            >
              + Выдать СИЗ работнику
            </button>
          )}
          <button
            onClick={() => onNavigate('ppe-card-edit', card.id)}
            className="px-3 py-2 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200"
          >
            Редактировать размеры
          </button>
          {card.status === 'active' ? (
            <button
              onClick={handleArchiveCard}
              className="px-3 py-2 bg-rose-50 text-rose-700 rounded text-sm hover:bg-rose-100 border border-rose-200"
            >
              В архив
            </button>
          ) : (
            <button
              onClick={handleRestoreCard}
              className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded text-sm hover:bg-emerald-100 border border-emerald-200"
            >
              Восстановить
            </button>
          )}
        </div>
      </div>

      {/* Лицевая сторона: сведения о работнике и антропометрия */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Работник */}
        <div className="p-5 bg-white rounded-lg border border-slate-200 shadow-sm md:col-span-2 space-y-4">
          <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">
            Сведения о работнике (Лицевая сторона карточки)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-400 font-medium">ФИО работника</div>
              <div className="font-semibold text-slate-800 text-base mt-0.5">
                {employee
                  ? `${employee.last_name} ${employee.first_name} ${employee.middle_name || ''}`.trim()
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">СНИЛС</div>
              <div className="font-mono text-slate-700 mt-0.5">{employee?.snils || 'Не указан'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Юридическое лицо</div>
              <div className="text-slate-800 mt-0.5">{le?.short_name || le?.full_name || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Подразделение</div>
              <div className="text-slate-800 mt-0.5">{dept?.name || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Профессия / Должность</div>
              <div className="font-medium text-slate-800 mt-0.5">{pos?.name || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Дата приёма на работу</div>
              <div className="text-slate-800 mt-0.5">{employee?.hire_date || '—'}</div>
            </div>
          </div>
        </div>

        {/* Антропометрические данные */}
        <div className="p-5 bg-white rounded-lg border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">
            Антропометрия (Размеры)
          </h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500 text-xs">Рост:</span>
              <span className="font-semibold text-slate-800">{card.height ? `${card.height} см` : '—'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500 text-xs">Размер одежды:</span>
              <span className="font-semibold text-slate-800">{card.clothing_size || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500 text-xs">Размер обуви:</span>
              <span className="font-semibold text-slate-800">{card.shoe_size || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500 text-xs">Головной убор:</span>
              <span className="font-semibold text-slate-800">{card.headwear_size || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500 text-xs">Противогаз/Респиратор:</span>
              <span className="font-semibold text-slate-800">{card.gasmask_size || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 text-xs">Размер перчаток:</span>
              <span className="font-semibold text-slate-800">{card.gloves_size || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Оборотная сторона: табличная часть выданных СИЗ */}
      <div className="p-5 bg-white rounded-lg border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Выданные СИЗ (Оборотная сторона карточки)
            </h2>
            <p className="text-xs text-slate-500">
              Контроль сроков носки, периодичности выдачи и списания
            </p>
          </div>
          {card.status === 'active' && (
            <button
              onClick={() => setShowIssueModal(true)}
              className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold rounded hover:bg-blue-100 border border-blue-200"
            >
              + Выдать СИЗ
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
              <tr>
                <th className="py-2.5 px-3">Наименование СИЗ</th>
                <th className="py-2.5 px-3">Категория</th>
                <th className="py-2.5 px-3">Модель / Сертификат</th>
                <th className="py-2.5 px-3">Дата выдачи</th>
                <th className="py-2.5 px-3">Кол-во</th>
                <th className="py-2.5 px-3">Срок носки</th>
                <th className="py-2.5 px-3">Срок возврата/замены</th>
                <th className="py-2.5 px-3">Фактическая сдача</th>
                <th className="py-2.5 px-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {issuances.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Работнику пока не выдавалось ни одного СИЗ. Нажмите кнопку «Выдать СИЗ работнику».
                  </td>
                </tr>
              ) : (
                issuances.map(iss => {
                  const isReturned = !!iss.actual_return_date;
                  const isOverdue =
                    !isReturned && !!iss.due_return_date && iss.due_return_date < today;

                  return (
                    <tr
                      key={iss.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isReturned ? 'bg-slate-50/50 opacity-80' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{iss.ppe_name}</div>
                        {iss.protection_properties && (
                          <div className="text-xs text-slate-500">
                            Свойства: {iss.protection_properties}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {PPE_CATEGORY_LABELS_RU[iss.ppe_type] || iss.ppe_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">
                        {iss.model_or_article || '—'}
                        {iss.doc_number && (
                          <div className="text-slate-400">Док: {iss.doc_number}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-xs whitespace-nowrap text-slate-800 font-medium">
                        {iss.issue_date}
                      </td>
                      <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                        {iss.quantity} {iss.unit}
                      </td>
                      <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                        {iss.wear_period_months === 0 ? 'До износа' : `${iss.wear_period_months} мес.`}
                      </td>
                      <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                        {iss.due_return_date ? (
                          <div className="flex items-center gap-1.5">
                            <span className={isOverdue ? 'font-bold text-rose-600' : 'text-slate-800'}>
                              {iss.due_return_date}
                            </span>
                            {isOverdue && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                ПРОСРОЧЕНО
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">Бессрочно</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-xs">
                        {isReturned ? (
                          <div>
                            <span className="font-semibold text-slate-800">
                              {iss.actual_return_date}
                            </span>
                            <div className="text-slate-500">
                              {iss.return_reason ? PPE_RETURN_REASON_LABELS_RU[iss.return_reason] : 'Сдано'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-emerald-700 font-medium text-xs">В носке</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {!isReturned && card.status === 'active' && (
                          <button
                            onClick={() => openReturnModal(iss)}
                            className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs font-semibold hover:bg-amber-100"
                          >
                            Сдать / Списать
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальное окно: Выдать СИЗ работнику */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">Выдать СИЗ работнику</h3>
              <button
                onClick={() => setShowIssueModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {issueError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">
                {issueError}
              </div>
            )}

            <form onSubmit={handleCreateIssuance} className="space-y-3 text-sm">
              {positionNorms.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Заполнить по установленной норме ЕТН для должности:
                  </label>
                  <select
                    value={selectedNormId}
                    onChange={e => handleNormSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-slate-50"
                  >
                    <option value="">-- Выберите норму ЕТН или введите вручную --</option>
                    {positionNorms.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.ppe_name} ({n.quantity_per_period} {n.unit}, {n.period_months === 0 ? 'до износа' : `${n.period_months} мес.`})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Наименование СИЗ *
                  </label>
                  <input
                    type="text"
                    required
                    value={issuePpeName}
                    onChange={e => setIssuePpeName(e.target.value)}
                    placeholder="Например: Костюм для защиты от общих производственных загрязнений"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Вид СИЗ
                  </label>
                  <select
                    value={issuePpeType}
                    onChange={e => setIssuePpeType(e.target.value as PpeCategory)}
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Дата выдачи *
                  </label>
                  <input
                    type="date"
                    required
                    max={today}
                    value={issueDate}
                    onChange={e => setIssueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Количество *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={issueQty}
                    onChange={e => setIssueQty(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Единица измерения
                  </label>
                  <input
                    type="text"
                    value={issueUnit}
                    onChange={e => setIssueUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Срок носки (месяцев) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={issueWearMonths}
                    onChange={e => setIssueWearMonths(e.target.value)}
                    placeholder="0 — до износа"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Акт / Ведомость / Документ
                  </label>
                  <input
                    type="text"
                    value={issueDoc}
                    onChange={e => setIssueDoc(e.target.value)}
                    placeholder="Требование-накладная №..."
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Модель, артикул, сертификат (ТР ТС 019/2011)
                  </label>
                  <input
                    type="text"
                    value={issueModel}
                    onChange={e => setIssueModel(e.target.value)}
                    placeholder="Арт. 102-05, Сертификат ЕАЭС RU С-RU..."
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded text-sm hover:bg-slate-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700"
                >
                  Зафиксировать выдачу
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно: Сдача / списание СИЗ */}
      {showReturnModal && selectedIssuanceForReturn && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                Сдача / Списание СИЗ
              </h3>
              <button
                onClick={() => setShowReturnModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 p-2.5 bg-slate-50 rounded border border-slate-200">
              СИЗ: <strong className="text-slate-900">{selectedIssuanceForReturn.ppe_name}</strong>
              <br />
              Дата выдачи: {selectedIssuanceForReturn.issue_date} (
              {selectedIssuanceForReturn.quantity} {selectedIssuanceForReturn.unit})
            </div>

            {returnError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">
                {returnError}
              </div>
            )}

            <form onSubmit={handleConfirmReturn} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Фактическая дата сдачи *
                </label>
                <input
                  type="date"
                  required
                  min={selectedIssuanceForReturn.issue_date}
                  max={today}
                  value={returnDate}
                  onChange={e => setReturnDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Причина сдачи / списания *
                </label>
                <select
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value as PpeReturnReason)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                >
                  {Object.entries(PPE_RETURN_REASON_LABELS_RU).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Акт списания / Примечание
                </label>
                <textarea
                  rows={2}
                  value={returnComment}
                  onChange={e => setReturnComment(e.target.value)}
                  placeholder="Реквизиты акта осмотра / списания..."
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded text-sm hover:bg-slate-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white rounded text-sm font-semibold hover:bg-amber-700"
                >
                  Подтвердить сдачу
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
