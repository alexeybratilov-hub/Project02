import React from 'react';
import { LegalEntity } from '../types';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string, id?: string) => void;
  currentLe: LegalEntity | null;
  onClearCurrentLe: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  currentLe,
  onClearCurrentLe,
}) => {
  return (
    <header>
      <a
        className="brand"
        href="#home"
        onClick={e => {
          e.preventDefault();
          onNavigate('home');
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>САОТ</span>
      </a>
      <nav>
        <button
          className={currentView === 'home' ? 'active' : ''}
          onClick={() => onNavigate('home')}
        >
          Главная
        </button>
        <button
          className={currentView.startsWith('legal-entities') ? 'active' : ''}
          onClick={() => onNavigate('legal-entities')}
        >
          Юридические лица
        </button>
        <button
          className={currentView.startsWith('contingent') ? 'active' : ''}
          onClick={() => onNavigate('contingent')}
        >
          Контингент
        </button>
        <button
          className={currentView === 'dictionaries' ? 'active' : ''}
          onClick={() => onNavigate('dictionaries')}
        >
          Справочники
        </button>
        <button
          className={currentView === 'modules' ? 'active' : ''}
          onClick={() => onNavigate('modules')}
        >
          Модули
        </button>
        <button
          className={currentView === 'backup' ? 'active' : ''}
          onClick={() => onNavigate('backup')}
        >
          Резервное копирование
        </button>
        <button
          className={currentView === 'audit' ? 'active' : ''}
          onClick={() => onNavigate('audit')}
        >
          Журнал аудита
        </button>
      </nav>
      <div className="current-le">
        {currentLe ? (
          <span>
            Текущее:{' '}
            <strong title={currentLe.full_name}>
              {currentLe.short_name || currentLe.full_name}
            </strong>{' '}
            <button
              onClick={onClearCurrentLe}
              title="Сбросить выбор"
              style={{
                background: 'transparent',
                color: '#dbe9ff',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '3px',
                padding: '1px 5px',
                fontSize: '0.75rem',
                marginLeft: '6px',
              }}
            >
              ×
            </button>
          </span>
        ) : (
          <span>Юридическое лицо не выбрано</span>
        )}
      </div>
    </header>
  );
};
