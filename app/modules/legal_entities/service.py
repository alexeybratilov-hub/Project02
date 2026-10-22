"""Сервис юридических лиц (FR-01, FR-02; DATA_MODEL §1.1).

Проверки: обязательное полное наименование, форматы ИНН/КПП/ОГРН,
дубликаты (ИНН+КПП, ОГРН — конфликт; по наименованию/только ИНН — предупреждение),
архивирование вместо удаления (D-009): связанные данные сохраняются.
Аудит create/update/archive/import — в той же транзакции изменения (T1-08).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date as _date
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.audit import add_audit
from app.core.models import (
    ContingentRecord,
    Department,
    Employee,
    LegalEntity,
)

ACTIVE = "active"
ARCHIVED = "archived"

# IMPORT_EXPORT §3: канонические заголовки и альтернативные названия столбцов.
LE_HEADERS = [
    "Полное наименование",
    "Сокращённое наименование",
    "ИНН",
    "КПП",
    "ОГРН",
    "Юридический адрес",
    "Фактический адрес",
    "Дополнительные сведения",
]
LE_ALIASES = {
    "полное наименование": "full_name",
    "наименование": "full_name",
    "название": "full_name",
    "сокращённое наименование": "short_name",
    "сокращенное наименование": "short_name",
    "сокращённое": "short_name",
    "сокращенное": "short_name",
    "инн": "inn",
    "кпп": "kpp",
    "огрн": "ogrn",
    "юридический адрес": "legal_address",
    "адрес": "legal_address",
    "фактический адрес": "actual_address",
    "дополнительные сведения": "extra_info",
    "доп сведения": "extra_info",
    "примечание": "extra_info",
}

FIELDS_RU = {
    "full_name": "Полное наименование",
    "short_name": "Сокращённое наименование",
    "inn": "ИНН",
    "kpp": "КПП",
    "ogrn": "ОГРН",
    "legal_address": "Юридический адрес",
    "actual_address": "Фактический адрес",
    "extra_info": "Дополнительные сведения",
}


def _norm(value: Any) -> str | None:
    """Строка без пробелов по краям; пустое → None."""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _ci(value: Any) -> str:
    """Нормализация для регистронезависимого сравнения.

    SQLite lower()/upper() не работают с кириллицей (ASCII-only), поэтому
    приведение регистра выполняется на стороне Python и применяется к обеим
    сторонам сравнения (см. DATA_MODEL §1.1, FR-02).
    """
    return (value or "").casefold().replace("\u0401", "\u0435")  # Ё/е → е


def validate_inn(value: str | None) -> str | None:
    if value is None:
        return None
    if not re.fullmatch(r"\d{10}|\d{12}", value):
        raise HTTPException(status_code=422, detail="ИНН должен содержать 10 или 12 цифр.")
    return value


def validate_kpp(value: str | None) -> str | None:
    if value is None:
        return None
    if not re.fullmatch(r"\d{9}", value):
        raise HTTPException(status_code=422, detail="КПП должен содержать 9 цифр.")
    return value


def validate_ogrn(value: str | None) -> str | None:
    if value is None:
        return None
    if not re.fullmatch(r"\d{13}|\d{15}", value):
        raise HTTPException(status_code=422, detail="ОГРН должен содержать 13 или 15 цифр.")
    return value


def checksum_warning(inn: str | None) -> str | None:
    """Предупреждение о контрольной сумме ИНН (DATA_MODEL §1.1 — не блокирует)."""
    if not inn or len(inn) not in (10, 12):
        return None
    digits = [int(c) for c in inn]
    if len(digits) == 12:
        n11 = sum(d * w for d, w in zip(digits[:11], (7, 2, 4, 10, 3, 5, 9, 4, 6, 8))) % 11 % 10
        n12 = sum(d * w for d, w in zip(digits[:12], (3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8))) % 11 % 10
        if digits[10] != n11 or digits[11] != n12:
            return "Контрольная сумма ИНН не сходится — проверьте значение."
        return None
    control = sum(d * w for d, w in zip(digits[:9], (2, 4, 10, 3, 5, 9, 4, 6, 8))) % 11 % 10
    if digits[9] != control:
        return "Контрольная сумма ИНН не сходится — проверьте значение."
    return None


def entity_snapshot(le: LegalEntity) -> dict:
    return {
        "id": le.id,
        "full_name": le.full_name,
        "short_name": le.short_name,
        "inn": le.inn,
        "kpp": le.kpp,
        "ogrn": le.ogrn,
        "legal_address": le.legal_address,
        "actual_address": le.actual_address,
        "extra_info": le.extra_info,
        "status": le.status,
    }


def find_duplicates(
    session: Session,
    *,
    inn: str | None,
    kpp: str | None,
    ogrn: str | None,
    full_name: str,
    exclude_id: str | None = None,
) -> tuple[str | None, list[str]]:
    """Вернуть (конфликт-дубликат, список предупреждений). Проверка — активные юрлица."""
    conflict: str | None = None
    warnings: list[str] = []

    base = select(LegalEntity).where(LegalEntity.status == ACTIVE)
    if exclude_id:
        base = base.where(LegalEntity.id != exclude_id)

    if inn and kpp:
        dup = session.execute(
            base.where(LegalEntity.inn == inn, LegalEntity.kpp == kpp)
        ).scalar_one_or_none()
        if dup:
            conflict = f"Юридическое лицо с такими ИНН и КПП уже зарегистрировано: «{dup.full_name}»."
    if conflict is None and ogrn:
        dup = session.execute(base.where(LegalEntity.ogrn == ogrn)).scalar_one_or_none()
        if dup:
            conflict = f"Юридическое лицо с таким ОГРН уже зарегистрировано: «{dup.full_name}»."
    if conflict is None and inn:
        dup = session.execute(base.where(LegalEntity.inn == inn)).scalars().first()
        if dup:
            warnings.append(f"В базе уже есть юридическое лицо с таким ИНН: «{dup.full_name}».")
    target = _ci(full_name.strip())
    name_dup = next(
        (row for row in session.execute(base).scalars() if _ci((row.full_name or "").strip()) == target),
        None,
    )
    if name_dup:
        warnings.append("Похожее полное наименование уже существует — возможен дубликат.")
    return conflict, warnings


def create_legal_entity(session: Session, data: dict, *, actor: str = "system") -> LegalEntity:
    full_name = _norm(data.get("full_name"))
    if not full_name:
        raise HTTPException(status_code=422, detail="Полное наименование обязательно для заполнения.")
    inn = validate_inn(_norm(data.get("inn")))
    kpp = validate_kpp(_norm(data.get("kpp")))
    ogrn = validate_ogrn(_norm(data.get("ogrn")))

    conflict, _warnings = find_duplicates(session, inn=inn, kpp=kpp, ogrn=ogrn, full_name=full_name)
    if conflict:
        raise HTTPException(status_code=409, detail=conflict)

    le = LegalEntity(
        full_name=full_name,
        short_name=_norm(data.get("short_name")),
        inn=inn,
        kpp=kpp,
        ogrn=ogrn,
        legal_address=_norm(data.get("legal_address")),
        actual_address=_norm(data.get("actual_address")),
        extra_info=_norm(data.get("extra_info")),
    )
    session.add(le)
    session.flush()  # генерация id/created_at для снимка аудита
    add_audit(session, entity_type="legal_entity", entity_id=le.id, action="create",
              before=None, after=entity_snapshot(le), actor=actor)
    session.commit()
    return le


def update_legal_entity(session: Session, le_id: str, data: dict, *, actor: str = "system") -> LegalEntity:
    le = session.get(LegalEntity, le_id)
    if le is None:
        raise HTTPException(status_code=404, detail="Юридическое лицо не найдено.")
    before = entity_snapshot(le)

    full_name = _norm(data.get("full_name", le.full_name))
    if not full_name:
        raise HTTPException(status_code=422, detail="Полное наименование обязательно для заполнения.")
    inn = validate_inn(_norm(data.get("inn", le.inn)))
    kpp = validate_kpp(_norm(data.get("kpp", le.kpp)))
    ogrn = validate_ogrn(_norm(data.get("ogrn", le.ogrn)))

    conflict, _warnings = find_duplicates(
        session, inn=inn, kpp=kpp, ogrn=ogrn, full_name=full_name, exclude_id=le.id
    )
    if conflict:
        raise HTTPException(status_code=409, detail=conflict)

    le.full_name = full_name
    le.short_name = _norm(data.get("short_name", le.short_name))
    le.inn, le.kpp, le.ogrn = inn, kpp, ogrn
    le.legal_address = _norm(data.get("legal_address", le.legal_address))
    le.actual_address = _norm(data.get("actual_address", le.actual_address))
    le.extra_info = _norm(data.get("extra_info", le.extra_info))
    session.flush()
    add_audit(session, entity_type="legal_entity", entity_id=le.id, action="update",
              before=before, after=entity_snapshot(le), actor=actor)
    session.commit()
    return le


def related_counts(session: Session, le_id: str) -> dict[str, int]:
    def _count(model) -> int:
        return int(
            session.scalar(
                select(func.count()).select_from(model).where(
                    model.legal_entity_id == le_id, model.status == ACTIVE
                )
            )
            or 0
        )

    return {
        "departments": _count(Department),
        "contingent_records": _count(ContingentRecord),
        "employees": _count(Employee),
    }


def archive_legal_entity(session: Session, le_id: str, *, actor: str = "system") -> LegalEntity:
    """Архивирование вместо каскадного удаления (D-009): связанные данные не удаляются."""
    le = session.get(LegalEntity, le_id)
    if le is None:
        raise HTTPException(status_code=404, detail="Юридическое лицо не найдено.")
    if le.status == ARCHIVED:
        raise HTTPException(status_code=409, detail="Юридическое лицо уже в архиве.")
    before = entity_snapshot(le)
    counts = related_counts(session, le_id)
    le.status = ARCHIVED
    session.flush()
    comment = (
        "В архиве остались связанные записи: " + ", ".join(f"{k} — {v}" for k, v in counts.items() if v)
        if any(counts.values()) else None
    )
    add_audit(session, entity_type="legal_entity", entity_id=le.id, action="archive",
              before=before, after=entity_snapshot(le), actor=actor, comment=comment)
    session.commit()
    return le


def restore_legal_entity(session: Session, le_id: str, *, actor: str = "system") -> LegalEntity:
    le = session.get(LegalEntity, le_id)
    if le is None:
        raise HTTPException(status_code=404, detail="Юридическое лицо не найдено.")
    if le.status == ACTIVE:
        raise HTTPException(status_code=409, detail="Юридическое лицо уже активно.")
    before = entity_snapshot(le)
    le.status = ACTIVE
    session.flush()
    add_audit(session, entity_type="legal_entity", entity_id=le.id, action="restore_from_archive",
              before=before, after=entity_snapshot(le), actor=actor)
    session.commit()
    return le


def get_or_404(session: Session, le_id: str) -> LegalEntity:
    le = session.get(LegalEntity, le_id)
    if le is None:
        raise HTTPException(status_code=404, detail="Юридическое лицо не найдено.")
    return le


def _like_pattern(term: str) -> str:
    """LIKE-паттерн с экранированием %/_ (регистр приводится вызывающей стороной)."""
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _filtered_active(session: Session, conds: list):
    """Записи по SQL-условиям; регистронезависимый фильтр по тексту — на Python
    (SQLite lower() не работает с кириллицей)."""
    return session.execute(select(LegalEntity).where(*conds)).scalars().all()


def _matches(le: LegalEntity, term_lower: str) -> bool:
    hay = (
        _ci(le.full_name),
        _ci(le.short_name or ""),
    )
    return any(term_lower in h for h in hay)


def list_legal_entities(
    session: Session,
    *,
    search: str | None = None,
    status: str = ACTIVE,
    page: int = 1,
    page_size: int = 30,
) -> tuple[list[LegalEntity], int]:
    conds = [LegalEntity.status == status]
    term = (search or "").strip()
    if term:
        # Числовой/латинский фрагмент — по ИНН через SQL; текстовый — по
        # наименованиям на Python (SQLite lower() не понимает кириллицу).
        numeric = bool(re.fullmatch(r"\d+", term))
        if numeric:
            conds.append(LegalEntity.inn.like(_like_pattern(term), escape="\\"))
        rows = list(_filtered_active(session, conds))
        if not numeric:
            needle = _ci(term)
            rows = [r for r in rows if _matches(r, needle)]
        rows.sort(key=lambda r: _ci(r.full_name))
        total = len(rows)
        start = (max(page, 1) - 1) * page_size
        return rows[start : start + page_size], total
    total = int(session.scalar(select(func.count()).select_from(LegalEntity).where(*conds)) or 0)
    rows = (
        session.execute(
            select(LegalEntity)
            .where(*conds)
            .order_by(LegalEntity.full_name)
            .offset((max(page, 1) - 1) * page_size)
            .limit(page_size)
        )
        .scalars()
        .all()
    )
    return list(rows), total


# ---------------- импорт (IMPORT_EXPORT §1–3, D-010) ----------------


@dataclass
class ImportRowResult:
    row: int  # номер строки в файле (1 — заголовки)
    action: str  # add | update | skip | reject
    name: str
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    changes: list[str] = field(default_factory=list)


@dataclass
class ImportPreview:
    results: list[ImportRowResult]
    structure_errors: list[str]
    summary: dict = field(default_factory=dict)

    @property
    def has_blocking_errors(self) -> bool:
        return bool(self.structure_errors) or any(r.action == "reject" for r in self.results)


def _cell_str(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, _date):
        return v.strftime("%d.%m.%Y")
    if hasattr(v, "strftime"):  # datetime
        return v.strftime("%d.%m.%Y")
    return _norm(v)


def map_headers(headers: list[str]) -> tuple[dict[int, str], list[str]]:
    """Заголовки таблицы → имена полей; ошибки структуры (IMPORT_EXPORT §7)."""
    from app.core.excel import normalize_header

    mapping: dict[int, str] = {}
    problems: list[str] = []
    used: set[str] = set()
    for idx, h in enumerate(headers):
        key = LE_ALIASES.get(normalize_header(h))
        if key:
            if key in used:
                problems.append(f"Столбец «{h}» повторяется — лишние столбцы игнорируются.")
            else:
                used.add(key)
                mapping[idx] = key
        elif normalize_header(h):
            problems.append(f"Неизвестный столбец «{h}» — будет пропущен.")
    if "full_name" not in used:
        problems.insert(0, "Отсутствует обязательный столбец «Полное наименование».")
    return mapping, problems


def parse_import_file(path) -> tuple[list[dict], list[str]]:
    """Чтение файла → записи + структурные ошибки (§1 п.5)."""
    from app.core.excel import read_xlsx_rows

    headers, rows = read_xlsx_rows(path)
    mapping, structural = map_headers(headers)
    if "full_name" not in mapping.values():
        return [], structural
    records: list[dict] = []
    for row in rows:
        rec: dict[str, Any] = {}
        has_value = False
        for idx, key in mapping.items():
            val = _cell_str(row[idx] if idx < len(row) else None)
            if val:
                has_value = True
            rec[key] = val
        if has_value:
            records.append(rec)
    return records, structural


def _format_error_for(rec: dict) -> str | None:
    """Проверка форматов без исключения — текст ошибки для строки импорта."""
    try:
        validate_inn(rec.get("inn"))
        validate_kpp(rec.get("kpp"))
        validate_ogrn(rec.get("ogrn"))
    except HTTPException as exc:
        return exc.detail
    return None


def identify_existing(session: Session, rec: dict) -> LegalEntity | None:
    """Идентификация (IMPORT_EXPORT §3): ИНН+КПП, затем ОГРН."""
    stmt = select(LegalEntity).where(LegalEntity.status == ACTIVE)
    if rec.get("inn") and rec.get("kpp"):
        return session.execute(
            stmt.where(LegalEntity.inn == rec["inn"], LegalEntity.kpp == rec["kpp"])
        ).scalar_one_or_none()
    if rec.get("ogrn"):
        return session.execute(stmt.where(LegalEntity.ogrn == rec["ogrn"])).scalar_one_or_none()
    return None


def preview_import(session: Session, records: list[dict], *, mode: str = "add") -> ImportPreview:
    """Предпросмотр строк до подтверждения (D-010). Ничего не сохраняет."""
    results: list[ImportRowResult] = []
    seen_keys: set[tuple] = set()
    for i, rec in enumerate(records, start=2):  # строка 1 — заголовки
        name = rec.get("full_name") or "(без наименования)"
        r = ImportRowResult(row=i, action="add", name=name)
        if not rec.get("full_name"):
            r.action = "reject"
            r.errors.append("Обязательное поле «Полное наименование» не заполнено.")
            results.append(r)
            continue
        fmt_err = _format_error_for(rec)
        if fmt_err:
            r.action = "reject"
            r.errors.append(fmt_err)
            results.append(r)
            continue
        existing = identify_existing(session, rec)
        if existing is not None:
            changes = [
                f"{FIELDS_RU[k]}: «{getattr(existing, k) or '—'}» → «{rec[k]}»"
                for k in FIELDS_RU
                if rec.get(k) and str(rec[k]) != str(getattr(existing, k) or "")
            ]
            if mode == "update":
                r.action, r.changes = "update", changes
            else:
                r.action = "skip"
                r.warnings.append("Совпадение по ИНН+КПП/ОГРН — запись будет пропущена.")
        else:
            key = (rec.get("inn"), rec.get("kpp"), rec.get("ogrn"))
            if key != (None, None, None) and key in seen_keys:
                r.action = "skip"
                r.warnings.append("Дубликат внутри файла — строка будет пропущена.")
            else:
                if key != (None, None, None):
                    seen_keys.add(key)
                else:
                    r.warnings.append(
                        "Нет ИНН/ОГРН для идентификации — запись будет добавлена; "
                        "возможен дубликат по наименованию."
                    )
                chk = checksum_warning(rec.get("inn"))
                if chk:
                    r.warnings.append(chk)
                target_name = _ci(rec["full_name"].strip())
                name_dup = next(
                    (
                        row
                        for row in session.execute(
                            select(LegalEntity).where(LegalEntity.status == ACTIVE)
                        ).scalars()
                        if _ci((row.full_name or "").strip()) == target_name
                    ),
                    None,
                )
                if name_dup:
                    r.warnings.append("Такое полное наименование уже существует — возможен дубликат.")
        results.append(r)
    summary = {
        "total": len(results),
        "add": sum(1 for r in results if r.action == "add"),
        "update": sum(1 for r in results if r.action == "update"),
        "skip": sum(1 for r in results if r.action == "skip"),
        "reject": sum(1 for r in results if r.action == "reject"),
    }
    return ImportPreview(results=results, structure_errors=[], summary=summary)


def commit_import(
    session: Session, records: list[dict], preview: ImportPreview, *, actor: str = "system"
) -> dict:
    """Транзакционное сохранение подтверждённого импорта (D-010):
    либо все допустимые строки, либо полный откат — частичное повреждение недопустимо."""
    applied = 0
    updated = 0
    try:
        for rec, res in zip(records, preview.results):
            if res.action in ("skip", "reject"):
                continue
            if res.action == "update":
                existing = identify_existing(session, rec)
                if existing is None:  # гонка — переклассифицируем в добавление
                    res.action = "add"
                else:
                    before = entity_snapshot(existing)
                    for k in FIELDS_RU:
                        if rec.get(k):
                            setattr(existing, k, rec[k])
                    session.flush()
                    add_audit(session, entity_type="legal_entity", entity_id=existing.id,
                              action="import_update", before=before,
                              after=entity_snapshot(existing), actor=actor)
                    updated += 1
                    continue
            # action == add
            le = LegalEntity(
                full_name=rec["full_name"],
                short_name=rec.get("short_name"),
                inn=rec.get("inn"),
                kpp=rec.get("kpp"),
                ogrn=rec.get("ogrn"),
                legal_address=rec.get("legal_address"),
                actual_address=rec.get("actual_address"),
                extra_info=rec.get("extra_info"),
            )
            session.add(le)
            session.flush()
            add_audit(session, entity_type="legal_entity", entity_id=le.id,
                      action="import_create", before=None, after=entity_snapshot(le), actor=actor)
            applied += 1
        session.commit()
    except Exception:
        session.rollback()
        raise
    return {
        "added": applied,
        "updated": updated,
        "skipped": preview.summary.get("skip", 0),
        "rejected": preview.summary.get("reject", 0),
    }


# ---------------- экспорт (IMPORT_EXPORT §6) ----------------


def export_rows(
    session: Session,
    *,
    ids: list[str] | None = None,
    search: str | None = None,
    status: str = ACTIVE,
) -> list[list]:
    """Строки экспорта в тех же столбцах, что и шаблон (§6); поддержка фильтрации."""
    if ids:
        query = select(LegalEntity).where(LegalEntity.id.in_(ids))
    else:
        query = select(LegalEntity).where(LegalEntity.status == status)
        term = (search or "").strip()
        if term:
            # тот же регистронезависимый фильтр, что и в списке (TESTING.md сценарий 14)
            rows = list_legal_entities(session, search=term, status=status, page_size=10**9)
            return [
                [r.full_name, r.short_name, r.inn, r.kpp, r.ogrn,
                 r.legal_address, r.actual_address, r.extra_info]
                for r in rows[0]
            ]
    rows = session.execute(query.order_by(LegalEntity.full_name)).scalars().all()
    return [
        [r.full_name, r.short_name, r.inn, r.kpp, r.ogrn,
         r.legal_address, r.actual_address, r.extra_info]
        for r in rows
    ]
