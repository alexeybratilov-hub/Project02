"""Резервное копирование и восстановление SQLite (T1-09).

Копирование только через sqlite3 backup API (нельзя копировать файл WAL-базы cp).
Перед восстановлением — обязательная копия текущего состояния; после — проверка
PRAGMA integrity_check.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import get_settings


def _db_path() -> Path:
    settings = get_settings()
    url = settings.sqlalchemy_db_url
    if not url.startswith("sqlite"):
        raise ValueError("Резервное копирование v1 поддерживает только SQLite (D-002)")
    return Path(url.removeprefix("sqlite:///"))


def create_backup(label: str = "") -> Path:
    """Создать резервную копию базы в backups/. Вернуть путь к файлу копии."""
    src_path = _db_path()
    if not src_path.exists():
        raise FileNotFoundError(f"База данных не найдена: {src_path}")
    settings = get_settings()
    settings.backups_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    safe_label = "".join(c for c in label if c.isalnum() or c in "-_")[:40]
    name = f"saot_{stamp}{'_' + safe_label if safe_label else ''}.db"
    dst_path = Path(settings.backups_dir) / name

    src = sqlite3.connect(str(src_path))
    dst = sqlite3.connect(str(dst_path))
    try:
        with dst:
            src.backup(dst)
    finally:
        src.close()
        dst.close()

    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": str(src_path),
        "backup": str(dst_path),
        "label": label,
        "size_bytes": dst_path.stat().st_size,
    }
    (dst_path.with_suffix(".json")).write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return dst_path


def list_backups() -> list[Path]:
    settings = get_settings()
    d = Path(settings.backups_dir)
    return sorted(d.glob("saot_*.db")) if d.exists() else []


def restore_backup(backup_path: Path, *, make_safety_copy: bool = True) -> Path:
    """Восстановить базу из копии. Перед заменой создать копию текущего состояния.

    Возвращает путь страховочной копии (или пустой Path, если базы не было).
    """
    backup_path = Path(backup_path)
    if not backup_path.exists():
        raise FileNotFoundError(f"Резервная копия не найдена: {backup_path}")

    # Проверка целостности источника восстановления.
    try:
        con = sqlite3.connect(str(backup_path))
    except sqlite3.Error as exc:
        raise ValueError(f"Копия повреждена и не может быть открыта: {exc}") from exc
    try:
        result = con.execute("PRAGMA integrity_check").fetchone()
        if not result or result[0] != "ok":
            raise ValueError(f"Копия повреждена (integrity_check: {result}): {backup_path}")
    except sqlite3.DatabaseError as exc:
        raise ValueError(f"Копия повреждена (не читается): {exc}") from exc
    finally:
        con.close()

    dst_path = _db_path()
    safety: Path = Path()
    if dst_path.exists() and make_safety_copy:
        safety = create_backup(label="pre-restore")

    src = sqlite3.connect(str(backup_path))
    dst = sqlite3.connect(str(dst_path))
    try:
        with dst:
            dst.execute("PRAGMA foreign_keys=OFF")
            src.backup(dst)
    finally:
        src.close()
        dst.close()

    # Проверка восстановленной базы.
    con = sqlite3.connect(str(dst_path))
    try:
        result = con.execute("PRAGMA integrity_check").fetchone()
        if not result or result[0] != "ok":
            raise RuntimeError(f"Восстановленная база повреждена: {result}")
    finally:
        con.close()

    # Аудит значимой операции (T1-08): восстановление из копии.
    from app.core.audit import write_audit

    write_audit(
        entity_type="database",
        entity_id=str(dst_path.name),
        action="restore",
        after={"backup": str(backup_path), "safety_copy": str(safety)},
        comment="Восстановление из резервной копии",
    )
    return safety
