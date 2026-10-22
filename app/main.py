"""Точка входа FastAPI (T1-01, T1-02, T1-05…T1-07).

Запуск: python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 (или start.bat).
Конфигурация — только из переменных окружения SAOT_* (app/core/config.py).
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates

from app.core import db
from app.core.audit import setup_logging
from app.core.config import get_settings
from app.core.errors import install_error_handling
from app.core.module_registry import discover_modules, registry

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()          # создаёт data/, backups/, logs/, attachments/ (T1-02)
    setup_logging()                    # T1-08
    log = logging.getLogger("saot.startup")
    db.init_db()                       # T1-03
    discover_modules()                 # T1-06
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

    @app.get("/", response_class=None)
    async def index(request: Request):
        return templates.TemplateResponse(
            request, "index.html", {"modules": registry.enabled()}
        )

    @app.get("/health")
    async def health():
        return {"status": "ok", "app": settings.app_name}

    return app


app = create_app()
