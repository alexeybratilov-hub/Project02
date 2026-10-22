"""Инфраструктура тестов (T1-11): временная БД в tmp_path, TestClient.

Каждый тест получает изолированную SQLite-базу с применённой схемой Alembic.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest

# Порядок важен: переменные окружения задаются до импорта app.*
# (настройки читаются лениво через get_settings, но фиксируются кэшем).


@pytest.fixture()
def settings_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SAOT_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("SAOT_BACKUPS_DIR", str(tmp_path / "backups"))
    monkeypatch.setenv("SAOT_LOGS_DIR", str(tmp_path / "logs"))
    monkeypatch.setenv("SAOT_ATTACHMENTS_DIR", str(tmp_path / "attachments"))
    monkeypatch.delenv("SAOT_DB_URL", raising=False)

    from app.core import config as config_module

    config_module.get_settings.cache_clear()
    settings = config_module.get_settings()
    yield settings
    config_module.get_settings.cache_clear()


@pytest.fixture()
def migrated_db(settings_env):
    """Чистая база со схемой из Alembic (upgrade head)."""
    from alembic import command

    from app.migrate import build_alembic_config

    build = build_alembic_config()
    command.upgrade(build, "head")
    yield settings_env.sqlalchemy_db_url
    from app.core import db

    db.dispose_engine()


@pytest.fixture()
def client(migrated_db) -> Iterator["object"]:  # noqa: F821
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture()
def session(migrated_db):
    from app.core import db

    engine = db.get_engine()
    conn = engine.connect()
    from sqlalchemy.orm import Session

    with Session(conn) as sess:
        yield sess
    conn.close()
    db.dispose_engine()
