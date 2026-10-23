import React, { useState } from 'react';
import { storage } from '../services/storage';
import {
  downloadTemplate,
  parseExcelFile,
  mapHeaders,
  generatePreview,
} from '../services/excel';
import { ImportPreviewData } from '../types';

interface LegalEntitiesImportProps {
  onNavigate: (view: string, id?: string) => void;
  onRefreshCurrentLe: () => void;
}

export const LegalEntitiesImport: React.FC<LegalEntitiesImportProps> = ({
  onNavigate,
  onRefreshCurrentLe,
}) => {
  const [mode, setMode] = useState<'add' | 'update'>('add');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
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

      const { mapping, problems } = mapHeaders(headers);
      if (!Object.values(mapping).includes('full_name')) {
        setPreview({
          results: [],
          structure_errors: problems,
          summary: { total: 0, add: 0, update: 0, skip: 0, reject: 0 },
        });
        return;
      }

      const allExisting = storage.listLegalEntities({ pageSize: 100000 }).items;
      const genPreview = generatePreview(rows, mapping, allExisting, mode);
      genPreview.structure_errors = problems;
      setPreview(genPreview);
    } catch (err: any) {
      setErrorMsg(`Ошибка чтения файла: ${err.message || 'Не удалось прочесть файл'}`);
    }
  };

  const handleConfirmImport = () => {
    if (!preview || preview.results.length === 0) return;

    try {
      const recordsToCommit = preview.results
        .filter(r => r.action === 'add' || r.action === 'update')
        .map(r => r.data);

      const res = storage.commitImport(recordsToCommit, mode);
      setReport({
        added: res.added,
        updated: res.updated,
        skipped: preview.summary.skip,
        rejected: preview.summary.reject,
      });
      onRefreshCurrentLe();
    } catch (err: any) {
      setErrorMsg(`Ошибка при сохранении: ${err.message}`);
    }
  };

  const hasBlockingErrors =
    Boolean(preview?.structure_errors && preview.structure_errors.length > 0) ||
    Boolean(preview?.results.some(r => r.action === 'reject'));

  const actionName = (action: string) => {
    switch (action) {
      case 'add':
        return 'добавить';
      case 'update':
        return 'обновить';
      case 'skip':
        return 'пропустить';
      case 'reject':
        return 'отклонить';
      default:
        return action;
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
            onNavigate('legal-entities');
          }}
        >
          ← К списку юридических лиц
        </a>
      </p>

      <h1>Импорт юридических лиц из Excel</h1>
      <p style={{ color: '#4b5563', margin: '0.4rem 0' }}>
        1. Скачайте{' '}
        <button
          className="link-action"
          type="button"
          onClick={downloadTemplate}
        >
          шаблон (.xlsx)
        </button>
        , заполните его (обязательный столбец — «Полное наименование»). Идентификация: ИНН+КПП, затем ОГРН.
      </p>
      <p style={{ color: '#4b5563', margin: '0.4rem 0' }}>
        2. Загрузите файл — увидите предпросмотр с ошибками и предупреждениями.
      </p>
      <p style={{ color: '#4b5563', margin: '0.4rem 0' }}>
        3. Подтвердите импорт — сохранение выполняется одной транзакцией; при отмене данные не изменяются.
      </p>

      {errorMsg && (
        <div className="alert" style={{ marginTop: '1rem' }}>
          <p>{errorMsg}</p>
        </div>
      )}

      {report && (
        <div className="ok" style={{ marginTop: '1.25rem' }}>
          <p>
            Импорт завершён: добавлено — {report.added}, обновлено — {report.updated},
            пропущено — {report.skipped}, отклонено — {report.rejected}.
          </p>
          <div style={{ marginTop: '0.8rem' }}>
            <button className="btn" onClick={() => onNavigate('legal-entities')}>
              Перейти к списку юридических лиц
            </button>
          </div>
        </div>
      )}

      {!report && (
        <form onSubmit={handleProcessPreview} style={{ marginTop: '1.25rem' }}>
          <div className="form-row">
            <label htmlFor="file">Файл .xlsx или .csv</label>
            <input
              id="file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              required
            />
          </div>

          <div className="form-row">
            <label htmlFor="mode">Режим совпадений</label>
            <select
              id="mode"
              value={mode}
              onChange={e => setMode(e.target.value as 'add' | 'update')}
            >
              <option value="add">Пропускать дубликаты</option>
              <option value="update">Обновлять после идентификации</option>
            </select>
          </div>

          <button className="btn" type="submit" style={{ marginTop: '0.5rem' }}>
            Проверить и показать предпросмотр
          </button>
        </form>
      )}

      {preview && !report && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Предпросмотр</h2>

          {preview.structure_errors.length > 0 && (
            <div className="alert">
              {preview.structure_errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}

          {preview.results.length > 0 && (
            <>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Строка</th>
                    <th>Наименование</th>
                    <th style={{ width: '110px' }}>Действие</th>
                    <th>Ошибки / предупреждения / изменения</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.results.map((r, i) => (
                    <tr key={i}>
                      <td>{r.row}</td>
                      <td>{r.name}</td>
                      <td>
                        <span
                          className={`badge ${
                            r.action === 'add'
                              ? 'ok'
                              : r.action === 'reject'
                              ? 'warn'
                              : ''
                          }`}
                        >
                          {actionName(r.action)}
                        </span>
                      </td>
                      <td>
                        {r.errors.map((e, idx) => (
                          <p key={`err-${idx}`} className="err">
                            {e}
                          </p>
                        ))}
                        {r.warnings.map((w, idx) => (
                          <p key={`warn-${idx}`} className="warn">
                            {w}
                          </p>
                        ))}
                        {r.changes.map((c, idx) => (
                          <p key={`chg-${idx}`}>{c}</p>
                        ))}
                        {r.errors.length === 0 &&
                          r.warnings.length === 0 &&
                          r.changes.length === 0 && (
                            <span className="muted">—</span>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p style={{ marginTop: '0.8rem', fontWeight: 500 }}>
                Итог: будет добавлено — {preview.summary.add}, обновлено —{' '}
                {preview.summary.update}, пропущено — {preview.summary.skip},
                отклонено — {preview.summary.reject}.
              </p>

              <div className="toolbar" style={{ marginTop: '1.25rem' }}>
                <button
                  className="btn"
                  onClick={handleConfirmImport}
                  disabled={hasBlockingErrors || (preview.summary.add === 0 && preview.summary.update === 0)}
                >
                  Подтвердить импорт
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setPreview(null);
                    setSelectedFile(null);
                  }}
                >
                  Отменить (данные не сохранятся)
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
