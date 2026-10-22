"""Модуль «Юридические лица» (этап 2, FR-01/FR-02).

Реестр модулей (T1-06): регистрация, маршруты, пункты навигации и
виджеты главной панели с фактическими показателями (пустые состояния — 0).
"""

from __future__ import annotations

from app.core.module_registry import ModuleInfo, registry


def _widgets():
    """Виджеты главной панели — только фактические данные из БД (без фиктивных)."""

    def legal_entities_widget(session):
        from app.modules.legal_entities import service as le_service

        _, active = le_service.list_legal_entities(session, status=le_service.ACTIVE, page_size=1)
        _, archived = le_service.list_legal_entities(session, status=le_service.ARCHIVED, page_size=1)
        return {
            "title": "Юридические лица",
            "value": active,
            "caption": f"активных; в архиве: {archived}",
            "href": "/legal-entities/",
            "empty_hint": "Пока нет ни одного юридического лица — создайте первое.",
        }

    return [legal_entities_widget]


def _router():
    from app.modules.legal_entities.router import build_router

    return build_router()


registry.register(
    ModuleInfo(
        module_id="legal_entities",
        title="Юридические лица",
        description="Реестр юридических лиц: карточки, архив, импорт/экспорт Excel.",
        version="0.1.0",
        enabled_by_default=True,
        requires_core=["db", "audit", "errors"],
        router_factory=_router,
        navigation_items=[{"href": "/legal-entities/", "title": "Юридические лица"}],
        widgets=_widgets(),
    )
)
