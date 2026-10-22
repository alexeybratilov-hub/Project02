"""Журналирование в logs/ и запись аудита (T1-08).

Аудит пишется в той же транзакции, что и изменение данных: вызывающий код
создаёт запись через add_audit() и выполняет commit сам.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.models import AuditLog

LOG_FORMAT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"


def setup_logging() -> None:
    """Файловый лог в logs/saot.log + лог в консоль. Идемпотентно."""
    root = logging.getLogger("saot")
    if root.handlers:
        return
    settings = get_settings()
    settings.ensure_runtime_dirs()
    root.setLevel(logging.INFO)
    handler = RotatingFileHandler(
        settings.logs_dir / "saot.log", maxBytes=2_000_000, backupCount=5, encoding="utf-8"
    )
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    root.addHandler(handler)
    stream = logging.StreamHandler()
    stream.setFormatter(logging.Formatter(LOG_FORMAT))
    root.addHandler(stream)


def _dump(obj) -> str | None:
    if obj is None:
        return None
    return json.dumps(obj, ensure_ascii=False, default=str)


def add_audit(
    session: Session,
    *,
    entity_type: str,
    entity_id: str,
    action: str,
    before=None,
    after=None,
    actor: str = "system",
    comment: str | None = None,
) -> AuditLog:
    """Создать запись аудита (без commit — в транзакции вызывающего)."""
    entry = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        changed_at=datetime.now(timezone.utc).replace(tzinfo=None),
        actor=actor,
        before_data=_dump(before),
        after_data=_dump(after),
        comment=comment,
    )
    session.add(entry)
    return entry
