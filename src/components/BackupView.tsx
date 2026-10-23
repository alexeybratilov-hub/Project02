import React, { useState } from 'react';
import { storage } from '../services/storage';

interface BackupViewProps {
  onRefreshCurrentLe: () => void;
}

export const BackupView: React.FC<BackupViewProps> = ({ onRefreshCurrentLe }) => {
  const [backups, setBackups] = useState(storage.getBackupsList());
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const refreshList = () => {
    setBackups(storage.getBackupsList());
  };

  const handleCreateBackup = () => {
    try {
      const backupJson = storage.createBackup('manual');
      refreshList();

      // Download file to user
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
      storage.restoreFromBackup(text);
      refreshList();
      onRefreshCurrentLe();
      setStatusMsg({ text: `База данных успешно восстановлена из файла «${file.name}».` });
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
      storage.restoreFromBackup(b.jsonString);
      refreshList();
      onRefreshCurrentLe();
      setStatusMsg({
        text: `База данных успешно восстановлена из снимка от ${new Date(
          b.created_at
        ).toLocaleString('ru-RU')}.`,
      });
    } catch (err: any) {
      setStatusMsg({ text: `Ошибка восстановления: ${err.message}`, isError: true });
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

  return (
    <div>
      <h1>Резервное копирование и восстановление</h1>
      <p style={{ color: '#4b5563' }}>
        Резервное копирование (T1-09, FR-14). Перед каждым восстановлением автоматически
        создаётся страховочная копия текущего состояния данных.
      </p>

      {statusMsg && (
        <div className={statusMsg.isError ? 'alert' : 'ok'} style={{ marginTop: '1rem' }}>
          <p>{statusMsg.text}</p>
        </div>
      )}

      <div className="toolbar" style={{ marginTop: '1.25rem' }}>
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
      </div>

      <h2>Снимки резервных копий</h2>
      {backups.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th style={{ width: '180px' }}>Дата создания</th>
              <th style={{ width: '120px' }}>Метка</th>
              <th>Состав данных</th>
              <th style={{ width: '130px' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((b, idx) => (
              <tr key={idx}>
                <td>{formatDate(b.created_at)}</td>
                <td>
                  <span className={`badge ${b.label === 'pre-restore' ? 'warn' : ''}`}>
                    {b.label === 'pre-restore' ? 'Страховочная' : b.label}
                  </span>
                </td>
                <td>
                  {b.counts ? (
                    <span style={{ fontSize: '0.88rem' }}>
                      Юрлиц: {b.counts.legal_entities}; Подразделений: {b.counts.departments}; Контингент:{' '}
                      {b.counts.contingent}; Работников: {b.counts.employees}; Аудит:{' '}
                      {b.counts.audit_logs}
                    </span>
                  ) : (
                    <span className="muted">Снимок базы</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-sm btn-secondary"
                    onClick={() => handleRestoreFromHistory(b)}
                  >
                    Восстановить
                  </button>
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
