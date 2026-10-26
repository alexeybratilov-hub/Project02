import React, { useState } from 'react';
import { storage } from '../services/storage';
import { exportSoutToXLSX, exportSoutToCSV } from '../services/excel';
import { SoutCard, EntityStatus } from '../types';

interface SoutListProps {
  onNavigate: (view: string, id?: string) => void;
  filterLeId?: string;
}

const CLASS_LABELS: Record<string, string> = {
  '1': 'Оптимальные (1)',
  '2': 'Допустимые (2)',
  '3.1': 'Вредные (3.1)',
  '3.2': 'Вредные (3.2)',
  '3.3': 'Вредные (3.3)',
  '3.4': 'Вредные (3.4)',
  '4': 'Опасные (4)',
};

function classBadgeStyle(finalClass: string): React.CSSProperties {
  if (finalClass === '4' || finalClass === '3.4') {
    return { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' };
  }
  if (finalClass === '3.3' || finalClass === '3.2') {
    return { background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' };
  }
  if (finalClass === '3.1') {
    return { background: '#fefce8', color: '#854d0e', border: '1px solid #fef08a' };
  }
  if (finalClass === '2') {
    return { background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' };
  }
  return { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' };
}

export const SoutList: React.FC<SoutListProps> = ({ onNavigate, filterLeId }) => {
  const moduleEnabled = storage.isModuleEnabled('sout');
  const currentLe = storage.getCurrentLegalEntity();
  const [selectedLeId, setSelectedLeId] = useState<string>(
    filterLeId || (currentLe ? currentLe.id : '')
  );
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [status, setStatus] = useState<EntityStatus>('active');
  const [page, setPage] = useState(1);
  const pageSize = 30;

  if (!moduleEnabled) {
    return (
      <div>
        <h1>Специальная оценка условий труда</h1>
        <div className="alert" style={{ background: '#fffbeb', borderColor: '#fef3c7', color: '#b45309' }}>
          Модуль «СОУТ» отключён. Включите его в{' '}
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
          . Накопленные данные сохранены и не будут потеряны.
        </div>
      </div>
    );
  }

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const departments = storage.getDepartments(selectedLeId || undefined);

  const { items, total } = storage.listSoutCards({
    search: activeSearch,
    legal_entity_id: selectedLeId || undefined,
    department_id: selectedDeptId || undefined,
    final_class: selectedClass || undefined,
    status,
    page,
    pageSize,
  });

  // Аналитика по всем активным картам (без пагинации)
  const allActive = storage.listSoutCards({
    legal_entity_id: selectedLeId || undefined,
    status: 'active',
    page: 1,
    pageSize: 100000,
  }).items;
  const harmfulCount = allActive.filter(c => ['3.1', '3.2', '3.3', '3.4', '4'].includes(c.final_class)).length;
  const declaredCount = allActive.filter(c => c.declaration_active).length;
  const classBreakdown = Object.keys(CLASS_LABELS)
    .map(cls => ({ cls, n: allActive.filter(c => c.final_class === cls).length }))
    .filter(x => x.n > 0);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setPage(1);
  };

  const handleArchive = (card: SoutCard) => {
    const confirmed = window.confirm(
      `Отправить в архив карту СОУТ № «${card.card_number}»? Журнал ознакомления будет сохранён.`
    );
    if (!confirmed) return;
    try {
      storage.archiveSoutCard(card.id);
      setStatus('archived');
      setPage(1);
    } catch (err: any) {
      alert(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestore = (card: SoutCard) => {
    try {
      storage.restoreSoutCard(card.id);
      setStatus('active');
      setPage(1);
    } catch (err: any) {
      alert(err.message || 'Ошибка восстановления');
    }
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    const allFiltered = storage.listSoutCards({
      search: activeSearch,
      legal_entity_id: selectedLeId || undefined,
      department_id: selectedDeptId || undefined,
      final_class: selectedClass || undefined,
      status,
      page: 1,
      pageSize: 100000,
    }).items;
    if (format === 'xlsx') {
      exportSoutToXLSX(allFiltered, `sout_cards_${status}.xlsx`);
    } else {
      exportSoutToCSV(allFiltered, `sout_cards_${status}.csv`);
    }
  };

  const positions = storage.getPositionsRaw();

  return (
    <div>
      <h1>Реестр карт СОУТ</h1>
      <p style={{ color: '#4b5563', marginBottom: '1rem' }}>
        Специальная оценка условий труда (ФЗ-426, Этап 6): учёт классов условий труда, вредных факторов,
        гарантий и компенсаций по ТК РФ (ст. 92, 117, 147, 222), сроков действия карт и деклараций соответствия.
      </p>

      <p className="toolbar">
        <button className="btn" onClick={() => onNavigate('sout-new')}>
          + Создать карту СОУТ
        </button>
        <button className="link-action" onClick={() => onNavigate('sout-import')}>
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

      {/* Виджеты аналитики */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '1rem 0' }}>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.6rem 1rem', minWidth: '130px' }}>
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Всего активных карт</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{allActive.length}</div>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem 1rem', minWidth: '130px' }}>
          <div style={{ fontSize: '0.8rem', color: '#b91c1c' }}>Вредные / опасные (3.x–4)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#991b1b' }}>{harmfulCount}</div>
        </div>
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '0.6rem 1rem', minWidth: '130px' }}>
          <div style={{ fontSize: '0.8rem', color: '#047857' }}>С декларацией (бессрочно)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#065f46' }}>{declaredCount}</div>
        </div>
        {classBreakdown.map(x => (
          <div key={x.cls} style={{ ...classBadgeStyle(x.cls), borderRadius: '6px', padding: '0.6rem 1rem', minWidth: '110px' }}>
            <div style={{ fontSize: '0.8rem' }}>Класс {x.cls}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{x.n}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', margin: '1rem 0' }}>
        <form className="filters" onSubmit={handleSearchSubmit} style={{ margin: 0 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск по номеру карты, должности, отделу, протоколу..."
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Класс условий труда:</label>
          <select
            value={selectedClass}
            onChange={e => {
              setSelectedClass(e.target.value);
              setPage(1);
            }}
            style={{ padding: '0.4rem', border: '1px solid #d0d7de', borderRadius: '4px' }}
          >
            <option value="">Все классы</option>
            {Object.entries(CLASS_LABELS).map(([cls, label]) => (
              <option key={cls} value={cls}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {(activeSearch || selectedLeId || selectedDeptId || selectedClass) && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setSearchQuery('');
              setActiveSearch('');
              setSelectedLeId('');
              setSelectedDeptId('');
              setSelectedClass('');
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
                <th>№ карты</th>
                <th>Юридическое лицо</th>
                <th>Подразделение / Должность</th>
                <th>Класс условий труда</th>
                <th>Факторы</th>
                <th>Занятых</th>
                <th>Срок действия</th>
                <th style={{ width: '160px' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map(card => {
                const le = legalEntities.find(l => l.id === card.legal_entity_id);
                const dept = departments.find(d => d.id === card.department_id) ||
                  storage.getDepartmentById(card.department_id);
                const pos = positions.find(p => p.id === card.position_id);

                return (
                  <tr key={card.id}>
                    <td>
                      <a
                        href={`#sout/${card.id}`}
                        style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
                        onClick={e => {
                          e.preventDefault();
                          onNavigate('sout-view', card.id);
                        }}
                      >
                        № {card.card_number}
                      </a>
                      {card.is_analogous && (
                        <span className="muted" style={{ display: 'block', fontSize: '0.8rem' }}>
                          аналогичное
                        </span>
                      )}
                    </td>
                    <td>
                      <span title={le?.full_name || ''}>{le?.short_name || le?.full_name || '—'}</span>
                    </td>
                    <td>
                      {dept?.name || '—'}
                      <span className="muted" style={{ display: 'block', fontSize: '0.85rem' }}>
                        {pos?.name || '—'}
                        {card.workplace_label ? ` (${card.workplace_label})` : ''}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          ...classBadgeStyle(card.final_class),
                          display: 'inline-block',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                        }}
                      >
                        {CLASS_LABELS[card.final_class] || card.final_class}
                      </span>
                    </td>
                    <td>
                      {card.factors.length > 0 ? (
                        <span title={card.factors.map(f => `${f.type}:${f.class}`).join(', ')}>
                          {card.factors.length} шт.
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{card.employees_count}</td>
                    <td>
                      {card.declaration_active ? (
                        <span style={{ color: '#065f46', fontWeight: 600 }}>Бессрочно (декларация)</span>
                      ) : card.expires_at ? (
                        <span>до {card.expires_at.split('-').reverse().join('.')}</span>
                      ) : (
                        <span className="muted">не указан</span>
                      )}
                    </td>
                    <td>
                      {card.status === 'active' ? (
                        <>
                          <button
                            className="link-action"
                            onClick={() => onNavigate('sout-edit', card.id)}
                          >
                            Изменить
                          </button>{' '}
                          <button
                            className="link-action danger"
                            onClick={() => handleArchive(card)}
                          >
                            В архив
                          </button>
                        </>
                      ) : (
                        <button className="link-action" onClick={() => handleRestore(card)}>
                          Восстановить
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {total > pageSize && (
            <p style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className="secondary"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ← Назад
              </button>
              <span>
                Страница {page} из {Math.ceil(total / pageSize)} (всего: {total})
              </span>
              <button
                className="secondary"
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage(p => p + 1)}
              >
                Вперёд →
              </button>
            </p>
          )}
        </>
      ) : (
        <p className="muted">
          {status === 'active'
            ? 'Карты СОУТ не найдены. Создайте первую карту или выполните импорт из Excel.'
            : 'Архив карт СОУТ пуст.'}
        </p>
      )}
    </div>
  );
};
