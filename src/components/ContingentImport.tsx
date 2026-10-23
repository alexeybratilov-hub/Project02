import React, { useState } from 'react';
import { storage } from '../services/storage';
import {
  downloadContingentTemplate,
  parseExcelFile,
  mapContingentHeaders,
  generateContingentPreview,
} from '../services/excel';
import { ContingentImportPreviewData } from '../types';

interface ContingentImportProps {
  onNavigate: (view: string, id?: string) => void;
}

export const ContingentImport: React.FC<ContingentImportProps> = ({ onNavigate }) => {
  const [mode, setMode] = useState<'add' | 'update'>('add');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ContingentImportPreviewData | null>(null);
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

      const { mapping, problems } = mapContingentHeaders(headers);
      const missingRequired = problems.some(p => p.includes('Отсутствует обязательный столбец'));

      if (missingRequired) {
        setPreview({
          results: [],
          structure_errors: problems,
          summary: { total: 0, add: 0, update: 0, skip: 0, reject: 0 },
        });
        return;
      }

      const allExisting = storage.getContingentRaw();
      const genPreview = generateContingentPreview(rows, mapping, allExisting, mode);
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
      const wsList = storage.getWorkSchedules();
      const spList = storage.getShiftPatterns();
      const wcsList = storage.getWorkConditionSubclasses();
      const esgList = storage.getElectricalSafetyGroups();

      for (const res of preview.results) {
        if (res.action === 'skip' || res.action === 'reject') continue;

        const d = res.data;
        const le = les.find(
          l =>
            l.inn === d.legal_entity_name ||
            l.full_name.toLowerCase() === d.legal_entity_name.toLowerCase() ||
            (l.short_name && l.short_name.toLowerCase() === d.legal_entity_name.toLowerCase())
        );
        if (!le) continue;

        // Find or create Department
        let dept = storage
          .getDepartments(le.id)
          .find(dp => dp.name.toLowerCase() === d.department_name.toLowerCase());
        if (!dept) {
          dept = storage.createDepartment({ legal_entity_id: le.id, name: d.department_name });
        }

        // Find or create Position
        const pos = storage.createPosition(d.position_name);

        // Optional references
        const ws = wsList.find(w => w.name.toLowerCase() === (d.work_schedule_name || '').toLowerCase());
        const sp = spList.find(s => s.name.toLowerCase() === (d.shift_pattern_name || '').toLowerCase());
        const wcs = wcsList.find(
          w =>
            w.code === (d.work_condition_subclass_name || '') ||
            w.name.toLowerCase() === (d.work_condition_subclass_name || '').toLowerCase()
        );
        const esg = esgList.find(
          e => e.name.toLowerCase() === (d.electrical_safety_group_name || '').toLowerCase()
        );

        const items29 = (d.items_29n || '')
          .split(/[;,]/)
          .map(s => s.trim())
          .filter(Boolean);
        const items342 = (d.items_342n || '')
          .split(/[;,]/)
          .map(s => s.trim())
          .filter(Boolean);

        recordsToCommit.push({
          legal_entity_id: le.id,
          department_id: dept.id,
          position_id: pos.id,
          workplace_label: d.workplace_label || null,
          work_schedule_id: ws?.id || null,
          shift_pattern_id: sp?.id || null,
          risk_card_number: d.risk_card_number || null,
          sout_card_number: d.sout_card_number || null,
          work_condition_subclass_id: wcs?.id || null,
          medical_items_29n: items29,
          medical_items_342n: items342,
          training_program: d.training_program || null,
          internship_program: d.internship_program || null,
          electrical_safety_group_id: esg?.id || null,
        });
      }

      const result = storage.commitContingentImport(recordsToCommit, mode);
      setReport({
        added: result.added,
        updated: result.updated,
        skipped: preview.summary.skip,
        rejected: preview.summary.reject,
      });
    } catch (err: any) {
      setErrorMsg(`Ошибка при сохранении: ${err.message}`);
    }
  };

  const hasBlockingErrors =
    Boolean(preview?.structure_errors && preview.structure_errors.length > 0) ||
    Boolean(preview?.results.some(r => r.action === 'reject'));

  return (
    <div>
      <p>
        <a
          href="#back"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}
          onClick={e => {
            e.preventDefault();
            onNavigate('contingent');
          }}
        >
          ← К реестру контингента
        </a>
      </p>

      <h1>Импорт реестра контингента из Excel</h1>
      <p style={{ color: '#4b5563', margin: '0.4rem 0' }}>
        1. Скачайте{' '}
        <button
          className="link-action"
          type="button"
          onClick={downloadContingentTemplate}
        >
          шаблон контингента (.xlsx)
        </button>
        . Обязательные поля: «Юридическое лицо», «Структурное подразделение», «Должность».
      </p>
      <p style={{ color: '#4b5563', margin: '0.4rem 0' }}>
        2. Идентификация записей по решению D-004 выполняется по ключу:
        <strong> «Юридическое лицо + Подразделение + Должность + Уточнение рабочего места»</strong>.
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
            <button className="btn" onClick={() => onNavigate('contingent')}>
              Перейти к реестру контингента
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
                    <th>Позиция (должность, отдел)</th>
                    <th style={{ width: '110px' }}>Действие</th>
                    <th>Ошибки / предупреждения / изменения</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.results.map((r, i) => (
                    <tr key={i}>
                      <td>{r.row}</td>
                      <td>{r.title}</td>
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
                          {r.action === 'add'
                            ? 'добавить'
                            : r.action === 'update'
                            ? 'обновить'
                            : r.action === 'skip'
                            ? 'пропустить'
                            : 'отклонить'}
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
                  disabled={
                    hasBlockingErrors ||
                    (preview.summary.add === 0 && preview.summary.update === 0)
                  }
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
