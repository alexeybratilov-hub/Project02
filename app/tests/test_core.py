"""Тесты аудита и реестра модулей (T1-06, T1-08)."""

from __future__ import annotations


def test_audit_written_in_same_transaction(migrated_db):
    from app.core import db
    from app.core.audit import add_audit
    from app.core.models import AuditLog, LegalEntity
    from sqlalchemy.orm import Session

    engine = db.get_engine()
    with Session(engine) as s:
        le = LegalEntity(full_name="ООО Аудит")
        s.add(le)
        s.flush()  # id генерируется приложением при flush
        add_audit(
            s,
            entity_type="legal_entity",
            entity_id=le.id,
            action="create",
            after={"full_name": le.full_name},
        )
        s.commit()  # одно commit — запись и аудит

    with Session(engine) as s:
        entries = s.query(AuditLog).all()
    assert len(entries) == 1
    assert entries[0].action == "create"
    assert "Аудит" in entries[0].after_data


def test_audit_rolled_back_with_change(migrated_db):
    """Откат транзакции не оставляет сиротских записей аудита."""
    from app.core import db
    from app.core.audit import add_audit
    from app.core.models import AuditLog, LegalEntity
    from sqlalchemy.orm import Session

    engine = db.get_engine()
    with Session(engine) as s:
        le = LegalEntity(full_name="ООО Отменён")
        s.add(le)
        add_audit(s, entity_type="legal_entity", entity_id=le.id, action="create")
        s.rollback()

    with Session(engine) as s:
        assert s.query(AuditLog).count() == 0
        assert s.query(LegalEntity).count() == 0


def test_registry_enable_disable_does_not_break_app(client):
    """Отключение модуля не ломает запуск (критерий T1-06)."""
    from fastapi import APIRouter

    from app.core.module_registry import ModuleInfo, registry

    def factory():
        router = APIRouter(prefix="/demo-module")

        @router.get("/ping")
        def ping():
            return {"pong": True}

        return router

    info = ModuleInfo(module_id="demo", title="Демонстрационный модуль", router_factory=factory)
    registry.register(info)
    try:
        app = client.app
        registry.mount(app)
        assert client.get("/demo-module/ping").json() == {"pong": True}

        registry.disable("demo")
        assert not registry.is_enabled("demo")
        assert client.get("/health").status_code == 200  # запуск не сломан

        registry.enable("demo")
        assert registry.is_enabled("demo")
    finally:
        registry._modules.pop("demo", None)
        registry.disable("demo")
