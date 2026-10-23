import React, { useState } from 'react';
import { storage } from '../services/storage';
import { exportToXLSX, exportToCSV } from '../services/excel';
import { EntityStatus, LegalEntity } from '../types';

interface LegalEntitiesListProps {
  onNavigate: (view: string, id?: string) => void;
  onRefreshCurrentLe: () => void;
}

export const LegalEntitiesList: React.FC<LegalEntitiesListProps> = ({
  onNavigate,
  onRefreshCurrentLe,
}) => {
  const [status, setStatus] = useState<EntityStatus>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const currentLeId = storage.getCurrentLegalEntityId();
  const { items, total } = storage.listLegalEntities({
    search: activeSearch,
    status,
    page,
    pageSize,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setPage(1);
  };

  const handleSelectCurrent = (le: LegalEntity) => {
    storage.setCurrentLegalEntityId(le.id);
    onRefreshCurrentLe();
  };

  const handleArchive = (le: LegalEntity) => {
    const confirmed = window.confirm(
      `Отправить в архив «${le.full_name}»? Связанные данные будут сохранены.`
    );
    if (!confirmed) return;

    try {
      storage.archiveLegalEntity(le.id);
      onRefreshCurrentLe();
      // Switch view to archived to match original router behavior
      setStatus('archived');
    } catch (err: any) {
      alert(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestore = (le: LegalEntity) => {
    try {
      storage.restoreLegalEntity(le.id);
      onRefreshCurrentLe();
      setStatus('active');
    } catch (err: any) {
      alert(err.message || 'Ошибка восстановления');
    }
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    // Export filtered rows matching search and status
    const allFiltered = storage.listLegalEntities({
      search: activeSearch,
      status,
      page: 1,
      pageSize: 100000,
    }).items;

    if (format === 'xlsx') {
      exportToXLSX(allFiltered, `legal_entities_${status}.xlsx`);
    } else {
      exportToCSV(allFiltered, `legal_entities_${status}.csv`);
    }
  };

  return (
    <div>
      <h1>Юридические лица</h1>
      <p className="toolbar">
        <button className="btn" onClick={() => onNavigate('legal-entities-new')}>
          + Создать юридическое лицо
        </button>
        <button
          className="link-action"
          onClick={() => onNavigate('legal-entities-import')}
        >
          Импорт из Excel
        </button>
        <button className="link-action" onClick={() => handleExport('xlsx')}>
          Экспорт (xlsx)
        </button>
        <button className="link-action" onClick={() => handleExport('csv')}>
          Экспорт (csv)
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

      <form className="filters" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Поиск по наименованию или ИНН"
        />
        <button type="submit">Найти</button>
        {activeSearch && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setSearchQuery('');
              setActiveSearch('');
              setPage(1);
            }}
          >
            Сбросить
          </button>
        )}
      </form>

      {items.length > 0 ? (
        <>
          <table>
            <thead>
              <tr>
                <th>Полное наименование</th>
                <th>Сокращённое</th>
                <th>ИНН</th>
                <th>КПП</th>
                <th>ОГРН</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map(le => {
                const isCurrent = currentLeId === le.id;
                return (
                  <tr key={le.id}>
                    <td>
                      <a
                        href={`#legal-entities/${le.id}`}
                        style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}
                        onClick={e => {
                          e.preventDefault();
                          onNavigate('legal-entities-view', le.id);
                        }}
                      >
                        {le.full_name}
                      </a>
                    </td>
                    <td>{le.short_name || '—'}</td>
                    <td>{le.inn || '—'}</td>
                    <td>{le.kpp || '—'}</td>
                    <td>{le.ogrn || '—'}</td>
                    <td>
                      <div className="table-actions">
                        {isCurrent ? (
                          <span className="badge">текущее</span>
                        ) : status === 'active' ? (
                          <button
                            type="button"
                            className="btn-sm btn-secondary"
                            onClick={() => handleSelectCurrent(le)}
                          >
                            Выбрать текущим
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className="btn-sm btn-secondary"
                          onClick={() => onNavigate('legal-entities-edit', le.id)}
                        >
                          Изменить
                        </button>

                        {status === 'active' ? (
                          <button
                            type="button"
                            className="btn-sm btn-danger-outline"
                            onClick={() => handleArchive(le)}
                          >
                            В архив
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-sm"
                            onClick={() => handleRestore(le)}
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
            ? 'Юридических лиц пока нет — создайте первое или импортируйте из Excel.'
            : 'Архив пуст.'}
        </p>
      )}
    </div>
  );
};
