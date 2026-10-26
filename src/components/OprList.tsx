import React, { useState } from 'react';
import { storage } from '../services/storage';
import { exportOprToXLSX, exportOprToCSV, exportOprPlanToXLSX } from '../services/excel';
import { OprCard, EntityStatus, RiskLevel, RISK_LEVEL_LABELS_RU } from '../types';

interface OprListProps {
  onNavigate: (view: string, id?: string) => void;
  filterLeId?: string;
}

export const OprList: React.FC<OprListProps> = ({ onNavigate, filterLeId }) => {
  const moduleEnabled = storage.isModuleEnabled('opr');
  const currentLe = storage.getCurrentLegalEntity();
  const [selectedLeId, setSelectedLeId] = useState<string>(
    filterLeId || (currentLe ? currentLe.id : '')
  );
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [status, setStatus] = useState<EntityStatus>('active');
  const [page, setPage] = useState(1);
  const pageSize = 30;

  if (!moduleEnabled) {
    return (
      <div>
        <h1>Оценка профессиональных рисков (ОПР)</h1>
        <div className="alert" style={{ background: '#fffbeb', borderColor: '#fef3c7', color: '#b45309' }}>
          Модуль «ОПР» отключён. Включите его в{' '}
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
          . Накопленные данные карт рисков и мероприятий сохранены и будут доступны при включении.
        </div>
      </div>
    );
  }

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const departments = storage.getDepartments(selectedLeId || undefined);

  const { items, total } = storage.listOprCards({
    search: activeSearch,
    legal_entity_id: selectedLeId || undefined,
    department_id: selectedDeptId || undefined,
    risk_level: (selectedRiskLevel as RiskLevel) || undefined,
    status,
    page,
    pageSize,
  });

  // Аналитика по активным картам
  const allActive = storage.listOprCards({
    legal_entity_id: selectedLeId || undefined,
    status: 'active',
    page: 1,
    pageSize: 100000,
  }).items;

  const lowCount = allActive.filter(c => c.overall_risk_level === 'low').length;
  const moderateCount = allActive.filter(c => c.overall_risk_level === 'moderate').length;
  const highCount = allActive.filter(c => c.overall_risk_level === 'high').length;
  const unacceptableCount = allActive.filter(c => c.overall_risk_level === 'unacceptable').length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedLeId(currentLe ? currentLe.id : '');
    setSelectedDeptId('');
    setSelectedRiskLevel('');
    setSearchQuery('');
    setActiveSearch('');
    setPage(1);
  };

  const getEntityName = (id: string) => {
    const le = legalEntities.find(l => l.id === id);
    return le ? le.short_name || le.full_name : '—';
  };

  const getDeptName = (id: string) => {
    const d = storage.getDepartmentsRaw().find(dept => dept.id === id);
    return d ? d.name : '—';
  };

  const getPosName = (id: string) => {
    const p = storage.getPositionById(id);
    return p ? p.name : '—';
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  const handleExportPlan = () => {
    const measures = storage.listOprMeasures();
    exportOprPlanToXLSX(measures);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1>Оценка профессиональных рисков (ОПР)</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={() => onNavigate('opr-new')}>
            + Создать карту ОПР
          </button>
          <button className="btn secondary" onClick={() => exportOprToXLSX(items)}>
            Экспорт Excel
          </button>
          <button className="btn secondary" onClick={() => exportOprToCSV(items)}>
            Экспорт CSV
          </button>
          <button className="btn secondary" onClick={handleExportPlan} title="Выгрузить сводный план мероприятий">
            Экспорт плана мероприятий
          </button>
        </div>
      </div>

      <p style={{ color: '#4b5563', marginBottom: '1.25rem' }}>
        Реестр карт оценки профессиональных рисков на рабочих местах по методике Приказа Минтруда России № 776н (матрица 5×5) и планы мероприятий по их снижению.
      </p>

      {/* Аналитические виджеты рисков */}
      <div className="widgets mb-6">
        <div
          className="widget"
          style={{ cursor: 'pointer', borderLeft: '4px solid #10b981' }}
          onClick={() => { setSelectedRiskLevel('low'); setPage(1); }}
        >
          <div className="value" style={{ color: '#065f46' }}>{lowCount}</div>
          <div className="title">Низкий (приемлемый)</div>
          <div className="caption">Балл 1–4. Контроль не требует срочных мер</div>
        </div>
        <div
          className="widget"
          style={{ cursor: 'pointer', borderLeft: '4px solid #f59e0b' }}
          onClick={() => { setSelectedRiskLevel('moderate'); setPage(1); }}
        >
          <div className="value" style={{ color: '#92400e' }}>{moderateCount}</div>
          <div className="title">Умеренный (допустимый)</div>
          <div className="caption">Балл 5–9. Регулярный периодический мониторинг</div>
        </div>
        <div
          className="widget"
          style={{ cursor: 'pointer', borderLeft: '4px solid #f97316' }}
          onClick={() => { setSelectedRiskLevel('high'); setPage(1); }}
        >
          <div className="value" style={{ color: '#9a3412' }}>{highCount}</div>
          <div className="title">Высокий (существенный)</div>
          <div className="caption">Балл 10–15. Необходим план снижения рисков</div>
        </div>
        <div
          className="widget"
          style={{ cursor: 'pointer', borderLeft: '4px solid #ef4444' }}
          onClick={() => { setSelectedRiskLevel('unacceptable'); setPage(1); }}
        >
          <div className="value" style={{ color: '#991b1b' }}>{unacceptableCount}</div>
          <div className="title">Недопустимый (критический)</div>
          <div className="caption">Балл 16–25. Требуются неотложные меры</div>
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
                setSelectedDeptId('');
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
            <label className="block text-xs font-semibold text-gray-600 mb-1">Подразделение</label>
            <select
              className="w-full text-sm p-2 border rounded"
              value={selectedDeptId}
              onChange={e => {
                setSelectedDeptId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Все подразделения</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Уровень риска</label>
            <select
              className="w-full text-sm p-2 border rounded"
              value={selectedRiskLevel}
              onChange={e => {
                setSelectedRiskLevel(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Все уровни</option>
              <option value="low">Низкий (1–4)</option>
              <option value="moderate">Умеренный (5–9)</option>
              <option value="high">Высокий (10–15)</option>
              <option value="unacceptable">Недопустимый (16–25)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Поиск</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="w-full text-sm p-2 border rounded"
                placeholder="Номер, должность, опасность..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn text-sm px-3 py-2">
                Найти
              </button>
            </div>
          </div>
        </div>

        {(selectedLeId || selectedDeptId || selectedRiskLevel || activeSearch) && (
          <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-200">
            <span>
              Активные фильтры:{' '}
              {selectedLeId && `Организация: ${getEntityName(selectedLeId)}; `}
              {selectedDeptId && `Подразделение: ${getDeptName(selectedDeptId)}; `}
              {selectedRiskLevel && `Уровень: ${RISK_LEVEL_LABELS_RU[selectedRiskLevel as RiskLevel]?.name}; `}
              {activeSearch && `Поиск: «${activeSearch}»`}
            </span>
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={handleResetFilters}
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </form>

      {/* Таблица карт ОПР */}
      {items.length === 0 ? (
        <div className="card text-center py-10 text-gray-500">
          <p className="text-base mb-2">Карт оценки профессиональных рисков не найдено</p>
          <p className="text-xs text-gray-400 mb-4">
            {activeSearch || selectedLeId || selectedDeptId || selectedRiskLevel
              ? 'Попробуйте изменить параметры поиска или фильтры.'
              : 'Создайте первую карту оценки профессиональных рисков для рабочего места.'}
          </p>
          <button className="btn" onClick={() => onNavigate('opr-new')}>
            + Создать карту ОПР
          </button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600 text-xs uppercase">
                <th className="p-3">№ карты</th>
                <th className="p-3">Организация</th>
                <th className="p-3">Подразделение / Должность</th>
                <th className="p-3 text-center">Опасностей</th>
                <th className="p-3 text-center">Балл риска</th>
                <th className="p-3">Уровень риска</th>
                <th className="p-3">Дата оценки</th>
                <th className="p-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map(card => {
                const levelInfo = RISK_LEVEL_LABELS_RU[card.overall_risk_level] || {
                  name: card.overall_risk_level,
                  badgeClass: 'bg-gray-100 text-gray-800',
                };
                return (
                  <tr key={card.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-semibold text-blue-700">
                      <a
                        href={`#opr/${card.id}`}
                        onClick={e => {
                          e.preventDefault();
                          onNavigate('opr-view', card.id);
                        }}
                      >
                        {card.card_number}
                      </a>
                    </td>
                    <td className="p-3 text-gray-800">{getEntityName(card.legal_entity_id)}</td>
                    <td className="p-3">
                      <div className="font-medium text-gray-900">{getPosName(card.position_id)}</div>
                      <div className="text-xs text-gray-500">
                        {getDeptName(card.department_id)}
                        {card.workplace_label && ` (${card.workplace_label})`}
                      </div>
                    </td>
                    <td className="p-3 text-center font-medium">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {card.hazards.length}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-bold text-sm">
                        {card.overall_risk_score}
                      </span>
                      <span className="text-xs text-gray-400"> / 25</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs border font-medium ${levelInfo.badgeClass}`}>
                        {levelInfo.name}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600 text-xs">
                      {card.assessment_date || '—'}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => onNavigate('opr-view', card.id)}
                        >
                          Просмотр
                        </button>
                        <button
                          className="text-xs text-gray-600 hover:underline"
                          onClick={() => onNavigate('opr-edit', card.id)}
                        >
                          Изменить
                        </button>
                        {card.status === 'active' ? (
                          <button
                            className="text-xs text-rose-600 hover:underline"
                            onClick={() => {
                              if (confirm(`Переместить карту ОПР № «${card.card_number}» в архив?`)) {
                                storage.archiveOprCard(card.id);
                                setSelectedLeId(selectedLeId); // триггер перерендера
                              }
                            }}
                          >
                            В архив
                          </button>
                        ) : (
                          <button
                            className="text-xs text-emerald-600 hover:underline"
                            onClick={() => {
                              storage.restoreOprCard(card.id);
                              setSelectedLeId(selectedLeId);
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
