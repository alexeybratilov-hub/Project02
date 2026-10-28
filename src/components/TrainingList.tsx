import React, { useState } from 'react';
import { storage, StorageService } from '../services/storage';
import {
  exportTrainingProgramsToXLSX,
  exportTrainingProgramsToCSV,
  exportTrainingProtocolsToXLSX,
  exportTrainingProtocolsToCSV,
} from '../services/excel';
import {
  EntityStatus,
  TrainingProtocolItem,
  TrainingProgram,
  TrainingProgramCategory,
  TRAINING_PROGRAM_CATEGORY_LABELS_RU,
  TRAINING_RESULT_LABELS_RU,
} from '../types';

interface TrainingListProps {
  onNavigate: (view: string, id?: string) => void;
  filterLeId?: string;
}

const fmtDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU');
};

export const TrainingList: React.FC<TrainingListProps> = ({ onNavigate, filterLeId }) => {
  const moduleEnabled = storage.isModuleEnabled('training');
  const currentLe = storage.getCurrentLegalEntity();
  const [activeTab, setActiveTab] = useState<'protocols' | 'programs'>('protocols');

  const [selectedLeId, setSelectedLeId] = useState<string>(
    filterLeId || (currentLe ? currentLe.id : '')
  );
  const [selectedType, setSelectedType] = useState<string>('');
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
        <h1 className="text-2xl font-bold mb-4">Обучение по охране труда и проверка знаний</h1>
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          Модуль «Обучение» отключён. Включите его в{' '}
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
          . Все данные программ обучения и протоколов проверки знаний сохранены и станут доступны
          сразу после включения.
        </div>
      </div>
    );
  }

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const employees = storage.getEmployeesRaw();
  const allProtocols = storage.listTrainingProtocols({ status, pageSize: 100000 }).items;

  const leMap = new Map(legalEntities.map(l => [l.id, l]));
  const empMap = new Map(employees.map(e => [e.id, e]));
  const programMap = new Map(storage.getTrainingProgramsRaw().map(pr => [pr.id, pr]));

  const protocolsResult = storage.listTrainingProtocols({
    search: activeSearch,
    legal_entity_id: selectedLeId || undefined,
    result: (selectedType as any) || undefined,
    validity: onlyOverdue ? 'overdue' : undefined,
    status,
    page: activeTab === 'protocols' ? page : 1,
    pageSize,
  });

  const programsResult = storage.listTrainingPrograms({
    search: activeSearch,
    legal_entity_id: selectedLeId || undefined,
    category: (selectedType as TrainingProgramCategory | undefined) || undefined,
    status,
    page: activeTab === 'programs' ? page : 1,
    pageSize,
  });

  const currentItems = activeTab === 'protocols' ? protocolsResult.items : programsResult.items;
  const currentTotal = activeTab === 'protocols' ? protocolsResult.total : programsResult.total;
  const totalPages = Math.max(1, Math.ceil(currentTotal / pageSize));

  const overdueCount = allProtocols.filter(p => StorageService.checkTrainingValidity(p.next_check_date) === 'overdue').length;
  const upcomingCount = allProtocols.filter(p => StorageService.checkTrainingValidity(p.next_check_date) === 'expiring').length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedLeId(currentLe ? currentLe.id : '');
    setSelectedType('');
    setOnlyOverdue(false);
    setSearchQuery('');
    setActiveSearch('');
    setPage(1);
  };

  const handleExportXLSX = () => {
    if (activeTab === 'protocols') {
      const all = storage.listTrainingProtocols({
        legal_entity_id: selectedLeId || undefined,
        status,
        pageSize: 100000,
      }).items;
      exportTrainingProtocolsToXLSX(all, leMap, empMap, programMap);
    } else {
      const all = storage.listTrainingPrograms({
        legal_entity_id: selectedLeId || undefined,
        status,
        pageSize: 100000,
      }).items;
      exportTrainingProgramsToXLSX(all, leMap);
    }
  };

  const handleExportCSV = () => {
    if (activeTab === 'protocols') {
      const all = storage.listTrainingProtocols({
        legal_entity_id: selectedLeId || undefined,
        status,
        pageSize: 100000,
      }).items;
      exportTrainingProtocolsToCSV(all, leMap, empMap, programMap);
    } else {
      const all = storage.listTrainingPrograms({
        legal_entity_id: selectedLeId || undefined,
        status,
        pageSize: 100000,
      }).items;
      exportTrainingProgramsToCSV(all, leMap);
    }
  };

  const handleArchiveProtocol = (p: TrainingProtocolItem) => {
    if (!window.confirm(`Отправить протокол № ${p.protocol_number} в архив?`)) return;
    try {
      storage.archiveTrainingProtocol(p.id);
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      alert(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestoreProtocol = (p: TrainingProtocolItem) => {
    try {
      storage.restoreTrainingProtocol(p.id);
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      alert(err.message || 'Ошибка восстановления');
    }
  };

  const handleArchiveProgram = (pr: TrainingProgram) => {
    if (!window.confirm(`Отправить программу «${pr.name}» в архив?`)) return;
    try {
      storage.archiveTrainingProgram(pr.id);
      setRefreshTick(t => t + 1);
    } catch (err: any) {
      alert(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestoreProgram = (pr: TrainingProgram) => {
    try {
      storage.restoreTrainingProgram(pr.id);
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
            Обучение по охране труда и проверка знаний
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Порядок обучения по Постановлению Правительства РФ от 24.12.2021 № 2464
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'protocols' ? (
            <>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700"
                onClick={() => onNavigate('training-protocol-new')}
              >
                + Новый протокол
              </button>
              <button
                className="px-3 py-2 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200"
                onClick={() => onNavigate('training-import', 'protocols')}
              >
                Импорт протоколов
              </button>
            </>
          ) : (
            <>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700"
                onClick={() => onNavigate('training-program-new')}
              >
                + Новая программа
              </button>
              <button
                className="px-3 py-2 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200"
                onClick={() => onNavigate('training-import', 'programs')}
              >
                Импорт программ
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
          <div className="text-xs text-slate-500 font-medium">Протоколов проверки знаний</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{protocolsResult.total}</div>
          <div className="text-xs text-slate-400 mt-1">активных в реестре</div>
        </div>
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Учебных программ</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{programsResult.total}</div>
          <div className="text-xs text-slate-400 mt-1">утверждённых программ</div>
        </div>
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Просрочена проверка знаний</div>
          <div className={`text-2xl font-bold mt-1 ${overdueCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {overdueCount}
          </div>
          <div className="text-xs text-slate-400 mt-1">требуют внеплановой проверки</div>
        </div>
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Истекает в течение 30 дней</div>
          <div className={`text-2xl font-bold mt-1 ${upcomingCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
            {upcomingCount}
          </div>
          <div className="text-xs text-slate-400 mt-1">плановый контроль сроков</div>
        </div>
      </div>

      {/* Переключатель вкладок */}
      <div className="border-b border-slate-200 flex items-center justify-between">
        <div className="flex gap-4">
          <button
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'protocols'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => {
              setActiveTab('protocols');
              setPage(1);
            }}
          >
            Протоколы проверки знаний ({protocolsResult.total})
          </button>
          <button
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'programs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => {
              setActiveTab('programs');
              setPage(1);
            }}
          >
            Программы обучения ({programsResult.total})
          </button>
        </div>

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
                activeTab === 'protocols'
                  ? 'Поиск по номеру протокола, ФИО работника или реестровому номеру...'
                  : 'Поиск по наименованию программы, должностям, основанию...'
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

          <div className="min-w-[220px]">
            <select
              value={selectedType}
              onChange={e => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
            >
              <option value="">
                {activeTab === 'protocols' ? 'Все результаты проверки' : 'Все категории программ'}
              </option>
              {activeTab === 'protocols' ? (
                Object.entries(TRAINING_RESULT_LABELS_RU).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))
              ) : (
                Object.entries(TRAINING_PROGRAM_CATEGORY_LABELS_RU).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))
              )}
            </select>
          </div>

          {activeTab === 'protocols' && (
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
              <span>Только просроченная проверка знаний</span>
            </label>
          )}

          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 text-white rounded text-sm font-medium hover:bg-slate-900"
          >
            Найти
          </button>
          {(activeSearch || selectedLeId || selectedType || onlyOverdue) && (
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
        {activeTab === 'protocols' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">№ Протокола</th>
                  <th className="py-3 px-4">Работник</th>
                  <th className="py-3 px-4">Организация</th>
                  <th className="py-3 px-4">Вид обучения</th>
                  <th className="py-3 px-4">Проверка знаний</th>
                  <th className="py-3 px-4">Следующая проверка</th>
                  <th className="py-3 px-4">Результат</th>
                  <th className="py-3 px-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Протоколы проверки знаний не найдены.
                    </td>
                  </tr>
                ) : (
                  (currentItems as TrainingProtocolItem[]).map(protocol => {
                    const emp = empMap.get(protocol.employee_id);
                    const le = leMap.get(protocol.legal_entity_id);
                    const program = programMap.get(protocol.training_program_id);
                    const validity = StorageService.checkTrainingValidity(protocol.next_check_date);
                    return (
                      <tr key={protocol.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          <button
                            onClick={() => onNavigate('training-protocol-view', protocol.id)}
                            className="text-blue-600 hover:underline font-bold"
                          >
                            {protocol.protocol_number}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">
                            {emp
                              ? `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim()
                              : 'Работник не указан'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {emp ? storage.getPositionById(emp.position_id)?.name || '—' : '—'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {le?.short_name || le?.full_name || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {program
                              ? TRAINING_PROGRAM_CATEGORY_LABELS_RU[program.category] || program.category
                              : 'Программа удалена'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs whitespace-nowrap">
                          <div>{fmtDate(protocol.session_date)}</div>
                          {program && <div className="text-slate-500">{program.hours} ч.</div>}
                        </td>
                        <td className="py-3 px-4 text-xs whitespace-nowrap">
                          <div>{fmtDate(protocol.next_check_date)}</div>
                          {validity === 'overdue' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                              ⚠ Просрочено
                            </span>
                          ) : validity === 'expiring' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              Истекает
                            </span>
                          ) : validity === 'valid' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium text-emerald-700">
                              Действует
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-500">
                              Без периодичности
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {protocol.result === 'passed' ? (
                            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {TRAINING_RESULT_LABELS_RU.passed}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                              {TRAINING_RESULT_LABELS_RU.failed}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() => onNavigate('training-protocol-view', protocol.id)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Протокол
                          </button>
                          <button
                            onClick={() => onNavigate('training-protocol-edit', protocol.id)}
                            className="text-xs text-slate-600 hover:underline"
                          >
                            Изменить
                          </button>
                          {status === 'active' ? (
                            <button
                              onClick={() => handleArchiveProtocol(protocol)}
                              className="text-xs text-rose-600 hover:underline"
                            >
                              Архив
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestoreProtocol(protocol)}
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Категория программы</th>
                  <th className="py-3 px-4">Наименование программы</th>
                  <th className="py-3 px-4">Организация</th>
                  <th className="py-3 px-4">Часы</th>
                  <th className="py-3 px-4">Периодичность</th>
                  <th className="py-3 px-4">Основание</th>
                  <th className="py-3 px-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Учебные программы не найдены.
                    </td>
                  </tr>
                ) : (
                  (currentItems as TrainingProgram[]).map(program => {
                    const le = leMap.get(program.legal_entity_id);
                    return (
                      <tr key={program.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900">
                            {TRAINING_PROGRAM_CATEGORY_LABELS_RU[program.category] || program.category}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{program.name}</div>
                          {program.positions && (
                            <div className="text-xs text-slate-500 max-w-[240px] truncate" title={program.positions}>
                              Должности: {program.positions}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {le?.short_name || le?.full_name || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs whitespace-nowrap font-medium text-slate-800">
                          {program.hours} ч.
                        </td>
                        <td className="py-3 px-4 text-xs whitespace-nowrap">
                          {program.recurring_months == null || program.recurring_months === 0 ? (
                            <span className="text-slate-600 font-medium">Бессрочно</span>
                          ) : program.recurring_months >= 12 ? (
                            `${Math.round(program.recurring_months / 12)} г.`
                          ) : (
                            `${program.recurring_months} мес.`
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-[200px] truncate">
                          {program.basis || '—'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() => onNavigate('training-program-edit', program.id)}
                            className="text-xs text-slate-600 hover:underline"
                          >
                            Изменить
                          </button>
                          {status === 'active' ? (
                            <button
                              onClick={() => handleArchiveProgram(program)}
                              className="text-xs text-rose-600 hover:underline"
                            >
                              Архив
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestoreProgram(program)}
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
