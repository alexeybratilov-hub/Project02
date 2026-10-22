"""Реестр модулей (T1-06, ARCHITECTURE.md §4 «Контракт модуля»).

Модуль — пакет в app/modules/<имя>/ с объектом ModuleInfo. Ядро не импортирует
доменную логику модулей; отключение модуля не должно ломать запуск приложения.
"""

from __future__ import annotations

import importlib
import pkgutil
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from fastapi import FastAPI

if TYPE_CHECKING:  # pragma: no cover
    pass


@dataclass
class ModuleInfo:
    module_id: str
    title: str
    description: str = ""
    version: str = "0.0.0"
    enabled_by_default: bool = True
    requires_core: list[str] = field(default_factory=list)
    router_factory: object | None = None  # callable() -> fastapi.APIRouter
    navigation_items: list[dict] = field(default_factory=list)


class ModuleRegistry:
    def __init__(self) -> None:
        self._modules: dict[str, ModuleInfo] = {}
        self._disabled: set[str] = set()

    def register(self, info: ModuleInfo) -> None:
        self._modules[info.module_id] = info

    def disable(self, module_id: str) -> None:
        self._disabled.add(module_id)

    def enable(self, module_id: str) -> None:
        self._disabled.discard(module_id)

    def is_enabled(self, module_id: str) -> bool:
        return module_id in self._modules and module_id not in self._disabled

    def all(self) -> list[ModuleInfo]:
        return list(self._modules.values())

    def enabled(self) -> list[ModuleInfo]:
        return [m for m in self._modules.values() if m.module_id not in self._disabled]

    def get(self, module_id: str) -> ModuleInfo | None:
        return self._modules.get(module_id)

    def mount(self, app: FastAPI) -> None:
        """Подключить маршруты включённых модулей; ошибки — в лог, запуск не прерывать."""
        import logging

        log = logging.getLogger("saot.modules")
        for info in self.enabled():
            if callable(info.router_factory):
                try:
                    app.include_router(info.router_factory())
                except Exception:  # noqa: BLE001 — изоляция отказа модуля (T1-06)
                    log.exception("Не удалось подключить модуль %s", info.module_id)


registry = ModuleRegistry()


def discover_modules() -> None:
    """Импорт всех пакетов в app/modules; каждый должен вызвать registry.register."""
    package = importlib.import_module("app.modules")
    for modinfo in pkgutil.iter_modules(package.__path__):
        if modinfo.ispkg:
            try:
                importlib.import_module(f"app.modules.{modinfo.name}")
            except Exception:  # noqa: BLE001 — битый модуль не ломает ядро
                import logging

                logging.getLogger("saot.modules").exception(
                    "Модуль %s не загружен и отключён", modinfo.name
                )
                registry.disable(modinfo.name)
