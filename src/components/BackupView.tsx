import React, { useState } from 'react';
import { storage } from '../services/storage';
import { DataIntegrityReport } from '../types';

interface BackupViewProps {
  onRefreshCurrentLe: () => void;
}

export const BackupView: React.FC<BackupViewProps> = ({ onRefreshCurrentLe }) => {
  const [backups, setBackups] = useState(storage.getBackupsList());
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [integrityReport, setIntegrityReport] = useState<DataIntegrityReport | null>(null);
  const [isRunningCheck, setIsRunningCheck] = useState(false);

  const refreshList = () => {
    setBackups(storage.getBackupsList());
  };

  const handleCreateBackup = () => {
    try {
      const backupJson = storage.createBackup('manual');
      refreshList();

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const blob = new Blob([backupJson], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saot_backup_${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMsg({ text: 'Резервная копия успешно создана и сохранена в файл.' });
    } catch (err: any) {
      setStatusMsg({ text: `Ошибка создания копии: ${err.message}`, isError: true });
    }
  };

  const handleDownloadSnapshot = (b: any) => {
    try {
      const stamp = new Date(b.created_at).toISOString().replace(/[:.]/g, '-');
      const blob = new Blob([b.jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saot_backup_${b.label || 'snapshot'}_${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setStatusMsg({ text: `Ошибка скачивания копии: ${err.message}`, isError: true });
    }
  };

  const handleRestoreFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    const confirmed = window.confirm(
      'Восстановить базу из резервной копии? Перед заменой будет автоматически создана страховочная копия текущего состояния.'
    );
    if (!confirmed) {
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const report = storage.restoreFromBackup(text);
      refreshList();
      onRefreshCurrentLe();
      setIntegrityReport(report);

      if (report.valid) {
        setStatusMsg({
          text: `База данных успешно восстановлена из файла «${file.name}». Целостность проверена: ошибок не обнаружено.`,
        });
      } else {
        setStatusMsg({
          text: `База данных восстановлена из «${file.name}», но при проверке связей обнаружено ${report.errors.length} несоответствий. Проверьте отчёт ниже.`,
          isError: true,
        });
      }
    } catch (err: any) {
      setStatusMsg({ text: `Ошибка восстановления: ${err.message}`, isError: true });
    } finally {
      e.target.value = '';
    }
  };

  const handleRestoreFromHistory = (b: any) => {
    const confirmed = window.confirm(
      `Восстановить состояние от ${new Date(b.created_at).toLocaleString('ru-RU')}? Перед заменой будет создана страховочная копия.`
    );
    if (!confirmed) return;

    try {
      const report = storage.restoreFromBackup(b.jsonString);
      refreshList();
      onRefreshCurrentLe();
      setIntegrityReport(report);

      if (report.valid) {
        setStatusMsg({
          text: `База данных успешно восстановлена из снимка от ${new Date(
            b.created_at
          ).toLocaleString('ru-RU')}. Целостность подтверждена.`,
        });
      } else {
        setStatusMsg({
          text: `База восстановлена, но выявлены замечания целостности (${report.errors.length}). См. отчёт.`,
          isError: true,
        });
      }
    } catch (err: any) {
      setStatusMsg({ text: `Ошибка восстановления: ${err.message}`, isError: true });
    }
  };

  const handleRunIntegrityCheck = () => {
    setIsRunningCheck(true);
    try {
      const report = storage.verifyDataIntegrity();
      setIntegrityReport(report);
      if (report.valid) {
        setStatusMsg({ text: 'Проверка целостности завершена: все связи корректны, разорванных ссылок нет.' });
      } else {
        setStatusMsg({
          text: `Проверка целостности выявила ${report.errors.length} ошибок связности данных!`,
          isError: true,
        });
      }
    } catch (err: any) {
      setStatusMsg({ text: `Ошибка выполнения проверки: ${err.message}`, isError: true });
    } finally {
      setIsRunningCheck(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return (
        d.toLocaleDateString('ru-RU') +
        ' ' +
        d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    } catch {
      return isoString;
    }
  };

  const renderLabelBadge = (label?: string) => {
    if (label === 'pre-restore') {
      return <span className="badge warn">Страховочная (pre-restore)</span>;
    }
    if (label?.startsWith('auto-import-')) {
      const target = label.replace('auto-import-', '');
      return <span className="badge info">Авто (импорт {target})</span>;
    }
    if (label === 'auto-daily') {
      return <span className="badge info">Авто (суточная)</span>;
    }
    return <span className="badge ok">{label || 'Ручная'}</span>;
  };

  return (
    <div>
      <h1>Резервное копирование и целостность данных</h1>
      <p style={{ color: '#4b5563' }}>
        Резервное копирование (T1-09, FR-14). Перед каждым восстановлением автоматически
        создаётся страховочная копия текущего состояния данных. Автоматические копии также создаются
        перед пакетными импортами и периодически раз в сутки.
      </p>

      {statusMsg && (
        <div className={statusMsg.isError ? 'alert' : 'ok'} style={{ marginTop: '1rem' }}>
          <p>{statusMsg.text}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="toolbar" style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button className="btn" onClick={handleCreateBackup}>
          💾 Создать резервную копию (JSON)
        </button>

        <label className="btn secondary" style={{ cursor: 'pointer', margin: 0 }}>
          📥 Восстановить из файла...
          <input
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleRestoreFromFile}
          />
        </label>

        <button
          className="btn secondary"
          onClick={handleRunIntegrityCheck}
          disabled={isRunningCheck}
        >
          🔍 {isRunningCheck ? 'Проверка...' : 'Проверить целостность данных (Сценарий 18)'}
        </button>
      </div>

      {/* Data Integrity Report Card */}
      {integrityReport && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            background: integrityReport.valid ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${integrityReport.valid ? '#bbf7d0' : '#fecaca'}`,
            borderRadius: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, color: integrityReport.valid ? '#166534' : '#991b1b' }}>
              {integrityReport.valid ? '✅ Целостность данных подтверждена' : '⚠️ Обнаружены несоответствия целостности'}
            </h3>
            <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
              Проверено: {formatDate(integrityReport.timestamp)}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ background: '#fff', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Юрлиц</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{integrityReport.stats.legal_entities}</div>
            </div>
            <div style={{ background: '#fff', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Подразделений</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{integrityReport.stats.departments}</div>
            </div>
            <div style={{ background: '#fff', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Должностей</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{integrityReport.stats.positions}</div>
            </div>
            <div style={{ background: '#fff', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Контингент</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{integrityReport.stats.contingent}</div>
            </div>
            <div style={{ background: '#fff', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Работников</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{integrityReport.stats.employees}</div>
            </div>
            <div style={{ background: '#fff', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Кадровых записей</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{integrityReport.stats.employment_history}</div>
            </div>
          </div>

          {integrityReport.errors.length > 0 && (
            <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              <strong style={{ color: '#991b1b', fontSize: '0.9rem' }}>Ошибки ссылочной целостности:</strong>
              <ul style={{ margin: '0.25rem 0 0.5rem 1.25rem', color: '#b91c1c', fontSize: '0.85rem' }}>
                {integrityReport.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {integrityReport.warnings.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <strong style={{ color: '#854d0e', fontSize: '0.9rem' }}>Предупреждения:</strong>
              <ul style={{ margin: '0.25rem 0 0 1.25rem', color: '#a16207', fontSize: '0.85rem' }}>
                {integrityReport.warnings.map((warn, idx) => (
                  <li key={idx}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {integrityReport.valid && integrityReport.warnings.length === 0 && (
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#15803d' }}>
              Все внешние ключи, ссылки на подразделения, должности, контингент и историю перемещений полностью согласованы.
            </p>
          )}
        </div>
      )}

      {/* Snapshots Table */}
      <h2 style={{ marginTop: '2rem' }}>Журнал снимков резервных копий</h2>
      {backups.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th style={{ width: '180px' }}>Дата создания</th>
              <th style={{ width: '170px' }}>Тип копии</th>
              <th>Состав данных</th>
              <th style={{ width: '200px' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((b, idx) => (
              <tr key={idx}>
                <td>{formatDate(b.created_at)}</td>
                <td>{renderLabelBadge(b.label)}</td>
                <td>
                  {b.counts ? (
                    <span style={{ fontSize: '0.88rem' }}>
                      Юрлиц: {b.counts.legal_entities}; Подразделений: {b.counts.departments}; Контингент:{' '}
                      {b.counts.contingent}; Работников: {b.counts.employees}; История:{' '}
                      {b.counts.employment_history ?? 0}; Аудит: {b.counts.audit_logs}
                    </span>
                  ) : (
                    <span className="muted">Снимок базы</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn-sm btn-secondary"
                      onClick={() => handleRestoreFromHistory(b)}
                    >
                      Восстановить
                    </button>
                    <button
                      type="button"
                      className="btn-sm"
                      style={{ background: '#f3f4f6', border: '1px solid #d1d5db', color: '#374151' }}
                      title="Скачать этот снимок в JSON"
                      onClick={() => handleDownloadSnapshot(b)}
                    >
                      Скачать
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">Резервных копий пока нет — создайте первую.</p>
      )}
    </div>
  );
};
