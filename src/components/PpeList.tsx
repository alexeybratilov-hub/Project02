import React, { useState } from 'react';
import { storage } from '../services/storage';
import {
  exportPpeNormsToXLSX,
  exportPpeNormsToCSV,
  exportPpeCardsToXLSX,
  exportPpeCardsToCSV,
} from '../services/excel';
import {
  EntityStatus,
  PpeCategory,
  PPE_CATEGORY_LABELS_RU,
  PpeNormItem,
  PpeCard,
} from '../types';

interface PpeListProps {
  onNavigate: (view: string, id?: string) => void;
  filterLeId?: string;
}

export const PpeList: React.FC<PpeListProps> = ({ onNavigate, filterLeId }) => {
  const moduleEnabled = storage.isModuleEnabled('ppe');
  const currentLe = storage.getCurrentLegalEntity();
  const [activeTab, setActiveTab] = useState<'cards' | 'norms'>('cards');

  const [selectedLeId, setSelectedLeId] = useState<string>(
    filterLeId || (currentLe ? currentLe.id : '')
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [status, setStatus] = useState<EntityStatus>('active');
  const [page, setPage] = useState(1);
  const [, setRefreshTick] = useState(0);
  const pageSize = 25;

  if (!moduleEnabled) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Средства индивидуальной защиты (СИЗ)</h1>
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          Модуль «СИЗ» отключён. Включите его в{' '}
          <a
            href="#modules"
            className="text-blue-600 underline font-semibold"
            onClick={e => {
              e.preventDefault();
              onNavigate('modules');
            }}
          >
            реестре модулей
          </a>
          . Все данные личных карточек и норм ЕТН сохранены и станут доступны сразу после включения.
        </div>
      </div>
    );
  }

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const positions = storage.getPositionsRaw();
  const departments = storage.getDepartmentsRaw();
  const employees = storage.getEmployeesRaw();
  const allIssuances = storage.getPpeIssuancesRaw();
  const { overdue: allOverdue, upcoming: allUpcoming } = storage.constructor
    ? (storage.constructor as any).checkPpeOverdue(allIssuances)
    : { overdue: [], upcoming: [] };

  const leMap = new Map(legalEntities.map(l => [l.id, l]));
  const posMap = new Map(positions.map(p => [p.id, p]));
  const deptMap = new Map(departments.map(d => [d.id, d]));
  const empMap = new Map(employees.map(e => [e.id, e]));

  // Data for active tab
  const cardsResult = storage.listPpeCards({
    search: activeSearch,
    legal_entity_id: selectedLeId || undefined,
    has_overdue: onlyOverdue || undefined,
    status,
    page: activeTab === 'cards' ? page : 1,
    pageSize,
  });

  const normsResult = storage.listPpeNorms({
    search: activeSearch,
    legal_entity_id: selectedLeId || undefined,
    ppe_type: (selectedCategory as PpeCategory) || undefined,
    status,
    page: activeTab === 'norms' ? page : 1,
    pageSize,
  });

  const currentItems = activeTab === 'cards' ? cardsResult.items : normsResult.items;
  const currentTotal = activeTab === 'cards' ? cardsResult.total : normsResult.total;
  const totalPages = Math.max(1, Math.ceil(currentTotal / pageSize));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedLeId(currentLe ? currentLe.id : '');
    setSelectedCategory('');
    setOnlyOverdue(false);
    setSearchQuery('');
    setActiveSearch('');
    setPage(1);
  };

  const handleExportXLSX = () => {
    if (activeTab === 'cards') {
      const allCards = storage.listPpeCards({
        legal_entity_id: selectedLeId || undefined,
        status,
        pageSize: 100000,
      }).items;
      exportPpeCardsToXLSX(allCards, leMap, empMap);
    } else {
      const allNorms = storage.listPpeNorms({
        legal_entity_id: selectedLeId || undefined,
        status,
        pageSize: 100000,
      }).items;
      exportPpeNormsToXLSX(allNorms, leMap, posMap, deptMap);
    }
  };

  const handleExportCSV = () => {
    if (activeTab === 'cards') {
      const allCards = storage.listPpeCards({
        legal_entity_id: selectedLeId || undefined,
        status,
        pageSize: 100000,
      }).items;
      exportPpeCardsToCSV(allCards, leMap, empMap);
    } else {
      const allNorms = storage.listPpeNorms({
        legal_entity_id: selectedLeId || undefined,
        status,
        pageSize: 100000,
      }).items;
      exportPpeNormsToCSV(allNorms, leMap, posMap, deptMap);
    }
  };

  const handleArchiveCard = (c: PpeCard) => {
    if (!window.confirm(`Отправить карточку СИЗ № ${c.card_number} в архив?`)) return;
    try {
      storage.archivePpeCard(c.id);
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      alert(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestoreCard = (c: PpeCard) => {
    try {
      storage.restorePpeCard(c.id);
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      alert(err.message || 'Ошибка восстановления');
    }
  };

  const handleArchiveNorm = (n: PpeNormItem) => {
    if (!window.confirm(`Отправить норму «${n.ppe_name}» в архив?`)) return;
    try {
      storage.archivePpeNorm(n.id);
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      alert(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestoreNorm = (n: PpeNormItem) => {
    try {
      storage.restorePpeNorm(n.id);
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      alert(err.message || 'Ошибка восстановления');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Заголовок и основные кнопки */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Средства индивидуальной защиты (СИЗ)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Правила обеспечения по Приказу Минтруда № 766н и Единые типовые нормы выдачи (ЕТН) № 767н
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'cards' ? (
            <>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700 flex items-center gap-1.5"
                onClick={() => onNavigate('ppe-card-new')}
              >
                + Новая карточка СИЗ
              </button>
              <button
                className="px-3 py-2 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200"
                onClick={() => onNavigate('ppe-import', 'cards')}
              >
                Импорт карточек
              </button>
            </>
          ) : (
            <>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700 flex items-center gap-1.5"
                onClick={() => onNavigate('ppe-norm-new')}
              >
                + Добавить норму СИЗ
              </button>
              <button
                className="px-3 py-2 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200"
                onClick={() => onNavigate('ppe-import', 'norms')}
              >
                Импорт норм ЕТН
              </button>
            </>
          )}
          <button
            className="px-3 py-2 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200"
            onClick={handleExportXLSX}
          >
            Экспорт Excel
          </button>
          <button
            className="px-3 py-2 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200"
            onClick={handleExportCSV}
          >
            CSV
          </button>
        </div>
      </div>

      {/* KPI показатели */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Личных карточек</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">
            {cardsResult.total}
          </div>
          <div className="text-xs text-slate-400 mt-1">активных в реестре</div>
        </div>
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Норм выдачи (ЕТН)</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {normsResult.total}
          </div>
          <div className="text-xs text-slate-400 mt-1">позиций номенклатуры</div>
        </div>
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Просрочено к замене</div>
          <div className={`text-2xl font-bold mt-1 ${allOverdue.length > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {allOverdue.length}
          </div>
          <div className="text-xs text-slate-400 mt-1">требуют выдачи/списания</div>
        </div>
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Замена в течение 30 дней</div>
          <div className={`text-2xl font-bold mt-1 ${allUpcoming.length > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
            {allUpcoming.length}
          </div>
          <div className="text-xs text-slate-400 mt-1">плановый контроль</div>
        </div>
      </div>

      {/* Переключатель вкладок */}
      <div className="border-b border-slate-200 flex items-center justify-between">
        <div className="flex gap-4">
          <button
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'cards'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => {
              setActiveTab('cards');
              setPage(1);
            }}
          >
            Личные карточки работников ({cardsResult.total})
          </button>
          <button
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'norms'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => {
              setActiveTab('norms');
              setPage(1);
            }}
          >
            Нормы бесплатной выдачи ЕТН ({normsResult.total})
          </button>
        </div>

        {/* Статус актив/архив */}
        <div className="flex items-center gap-1 mb-2 bg-slate-100 p-1 rounded-md text-xs">
          <button
            className={`px-3 py-1 rounded font-medium ${
              status === 'active' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => {
              setStatus('active');
              setPage(1);
            }}
          >
            Активные
          </button>
          <button
            className={`px-3 py-1 rounded font-medium ${
              status === 'archived' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => {
              setStatus('archived');
              setPage(1);
            }}
          >
            Архив
          </button>
        </div>
      </div>

      {/* Панель фильтров и поиска */}
      <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <input
              type="text"
              placeholder={
                activeTab === 'cards'
                  ? 'Поиск по номеру карточки, ФИО работника или СНИЛС...'
                  : 'Поиск по наименованию СИЗ, должности, основанию ЕТН...'
              }
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="min-w-[180px]">
            <select
              value={selectedLeId}
              onChange={e => {
                setSelectedLeId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
            >
              <option value="">Все организации</option>
              {legalEntities.map(l => (
                <option key={l.id} value={l.id}>
                  {l.short_name || l.full_name}
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'norms' && (
            <div className="min-w-[180px]">
              <select
                value={selectedCategory}
                onChange={e => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
              >
                <option value="">Все категории СИЗ</option>
                {Object.entries(PPE_CATEGORY_LABELS_RU).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'cards' && (
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={e => {
                  setOnlyOverdue(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Только с просроченными СИЗ</span>
            </label>
          )}

          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 text-white rounded text-sm font-medium hover:bg-slate-900"
          >
            Найти
          </button>
          {(activeSearch || selectedLeId || selectedCategory || onlyOverdue) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-2 border border-slate-300 text-slate-600 rounded text-sm hover:bg-slate-50"
            >
              Сброс
            </button>
          )}
        </form>
      </div>

      {/* Табличная часть */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {activeTab === 'cards' ? (
          /* Таблица личных карточек */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">№ Карточки</th>
                  <th className="py-3 px-4">Работник / Должность</th>
                  <th className="py-3 px-4">Организация</th>
                  <th className="py-3 px-4">Размеры</th>
                  <th className="py-3 px-4">Выдано СИЗ</th>
                  <th className="py-3 px-4">Статус контроля</th>
                  <th className="py-3 px-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Карточки учёта СИЗ не найдены.
                    </td>
                  </tr>
                ) : (
                  (currentItems as PpeCard[]).map(card => {
                    const emp = empMap.get(card.employee_id);
                    const pos = emp ? posMap.get(emp.position_id) : undefined;
                    const dept = emp ? deptMap.get(emp.department_id) : undefined;
                    const le = leMap.get(card.legal_entity_id);
                    const cardIssuances = allIssuances.filter(i => i.ppe_card_id === card.id && i.status === 'active');
                    const hasOverdue = cardIssuances.some(
                      i => !i.actual_return_date && i.due_return_date && i.due_return_date < new Date().toISOString().slice(0, 10)
                    );

                    return (
                      <tr key={card.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          <button
                            onClick={() => onNavigate('ppe-view', card.id)}
                            className="text-blue-600 hover:underline font-bold"
                          >
                            {card.card_number}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">
                            {emp ? `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim() : 'Работник не указан'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {pos?.name || '—'} {dept ? `• ${dept.name}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {le?.short_name || le?.full_name || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {card.clothing_size ? `Одежда: ${card.clothing_size}` : ''}
                          {card.shoe_size ? ` | Обувь: ${card.shoe_size}` : ''}
                          {!card.clothing_size && !card.shoe_size && <span className="text-slate-400">Не указаны</span>}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className="font-semibold text-slate-800">{cardIssuances.length}</span> позиций
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {hasOverdue ? (
                            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                              ⚠ Есть просроченные
                            </span>
                          ) : cardIssuances.length > 0 ? (
                            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              В норме
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded text-xs font-medium text-slate-400">
                              Нет выданных
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() => onNavigate('ppe-view', card.id)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Карточка
                          </button>
                          <button
                            onClick={() => onNavigate('ppe-card-edit', card.id)}
                            className="text-xs text-slate-600 hover:underline"
                          >
                            Изменить
                          </button>
                          {status === 'active' ? (
                            <button
                              onClick={() => handleArchiveCard(card)}
                              className="text-xs text-rose-600 hover:underline"
                            >
                              Архив
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestoreCard(card)}
                              className="text-xs text-emerald-600 hover:underline"
                            >
                              Восстановить
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
        ) : (
          /* Таблица норм ЕТН */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Должность / Профессия</th>
                  <th className="py-3 px-4">Вид СИЗ</th>
                  <th className="py-3 px-4">Наименование СИЗ</th>
                  <th className="py-3 px-4">Норма выдачи</th>
                  <th className="py-3 px-4">Срок носки</th>
                  <th className="py-3 px-4">Основание ЕТН / Факторы</th>
                  <th className="py-3 px-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Нормы выдачи СИЗ не найдены.
                    </td>
                  </tr>
                ) : (
                  (currentItems as PpeNormItem[]).map(norm => {
                    const pos = posMap.get(norm.position_id);
                    const dept = norm.department_id ? deptMap.get(norm.department_id) : undefined;
                    const le = leMap.get(norm.legal_entity_id);

                    return (
                      <tr key={norm.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{pos?.name || norm.position_id}</div>
                          <div className="text-xs text-slate-500">
                            {le?.short_name || le?.full_name} {dept ? `• ${dept.name}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {PPE_CATEGORY_LABELS_RU[norm.ppe_type] || norm.ppe_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 flex items-center gap-1.5">
                            {norm.ppe_name}
                            {norm.is_duty && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                ДЕЖУРНОЕ
                              </span>
                            )}
                          </div>
                          {norm.protection_properties && (
                            <div className="text-xs text-slate-500">
                              Свойства: {norm.protection_properties}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs whitespace-nowrap font-medium text-slate-800">
                          {norm.quantity_per_period} {norm.unit}
                        </td>
                        <td className="py-3 px-4 text-xs whitespace-nowrap">
                          {norm.period_months === 0 ? (
                            <span className="text-slate-600 font-medium">До износа</span>
                          ) : (
                            `${norm.period_months} мес.`
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-[220px] truncate">
                          <div>{norm.norm_basis || 'По нормам ЕТН'}</div>
                          {norm.hazard_or_factor && (
                            <div className="text-slate-400 truncate">{norm.hazard_or_factor}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() => onNavigate('ppe-norm-edit', norm.id)}
                            className="text-xs text-slate-600 hover:underline"
                          >
                            Изменить
                          </button>
                          {status === 'active' ? (
                            <button
                              onClick={() => handleArchiveNorm(norm)}
                              className="text-xs text-rose-600 hover:underline"
                            >
                              Архив
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestoreNorm(norm)}
                              className="text-xs text-emerald-600 hover:underline"
                            >
                              Восстановить
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
        )}

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <div>
              Показано {currentItems.length} из {currentTotal}
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-2 py-1 border border-slate-300 rounded bg-white disabled:opacity-50"
              >
                ← Назад
              </button>
              <span className="px-2 font-medium">
                Страница {page} из {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-2 py-1 border border-slate-300 rounded bg-white disabled:opacity-50"
              >
                Вперёд →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
