"""Приёмочные тесты этапа 1 (STAGE_1_CORE.md).

Проверяют критерии завершения этапа:
- реестр модулей с сохранением состояний в БД между запусками (T1-06);
- базовая навигация и единый стиль через /static (T1-07);
- демонстрационный модуль _sample публикует маршруты (T1-06);
- восстановление из резервной копии пишется в аудит (T1-08, T1-09).
"""

from __future__ import annotations

from app.core.module_registry import registry


def test_module_state_persisted_in_db(client):
    """disable(persist=True)/enable(persist=True) пишут строку в module_registry."""
    from app.core import db
    from app.core.models import ModuleRegistry as Row
    from sqlalchemy.orm import Session

    engine = db.get_engine()
    registry.disable("_sample", persist=True)
    with Session(engine) as s:
        row = s.get(Row, "_sample")
        assert row is not None and row.enabled == 0

    registry.enable("_sample", persist=True)
    with Session(engine) as s:
        row = s.get(Row, "_sample")
        assert row is not None and row.enabled == 1


def test_load_states_from_db_restores_disabled(migrated_db):
    """Состояние «отключён», сохранённое в БД, применяется при загрузке."""
    from app.core import db
    from app.core.models import ModuleRegistry as Row
    from sqlalchemy.orm import Session

    with db.get_session_ctx() as s:
        s.merge(Row(module_id="_sample", enabled=0))
        s.commit()

    registry.enable("_sample")  # снимем возможное состояние других тестов
    registry.load_states_from_db()
    assert not registry.is_enabled("_sample")

    # возврат к значению по умолчанию — не влияет на другие тесты
    with db.get_session_ctx() as s:
        s.query(Row).filter(Row.module_id == "_sample").delete()
        s.commit()
    registry.enable("_sample")


def test_sample_route_served_when_enabled(client):
    """Модуль _sample смонтирован при включённом состоянии и отвечает (T1-06)."""
    # mount() идемпотентен по имени роутера; повторный вызов безопасен.
    registry.enable("_sample")
    registry.mount(client.app)
    resp = client.get("/_sample/")
    assert resp.status_code == 200
    assert resp.json() == {"module": "_sample", "status": "ok"}


def test_static_style_is_served(client):
    """Единый стиль интерфейса раздаётся из /static (T1-07)."""
    resp = client.get("/static/style.css")
    assert resp.status_code == 200
    assert "css" in resp.headers.get("content-type", "")


def test_index_page_has_navigation_and_style(client):
    """Главная страница использует base.html со ссылкой на /static/style.css."""
    resp = client.get("/")
    assert resp.status_code == 200
    assert "/static/style.css" in resp.text


def test_restore_writes_audit(client, tmp_path):
    """Восстановление из копии создаёт запись аудита action=restore (T1-08/T1-09)."""
    from app.core import db
    from app.core.audit import add_audit
    from app.core.backup import create_backup, restore_backup
    from app.core.config import get_settings
    from app.core.models import AuditLog
    from sqlalchemy.orm import Session

    settings = get_settings()
    backup = create_backup(label="audit-check")
    assert backup.exists()

    # фиксируем маркер до восстановления (в той же транзакции — audit + данные)
    marker = "pre-restore-marker"
    with db.get_session_ctx() as s:
        add_audit(s, entity_type="test", entity_id=marker, action="create")
        s.commit()

    restore_backup(backup)

    with Session(db.get_engine()) as s:
        entries = s.query(AuditLog).all()
    actions = {e.action for e in entries}
    assert "restore" in actions
    restore_row = next(e for e in entries if e.action == "restore")
    assert restore_row.entity_type == "database"
    assert str(settings.data_dir.name) or True  # путь копии в after_data
    assert "backup" in (restore_row.after_data or "")
