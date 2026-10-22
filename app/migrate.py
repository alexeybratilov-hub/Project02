"""Применение миграций с обязательной резервной копией (D-006, T1-04).

Использование: python -m app.migrate
Порядок: если база существует — создать копию в backups/, затем alembic upgrade head.
"""

from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config as AlembicConfig

from app.core.backup import create_backup
from app.core.config import PROJECT_ROOT, get_settings

log = logging.getLogger("saot.migrate")


def build_alembic_config() -> AlembicConfig:
    cfg = AlembicConfig(str(PROJECT_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(PROJECT_ROOT / "alembic"))
    return cfg


def migrate() -> None:
    settings = get_settings()
    url = settings.sqlalchemy_db_url
    if url.startswith("sqlite"):
        db_file = Path(url.removeprefix("sqlite:///"))
        if db_file.exists():
            copy_path = create_backup(label="pre-migration")
            log.info("Резервная копия перед миграцией: %s", copy_path)
    command.upgrade(build_alembic_config(), "head")
    log.info("Миграции применены: head")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
    migrate()
