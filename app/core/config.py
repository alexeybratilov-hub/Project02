"""Конфигурация приложения (T1-02).

Все настраиваемые параметры читаются из переменных окружения с префиксом SAOT_.
Захардкоженные абсолютные пути запрещены: пути по умолчанию рассчитываются
относительно корня проекта (портативная папка, D-003).

Переменные окружения (см. HANDOFF.md §11, ARCHITECTURE.md §13):
- SAOT_DB_URL    — URL SQLAlchemy (по умолчанию sqlite:///<PROJECT_ROOT>/data/saot.db)
- SAOT_HOST      — адрес прослушивания (по умолчанию 127.0.0.1; 0.0.0.0 только явно, D-016)
- SAOT_PORT      — порт (по умолчанию 8000)
- SAOT_DATA_DIR / SAOT_BACKUP_DIR / SAOT_LOG_DIR / SAOT_ATTACHMENTS_DIR — рабочие папки
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Корень проекта: .../app/core/config.py -> два уровня вверх от core, один от app.
PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SAOT_", env_file=".env", extra="ignore")

    app_name: str = "САОТ — система автоматизации охраны труда"
    host: str = "127.0.0.1"
    port: int = 8000

    # Рабочие папки (создаются автоматически, см. ensure_runtime_dirs)
    data_dir: Path = PROJECT_ROOT / "data"
    backups_dir: Path = PROJECT_ROOT / "backups"
    logs_dir: Path = PROJECT_ROOT / "logs"
    attachments_dir: Path = PROJECT_ROOT / "attachments"

    # База данных: если не задан SAOT_DB_URL — SQLite WAL в data/saot.db (D-002)
    db_url: str = ""

    @property
    def sqlalchemy_db_url(self) -> str:
        return self.db_url or f"sqlite:///{(self.data_dir / 'saot.db').as_posix()}"

    def ensure_runtime_dirs(self) -> None:
        """Создать рабочие папки, если их ещё нет (T1-02)."""
        for d in (self.data_dir, self.backups_dir, self.logs_dir, self.attachments_dir):
            Path(d).mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    # Относительные пути из окружения считаем относительно корня проекта.
    for attr in ("data_dir", "backups_dir", "logs_dir", "attachments_dir"):
        p = Path(getattr(settings, attr))
        if not p.is_absolute():
            setattr(settings, attr, PROJECT_ROOT / p)
    settings.ensure_runtime_dirs()
    return settings


# Совместимость: явный сброс кэша в тестах.
def reset_settings_cache() -> None:
    get_settings.cache_clear()
    os.environ.pop("SAOT_ENV_CLEARED", None)
