import React, { useState } from 'react';
import { storage } from '../services/storage';
import {
  downloadOprTemplate,
  parseExcelFile,
  mapOprHeaders,
  generateOprPreview,
  parseOprHazards,
} from '../services/excel';
import { OprImportPreviewData } from '../types';
import { ciCompare } from '../services/validation';

interface OprImportProps {
  onNavigate: (view: string, id?: string) => void;
}

export const OprImport: React.FC<OprImportProps> = ({ onNavigate }) => {
  const moduleEnabled = storage.isModuleEnabled('opr');
  const [mode, setMode] = useState<'add' | 'update'>('add');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<OprImportPreviewData | null>(null);
  const [report, setReport] = useState<{
    added: number;
    updated: number;
    skipped: number;
    rejected: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!moduleEnabled) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Импорт карт ОПР</h1>
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded">
          Модуль «ОПР» отключён. Включите его в реестре модулей.
        </div>
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

      const { mapping, problems } = mapOprHeaders(headers);
      const missingRequired = problems.some(p => p.includes('Отсутствует обязательная колонка'));

      if (missingRequired) {
        setPreview({
          results: [],
          structure_errors: problems,
          summary: { total: 0, add: 0, update: 0, skip: 0, reject: 0 },
        });
        return;
      }

      const allExisting = storage.getOprCardsRaw();
      const genPreview = generateOprPreview(rows, mapping, allExisting, mode);
      genPreview.structure_errors = problems;
      setPreview(genPreview);
    } catch (err: any) {
      setErrorMsg(`Ошибка чтения файла: ${err.message || 'Не удалось прочесть файл'}`);
    }
  };

  const handleConfirmImport = () => {
    if (!preview || preview.results.length === 0) return;

    try {
      const les = storage.listLegalEntities({ pageSize: 10000 }).items;

      // Создаём автоматическую точку восстановления перед импортом
      storage.createBackup('auto-import-opr');

      let addedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let rejectedCount = 0;

      for (const res of preview.results) {
        if (res.action === 'skip') {
          skippedCount++;
          continue;
        }
        if (res.action === 'reject') {
          rejectedCount++;
          continue;
        }

        const d = res.data;
        const le = les.find(
          l =>
            l.status === 'active' &&
            (l.inn === d.legal_entity_name ||
              ciCompare(l.full_name) === ciCompare(d.legal_entity_name) ||
              ciCompare(l.short_name || '') === ciCompare(d.legal_entity_name))
        );

        if (!le) {
          rejectedCount++;
          continue;
        }

        // Подразделение (найти или создать)
        let dept = storage.getDepartments(le.id).find(
          dep => ciCompare(dep.name) === ciCompare(d.department_name)
        );
        if (!dept) {
          dept = storage.createDepartment({ legal_entity_id: le.id, name: d.department_name });
        }

        // Должность (найти или создать)
        let pos = storage.getPositionsRaw().find(
          p => p.status === 'active' && ciCompare(p.name) === ciCompare(d.position_name)
        );
        if (!pos) {
          pos = storage.createPosition(d.position_name);
        }

        // Опасности
        const parsedHazards = parseOprHazards(d.hazards_raw);

        // Поиск существующей карты для update
        const existingCard = storage.getOprCardsRaw().find(
          c =>
            c.status === 'active' &&
            c.legal_entity_id === le.id &&
            ciCompare(c.card_number) === ciCompare(d.card_number)
        );

        if (existingCard && res.action === 'update') {
          storage.updateOprCard(existingCard.id, {
            department_id: dept.id,
            position_id: pos.id,
            workplace_label: d.workplace_label || null,
            assessment_date: d.assessment_date || existingCard.assessment_date,
            assessment_method: d.assessment_method || existingCard.assessment_method,
            commission_members: d.commission_members || existingCard.commission_members,
            hazards: parsedHazards.length > 0 ? parsedHazards : existingCard.hazards,
          });
          updatedCount++;
        } else {
          storage.createOprCard({
            card_number: d.card_number,
            legal_entity_id: le.id,
            department_id: dept.id,
            position_id: pos.id,
            workplace_label: d.workplace_label || null,
            assessment_date: d.assessment_date || null,
            assessment_method: d.assessment_method || 'Матричный метод (5x5, Приказ 776н)',
            commission_members: d.commission_members || null,
            hazards: parsedHazards,
          });
          addedCount++;
        }
      }

      setReport({
        added: addedCount,
        updated: updatedCount,
        skipped: skippedCount,
        rejected: rejectedCount,
      });
      setPreview(null);
    } catch (err: any) {
      setErrorMsg(`Ошибка применения импорта: ${err.message || 'Сбой операции'}`);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => onNavigate('opr')}
            className="text-sm text-blue-600 hover:underline mb-1 inline-block"
          >
            ← К реестру карт ОПР
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Импорт карт оценки рисков (ОПР)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Загрузка карт ОПР из файлов Excel (.xlsx) или CSV (.csv) с предварительным просмотром и валидацией
          </p>
        </div>

        <button
          type="button"
          onClick={downloadOprTemplate}
          className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 rounded text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
        >
          📥 Скачать шаблон Excel
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded text-sm">
          {errorMsg}
        </div>
      )}

      {/* Итоговый отчёт после импорта */}
      {report && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
          <h2 className="text-base font-bold text-emerald-900">Импорт успешно завершён</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="p-3 bg-white rounded border border-emerald-100">
              <span className="text-xs text-slate-500 block">Добавлено карт:</span>
              <span className="text-xl font-bold text-emerald-700">{report.added}</span>
            </div>
            <div className="p-3 bg-white rounded border border-emerald-100">
              <span className="text-xs text-slate-500 block">Обновлено:</span>
              <span className="text-xl font-bold text-blue-700">{report.updated}</span>
            </div>
            <div className="p-3 bg-white rounded border border-emerald-100">
              <span className="text-xs text-slate-500 block">Пропущено:</span>
              <span className="text-xl font-bold text-slate-600">{report.skipped}</span>
            </div>
            <div className="p-3 bg-white rounded border border-emerald-100">
              <span className="text-xs text-slate-500 block">Отклонено (ошибки):</span>
              <span className="text-xl font-bold text-rose-600">{report.rejected}</span>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Перед импортом была создана автоматическая резервная копия. В случае необходимости данные можно восстановить в разделе «Резервное копирование».
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('opr')}
              className="px-4 py-2 bg-emerald-700 text-white rounded text-sm font-semibold hover:bg-emerald-800"
            >
              Перейти в реестр карт ОПР
            </button>
          </div>
        </div>
      )}

      {/* Форма выбора файла и режима */}
      {!report && (
        <form onSubmit={handleProcessPreview} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Файл для импорта (.xlsx, .csv)</label>
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Режим импорта дубликатов</label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="radio"
                    name="mode"
                    value="add"
                    checked={mode === 'add'}
                    onChange={() => setMode('add')}
                  />
                  Только добавление (существующие номера пропускать)
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="radio"
                    name="mode"
                    value="update"
                    checked={mode === 'update'}
                    onChange={() => setMode('update')}
                  />
                  Обновление существующих карт по номеру в организации
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t">
            <button
              type="submit"
              disabled={!selectedFile}
              className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-40"
            >
              Анализировать и подготовить предпросмотр
            </button>
          </div>
        </form>
      )}

      {/* Предпросмотр строк */}
      {preview && (
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-800">Результат анализа файла</h2>
              <div className="flex items-center gap-3 text-xs mt-1 text-slate-600">
                <span>Всего строк: <strong>{preview.summary.total}</strong></span>
                <span className="text-emerald-700">К добавлению: <strong>{preview.summary.add}</strong></span>
                <span className="text-blue-700">К обновлению: <strong>{preview.summary.update}</strong></span>
                <span className="text-slate-600">Пропуск: <strong>{preview.summary.skip}</strong></span>
                <span className="text-rose-600">Ошибок: <strong>{preview.summary.reject}</strong></span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={preview.summary.add + preview.summary.update === 0}
              className="px-5 py-2 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 shadow-sm"
            >
              Подтвердить импорт ({preview.summary.add + preview.summary.update})
            </button>
          </div>

          {preview.structure_errors.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 space-y-1">
              <strong>Предупреждения по структуре файла:</strong>
              {preview.structure_errors.map((e, idx) => (
                <div key={idx}>• {e}</div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr className="text-slate-600 font-semibold">
                  <th className="py-2 px-3 w-12">Стр.</th>
                  <th className="py-2 px-3 w-28">Действие</th>
                  <th className="py-2 px-3">Карта ОПР</th>
                  <th className="py-2 px-3">Организация / Подразделение</th>
                  <th className="py-2 px-3">Должность</th>
                  <th className="py-2 px-3">Статус проверки</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.results.map((r, idx) => {
                  let badge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      Добавить
                    </span>
                  );
                  if (r.action === 'update') {
                    badge = (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                        Обновить
                      </span>
                    );
                  } else if (r.action === 'skip') {
                    badge = (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                        Пропустить
                      </span>
                    );
                  } else if (r.action === 'reject') {
                    badge = (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                        Ошибка
                      </span>
                    );
                  }

                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-500 font-mono">{r.row}</td>
                      <td className="py-2 px-3">{badge}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{r.data.card_number || '—'}</td>
                      <td className="py-2 px-3 text-slate-700">
                        <div>{r.data.legal_entity_name || '—'}</div>
                        <div className="text-[11px] text-slate-500">{r.data.department_name || '—'}</div>
                      </td>
                      <td className="py-2 px-3 text-slate-700">{r.data.position_name || '—'}</td>
                      <td className="py-2 px-3">
                        {r.errors.length > 0 && (
                          <div className="text-rose-600 space-y-0.5">
                            {r.errors.map((e, ei) => (
                              <div key={ei}>✕ {e}</div>
                            ))}
                          </div>
                        )}
                        {r.warnings.length > 0 && (
                          <div className="text-amber-700 space-y-0.5">
                            {r.warnings.map((w, wi) => (
                              <div key={wi}>⚠ {w}</div>
                            ))}
                          </div>
                        )}
                        {r.changes.length > 0 && (
                          <div className="text-blue-700 space-y-0.5">
                            {r.changes.map((c, ci) => (
                              <div key={ci}>ℹ {c}</div>
                            ))}
                          </div>
                        )}
                        {r.errors.length === 0 && r.warnings.length === 0 && r.changes.length === 0 && (
                          <span className="text-emerald-600">✓ Готово к загрузке</span>
                        )}
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
