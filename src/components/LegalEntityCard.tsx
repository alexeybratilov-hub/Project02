import React from 'react';
import { storage } from '../services/storage';
import { checksumWarning } from '../services/validation';

interface LegalEntityCardProps {
  id: string;
  onNavigate: (view: string, id?: string) => void;
  onRefreshCurrentLe: () => void;
}

export const LegalEntityCard: React.FC<LegalEntityCardProps> = ({
  id,
  onNavigate,
  onRefreshCurrentLe,
}) => {
  const item = storage.getLegalEntityById(id);
  const currentLeId = storage.getCurrentLegalEntityId();

  if (!item) {
    return (
      <div>
        <p>
          <a
            href="#back"
            onClick={e => {
              e.preventDefault();
              onNavigate('legal-entities');
            }}
          >
            ← К списку юридических лиц
          </a>
        </p>
        <div className="alert">
          <p>Юридическое лицо не найдено.</p>
        </div>
      </div>
    );
  }

  const counts = storage.getRelatedCounts(item.id);
  const isCurrent = currentLeId === item.id;
  const innWarn = checksumWarning(item.inn);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return (
        d.toLocaleDateString('ru-RU') +
        ' ' +
        d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      );
    } catch {
      return isoString;
    }
  };

  const handleSelectCurrent = () => {
    storage.setCurrentLegalEntityId(item.id);
    onRefreshCurrentLe();
  };

  const handleArchive = () => {
    const confirmed = window.confirm(
      'Отправить в архив? Связанные данные будут сохранены.'
    );
    if (!confirmed) return;

    try {
      storage.archiveLegalEntity(item.id);
      onRefreshCurrentLe();
      onNavigate('legal-entities');
    } catch (err: any) {
      alert(err.message || 'Ошибка архивирования');
    }
  };

  const handleRestore = () => {
    try {
      storage.restoreLegalEntity(item.id);
      onRefreshCurrentLe();
      onNavigate('legal-entities');
    } catch (err: any) {
      alert(err.message || 'Ошибка восстановления');
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

      <h1>{item.full_name}</h1>
      {item.status === 'archived' && <p className="badge warn">В архиве</p>}

      <table className="detail">
        <tbody>
          <tr>
            <th>Сокращённое наименование</th>
            <td>{item.short_name || '—'}</td>
          </tr>
          <tr>
            <th>ИНН</th>
            <td>
              {item.inn || '—'}
              {innWarn && (
                <span className="warn" style={{ display: 'block', fontSize: '0.85rem' }}>
                  {innWarn}
                </span>
              )}
            </td>
          </tr>
          <tr>
            <th>КПП</th>
            <td>{item.kpp || '—'}</td>
          </tr>
          <tr>
            <th>ОГРН</th>
            <td>{item.ogrn || '—'}</td>
          </tr>
          <tr>
            <th>Юридический адрес</th>
            <td>{item.legal_address || '—'}</td>
          </tr>
          <tr>
            <th>Фактический адрес</th>
            <td>{item.actual_address || '—'}</td>
          </tr>
          <tr>
            <th>Дополнительные сведения</th>
            <td>{item.extra_info || '—'}</td>
          </tr>
          <tr>
            <th>Создано</th>
            <td>{formatDate(item.created_at)}</td>
          </tr>
          <tr>
            <th>Изменено</th>
            <td>{formatDate(item.updated_at)}</td>
          </tr>
        </tbody>
      </table>

      <h2>Связанные данные</h2>
      <p style={{ color: '#4b5563' }}>
        Подразделения: <strong>{counts.departments}</strong>;{' '}
        записи контингента:{' '}
        <button
          type="button"
          className="link-action"
          onClick={() => onNavigate('contingent', item.id)}
        >
          {counts.contingent_records} (показать реестр)
        </button>
        ; работники: <strong>{counts.employees}</strong>.<br />
        Архивирование не удаляет связанные данные (D-009).
      </p>

      <div className="toolbar" style={{ marginTop: '1.5rem' }}>
        <button className="btn" onClick={() => onNavigate('legal-entities-edit', item.id)}>
          Изменить
        </button>

        {isCurrent ? (
          <span className="badge">текущее юридическое лицо</span>
        ) : item.status === 'active' ? (
          <button className="secondary" onClick={handleSelectCurrent}>
            Выбрать текущим
          </button>
        ) : null}

        {item.status === 'active' ? (
          <button className="danger" onClick={handleArchive}>
            В архив
          </button>
        ) : (
          <button className="btn" onClick={handleRestore}>
            Вернуть из архива
          </button>
        )}
      </div>
    </div>
  );
};
