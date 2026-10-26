import React, { useState } from 'react';
import { storage } from '../services/storage';
import { exportMedicalToXLSX, exportMedicalToCSV } from '../services/excel';
import {
  EntityStatus,
  MedicalExamType,
  MedicalConclusion,
  MEDICAL_EXAM_TYPE_LABELS_RU,
  MEDICAL_CONCLUSION_LABELS_RU,
} from '../types';

interface MedicalListProps {
  onNavigate: (view: string, id?: string) => void;
  filterLeId?: string;
}

export const MedicalList: React.FC<MedicalListProps> = ({ onNavigate, filterLeId }) => {
  const moduleEnabled = storage.isModuleEnabled('medical');
  const currentLe = storage.getCurrentLegalEntity();
  const [selectedLeId, setSelectedLeId] = useState<string>(
    filterLeId || (currentLe ? currentLe.id : '')
  );
  const [selectedExamType, setSelectedExamType] = useState<string>('');
  const [selectedConclusion, setSelectedConclusion] = useState<string>('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [status, setStatus] = useState<EntityStatus>('active');
  const [page, setPage] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);
  const pageSize = 30;
  void refreshTick; // триггер перерендера после архивирования/восстановления

  if (!moduleEnabled) {
    return (
      <div>
        <h1>Медосмотры (Приказ Минздрава 29н)</h1>
        <div className="alert" style={{ background: '#fffbeb', borderColor: '#fef3c7', color: '#b45309' }}>
          Модуль «Медосмотры» отключён. Включите его в{' '}
          <a
            href="#modules"
            style={{ color: 'var(--accent)' }}
            onClick={e => {
              e.preventDefault();
              onNavigate('modules');
            }}
          >
            реестре модулей
          </a>
          . Накопленные данные карт медосмотров сохранены и будут доступны при включении.
        </div>
      </div>
    );
  }

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const employees = storage.getEmployeesRaw();

  const { items, total } = storage.listMedicalCards({
    search: activeSearch,
    legal_entity_id: selectedLeId || undefined,
    exam_type: (selectedExamType as MedicalExamType) || undefined,
    conclusion: (selectedConclusion as MedicalConclusion) || undefined,
    overdue: onlyOverdue || undefined,
    status,
    page,
    pageSize,
  });

  // Аналитика по активным картам
  const allActive = storage.listMedicalCards({
    legal_entity_id: selectedLeId || undefined,
    status: 'active',
    page: 1,
    pageSize: 100000,
  }).items;

  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = allActive.filter(c => !!c.next_due_date && c.next_due_date < today).length;
  const pendingCount = allActive.filter(c => c.conclusion === 'pending').length;
  const unfitCount = allActive.filter(c => c.conclusion === 'unfit' || c.contraindications_found).length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedLeId(currentLe ? currentLe.id : '');
    setSelectedExamType('');
    setSelectedConclusion('');
    setOnlyOverdue(false);
    setSearchQuery('');
    setActiveSearch('');
    setPage(1);
  };

  const getEntityName = (id: string) => {
    const le = legalEntities.find(l => l.id === id);
    return le ? le.short_name || le.full_name : '—';
  };

  const getEmployeeFio = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return '—';
    return `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim();
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1>Медосмотры (Приказ Минздрава 29н)</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={() => onNavigate('medical-new')}>
            + Создать карту медосмотра
          </button>
          <button className="btn secondary" onClick={() => onNavigate('medical-import')}>
            Импорт Excel
          </button>
          <button className="btn secondary" onClick={() => exportMedicalToXLSX(items)}>
            Экспорт Excel
          </button>
          <button className="btn secondary" onClick={() => exportMedicalToCSV(items)}>
            Экспорт CSV
          </button>
        </div>
      </div>

      <p style={{ color: '#4b5563', marginBottom: '1.25rem' }}>
        Реестр карт предварительных и периодических медицинских осмотров (Приказ Минздрава России № 29н),
        контроль сроков следующих осмотров и заключений по результатам.
      </p>

      {/* Аналитические виджеты */}
      <div className="widgets mb-6">
        <div className="widget">
          <div className="value">{allActive.length}</div>
          <div className="title">Активных карт</div>
          <div className="caption">Все незаархивированные медосмотры</div>
        </div>
        <div
          className="widget"
          style={{ cursor: 'pointer', borderLeft: '4px solid #ef4444' }}
          onClick={() => { setOnlyOverdue(true); setPage(1); }}
        >
          <div className="value" style={{ color: '#991b1b' }}>{overdueCount}</div>
          <div className="title">Просрочено</div>
          <div className="caption">Срок следующего медосмотра истёк</div>
        </div>
        <div
          className="widget"
          style={{ cursor: 'pointer', borderLeft: '4px solid #f59e0b' }}
          onClick={() => { setSelectedConclusion('pending'); setPage(1); }}
        >
          <div className="value" style={{ color: '#92400e' }}>{pendingCount}</div>
          <div className="title">Заключение не получено</div>
          <div className="caption">Ожидается результат из медорганизации</div>
        </div>
        <div
          className="widget"
          style={{ cursor: 'pointer', borderLeft: '4px solid #dc2626' }}
          onClick={() => { setSelectedConclusion('unfit'); setPage(1); }}
        >
          <div className="value" style={{ color: '#991b1b' }}>{unfitCount}</div>
          <div className="title">Противопоказания / не годен</div>
          <div className="caption">Требуют кадровых решений</div>
        </div>
      </div>

      {/* Вкладки: Активные / Архив */}
      <div className="tabs mb-4 flex gap-2 border-b border-gray-200">
        <button
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            status === 'active'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => {
            setStatus('active');
            setPage(1);
          }}
        >
          Активные карты ({allActive.length})
        </button>
        <button
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            status === 'archived'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => {
            setStatus('archived');
            setPage(1);
          }}
        >
          Архив
        </button>
      </div>

      {/* Фильтры и поиск */}
      <form onSubmit={handleSearchSubmit} className="card mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Организация</label>
            <select
              className="w-full text-sm p-2 border rounded"
              value={selectedLeId}
              onChange={e => {
                setSelectedLeId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Все организации</option>
              {legalEntities.map(le => (
                <option key={le.id} value={le.id}>
                  {le.short_name || le.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Вид медосмотра</label>
            <select
              className="w-full text-sm p-2 border rounded"
              value={selectedExamType}
              onChange={e => {
                setSelectedExamType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Все виды</option>
              {(Object.keys(MEDICAL_EXAM_TYPE_LABELS_RU) as MedicalExamType[]).map(t => (
                <option key={t} value={t}>
                  {MEDICAL_EXAM_TYPE_LABELS_RU[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Заключение</label>
            <select
              className="w-full text-sm p-2 border rounded"
              value={selectedConclusion}
              onChange={e => {
                setSelectedConclusion(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Все заключения</option>
              {(Object.keys(MEDICAL_CONCLUSION_LABELS_RU) as MedicalConclusion[]).map(c => (
                <option key={c} value={c}>
                  {MEDICAL_CONCLUSION_LABELS_RU[c].name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Поиск</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="w-full text-sm p-2 border rounded"
                placeholder="Номер карты, ФИО, клиника..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn text-sm px-3 py-2">
                Найти
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-200">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyOverdue}
              onChange={e => {
                setOnlyOverdue(e.target.checked);
                setPage(1);
              }}
            />
            Только просроченные сроки следующего медосмотра
          </label>
          {(selectedLeId || selectedExamType || selectedConclusion || activeSearch || onlyOverdue) && (
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={handleResetFilters}
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      </form>

      {/* Таблица карт медосмотров */}
      {items.length === 0 ? (
        <div className="card text-center py-10 text-gray-500">
          <p className="text-base mb-2">Карт медосмотров не найдено</p>
          <p className="text-xs text-gray-400 mb-4">
            {activeSearch || selectedLeId || selectedExamType || selectedConclusion || onlyOverdue
              ? 'Попробуйте изменить параметры поиска или фильтры.'
              : 'Создайте первую карту медосмотра или загрузите данные через импорт Excel.'}
          </p>
          <button className="btn" onClick={() => onNavigate('medical-new')}>
            + Создать карту медосмотра
          </button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600 text-xs uppercase">
                <th className="p-3">№ карты</th>
                <th className="p-3">Работник</th>
                <th className="p-3">Организация</th>
                <th className="p-3">Вид осмотра</th>
                <th className="p-3">Дата осмотра</th>
                <th className="p-3">Срок следующего</th>
                <th className="p-3">Заключение</th>
                <th className="p-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map(card => {
                const conclusionInfo = MEDICAL_CONCLUSION_LABELS_RU[card.conclusion] || {
                  name: card.conclusion,
                  badgeClass: 'badge-gray',
                };
                const isOverdue = status === 'active' && !!card.next_due_date && card.next_due_date < today;
                return (
                  <tr key={card.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-semibold text-blue-700">
                      <a
                        href={`#medical/${card.id}`}
                        onClick={e => {
                          e.preventDefault();
                          onNavigate('medical-view', card.id);
                        }}
                      >
                        {card.card_number}
                      </a>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-gray-900">{getEmployeeFio(card.employee_id)}</div>
                      {card.clinic_name && (
                        <div className="text-xs text-gray-500">{card.clinic_name}</div>
                      )}
                    </td>
                    <td className="p-3 text-gray-800">{getEntityName(card.legal_entity_id)}</td>
                    <td className="p-3 text-xs text-gray-700">
                      {MEDICAL_EXAM_TYPE_LABELS_RU[card.exam_type] || card.exam_type}
                    </td>
                    <td className="p-3 text-gray-600 text-xs">{card.exam_date || '—'}</td>
                    <td className="p-3 text-xs">
                      {card.next_due_date ? (
                        <span className={isOverdue ? 'text-rose-700 font-bold' : 'text-gray-700'}>
                          {card.next_due_date}
                          {isOverdue && ' ⚠ просрочен'}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs border font-medium ${conclusionInfo.badgeClass}`}>
                        {conclusionInfo.name}
                      </span>
                      {card.contraindications_found && (
                        <div className="text-[10px] text-rose-600 mt-1">Выявлены противопоказания</div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => onNavigate('medical-view', card.id)}
                        >
                          Просмотр
                        </button>
                        <button
                          className="text-xs text-gray-600 hover:underline"
                          onClick={() => onNavigate('medical-edit', card.id)}
                        >
                          Изменить
                        </button>
                        {card.status === 'active' ? (
                          <button
                            className="text-xs text-rose-600 hover:underline"
                            onClick={() => {
                              if (confirm(`Переместить карту медосмотра № «${card.card_number}» в архив?`)) {
                                try {
                                  storage.archiveMedicalCard(card.id);
                                  setRefreshTick(t => t + 1);
                                } catch (err: any) {
                                  alert(err.message || 'Ошибка архивирования');
                                }
                              }
                            }}
                          >
                            В архив
                          </button>
                        ) : (
                          <button
                            className="text-xs text-emerald-600 hover:underline"
                            onClick={() => {
                              try {
                                storage.restoreMedicalCard(card.id);
                                setRefreshTick(t => t + 1);
                              } catch (err: any) {
                                alert(err.message || 'Ошибка восстановления');
                              }
                            }}
                          >
                            Восстановить
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-3 border-t text-xs text-gray-600">
              <span>
                Показано {items.length} из {total} карт
              </span>
              <div className="flex gap-1">
                <button
                  className="px-2 py-1 border rounded disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  ← Назад
                </button>
                <span className="px-3 py-1">
                  Страница {page} из {totalPages}
                </span>
                <button
                  className="px-2 py-1 border rounded disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Вперёд →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
