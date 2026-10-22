"""Тесты резервного копирования и восстановления (T1-09).

Сценарий TESTING.md №16–18: copy → modify → restore → данные соответствуют.
"""

from __future__ import annotations

from pathlib import Path


def _add_legal_entity(session, full_name: str) -> str:
    from app.core.models import LegalEntity

    le = LegalEntity(full_name=full_name)
    session.add(le)
    session.flush()  # генерация id (D-012) до использования
    session.commit()
    return le.id


def test_backup_modify_restore_roundtrip(migrated_db, settings_env):
    from app.core import db
    from app.core.backup import create_backup, restore_backup
    from app.core.models import LegalEntity
    from sqlalchemy.orm import Session

    engine = db.get_engine()

    with Session(engine) as s:
        first_id = _add_legal_entity(s, "ООО Первый")

    copy_path = create_backup(label="test")
    assert Path(copy_path).exists()
    manifest = Path(str(copy_path).replace(".db", ".json"))
    assert manifest.exists(), "манифст копии не создан"

    with Session(engine) as s:
        _add_legal_entity(s, "ООО Второй после копии")

    with Session(engine) as s:
        assert s.query(LegalEntity).count() == 2

    restore_backup(copy_path)

    with Session(engine) as s:
        names = {le.full_name for le in s.query(LegalEntity)}
        ids = {le.id for le in s.query(LegalEntity)}
    assert names == {"ООО Первый"}
    assert ids == {first_id}
    # Страховочная копия pre-restore создана перед восстановлением.
    pre = [p for p in Path(settings_env.backups_dir).glob("saot_*pre-restore.db")]
    assert pre, "не создана страховочная копия перед восстановлением"


def test_restore_rejects_corrupted_backup(migrated_db, settings_env):
    import pytest

    from app.core.backup import create_backup, restore_backup

    copy_path = create_backup(label="corrupt-test")
    raw = bytearray(Path(copy_path).read_bytes())
    for i in range(100, min(500, len(raw))):
        raw[i] ^= 0xFF
    Path(copy_path).write_bytes(bytes(raw))

    with pytest.raises(ValueError, match="повреждена"):
        restore_backup(copy_path)
