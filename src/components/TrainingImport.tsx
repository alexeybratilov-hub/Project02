import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { storage } from '../services/storage';
import {
  downloadTrainingProgramsTemplate,
  downloadTrainingProtocolsTemplate,
  mapTrainingProgramsHeaders,
  mapTrainingProtocolsHeaders,
  generateTrainingProgramsPreview,
  generateTrainingProtocolsPreview,
} from '../services/excel';
import { TrainingImportPreviewData } from '../types';

interface TrainingImportProps {
  onNavigate: (view: string, id?: string) => void;
  initialType?: 'programs' | 'protocols';
}

export const TrainingImport: React.FC<TrainingImportProps> = ({ onNavigate, initialType = 'programs' }) => {
  const [importType, setImportType] = useState<'programs' | 'protocols'>(initialType);
  const [mode, setMode] = useState<'add' | 'update'>('add');
  const [fileName, setFileName] = useState<string>('');
  const [previewData, setPreviewData] = useState<TrainingImportPreviewData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<{
    added: number;
    updated: number;
    skipped: number;
    rejected: number;
  } | null>(null);

  const handleDownloadTemplate = () => {
    if (importType === 'programs') {
      downloadTrainingProgramsTemplate();
    } else {
      downloadTrainingProtocolsTemplate();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setCommitResult(null);
    setPreviewData(null);

    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        if (!ws) {
          throw new Error('Файл не содержит листов.');
        }

        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rawRows.length < 2) {
          throw new Error('Таблица пуста или содержит только заголовок.');
        }

        const headers = (rawRows[0] || []).map(h => String(h || '').trim());
        const les = storage.listLegalEntities({ pageSize: 1000 }).items;

        if (importType === 'programs') {
          const mapping = mapTrainingProgramsHeaders(headers);
          const mappedRows = rawRows.slice(1).map(row => {
            const obj: Record<string, any> = {};
            headers.forEach((h, colIdx) => {
              const field = mapping[h];
              if (field) obj[field] = row[colIdx];
            });
            return obj;
          });
          const existingPrograms = storage.getTrainingProgramsRaw();
          const preview = generateTrainingProgramsPreview(mappedRows, les, existingPrograms, mode);
          setPreviewData(preview);
        } else {
          const mapping = mapTrainingProtocolsHeaders(headers);
          const mappedRows = rawRows.slice(1).map(row => {
            const obj: Record<string, any> = {};
            headers.forEach((h, colIdx) => {
              const field = mapping[h];
              if (field) obj[field] = row[colIdx];
            });
            return obj;
          });
          const employees = storage.getEmployeesRaw();
          const programs = storage.getTrainingProgramsRaw();
          const existingProtocols = storage.getTrainingProtocolsRaw();
          const preview = generateTrainingProtocolsPreview(
            mappedRows,
            les,
            employees,
            programs,
            existingProtocols,
            mode
          );
          setPreviewData(preview);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Ошибка чтения файла');
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleCommit = () => {
    if (!previewData) return;
    setErrorMsg(null);

    try {
      storage.createBackup(`auto-import-training-${importType}`);
      let added = 0;
      let updated = 0;
      let skipped = 0;
      let rejected = 0;

      if (importType === 'programs') {
        const existingPrograms = [...storage.getTrainingProgramsRaw()];
        for (const item of previewData.results) {
          if (item.action === 'reject') {
            rejected++;
            continue;
          }
          if (item.action === 'skip') {
            skipped++;
            continue;
          }
          if (item.action === 'update') {
            const programToUpdate = existingPrograms.find(
              p =>
                p.status === 'active' &&
                p.legal_entity_id === item.data.legal_entity_id &&
                p.name.toLowerCase().trim() === String(item.data.name || '').toLowerCase().trim()
            );
            if (programToUpdate) {
              storage.updateTrainingProgram(programToUpdate.id, {
                category: item.data.category,
                hours: item.data.hours,
                recurring_months: item.data.recurring_months,
                positions: item.data.positions,
                basis: item.data.basis,
              });
              updated++;
            } else {
              skipped++;
            }
          } else if (item.action === 'add') {
            storage.createTrainingProgram({
              legal_entity_id: item.data.legal_entity_id,
              name: item.data.name,
              category: item.data.category,
              hours: item.data.hours,
              recurring_months: item.data.recurring_months ?? null,
              positions: item.data.positions || null,
              basis: item.data.basis || null,
            });
            added++;
          }
        }
      } else {
        // Протоколы
        for (const item of previewData.results) {
          if (item.action === 'reject') {
            rejected++;
            continue;
          }
          if (item.action === 'skip') {
            skipped++;
            continue;
          }
          if (item.action === 'update') {
            // Регламентный протокол не редактируется — строка пропускается с фиксацией в статистике
            skipped++;
            continue;
          } else if (item.action === 'add') {
            storage.createTrainingProtocol({
              protocol_number: item.data.protocol_number,
              legal_entity_id: item.data.legal_entity_id,
              training_program_id: item.data.training_program_id,
              session_date: item.data.session_date,
              chairperson: item.data.chairperson,
              members: item.data.members,
              employee_id: item.data.employee_id,
              result: item.data.result,
              issues_certificate: item.data.issues_certificate,
              certificate_number: item.data.certificate_number || null,
              registry_entry_number: item.data.registry_entry_number || null,
            });
            added++;
          }
        }
      }

      setCommitResult({ added, updated, skipped, rejected });
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка применения импорта');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <button
        onClick={() => onNavigate('training')}
        className="text-sm text-blue-600 hover:underline mb-1 inline-block"
      >
        ← К реестру обучения
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Импорт данных обучения из Excel (.xlsx, .csv)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Пакетная загрузка программ обучения и протоколов проверки знаний требований охраны труда (Постановление № 2464)
        </p>
      </div>

      {/* Выбор типа импорта */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            importType === 'programs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          onClick={() => {
            setImportType('programs');
            setPreviewData(null);
            setCommitResult(null);
          }}
        >
          Программы обучения
        </button>
        <button
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            importType === 'protocols'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          onClick={() => {
            setImportType('protocols');
            setPreviewData(null);
            setCommitResult(null);
          }}
        >
          Протоколы проверки знаний
        </button>
      </div>

      {/* Панель загрузки и шаблон */}
      <div className="p-6 bg-white rounded-lg border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              1. Скачайте шаблон или выберите готовый файл
            </h2>
            <p className="text-xs text-slate-500">
              {importType === 'programs'
                ? 'Шаблон содержит колонки для наименования программы, категории (А/Б/В/первая помощь/СИЗ), трудоемкости и периодичности.'
                : 'Шаблон содержит колонки для номера и даты протокола, программы, работника (ФИО/СНИЛС), результата и состава комиссии.'}
            </p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
          >
            📥 Скачать шаблон ({importType === 'programs' ? 'Программы' : 'Протоколы'})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />

          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="font-semibold">Режим импорта:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                value="add"
                checked={mode === 'add'}
                onChange={() => setMode('add')}
              />
              Только добавление
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                value="update"
                checked={mode === 'update'}
                onChange={() => setMode('update')}
              />
              Обновление существующих
            </label>
          </div>
        </div>

        {fileName && (
          <div className="text-xs text-slate-500">
            Выбранный файл: <strong className="text-slate-800">{fileName}</strong>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">{errorMsg}</div>
      )}

      {/* Результат применения */}
      {commitResult && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 space-y-2">
          <h3 className="font-bold text-base">Импорт успешно завершён!</h3>
          <p className="text-sm">
            Добавлено: <strong>{commitResult.added}</strong> | Обновлено: <strong>{commitResult.updated}</strong> |
            Пропущено: <strong>{commitResult.skipped}</strong> | Отклонено с ошибками: <strong>{commitResult.rejected}</strong>
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('training')}
              className="px-4 py-2 bg-emerald-700 text-white rounded text-sm font-semibold hover:bg-emerald-800"
            >
              Перейти к реестру обучения
            </button>
          </div>
        </div>
      )}

      {/* Предпросмотр */}
      {previewData && !commitResult && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">2. Предпросмотр строк таблицы</h2>
              <div className="flex gap-3 text-xs mt-1">
                <span className="text-slate-600">Всего строк: <strong>{previewData.summary.total}</strong></span>
                <span className="text-emerald-700">К добавлению: <strong>{previewData.summary.add}</strong></span>
                <span className="text-blue-700">К обновлению: <strong>{previewData.summary.update}</strong></span>
                <span className="text-amber-700">Пропуск: <strong>{previewData.summary.skip}</strong></span>
                <span className="text-rose-700">Ошибки: <strong>{previewData.summary.reject}</strong></span>
              </div>
            </div>

            <button
              disabled={previewData.summary.add === 0 && previewData.summary.update === 0}
              onClick={handleCommit}
              className="px-5 py-2 bg-blue-600 text-white rounded font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm self-start sm:self-auto"
            >
              Применить импорт ({previewData.summary.add + previewData.summary.update})
            </button>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Строка</th>
                  <th className="py-2.5 px-3">Действие</th>
                  <th className="py-2.5 px-3">Наименование / Объект</th>
                  <th className="py-2.5 px-3">Результат проверки / Предупреждения</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.results.map((r, i) => {
                  let badge = 'bg-slate-100 text-slate-700';
                  let label = 'Пропуск';
                  if (r.action === 'add') {
                    badge = 'bg-emerald-100 text-emerald-800 font-bold';
                    label = 'Добавление';
                  } else if (r.action === 'update') {
                    badge = 'bg-blue-100 text-blue-800 font-bold';
                    label = 'Обновление';
                  } else if (r.action === 'reject') {
                    badge = 'bg-rose-100 text-rose-800 font-bold';
                    label = 'Ошибка';
                  }

                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{r.row}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${badge}`}>{label}</span>
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800">{r.title}</td>
                      <td className="py-2 px-3">
                        {r.errors.map((err, eIdx) => (
                          <div key={eIdx} className="text-rose-600 font-medium">
                            • {err}
                          </div>
                        ))}
                        {r.warnings.map((w, wIdx) => (
                          <div key={wIdx} className="text-amber-600">
                            • {w}
                          </div>
                        ))}
                        {r.changes.map((c, cIdx) => (
                          <div key={cIdx} className="text-blue-600">
                            • {c}
                          </div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
