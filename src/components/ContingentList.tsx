import React, { useState } from 'react';
import { storage } from '../services/storage';
import { exportContingentToXLSX, exportContingentToCSV } from '../services/excel';
import { ContingentRecord, EntityStatus } from '../types';

interface ContingentListProps {
  onNavigate: (view: string, id?: string) => void;
  filterLeId?: string;
}

export const ContingentList: React.FC<ContingentListProps> = ({
  onNavigate,
  filterLeId,
}) => {
  const currentLe = storage.getCurrentLegalEntity();
  const [selectedLeId, setSelectedLeId] = useState<string>(
    filterLeId || (currentLe ? currentLe.id : '')
  );
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [status, setStatus] = useState<EntityStatus>('active');
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const departments = storage.getDepartments(selectedLeId || undefined);
  const positions = storage.getPositionsRaw();
  const subclasses = storage.getWorkConditionSubclasses();

  const { items, total } = storage.listContingentRecords({
    search: activeSearch,
    legal_entity_id: selectedLeId || undefined,
    department_id: selectedDeptId || undefined,
    status,
    page,
    pageSize,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setPage(1);
  };

  const handleArchive = (record: ContingentRecord) => {
    const pos = positions.find(p => p.id === record.position_id)?.name || 'запись';
    const confirmed = window.confirm(
      `Отправить в архив запись «${pos}»? Связанные работники будут сохранены.`
    );
    if (!confirmed) return;

    try {
      storage.archiveContingentRecord(record.id);
      setStatus('archived');
    } catch (err: any) {
      alert(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestore = (record: ContingentRecord) => {
    try {
      storage.restoreContingentRecord(record.id);
      setStatus('active');
    } catch (err: any) {
      alert(err.message || 'Ошибка восстановления');
    }
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    const allFiltered = storage.listContingentRecords({
      search: activeSearch,
      legal_entity_id: selectedLeId || undefined,
      department_id: selectedDeptId || undefined,
      status,
      page: 1,
      pageSize: 100000,
    }).items;

    if (format === 'xlsx') {
      exportContingentToXLSX(allFiltered, `contingent_${status}.xlsx`);
    } else {
      exportContingentToCSV(allFiltered, `contingent_${status}.csv`);
    }
  };

  return (
    <div>
      <h1>Реестр контингента работников</h1>
      <p style={{ color: '#4b5563', marginBottom: '1rem' }}>
        Реестр контингента (этап 3, FR-05, FR-06): рабочие места, факторы производственной среды, карты СОУТ и ОПР, пункты приказов № 29н/342н.
      </p>

      <p className="toolbar">
        <button className="btn" onClick={() => onNavigate('contingent-new')}>
          + Создать запись контингента
        </button>
        <button
          className="link-action"
          onClick={() => onNavigate('contingent-import')}
        >
          Импорт из Excel
        </button>
        <button className="link-action" onClick={() => handleExport('xlsx')}>
          Экспорт (xlsx)
        </button>
        <button className="link-action" onClick={() => handleExport('csv')}>
          Экспорт (csv)
        </button>
        <button
          className="link-action"
          onClick={() => onNavigate('dictionaries')}
        >
          Справочники
        </button>
        {status === 'active' ? (
          <button
            className="link-action"
            onClick={() => {
              setStatus('archived');
              setPage(1);
            }}
          >
            Архив
          </button>
        ) : (
          <button
            className="link-action"
            onClick={() => {
              setStatus('active');
              setPage(1);
            }}
          >
            К активным
          </button>
        )}
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', margin: '1rem 0' }}>
        <form className="filters" onSubmit={handleSearchSubmit} style={{ margin: 0 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск по должности, подразделению, СОУТ, 29н..."
            style={{ width: '320px' }}
          />
          <button type="submit">Найти</button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Юрлицо:</label>
          <select
            value={selectedLeId}
            onChange={e => {
              setSelectedLeId(e.target.value);
              setSelectedDeptId('');
              setPage(1);
            }}
            style={{ padding: '0.4rem', border: '1px solid #d0d7de', borderRadius: '4px' }}
          >
            <option value="">Все юридические лица</option>
            {legalEntities.map(le => (
              <option key={le.id} value={le.id}>
                {le.short_name || le.full_name}
              </option>
            ))}
          </select>
        </div>

        {selectedLeId && departments.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Подразделение:</label>
            <select
              value={selectedDeptId}
              onChange={e => {
                setSelectedDeptId(e.target.value);
                setPage(1);
              }}
              style={{ padding: '0.4rem', border: '1px solid #d0d7de', borderRadius: '4px' }}
            >
              <option value="">Все подразделения</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {(activeSearch || selectedLeId || selectedDeptId) && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setSearchQuery('');
              setActiveSearch('');
              setSelectedLeId('');
              setSelectedDeptId('');
              setPage(1);
            }}
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      {items.length > 0 ? (
        <>
          <table>
            <thead>
              <tr>
                <th>Юридическое лицо</th>
                <th>Подразделение</th>
                <th>Должность / Уточнение</th>
                <th>Карта СОУТ / Подкласс</th>
                <th>Карта ОПР</th>
                <th>Приказы 29н / 342н</th>
                <th style={{ width: '160px' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map(rec => {
                const le = legalEntities.find(l => l.id === rec.legal_entity_id);
                const dept = departments.find(d => d.id === rec.department_id);
                const pos = positions.find(p => p.id === rec.position_id);
                const sub = subclasses.find(s => s.id === rec.work_condition_subclass_id);

                return (
                  <tr key={rec.id}>
                    <td>
                      <span title={le?.full_name || ''}>
                        {le?.short_name || le?.full_name || '—'}
                      </span>
                    </td>
                    <td>{dept?.name || '—'}</td>
                    <td>
                      <a
                        href={`#contingent/${rec.id}`}
                        style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
                        onClick={e => {
                          e.preventDefault();
                          onNavigate('contingent-view', rec.id);
                        }}
                      >
                        {pos?.name || '—'}
                      </a>
                      {rec.workplace_label && (
                        <span className="muted" style={{ display: 'block', fontSize: '0.82rem' }}>
                          раб. место: {rec.workplace_label}
                        </span>
                      )}
                    </td>
                    <td>
                      {rec.sout_card_number ? (
                        <span>№ {rec.sout_card_number}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                      {sub && (
                        <span
                          className="badge"
                          style={{ marginLeft: '5px', fontSize: '0.75rem' }}
                        >
                          кл. {sub.code}
                        </span>
                      )}
                    </td>
                    <td>
                      {rec.risk_card_number ? (
                        <span>№ {rec.risk_card_number}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {rec.medical_items_29n && rec.medical_items_29n.length > 0 && (
                        <div style={{ fontSize: '0.82rem' }}>
                          <strong>29н:</strong> {rec.medical_items_29n.join(', ')}
                        </div>
                      )}
                      {rec.medical_items_342n && rec.medical_items_342n.length > 0 && (
                        <div style={{ fontSize: '0.82rem', color: '#065f46' }}>
                          <strong>342н:</strong> {rec.medical_items_342n.join(', ')}
                        </div>
                      )}
                      {(!rec.medical_items_29n || rec.medical_items_29n.length === 0) &&
                        (!rec.medical_items_342n || rec.medical_items_342n.length === 0) && (
                          <span className="muted">—</span>
                        )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-sm btn-secondary"
                          onClick={() => onNavigate('contingent-edit', rec.id)}
                        >
                          Изменить
                        </button>
                        {status === 'active' ? (
                          <button
                            type="button"
                            className="btn-sm btn-danger-outline"
                            onClick={() => handleArchive(rec)}
                          >
                            В архив
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-sm"
                            onClick={() => handleRestore(rec)}
                          >
                            Вернуть
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="muted" style={{ marginTop: '0.8rem' }}>
            Всего: {total}. Страница {page} из {Math.max(1, Math.ceil(total / pageSize))}.
          </p>

          {total > pageSize && (
            <div className="toolbar">
              <button
                disabled={page <= 1}
                className="secondary"
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ← Назад
              </button>
              <button
                disabled={page * pageSize >= total}
                className="secondary"
                onClick={() => setPage(p => p + 1)}
              >
                Вперёд →
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="empty">
          {activeSearch
            ? `Ничего не найдено по запросу «${activeSearch}».`
            : status === 'active'
            ? 'В реестре контингента пока нет записей — создайте первую или загрузите из Excel.'
            : 'Архив контингента пуст.'}
        </p>
      )}
    </div>
  );
};
