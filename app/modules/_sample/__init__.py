"""Тестовый (демонстрационный) модуль ядра — проверка контракта T1-06.

Не является функциональным модулем этапа 2+; служит для проверки:
регистрации в реестре, публикации маршрутов, включения/отключения без
потери данных и без влияния на запуск приложения.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.module_registry import ModuleInfo, registry


def _router() -> APIRouter:
    router = APIRouter(prefix="/_sample", tags=["_sample"])

    @router.get("/")
    async def index():
        return {"module": "_sample", "status": "ok"}

    return router


registry.register(
    ModuleInfo(
        module_id="_sample",
        title="Тестовый модуль",
        description="Демонстрация контракта модуля (этап 1, T1-06).",
        version="0.1.0",
        enabled_by_default=True,
        requires_core=["db", "audit", "errors"],
        router_factory=_router,
        navigation_items=[{"href": "/_sample/", "title": "Тестовый модуль"}],
    )
)
