import React, { useState } from 'react';
import { storage } from '../services/storage';
import { exportEmployeesToXLSX, exportEmployeesToCSV, formatDateForDisplay } from '../services/excel';
import { Employee, EntityStatus } from '../types';

interface EmployeesListProps {
  onNavigate: (view: string, id?: string) => void;
  filterLeId?: string;
}

export const EmployeesList: React.FC<EmployeesListProps> = ({
  onNavigate,
  filterLeId,
}) => {
  const currentLe = storage.getCurrentLegalEntity();
  const [selectedLeId, setSelectedLeId] = useState<string>(
    filterLeId || (currentLe ? currentLe.id : '')
  );
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedPosId, setSelectedPosId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [status, setStatus] = useState<EntityStatus>('active');
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const departments = storage.getDepartments(selectedLeId || undefined);
  const positions = storage.getPositions();
  const contingentList = storage.getContingentRaw();

  const { items, total } = storage.listEmployees({
    search: activeSearch,
    legal_entity_id: selectedLeId || undefined,
    department_id: selectedDeptId || undefined,
    position_id: selectedPosId || undefined,
    status,
    page,
    pageSize,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setPage(1);
  };

  const handleArchive = (employee: Employee) => {
    const fullName = `${employee.last_name} ${employee.first_name}${employee.middle_name ? ' ' + employee.middle_name : ''}`;
    const confirmed = window.confirm(
      `Отправить в архив работника «${fullName}»? История кадровых перемещений будет сохранена.`
    );
    if (!confirmed) return;

    try {
      storage.archiveEmployee(employee.id);
      setStatus('archived');
    } catch (err: any) {
      alert(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestore = (employee: Employee) => {
    try {
      storage.restoreEmployee(employee.id);
      setStatus('active');
    } catch (err: any) {
      alert(err.message || 'Ошибка восстановления');
    }
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    const allFiltered = storage.listEmployees({
      search: activeSearch,
      legal_entity_id: selectedLeId || undefined,
      department_id: selectedDeptId || undefined,
      position_id: selectedPosId || undefined,
      status,
      page: 1,
      pageSize: 100000,
    }).items;

    if (format === 'xlsx') {
      exportEmployeesToXLSX(allFiltered, `employees_${status}.xlsx`);
    } else {
      exportEmployeesToCSV(allFiltered, `employees_${status}.csv`);
    }
  };

  return (
    <div>
      <h1>Реестр работников</h1>
      <p style={{ color: '#4b5563', marginBottom: '1rem' }}>
        Поимённый список работников (этап 4, FR-07…FR-09): учёт СНИЛС, связь с контингентом, кадровые перемещения (D-005).
      </p>

      <p className="toolbar">
        <button className="btn" onClick={() => onNavigate('employees-new')}>
          + Добавить работника
        </button>
        <button
          className="link-action"
          onClick={() => onNavigate('employees-import')}
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
            Архивные работники
          </button>
        ) : (
          <button
            className="link-action"
            onClick={() => {
              setStatus('active');
              setPage(1);
            }}
          >
            Активные работники
          </button>
        )}
      </p>

      {/* Панель фильтрации */}
      <div className="filter-panel">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedLeId}
            onChange={e => {
              setSelectedLeId(e.target.value);
              setSelectedDeptId('');
              setPage(1);
            }}
            style={{ minWidth: '220px' }}
          >
            <option value="">Все юридические лица</option>
            {legalEntities.map(le => (
              <option key={le.id} value={le.id}>
                {le.short_name || le.full_name}
              </option>
            ))}
          </select>

          <select
            value={selectedDeptId}
            onChange={e => {
              setSelectedDeptId(e.target.value);
              setPage(1);
            }}
            style={{ minWidth: '180px' }}
            disabled={!selectedLeId && departments.length === 0}
          >
            <option value="">Все подразделения</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={selectedPosId}
            onChange={e => {
              setSelectedPosId(e.target.value);
              setPage(1);
            }}
            style={{ minWidth: '180px' }}
          >
            <option value="">Все должности</option>
            {positions.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <input
            type="search"
            placeholder="Поиск по ФИО, СНИЛС..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />

          <button type="submit" className="btn btn-secondary">
            Найти
          </button>

          {(selectedLeId || selectedDeptId || selectedPosId || activeSearch) && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSelectedLeId('');
                setSelectedDeptId('');
                setSelectedPosId('');
                setSearchQuery('');
                setActiveSearch('');
                setPage(1);
              }}
            >
              Сброс
            </button>
          )}
        </form>
      </div>

      {status === 'archived' && (
        <div className="alert" style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#92400e', marginBottom: '1rem' }}>
          <strong>Режим архива.</strong> Показаны уволенные/архивированные работники. Доступно восстановление.
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#fff', border: '1px dashed #d0d7de', borderRadius: '6px' }}>
          <p style={{ color: '#57606a', fontSize: '1.05rem', margin: '0 0 1rem' }}>
            {status === 'active'
              ? 'Работники не найдены.'
              : 'В архиве нет работников.'}
          </p>
          {status === 'active' && (
            <button className="btn" onClick={() => onNavigate('employees-new')}>
              + Добавить первого работника
            </button>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ФИО работника</th>
                <th>Организация</th>
                <th>Подразделение</th>
                <th>Должность</th>
                <th>СНИЛС</th>
                <th>Дата приёма</th>
                <th>Контингент</th>
                <th style={{ width: '160px' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map(employee => {
                const le = legalEntities.find(l => l.id === employee.legal_entity_id);
                const dept = departments.find(d => d.id === employee.department_id);
                const pos = positions.find(p => p.id === employee.position_id);
                const contingentRec = employee.contingent_record_id
                  ? contingentList.find(c => c.id === employee.contingent_record_id)
                  : null;

                const fullName = `${employee.last_name} ${employee.first_name}${employee.middle_name ? ' ' + employee.middle_name : ''}`;

                return (
                  <tr key={employee.id}>
                    <td>
                      <a
                        href={`#employees/${employee.id}`}
                        onClick={e => {
                          e.preventDefault();
                          onNavigate('employees-view', employee.id);
                        }}
                        style={{ fontWeight: 600, color: 'var(--accent)' }}
                      >
                        {fullName}
                      </a>
                    </td>
                    <td>{le?.short_name || le?.full_name || '—'}</td>
                    <td>{dept?.name || '—'}</td>
                    <td>{pos?.name || '—'}</td>
                    <td>
                      {employee.snils ? (
                        <span style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}>
                          {employee.snils}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Не указан</span>
                      )}
                    </td>
                    <td>{formatDateForDisplay(employee.hire_date) || '—'}</td>
                    <td>
                      {contingentRec ? (
                        <a
                          href={`#contingent/${contingentRec.id}`}
                          onClick={e => {
                            e.preventDefault();
                            onNavigate('contingent-view', contingentRec.id);
                          }}
                          className="badge"
                          style={{
                            background: '#dcfce7',
                            color: '#166534',
                            textDecoration: 'none',
                            display: 'inline-block',
                          }}
                          title="Привязан к записи контингента"
                        >
                          ✓ {contingentRec.workplace_label || 'Привязан'}
                        </a>
                      ) : (
                        <span
                          className="badge"
                          style={{ background: '#f3f4f6', color: '#6b7280' }}
                          title="Позиция контингента не привязана"
                        >
                          Не привязан
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn-sm btn-secondary"
                          onClick={() => onNavigate('employees-view', employee.id)}
                        >
                          Инфо
                        </button>
                        <button
                          className="btn-sm btn-secondary"
                          onClick={() => onNavigate('employees-edit', employee.id)}
                        >
                          Ред.
                        </button>
                        {status === 'active' ? (
                          <button
                            className="btn-sm btn-secondary"
                            onClick={() => handleArchive(employee)}
                            title="В архив"
                          >
                            В архив
                          </button>
                        ) : (
                          <button
                            className="btn-sm btn-secondary"
                            onClick={() => handleRestore(employee)}
                            title="Восстановить"
                          >
                            Восст.
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Пагинация */}
      {total > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <span style={{ fontSize: '0.88rem', color: '#6b7280' }}>
            Показано {items.length} из {total} работников
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn-sm btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              ← Назад
            </button>
            <span style={{ padding: '0.2rem 0.5rem', fontSize: '0.9rem' }}>
              Страница {page} из {Math.ceil(total / pageSize)}
            </span>
            <button
              className="btn-sm btn-secondary"
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage(p => p + 1)}
            >
              Вперёд →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
