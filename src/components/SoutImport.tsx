import React, { useState } from 'react';
import { storage } from '../services/storage';
import {
  downloadSoutTemplate,
  parseExcelFile,
  mapSoutHeaders,
  generateSoutPreview,
} from '../services/excel';
import { SoutImportPreviewData } from '../types';
import { ciCompare } from '../services/validation';

interface SoutImportProps {
  onNavigate: (view: string, id?: string) => void;
}

export const SoutImport: React.FC<SoutImportProps> = ({ onNavigate }) => {
  const moduleEnabled = storage.isModuleEnabled('sout');
  const [mode, setMode] = useState<'add' | 'update'>('add');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SoutImportPreviewData | null>(null);
  const [report, setReport] = useState<{
    added: number;
    updated: number;
    skipped: number;
    rejected: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!moduleEnabled) {
    return (
      <div>
        <h1>Импорт карт СОУТ</h1>
        <div className="alert">Модуль «СОУТ» отключён. Включите его в реестре модулей.</div>
      </div>
    );
  }

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

      const { mapping, problems } = mapSoutHeaders(headers);
      const missingRequired = problems.some(p => p.includes('Отсутствует обязательный столбец'));

      if (missingRequired) {
        setPreview({
          results: [],
          structure_errors: problems,
          summary: { total: 0, add: 0, update: 0, skip: 0, reject: 0 },
        });
        return;
      }

      const allExisting = storage.getSoutCardsRaw();
      const genPreview = generateSoutPreview(rows, mapping, allExisting, mode);
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

        // Подразделение: найти или создать
        let dept = storage
          .getDepartments(le.id)
          .find(dp => ciCompare(dp.name) === ciCompare(d.department_name));
        if (!dept) {
          dept = storage.createDepartment({ legal_entity_id: le.id, name: d.department_name });
        }

        // Должность: справочник D-013 (createPosition возвращает существующую при дубликате)
        let pos = storage
          .getPositions()
          .find(p => ciCompare(p.name) === ciCompare(d.position_name));
        if (!pos) {
          pos = storage.createPosition(d.position_name);
        }

        recordsToCommit.push({
          card_number: d.card_number,
          legal_entity_id: le.id,
          department_id: dept.id,
          position_id: pos.id,
          workplace_label: d.workplace_label || null,
          is_analogous: d.is_analogous === '1',
          analogous_basis: d.analogous_basis || null,
          factors: d.factors ? JSON.parse(d.factors) : [],
          final_class: d.final_class,
          employees_count: Number(d.employees_count) || 0,
          women_count: Number(d.women_count) || 0,
          minors_count: Number(d.minors_count) || 0,
          disabled_count: Number(d.disabled_count) || 0,
          measurement_org: d.measurement_org || null,
          protocol_number: d.protocol_number || null,
          report_approved_at: d.report_approved_at || null,
          declaration_active: d.declaration_active === '1',
          declaration_number: d.declaration_number || null,
        });
      }

      const commitResult = storage.commitSoutImport(recordsToCommit, mode);
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
            onNavigate('sout');
          }}
        >
          ← К реестру карт СОУТ
        </a>
      </p>

      <h1>Импорт карт СОУТ из Excel</h1>
      <p style={{ color: '#4b5563', marginBottom: '1.25rem' }}>
        Загрузка карт СОУТ из файлов .xlsx / .csv (IMPORT_EXPORT §6). Идентификация записи: <strong>номер карты + юридическое лицо</strong>.
        Класс условий труда проверяется по списку 1, 2, 3.1–3.4, 4; вредные факторы указываются в формате «Фактор:класс; Фактор:класс».
      </p>

      <div style={{ marginBottom: '1.5rem', background: '#eef3f8', padding: '1rem', borderRadius: '6px' }}>
        <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>1. Подготовьте файл по шаблону</p>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#4b5563' }}>
          Шаблон содержит 18 колонок: Юридическое лицо, Структурное подразделение, Должность, Номер карты СОУТ, Рабочее место (уточнение),
          Аналогичное рабочее место, Основание аналогичности, Вредные факторы, Класс условий труда, Занятых работников, Из них женщин,
          Из них несовершеннолетних, Из них инвалидов, Организация (измерения), Номер протокола, Дата утверждения отчёта,
          Декларация соответствия, Номер декларации.
        </p>
        <button className="btn btn-secondary" onClick={() => downloadSoutTemplate()}>
          📥 Скачать шаблон (template_sout.xlsx)
        </button>
      </div>

      {errorMsg && (
        <div className="alert" style={{ background: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b', marginBottom: '1rem' }}>
          <strong>Ошибка:</strong> {errorMsg}
        </div>
      )}

      {report && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '6px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#166534' }}>
            ✓ Импорт успешно завершён (транзакция зафиксирована)
          </h3>
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem', color: '#14532d' }}>
            <li>Добавлено новых карт: <strong>{report.added}</strong></li>
            <li>Обновлено существующих (по номеру карты): <strong>{report.updated}</strong></li>
            <li>Пропущено записей: <strong>{report.skipped}</strong></li>
            <li>Отклонено из-за ошибок: <strong>{report.rejected}</strong></li>
          </ul>
          <button className="btn" onClick={() => onNavigate('sout')}>
            Перейти к реестру карт СОУТ
          </button>
        </div>
      )}

      {!report && (
        <form onSubmit={handleProcessPreview} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontWeight: 600 }}>2. Загрузите заполненный файл</p>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Режим импорта:
            </label>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="radio" name="importMode" value="add" checked={mode === 'add'} onChange={() => setMode('add')} />
                <span>Добавлять новые (пропускать существующие номера карт)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="radio" name="importMode" value="update" checked={mode === 'update'} onChange={() => setMode('update')} />
                <span>Обновлять существующие по номеру карты + добавлять новые</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ padding: '0.4rem 0' }} />
            <button type="submit" className="btn" disabled={!selectedFile}>
              Анализировать и предпросмотр
            </button>
          </div>
        </form>
      )}

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

          <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto', marginBottom: '1.25rem' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>Стр.</th>
                  <th style={{ width: '110px' }}>Действие</th>
                  <th>Карта / Рабочее место</th>
                  <th>Организация</th>
                  <th>Класс</th>
                  <th>Факторы</th>
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
                    badgeLabel = 'Отклонено';
                  }

                  let factorsStr = '';
                  if (row.data.factors) {
                    try {
                      const arr = JSON.parse(row.data.factors) as Array<{ type: string; class: string }>;
                      factorsStr = arr.map(f => `${f.type}:${f.class}`).join(', ');
                    } catch {
                      factorsStr = row.data.factors_raw || '';
                    }
                  } else {
                    factorsStr = row.data.factors_raw || '';
                  }

                  return (
                    <tr key={row.row} style={row.action === 'reject' ? { background: '#fef2f2' } : undefined}>
                      <td>{row.row}</td>
                      <td>
                        <span style={{ background: badgeBg, color: badgeColor, padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.82rem', fontWeight: 600 }}>
                          {badgeLabel}
                        </span>
                      </td>
                      <td>
                        <strong>{row.title}</strong>
                        <span className="muted" style={{ display: 'block', fontSize: '0.82rem' }}>
                          {row.data.position_name}
                          {row.data.workplace_label ? ` (${row.data.workplace_label})` : ''}
                          {' · '}
                          {row.data.department_name}
                        </span>
                      </td>
                      <td>{row.data.legal_entity_name}</td>
                      <td>{row.data.final_class || '—'}</td>
                      <td style={{ fontSize: '0.82rem' }}>{factorsStr || '—'}</td>
                      <td>
                        {row.errors.map((err, i) => (
                          <div key={`e${i}`} style={{ color: '#991b1b', fontSize: '0.85rem' }}>❗ {err}</div>
                        ))}
                        {row.warnings.map((w, i) => (
                          <div key={`w${i}`} style={{ color: '#a16207', fontSize: '0.85rem' }}>⚠ {w}</div>
                        ))}
                        {row.changes.map((ch, i) => (
                          <div key={`c${i}`} style={{ color: '#1e40af', fontSize: '0.85rem' }}>{ch}</div>
                        ))}
                        {row.errors.length === 0 && row.warnings.length === 0 && row.changes.length === 0 && (
                          <span className="muted">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              className="btn"
              onClick={handleConfirmImport}
              disabled={preview.summary.add + preview.summary.update === 0}
            >
              Подтвердить импорт
            </button>
            <button className="secondary" onClick={() => setPreview(null)}>
              Отменить
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
