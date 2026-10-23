import React, { useState } from 'react';
import { storage } from '../services/storage';
import {
  downloadEmployeeTemplate,
  parseExcelFile,
  mapEmployeeHeaders,
  generateEmployeePreview,
  formatDateForDisplay,
} from '../services/excel';
import { EmployeeImportPreviewData } from '../types';
import { ciCompare } from '../services/validation';

interface EmployeesImportProps {
  onNavigate: (view: string, id?: string) => void;
}

export const EmployeesImport: React.FC<EmployeesImportProps> = ({ onNavigate }) => {
  const [mode, setMode] = useState<'add' | 'update'>('add');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<EmployeeImportPreviewData | null>(null);
  const [report, setReport] = useState<{
    added: number;
    updated: number;
    skipped: number;
    rejected: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setPreview(null);
      setReport(null);
      setErrorMsg(null);
    }
  };

  const handleProcessPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Пожалуйста, выберите файл .xlsx или .csv');
      return;
    }
    setErrorMsg(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const { headers, rows, structuralErrors } = parseExcelFile(buffer);

      if (structuralErrors.length > 0) {
        setPreview({
          results: [],
          structure_errors: structuralErrors,
          summary: { total: 0, add: 0, update: 0, skip: 0, reject: 0 },
        });
        return;
      }

      const { mapping, problems } = mapEmployeeHeaders(headers);
      const missingRequired = problems.some(p => p.includes('Отсутствует обязательный столбец'));

      if (missingRequired) {
        setPreview({
          results: [],
          structure_errors: problems,
          summary: { total: 0, add: 0, update: 0, skip: 0, reject: 0 },
        });
        return;
      }

      const allExisting = storage.getEmployeesRaw();
      const genPreview = generateEmployeePreview(rows, mapping, allExisting, mode);
      genPreview.structure_errors = problems;
      setPreview(genPreview);
    } catch (err: any) {
      setErrorMsg(`Ошибка чтения файла: ${err.message || 'Не удалось прочесть файл'}`);
    }
  };

  const handleConfirmImport = () => {
    if (!preview || preview.results.length === 0) return;

    try {
      const recordsToCommit: any[] = [];
      const les = storage.listLegalEntities({ pageSize: 10000 }).items;
      const contingentList = storage.getContingentRaw();

      for (const res of preview.results) {
        if (res.action === 'skip' || res.action === 'reject') continue;

        const d = res.data;
        const le = les.find(
          l =>
            l.inn === d.legal_entity_name ||
            ciCompare(l.full_name) === ciCompare(d.legal_entity_name) ||
            (l.short_name && ciCompare(l.short_name) === ciCompare(d.legal_entity_name))
        );
        if (!le) continue;

        // Ensure department exists
        let dept = storage
          .getDepartments(le.id)
          .find(dp => ciCompare(dp.name) === ciCompare(d.department_name));
        if (!dept) {
          dept = storage.createDepartment({
            legal_entity_id: le.id,
            name: d.department_name,
          });
        }

        // Ensure position exists in dictionary (D-013)
        let pos = storage
          .getPositions()
          .find(p => ciCompare(p.name) === ciCompare(d.position_name));
        if (!pos) {
          pos = storage.createPosition(d.position_name);
        }

        // Match contingent record if label provided
        let contingentId: string | null = null;
        if (d.contingent_label) {
          const matchContingent = contingentList.find(
            c =>
              c.legal_entity_id === le.id &&
              c.status === 'active' &&
              ciCompare(c.workplace_label || '') === ciCompare(d.contingent_label || '')
          );
          if (matchContingent) {
            contingentId = matchContingent.id;
          }
        }

        recordsToCommit.push({
          legal_entity_id: le.id,
          department_id: dept.id,
          position_id: pos.id,
          last_name: d.last_name,
          first_name: d.first_name,
          middle_name: d.middle_name || null,
          hire_date: d.hire_date || null,
          birth_date: d.birth_date || null,
          snils: d.snils || null,
          contingent_record_id: contingentId,
        });
      }

      const commitResult = storage.commitEmployeeImport(recordsToCommit, mode);
      setReport({
        ...commitResult,
        rejected: commitResult.rejected + preview.summary.reject,
      });
      setPreview(null);
    } catch (err: any) {
      setErrorMsg(`Сбой транзакции импорта: ${err.message || 'Ошибка импорта'}`);
    }
  };

  return (
    <div>
      <p>
        <a
          href="#back"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}
          onClick={e => {
            e.preventDefault();
            onNavigate('employees');
          }}
        >
          ← К реестру работников
        </a>
      </p>

      <h1>Импорт списка работников из Excel</h1>
      <p style={{ color: '#4b5563', marginBottom: '1.25rem' }}>
        Загрузка списка работников из файлов .xlsx / .csv (IMPORT_EXPORT §5). Идентификация проводится по <strong>СНИЛС + Юридическое лицо</strong>. Без СНИЛС записи добавляются новыми без автоматического объединения по ФИО.
      </p>

      {/* Кнопка скачивания шаблона */}
      <div style={{ marginBottom: '1.5rem', background: '#eef3f8', padding: '1rem', borderRadius: '6px' }}>
        <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>1. Подготовьте файл по шаблону</p>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#4b5563' }}>
          Шаблон содержит 10 колонок: Юридическое лицо, Структурное подразделение, Должность, Фамилия, Имя, Отчество, Дата приёма, Дата рождения, СНИЛС, Запись контингента.
        </p>
        <button className="btn btn-secondary" onClick={() => downloadEmployeeTemplate()}>
          📥 Скачать шаблон (template_employees.xlsx)
        </button>
      </div>

      {errorMsg && (
        <div className="alert" style={{ background: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b', marginBottom: '1rem' }}>
          <strong>Ошибка:</strong> {errorMsg}
        </div>
      )}

      {/* Отчёт об успешном завершении */}
      {report && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '6px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#166534' }}>
            ✓ Импорт успешно завершён (транзакция зафиксирована)
          </h3>
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem', color: '#14532d' }}>
            <li>Добавлено новых работников: <strong>{report.added}</strong></li>
            <li>Обновлено существующих (по СНИЛС): <strong>{report.updated}</strong></li>
            <li>Пропущено записей: <strong>{report.skipped}</strong></li>
            <li>Отклонено из-за ошибок: <strong>{report.rejected}</strong></li>
          </ul>
          <button className="btn" onClick={() => onNavigate('employees')}>
            Перейти к списку работников
          </button>
        </div>
      )}

      {/* Форма выбора файла */}
      {!report && (
        <form onSubmit={handleProcessPreview} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontWeight: 600 }}>2. Загрузите заполненный файл</p>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Режим импорта:
            </label>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="importMode"
                  value="add"
                  checked={mode === 'add'}
                  onChange={() => setMode('add')}
                />
                <span>Добавлять новые (пропускать дубликаты по СНИЛС)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="importMode"
                  value="update"
                  checked={mode === 'update'}
                  onChange={() => setMode('update')}
                />
                <span>Обновлять существующие по СНИЛС + добавлять новые</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              style={{ padding: '0.4rem 0' }}
            />
            <button type="submit" className="btn" disabled={!selectedFile}>
              Анализировать и предпросмотр
            </button>
          </div>
        </form>
      )}

      {/* Блок предпросмотра */}
      {preview && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2>3. Предварительный просмотр данных</h2>

          {preview.structure_errors.length > 0 && (
            <div className="alert" style={{ background: '#fffbeb', borderColor: '#fef3c7', color: '#b45309', marginBottom: '1rem' }}>
              <strong>Замечания к структуре файла:</strong>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                {preview.structure_errors.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Счётчики сводки */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.6rem 1rem', flex: 1, minWidth: '120px' }}>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Всего строк</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{preview.summary.total}</div>
            </div>
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '0.6rem 1rem', flex: 1, minWidth: '120px' }}>
              <div style={{ fontSize: '0.8rem', color: '#047857' }}>К добавлению</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#065f46' }}>{preview.summary.add}</div>
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.6rem 1rem', flex: 1, minWidth: '120px' }}>
              <div style={{ fontSize: '0.8rem', color: '#1d4ed8' }}>К обновлению</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e40af' }}>{preview.summary.update}</div>
            </div>
            <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: '6px', padding: '0.6rem 1rem', flex: 1, minWidth: '120px' }}>
              <div style={{ fontSize: '0.8rem', color: '#a16207' }}>Будет пропущено</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#854d0e' }}>{preview.summary.skip}</div>
            </div>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem 1rem', flex: 1, minWidth: '120px' }}>
              <div style={{ fontSize: '0.8rem', color: '#b91c1c' }}>Ошибки / Отклонено</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#991b1b' }}>{preview.summary.reject}</div>
            </div>
          </div>

          {/* Таблица строк */}
          <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto', marginBottom: '1.25rem' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>Стр.</th>
                  <th style={{ width: '110px' }}>Действие</th>
                  <th>Работник</th>
                  <th>Организация</th>
                  <th>Подразделение</th>
                  <th>Должность</th>
                  <th>СНИЛС</th>
                  <th>Даты</th>
                  <th>Статус проверки / Ошибки</th>
                </tr>
              </thead>
              <tbody>
                {preview.results.map(row => {
                  let badgeBg = '#ecfdf5';
                  let badgeColor = '#065f46';
                  let badgeLabel = 'Добавить';

                  if (row.action === 'update') {
                    badgeBg = '#eff6ff';
                    badgeColor = '#1e40af';
                    badgeLabel = 'Обновить';
                  } else if (row.action === 'skip') {
                    badgeBg = '#fefce8';
                    badgeColor = '#854d0e';
                    badgeLabel = 'Пропустить';
                  } else if (row.action === 'reject') {
                    badgeBg = '#fef2f2';
                    badgeColor = '#991b1b';
                    badgeLabel = 'Отклонить';
                  }

                  return (
                    <tr key={row.row} style={row.action === 'reject' ? { background: '#fff5f5' } : {}}>
                      <td>{row.row}</td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: badgeBg, color: badgeColor, fontWeight: 600 }}
                        >
                          {badgeLabel}
                        </span>
                      </td>
                      <td>
                        <strong>{row.title}</strong>
                      </td>
                      <td>{row.data.legal_entity_name || '—'}</td>
                      <td>{row.data.department_name || '—'}</td>
                      <td>{row.data.position_name || '—'}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace' }}>
                          {row.data.snils || '—'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {row.data.hire_date && `Приём: ${formatDateForDisplay(row.data.hire_date)}; `}
                        {row.data.birth_date && `Рожд: ${formatDateForDisplay(row.data.birth_date)}`}
                        {!row.data.hire_date && !row.data.birth_date && '—'}
                      </td>
                      <td>
                        {row.errors.length > 0 && (
                          <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>
                            {row.errors.join('; ')}
                          </div>
                        )}
                        {row.warnings.length > 0 && (
                          <div style={{ color: '#d97706', fontSize: '0.85rem' }}>
                            {row.warnings.join('; ')}
                          </div>
                        )}
                        {row.changes.length > 0 && (
                          <div style={{ color: '#2563eb', fontSize: '0.85rem' }}>
                            {row.changes.join('; ')}
                          </div>
                        )}
                        {row.errors.length === 0 && row.warnings.length === 0 && row.changes.length === 0 && (
                          <span style={{ color: '#16a34a', fontSize: '0.85rem' }}>✓ Корректно</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              className="btn"
              onClick={handleConfirmImport}
              disabled={preview.summary.add === 0 && preview.summary.update === 0}
            >
              Подтвердить импорт ({preview.summary.add + preview.summary.update} записей)
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setPreview(null);
                setSelectedFile(null);
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
