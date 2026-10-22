"""HTTP-слой модуля «Юридические лица» (T2-01…T2-06).

Страницы (Jinja2): список, карточка создания/редактирования, архив, импорт.
JSON API: операции для главной панели и будущего интерфейса.
Выбор текущего юрлица — cookie saot_le + переменная шаблона current_legal_entity (T2-07).
"""

from __future__ import annotations

import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.core.excel import csv_bytes_utf8_bom, xlsx_bytes
from app.modules.legal_entities import service as le_service

BASE_DIR = Path(__file__).resolve().parents[2]
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

CURRENT_LE_COOKIE = "saot_current_le"

# Предпросмотр импорта до подтверждения (D-010): token -> разобранные строки.
# Desktop-приложение однопроцессное; очистка — при подтверждении/перезапуске.
_PENDING_IMPORTS: dict[str, list[dict]] = {}


def _page(request: Request, name: str, context: dict):
    """Единый рендер: доступные модули для навигации + текущее юрлицо (T2-07)."""
    from app.core.module_registry import registry

    ctx = {"request": request, "modules": registry.enabled()}
    le_id = request.cookies.get(CURRENT_LE_COOKIE)
    current_le = None
    if le_id:
        with next(get_session()) as session:
            row = session.get(le_service.LegalEntity, le_id)
            if row is not None and row.status == le_service.ACTIVE:
                current_le = row
    ctx["current_legal_entity"] = current_le
    ctx.update(context)
    status_code = ctx.pop("http_status", 200)
    return templates.TemplateResponse(request, name, ctx, status_code=status_code)


def build_router() -> APIRouter:
    router = APIRouter(prefix="/legal-entities", tags=["legal_entities"])

    # ---------------- страницы ----------------

    @router.get("/")
    async def list_page(
        request: Request,
        session: Session = Depends(get_session),
        q: str | None = None,
        status: str = le_service.ACTIVE,
        page: int = 1,
    ):
        rows, total = le_service.list_legal_entities(session, search=q, status=status, page=page)
        return _page(
            request,
            "legal_entities/list.html",
            {
                "items": rows,
                "total": total,
                "page": max(page, 1),
                "page_size": 30,
                "q": q or "",
                "status": status,
            },
        )

    @router.get("/new")
    async def new_page(request: Request):
        return _page(request, "legal_entities/form.html", {"item": None, "errors": []})

    @router.post("/new")
    async def new_submit(
        request: Request,
        session: Session = Depends(get_session),
        form: dict = Depends(_as_form),
    ):
        try:
            le = le_service.create_legal_entity(session, form)
        except HTTPException as exc:  # русские сообщения без стек-трейсов (T1-05)
            return _page(
                request,
                "legal_entities/form.html",
                {"item": form, "errors": [exc.detail], "mode": "create", "http_status": exc.status_code},
            )
        return RedirectResponse(f"/legal-entities/{le.id}", status_code=303)

    @router.get("/{le_id}")
    async def view_page(request: Request, le_id: str, session: Session = Depends(get_session)):
        le = le_service.get_or_404(session, le_id)
        counts = le_service.related_counts(session, le_id)
        return _page(request, "legal_entities/card.html", {"item": le, "counts": counts})

    @router.get("/{le_id}/edit")
    async def edit_page(request: Request, le_id: str, session: Session = Depends(get_session)):
        le = le_service.get_or_404(session, le_id)
        return _page(request, "legal_entities/form.html", {"item": le, "errors": [], "mode": "edit"})

    @router.post("/{le_id}/edit")
    async def edit_submit(
        request: Request,
        le_id: str,
        session: Session = Depends(get_session),
        form: dict = Depends(_as_form),
    ):
        try:
            le_service.update_legal_entity(session, le_id, form)
        except HTTPException as exc:
            item = {**form, "id": le_id}
            return _page(
                request,
                "legal_entities/form.html",
                {"item": item, "errors": [exc.detail], "mode": "edit", "http_status": exc.status_code},
            )
        return RedirectResponse(f"/legal-entities/{le_id}", status_code=303)

    @router.post("/{le_id}/archive")
    async def archive(le_id: str, session: Session = Depends(get_session)):
        le_service.archive_legal_entity(session, le_id)
        return RedirectResponse("/legal-entities/?status=archived", status_code=303)

    @router.post("/{le_id}/restore")
    async def restore(le_id: str, session: Session = Depends(get_session)):
        le_service.restore_legal_entity(session, le_id)
        return RedirectResponse("/legal-entities/", status_code=303)

    @router.post("/{le_id}/select")
    async def select_current(le_id: str, request: Request, session: Session = Depends(get_session)):
        """Выбор текущего юридического лица (T2-07): cookie + возврат на страницу."""
        le = le_service.get_or_404(session, le_id)
        response = RedirectResponse(request.headers.get("referer") or "/legal-entities/", status_code=303)
        response.set_cookie(CURRENT_LE_COOKIE, le.id, max_age=30 * 24 * 3600, samesite="lax")
        return response

    @router.get("/import/template")
    async def import_template():
        data = xlsx_bytes(le_service.LE_HEADERS, [])
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="template_legal_entities.xlsx"'},
        )

    @router.get("/import")
    async def import_page(request: Request):
        return _page(request, "legal_entities/import.html", {"preview": None})

    @router.post("/import")
    async def import_preview(
        request: Request,
        file: UploadFile,
        mode: str = Form("add"),
        session: Session = Depends(get_session),
    ):
        suffix = Path(file.filename or "upload.xlsx").suffix or ".xlsx"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(await file.read())
            tmp_path = Path(tmp.name)
        try:
            records, structural = le_service.parse_import_file(tmp_path)
            missing_required = any("Отсутствует обязательный столбец" in e for e in structural)
            if missing_required or (structural and not records):
                preview = le_service.ImportPreview(results=[], structure_errors=structural)
            else:
                preview = le_service.preview_import(session, records, mode=mode)
                preview.structure_errors = structural
        finally:
            tmp_path.unlink(missing_ok=True)
        token = uuid.uuid4().hex
        _PENDING_IMPORTS[token] = records
        return _render_preview(request, preview, token=token)

    @router.post("/import/confirm")
    async def import_confirm(
        request: Request,
        session: Session = Depends(get_session),
        token: str = Form(...),
    ):
        """Подтверждение импорта (D-010): сохранение ранее просмотренных строк
        одной транзакцией; отмена — просто не подтверждать (строки остаются в памяти)."""
        records = _PENDING_IMPORTS.pop(token, None)
        if records is None:
            return JSONResponse(
                status_code=422,
                content={"error": "Данные предпросмотра не найдены или устарели — загрузите файл заново."},
            )
        preview = le_service.preview_import(session, records)
        if preview.has_blocking_errors:
            return _render_preview(request, preview)
        report = le_service.commit_import(session, records, preview)
        return _render_preview(request, preview, report=report)

    # ---------------- JSON API ----------------

    @router.get("/api/list")
    async def api_list(
        session: Session = Depends(get_session),
        q: str | None = None,
        status: str = le_service.ACTIVE,
        page: int = 1,
    ):
        rows, total = le_service.list_legal_entities(session, search=q, status=status, page=page)
        return {
            "total": total,
            "items": [le_service.entity_snapshot(r) for r in rows],
        }

    @router.get("/api/export")
    async def api_export(
        session: Session = Depends(get_session),
        ids: str | None = None,
        q: str | None = None,
        status: str = le_service.ACTIVE,
        fmt: str = "xlsx",
    ):
        id_list = [s.strip() for s in ids.split(",")] if ids else None
        rows = le_service.export_rows(session, ids=id_list, search=q, status=status)
        if fmt == "csv":
            return Response(
                content=csv_bytes_utf8_bom(le_service.LE_HEADERS, rows),
                media_type="text/csv; charset=utf-8",
                headers={"Content-Disposition": 'attachment; filename="legal_entities.csv"'},
            )
        return Response(
            content=xlsx_bytes(le_service.LE_HEADERS, rows),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="legal_entities.xlsx"'},
        )

    @router.get("/api/stats")
    async def api_stats(session: Session = Depends(get_session)):
        _, active_total = le_service.list_legal_entities(session, status=le_service.ACTIVE, page_size=1)
        _, archived_total = le_service.list_legal_entities(session, status=le_service.ARCHIVED, page_size=1)
        return {"active": active_total, "archived": archived_total}

    return router


def _as_form(
    full_name: str = Form(""),
    short_name: str = Form(""),
    inn: str = Form(""),
    kpp: str = Form(""),
    ogrn: str = Form(""),
    legal_address: str = Form(""),
    actual_address: str = Form(""),
    extra_info: str = Form(""),
) -> dict:
    return {
        "full_name": full_name,
        "short_name": short_name,
        "inn": inn,
        "kpp": kpp,
        "ogrn": ogrn,
        "legal_address": legal_address,
        "actual_address": actual_address,
        "extra_info": extra_info,
    }


def _render_preview(request: Request, preview, report: dict | None = None, token: str | None = None):
    return _page(
        request,
        "legal_entities/import.html",
        {"preview": preview, "report": report, "token": token},
    )
