"""Тесты модуля «Юридические лица» (этап 2, T2-09).

Сервисный слой: валидация форматов, дубликаты, архивирование без удаления
связей (D-009), аудит в транзакции изменения; импорт/экспорт по IMPORT_EXPORT.md.
"""

from __future__ import annotations

import io

import pytest
from openpyxl import Workbook, load_workbook
from sqlalchemy import select

from app.core.models import AuditLog, Department, LegalEntity
from app.modules.legal_entities import service as le


def _make(session, **kw) -> LegalEntity:
    data = {"full_name": "ООО Ромашка", "inn": "7701234567", "kpp": "770101001",
            "ogrn": "1027700133320"}
    data.update(kw)
    return le.create_legal_entity(session, data)


class TestCreateValidation:
    def test_requires_full_name(self, session):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc:
            le.create_legal_entity(session, {"full_name": "   "})
        assert exc.value.status_code == 422
        assert "Полное наименование" in exc.value.detail

    @pytest.mark.parametrize("field,value,msg", [
        ("inn", "12345", "ИНН"),
        ("kpp", "12345678", "КПП"),
        ("ogrn", "123", "ОГРН"),
    ])
    def test_bad_formats(self, session, field, value, msg):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc:
            le.create_legal_entity(session, {"full_name": "ООО Тест", field: value})
        assert exc.value.status_code == 422
        assert msg in exc.value.detail

    def test_valid_inn_10_or_12(self, session):
        a = le.create_legal_entity(session, {"full_name": "А", "inn": "7701234567"})
        b = le.create_legal_entity(session, {"full_name": "Б", "inn": "770123456789"})
        assert a.id and b.id

    def test_create_writes_audit_in_same_transaction(self, session):
        created = _make(session)
        entries = session.execute(
            select(AuditLog).where(AuditLog.entity_id == created.id)
        ).scalars().all()
        assert len(entries) == 1
        assert entries[0].action == "create"
        assert entries[0].entity_type == "legal_entity"
        assert created.id in entries[0].after_data


class TestDuplicates:
    def test_same_inn_kpp_conflict(self, session):
        from fastapi import HTTPException

        _make(session)
        with pytest.raises(HTTPException) as exc:
            _make(session, full_name="Другое имя")
        assert exc.value.status_code == 409
        assert "ИНН" in exc.value.detail

    def test_same_ogrn_conflict(self, session):
        from fastapi import HTTPException

        _make(session)
        with pytest.raises(HTTPException) as exc:
            le.create_legal_entity(session, {"full_name": "В", "inn": "7709999999",
                                             "kpp": "770901001", "ogrn": "1027700133320"})
        assert exc.value.status_code == 409

    def test_same_inn_other_kpp_is_warning_not_conflict(self, session):
        _make(session)
        conflict, warnings = le.find_duplicates(
            session, inn="7701234567", kpp="770202002", ogrn=None, full_name="Филиал"
        )
        assert conflict is None
        assert any("ИНН" in w for w in warnings)

    def test_update_excludes_self(self, session):
        created = _make(session)
        updated = le.update_legal_entity(session, created.id, {"short_name": "Ромашка"})
        assert updated.short_name == "Ромашка"


class TestArchive:
    def test_archive_keeps_related_data(self, session):
        created = _make(session)
        session.add(Department(name="Цех", legal_entity_id=created.id))
        session.commit()
        le.archive_legal_entity(session, created.id)
        refreshed = session.get(LegalEntity, created.id)
        assert refreshed.status == "archived"
        deps = session.execute(select(Department)).scalars().all()
        assert len(deps) == 1  # связанные данные НЕ удалены (D-009)
        audit = session.execute(
            select(AuditLog).where(AuditLog.entity_id == created.id, AuditLog.action == "archive")
        ).scalar_one()
        assert "departments" in (audit.comment or "")

    def test_double_archive_conflict_and_restore(self, session):
        from fastapi import HTTPException

        created = _make(session)
        le.archive_legal_entity(session, created.id)
        with pytest.raises(HTTPException) as exc:
            le.archive_legal_entity(session, created.id)
        assert exc.value.status_code == 409
        back = le.restore_legal_entity(session, created.id)
        assert back.status == "active"

    def test_archived_not_found_in_active_list(self, session):
        created = _make(session)
        le.archive_legal_entity(session, created.id)
        rows, total = le.list_legal_entities(session, status="active")
        assert total == 0
        rows, total = le.list_legal_entities(session, status="archived")
        assert total == 1


class TestListSearch:
    def test_search_by_name_and_inn(self, session):
        _make(session, full_name="ООО Вектор", inn="7711111111", kpp="771101001", ogrn=None)
        _make(session, full_name="АО Кубань", inn="7722222222", kpp="772201001", ogrn=None)
        rows, total = le.list_legal_entities(session, search="вектор")
        assert total == 1 and rows[0].full_name == "ООО Вектор"
        rows, total = le.list_legal_entities(session, search="77222")
        assert total == 1 and rows[0].full_name == "АО Кубань"


# ---------------- импорт / экспорт ----------------


def _xlsx(headers, rows) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(headers)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _write(tmp_path, headers, rows, name="import.xlsx"):
    p = tmp_path / name
    p.write_bytes(_xlsx(headers, rows))
    return p


class TestImport:
    def test_parse_and_add(self, session, tmp_path):
        path = _write(tmp_path, le.LE_HEADERS, [
            ["ООО Импорт1", "Импорт1", "7701111111", "770101001", None, None, None, None],
            ["ООО Импорт2", None, "7702222222", "770201001", None, None, None, None],
        ])
        records, structural = le.parse_import_file(path)
        assert not structural
        assert len(records) == 2
        preview = le.preview_import(session, records)
        assert preview.summary["add"] == 2
        report = le.commit_import(session, records, preview)
        assert report["added"] == 2
        _, total = le.list_legal_entities(session)
        assert total == 2

    def test_missing_required_column_structure_error(self, session, tmp_path):
        path = _write(tmp_path, ["ИНН", "КПП"], [["7701111111", "770101001"]])
        records, structural = le.parse_import_file(path)
        assert records == []
        assert any("Отсутствует обязательный столбец" in e for e in structural)

    def test_duplicate_detection_skip_mode(self, session, tmp_path):
        _make(session)  # ИНН 7701234567, КПП 770101001
        path = _write(tmp_path, le.LE_HEADERS, [
            ["ООО Дубль", None, "7701234567", "770101001", None, None, None, None],
        ])
        records, _ = le.parse_import_file(path)
        preview = le.preview_import(session, records, mode="add")
        assert preview.summary["skip"] == 1
        report = le.commit_import(session, records, preview)
        assert report["added"] == 0 and report["skipped"] == 1
        _, total = le.list_legal_entities(session)
        assert total == 1  # без потерь и без дублей

    def test_update_mode_shows_changes(self, session, tmp_path):
        created = _make(session)
        path = _write(tmp_path, le.LE_HEADERS, [
            ["ООО Ромашка обновл.", None, "7701234567", "770101001", None, None, None, None],
        ])
        records, _ = le.parse_import_file(path)
        preview = le.preview_import(session, records, mode="update")
        assert preview.summary["update"] == 1
        assert any("Полное наименование" in c for c in preview.results[0].changes)
        report = le.commit_import(session, records, preview)
        assert report["updated"] == 1
        assert session.get(LegalEntity, created.id).full_name == "ООО Ромашка обновл."

    def test_bad_format_rejected_and_cancel_keeps_data(self, session, tmp_path):
        """Сценарий 4+5: некорректные данные показаны; отмена — данные не изменились."""
        before = _make(session)
        path = _write(tmp_path, le.LE_HEADERS, [
            ["ООО Плохой ИНН", None, "abc", None, None, None, None, None],
            [None, None, "7703333333", "770301001", None, None, None, None],
        ])
        records, _ = le.parse_import_file(path)
        preview = le.preview_import(session, records)
        assert preview.summary["reject"] == 2
        assert preview.has_blocking_errors
        # «отмена импорта»: подтверждение не отправлено — commit не вызывался
        _, total = le.list_legal_entities(session)
        assert total == 1
        assert session.get(LegalEntity, before.id).full_name == "ООО Ромашка"

    def test_checksum_warning(self, session, tmp_path):
        path = _write(tmp_path, le.LE_HEADERS, [
            ["ООО Контроль", None, "7701234560", None, None, None, None, None],
        ])
        records, _ = le.parse_import_file(path)
        preview = le.preview_import(session, records)
        assert preview.summary["add"] == 1  # предупреждение, не ошибка
        assert any("Контрольная сумма" in w for w in preview.results[0].warnings)

    def test_alternative_headers(self, session, tmp_path):
        path = _write(tmp_path, ["Наименование", "Сокращенное наименование", "ИНН", "Примечание"], [
            ["ООО Алиас", "Алиас", "7704444444", "проверка"],
        ])
        records, structural = le.parse_import_file(path)
        assert records and records[0]["full_name"] == "ООО Алиас"
        assert records[0]["extra_info"] == "проверка"


class TestExport:
    def test_export_roundtrip_no_loss(self, session):
        """Сценарий 14: экспорт сохраняет данные без потерь (проверка round-trip)."""
        _make(session, full_name="ООО Экспорт", short_name="Эксп")
        rows = le.export_rows(session)
        assert rows[0][0] == "ООО Экспорт"
        from app.core.excel import xlsx_bytes

        data = xlsx_bytes(le.LE_HEADERS, rows)
        wb = load_workbook(io.BytesIO(data))
        got = list(wb.active.iter_rows(values_only=True))
        assert got[0][0] == "Полное наименование"
        assert got[1][0] == "ООО Экспорт" and got[1][2] == "7701234567"

    def test_export_filtered_by_ids(self, session):
        a = _make(session, full_name="ООО А", inn="7701111111", kpp="770101001", ogrn=None)
        _make(session, full_name="ООО Б", inn="7702222222", kpp="770201001", ogrn=None)
        rows = le.export_rows(session, ids=[a.id])
        assert len(rows) == 1 and rows[0][0] == "ООО А"

    def test_formula_injection_escaped(self, session, tmp_path):
        from app.core.excel import write_xlsx, read_xlsx_rows

        write_xlsx(le.LE_HEADERS, [["=HYPERLINK(\"http://evil\")", None, None, None, None, None, None, None]],
                   tmp_path / "out.xlsx")
        _headers, rows = read_xlsx_rows(tmp_path / "out.xlsx")
        assert str(rows[0][0]).startswith("'=")
