"""Тесты миграций и схемы (T1-04, T1-11)."""

from __future__ import annotations

import sqlite3

EXPECTED_TABLES = {
    "legal_entities",
    "departments",
    "positions",
    "work_schedules",
    "shift_patterns",
    "work_condition_subclasses",
    "electrical_safety_groups",
    "contingent_records",
    "contingent_medical_items",
    "employees",
    "employment_history",
    "audit_log",
    "module_registry",
}


def _db_file(settings) -> str:
    return settings.sqlalchemy_db_url.removeprefix("sqlite:///")


def test_upgrade_head_creates_all_tables(migrated_db, settings_env):
    con = sqlite3.connect(_db_file(settings_env))
    try:
        tables = {
            row[0]
            for row in con.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
    finally:
        con.close()
    assert EXPECTED_TABLES <= tables
    assert "alembic_version" in tables


def test_upgrade_is_repeatable_on_existing_db(migrated_db, settings_env):
    """Повторный `upgrade head` на уже мигрированной базе не падает (критерий T1-04)."""
    from alembic import command

    from app.migrate import build_alembic_config

    command.upgrade(build_alembic_config(), "head")  # второй прогон — без ошибок


def test_wal_mode_and_foreign_keys_pragma(migrated_db, settings_env):
    from app.core import db

    engine = db.get_engine()
    with engine.connect() as conn:
        assert conn.exec_driver_sql("PRAGMA journal_mode").scalar().lower() == "wal"
        assert int(conn.exec_driver_sql("PRAGMA foreign_keys").scalar()) == 1


def test_foreign_keys_enforced(session):
    """FK работает: запись с несуществующим юрлицом отклоняется."""
    import pytest
    from sqlalchemy.exc import IntegrityError

    from app.core.models import Department

    session.add(Department(legal_entity_id="нет-такого-id", name="цех"))
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
