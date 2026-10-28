import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { storage } from '../services/storage';
import {
  downloadPpeNormsTemplate,
  downloadPpeCardsTemplate,
  mapPpeNormsHeaders,
  mapPpeCardsHeaders,
  generatePpeNormsPreview,
  generatePpeCardsPreview,
} from '../services/excel';
import { PpeImportPreviewData } from '../types';

interface PpeImportProps {
  onNavigate: (view: string, id?: string) => void;
  initialType?: 'norms' | 'cards';
}

export const PpeImport: React.FC<PpeImportProps> = ({ onNavigate, initialType = 'norms' }) => {
  const [importType, setImportType] = useState<'norms' | 'cards'>(initialType);
  const [mode, setMode] = useState<'add' | 'update'>('add');
  const [fileName, setFileName] = useState<string>('');
  const [previewData, setPreviewData] = useState<PpeImportPreviewData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<{
    added: number;
    updated: number;
    skipped: number;
    rejected: number;
  } | null>(null);

  const handleDownloadTemplate = () => {
    if (importType === 'norms') {
      downloadPpeNormsTemplate();
    } else {
      downloadPpeCardsTemplate();
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
        const positions = storage.getPositionsRaw();
        const depts = storage.getDepartmentsRaw();
        const employees = storage.getEmployeesRaw();

        if (importType === 'norms') {
          const mapping = mapPpeNormsHeaders(headers);
          const mappedRows = rawRows.slice(1).map(row => {
            const obj: Record<string, any> = {};
            headers.forEach((h, colIdx) => {
              const field = mapping[h];
              if (field) {
                obj[field] = row[colIdx];
              }
            });
            return obj;
          });

          const existingNorms = storage.getPpeNormsRaw();
          const preview = generatePpeNormsPreview(mappedRows, les, depts, positions, existingNorms, mode);
          setPreviewData(preview);
        } else {
          const mapping = mapPpeCardsHeaders(headers);
          const mappedRows = rawRows.slice(1).map(row => {
            const obj: Record<string, any> = {};
            headers.forEach((h, colIdx) => {
              const field = mapping[h];
              if (field) {
                obj[field] = row[colIdx];
              }
            });
            return obj;
          });

          const existingCards = storage.getPpeCardsRaw();
          const preview = generatePpeCardsPreview(mappedRows, les, employees, existingCards, mode);
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
      storage.createBackup(`auto-import-ppe-${importType}`);
      let added = 0;
      let updated = 0;
      let skipped = 0;
      let rejected = 0;

      if (importType === 'norms') {
        const existingNorms = [...storage.getPpeNormsRaw()];
        const positions = storage.getPositionsRaw();
        const depts = storage.getDepartmentsRaw();

        for (const item of previewData.results) {
          if (item.action === 'reject') {
            rejected++;
            continue;
          }
          if (item.action === 'skip') {
            skipped++;
            continue;
          }

          // Ensure department if needed
          let deptId = item.data.department_id;
          if (!deptId && item.data.department_name && item.data.legal_entity_id) {
            const d = depts.find(
              dep => dep.legal_entity_id === item.data.legal_entity_id && dep.name === item.data.department_name
            );
            if (d) deptId = d.id;
          }

          // Ensure position if needed
          let posId = item.data.position_id;
          if (!posId && item.data.position_name) {
            const p = positions.find(pos => pos.name === item.data.position_name);
            if (p) posId = p.id;
            else {
              const newPos = storage.createPosition(item.data.position_name);
              posId = newPos.id;
            }
          }

          if (item.action === 'update') {
            const normToUpdate = existingNorms.find(
              n =>
                n.status === 'active' &&
                n.legal_entity_id === item.data.legal_entity_id &&
                n.position_id === posId &&
                n.ppe_name === item.data.ppe_name
            );
            if (normToUpdate) {
              storage.updatePpeNorm(normToUpdate.id, {
                ppe_type: item.data.ppe_type,
                protection_properties: item.data.protection_properties,
                quantity_per_period: item.data.quantity_per_period,
                unit: item.data.unit,
                period_months: item.data.period_months,
                is_duty: item.data.is_duty,
                norm_basis: item.data.norm_basis,
                hazard_or_factor: item.data.hazard_or_factor,
              });
              updated++;
            } else {
              skipped++;
            }
          } else if (item.action === 'add') {
            storage.createPpeNorm({
              legal_entity_id: item.data.legal_entity_id,
              department_id: deptId || null,
              position_id: posId,
              ppe_type: item.data.ppe_type,
              ppe_name: item.data.ppe_name,
              protection_properties: item.data.protection_properties,
              quantity_per_period: item.data.quantity_per_period,
              unit: item.data.unit,
              period_months: item.data.period_months,
              is_duty: item.data.is_duty,
              norm_basis: item.data.norm_basis,
              hazard_or_factor: item.data.hazard_or_factor,
            });
            added++;
          }
        }
      } else {
        // Cards commit
        const existingCards = [...storage.getPpeCardsRaw()];
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
            const cardToUpdate = existingCards.find(
              c =>
                c.status === 'active' &&
                c.legal_entity_id === item.data.legal_entity_id &&
                c.card_number === item.data.card_number
            );
            if (cardToUpdate) {
              storage.updatePpeCard(cardToUpdate.id, {
                height: item.data.height,
                clothing_size: item.data.clothing_size,
                shoe_size: item.data.shoe_size,
                headwear_size: item.data.headwear_size,
                gasmask_size: item.data.gasmask_size,
                gloves_size: item.data.gloves_size,
              });
              updated++;
            } else {
              skipped++;
            }
          } else if (item.action === 'add') {
            storage.createPpeCard({
              card_number: item.data.card_number,
              legal_entity_id: item.data.legal_entity_id,
              employee_id: item.data.employee_id,
              height: item.data.height,
              clothing_size: item.data.clothing_size,
              shoe_size: item.data.shoe_size,
              headwear_size: item.data.headwear_size,
              gasmask_size: item.data.gasmask_size,
              gloves_size: item.data.gloves_size,
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
        onClick={() => onNavigate('ppe')}
        className="text-sm text-blue-600 hover:underline mb-1 inline-block"
      >
        ← К реестру СИЗ
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Импорт данных СИЗ из Excel (.xlsx, .csv)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Пакетная загрузка норм выдачи ЕТН (Приказ 767н) или личных карточек учёта СИЗ (Приказ 766н)
        </p>
      </div>

      {/* Выбор типа импорта */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            importType === 'norms'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          onClick={() => {
            setImportType('norms');
            setPreviewData(null);
            setCommitResult(null);
          }}
        >
          Нормы бесплатной выдачи СИЗ (ЕТН)
        </button>
        <button
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            importType === 'cards'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          onClick={() => {
            setImportType('cards');
            setPreviewData(null);
            setCommitResult(null);
          }}
        >
          Личные карточки работников (размеры)
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
              {importType === 'norms'
                ? 'Шаблон содержит колонки для должности, категории СИЗ, срока носки и норм выдачи.'
                : 'Шаблон содержит колонки для ФИО, СНИЛС, номера карточки и размеров работника.'}
            </p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
          >
            📥 Скачать шаблон ({importType === 'norms' ? 'Нормы ЕТН' : 'Карточки СИЗ'})
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
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
          {errorMsg}
        </div>
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
              onClick={() => onNavigate('ppe')}
              className="px-4 py-2 bg-emerald-700 text-white rounded text-sm font-semibold hover:bg-emerald-800"
            >
              Перейти к реестру СИЗ
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
