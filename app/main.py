"""Точка входа FastAPI (T1-01, T1-02, T1-05…T1-07).

Запуск: python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 (или start.bat).
Конфигурация — только из переменных окружения SAOT_* (app/core/config.py).
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.core import db
from app.core.audit import setup_logging
from app.core.config import get_settings
from app.core.errors import install_error_handling
from app.core.module_registry import discover_modules, registry


def run_startup_migrations() -> None:
    """Desktop-режим: миграции применяются автоматически при запуске (ARCHITECTURE §12, D-006).

    Серверный режим (SAOT_AUTO_MIGRATE=off): миграции — отдельной командой
    `python -m app.migrate` с подтверждением.
    """
    import os

    if os.environ.get("SAOT_AUTO_MIGRATE", "on").lower() in ("off", "0", "false"):
        return
    import logging

    from app.migrate import migrate

    try:
        migrate()
    except Exception:  # noqa: BLE001 — не ронять запуск из-за миграций; подробности в логе
        logging.getLogger("saot.startup").exception("Миграции при запуске не применены")
        raise

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()          # создаёт data/, backups/, logs/, attachments/ (T1-02)
    setup_logging()                    # T1-08
    log = logging.getLogger("saot.startup")
    run_startup_migrations()           # ARCHITECTURE §12: схема до первого запроса (desktop)
    db.init_db()                       # T1-03
    discover_modules()                 # T1-06
    registry.load_states_from_db()     # сохранённые состояния модулей (DATA_MODEL §1.11)
    registry.mount(app)
    log.info("Приложение запущено; БД: %s; модули: %s",
             settings.sqlalchemy_db_url,
             ", ".join(m.module_id for m in registry.enabled()) or "нет")
    yield
    db.dispose_engine()
    log.info("Приложение остановлено")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, docs_url=None, redoc_url=None, lifespan=lifespan)
    install_error_handling(app)        # T1-05
    app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")  # T1-07

    @app.get("/", response_class=None)
    async def index(request: Request):
        # Главная панель: виджеты включённых модулей — только фактические показатели (T2-08).
        from app.core import db

        widget_values = []
        try:
            with db.get_session_ctx() as session:
                for info in registry.enabled():
                    for widget in info.widgets:
                        try:
                            widget_values.append(widget(session))
                        except Exception:  # noqa: BLE001 — отказ виджета не ронняет главную
                            logging.getLogger("saot.dashboard").exception(
                                "Виджет модуля %s не построен", info.module_id
                            )
        except Exception:  # noqa: BLE001 — при недоступной БД показываем пустые состояния
            logging.getLogger("saot.dashboard").exception("Не удалось построить виджеты")
        return templates.TemplateResponse(
            request, "index.html", {"modules": registry.enabled(), "widgets": widget_values}
        )

    @app.get("/health")
    async def health():
        return {"status": "ok", "app": settings.app_name}

    return app


app = create_app()
