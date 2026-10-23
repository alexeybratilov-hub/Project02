import React, { useState } from 'react';
import { storage } from '../services/storage';

export const DictionariesView: React.FC = () => {
  const [tab, setTab] = useState<'positions' | 'departments' | 'conditions'>('positions');
  const [newPosName, setNewPosName] = useState('');
  const [posError, setPosError] = useState<string | null>(null);

  const [selectedLeId, setSelectedLeId] = useState<string>('');
  const [newDeptName, setNewDeptName] = useState('');
  const [deptParentId, setDeptParentId] = useState<string>('');
  const [deptError, setDeptError] = useState<string | null>(null);

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const positions = storage.getPositions();
  const departments = storage.getDepartments(selectedLeId || undefined);
  const schedules = storage.getWorkSchedules();
  const shifts = storage.getShiftPatterns();
  const subclasses = storage.getWorkConditionSubclasses();
  const elecGroups = storage.getElectricalSafetyGroups();

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    setPosError(null);
    if (!newPosName.trim()) return;
    try {
      storage.createPosition(newPosName.trim());
      setNewPosName('');
    } catch (err: any) {
      setPosError(err.message);
    }
  };

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    setDeptError(null);
    if (!selectedLeId) {
      setDeptError('Выберите юридическое лицо.');
      return;
    }
    if (!newDeptName.trim()) return;
    try {
      storage.createDepartment({
        legal_entity_id: selectedLeId,
        name: newDeptName.trim(),
        parent_id: deptParentId || null,
      });
      setNewDeptName('');
      setDeptParentId('');
    } catch (err: any) {
      setDeptError(err.message);
    }
  };

  return (
    <div>
      <h1>Справочники системы</h1>
      <p style={{ color: '#4b5563', marginBottom: '1.25rem' }}>
        Единые классификаторы и справочники (FR-03, FR-04, DATA_MODEL §1.2–1.4): должности, подразделения, режимы работы и условия труда.
      </p>

      <div className="toolbar" style={{ borderBottom: '1px solid #d0d7de', paddingBottom: '0.5rem' }}>
        <button
          className={tab === 'positions' ? 'btn' : 'btn secondary'}
          onClick={() => setTab('positions')}
        >
          Должности (глобальный справочник)
        </button>
        <button
          className={tab === 'departments' ? 'btn' : 'btn secondary'}
          onClick={() => setTab('departments')}
        >
          Подразделения (по юрлицам)
        </button>
        <button
          className={tab === 'conditions' ? 'btn' : 'btn secondary'}
          onClick={() => setTab('conditions')}
        >
          Условия труда и режимы работы
        </button>
      </div>

      {tab === 'positions' && (
        <div style={{ marginTop: '1.25rem' }}>
          <h2>Справочник должностей (D-013)</h2>
          <p style={{ color: '#4b5563', fontSize: '0.9rem' }}>
            Единый глобальный справочник должностей. Дубликаты нормализуются по регистру и пробелам.
          </p>

          <form onSubmit={handleAddPosition} style={{ display: 'flex', gap: '0.6rem', margin: '1rem 0' }}>
            <input
              type="text"
              placeholder="Новая должность (профессия)..."
              value={newPosName}
              onChange={e => setNewPosName(e.target.value)}
              style={{ width: '360px', padding: '0.45rem', border: '1px solid #d0d7de', borderRadius: '4px' }}
            />
            <button className="btn" type="submit">
              + Добавить должность
            </button>
          </form>

          {posError && (
            <div className="alert">
              <p>{posError}</p>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th>Наименование должности</th>
                <th>Нормализованное значение</th>
                <th style={{ width: '120px' }}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td className="muted">{p.normalized_name}</td>
                  <td>
                    <span className="badge ok">активна</span>
                  </td>
                </tr>
              ))}
              {positions.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty">
                    Должностей пока нет — добавьте первую.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'departments' && (
        <div style={{ marginTop: '1.25rem' }}>
          <h2>Справочник подразделений (FR-03)</h2>
          <p style={{ color: '#4b5563', fontSize: '0.9rem' }}>
            Подразделения принадлежат конкретному юридическому лицу и поддерживают иерархию (родительское подразделение).
          </p>

          <div className="form-row" style={{ maxWidth: '400px', margin: '1rem 0' }}>
            <label htmlFor="dept_le_select">Выберите юридическое лицо:</label>
            <select
              id="dept_le_select"
              value={selectedLeId}
              onChange={e => setSelectedLeId(e.target.value)}
            >
              <option value="">-- Выберите организацию --</option>
              {legalEntities.map(le => (
                <option key={le.id} value={le.id}>
                  {le.full_name}
                </option>
              ))}
            </select>
          </div>

          {selectedLeId && (
            <form onSubmit={handleAddDepartment} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Наименование подразделения..."
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
                style={{ width: '280px', padding: '0.45rem', border: '1px solid #d0d7de', borderRadius: '4px' }}
              />
              <select
                value={deptParentId}
                onChange={e => setDeptParentId(e.target.value)}
                style={{ padding: '0.45rem', border: '1px solid #d0d7de', borderRadius: '4px' }}
              >
                <option value="">Без вышестоящего (корневое)</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    Входит в: {d.name}
                  </option>
                ))}
              </select>
              <button className="btn" type="submit">
                + Добавить
              </button>
            </form>
          )}

          {deptError && (
            <div className="alert">
              <p>{deptError}</p>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th>Наименование подразделения</th>
                <th>Родительское подразделение</th>
                <th style={{ width: '120px' }}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {departments.map(d => {
                const parent = departments.find(p => p.id === d.parent_id);
                return (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 500 }}>{d.name}</td>
                    <td>{parent ? parent.name : <span className="muted">— (корневое)</span>}</td>
                    <td>
                      <span className="badge ok">активно</span>
                    </td>
                  </tr>
                );
              })}
              {departments.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty">
                    {selectedLeId
                      ? 'В выбранном юридическом лице пока нет подразделений.'
                      : 'Выберите юридическое лицо выше для просмотра подразделений.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'conditions' && (
        <div style={{ marginTop: '1.25rem' }}>
          <h2>Классификаторы условий труда (DATA_MODEL §1.4)</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
            <div>
              <h3>Графики работы</h3>
              <table>
                <thead>
                  <tr>
                    <th>Наименование графика</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(ws => (
                    <tr key={ws.id}>
                      <td>{ws.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3>Сменность</h3>
              <table>
                <thead>
                  <tr>
                    <th>Вид сменности</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map(sp => (
                    <tr key={sp.id}>
                      <td>{sp.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3>Подклассы условий труда (СОУТ)</h3>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Код</th>
                    <th>Наименование</th>
                  </tr>
                </thead>
                <tbody>
                  {subclasses.map(wcs => (
                    <tr key={wcs.id}>
                      <td>
                        <span className="badge">{wcs.code}</span>
                      </td>
                      <td>{wcs.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3>Группы по электробезопасности</h3>
              <table>
                <thead>
                  <tr>
                    <th>Группа</th>
                  </tr>
                </thead>
                <tbody>
                  {elecGroups.map(eg => (
                    <tr key={eg.id}>
                      <td>{eg.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
