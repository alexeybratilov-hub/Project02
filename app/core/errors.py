"""Обработка ошибок и корреляционный ID (T1-05).

Пользователю — понятные сообщения на русском без стек-трейсов; подробностями
служит серверный лог. Каждому ответу присваивается X-Request-ID.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.audit import LOG_FORMAT  # noqa: F401  (единый формат лога)

log = logging.getLogger("saot.errors")


def new_request_id() -> str:
    return uuid.uuid4().hex[:12]


_HUMAN_HTTP = {
    400: "Запрос выполнен неверно.",
    403: "Действие запрещено.",
    404: "Запрошенная страница или запись не найдены.",
    405: "Метод запроса не поддерживается.",
    409: "Конфликт: запись уже существует или изменена.",
    422: "Проверьте введённые данные: обнаружены ошибки.",
}


def install_error_handling(app: FastAPI) -> None:
    @app.middleware("http")
    async def correlation_id(request: Request, call_next):
        rid = request.headers.get("X-Request-ID") or new_request_id()
        request.state.request_id = rid
        try:
            response = await call_next(request)
        except Exception:  # noqa: BLE001
            log.exception("Необработанная ошибка запроса %s %s (request_id=%s)",
                          request.method, request.url.path, rid)
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Внутренняя ошибка приложения. Повторите действие; "
                             "если ошибка повторяется — обратитесь к разработчику.",
                    "request_id": rid,
                },
            )
        response.headers["X-Request-ID"] = rid
        return response

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        rid = getattr(request.state, "request_id", "")
        message = exc.detail if isinstance(exc.detail, str) and _has_cyrillic(exc.detail) \
            else _HUMAN_HTTP.get(exc.status_code, _HUMAN_HTTP[400])
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": message, "request_id": rid},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        rid = getattr(request.state, "request_id", "")
        problems = []
        for err in exc.errors():
            field = " → ".join(str(p) for p in err.get("loc", ())[1:]) or "документ"
            problems.append(f"{field}: {_translate_reason(err.get('msg', ''))}")
        log.warning("Ошибка валидации %s (request_id=%s): %s",
                    request.url.path, rid, "; ".join(problems))
        return JSONResponse(
            status_code=422,
            content={
                "error": "Данные проверены с ошибками: " + "; ".join(problems),
                "request_id": rid,
            },
        )


def _has_cyrillic(text: str) -> bool:
    return any("\u0430" <= c.lower() <= "\u044f" for c in text)


_TRANSLATIONS = {
    "Field required": "обязательное поле не заполнено",
    "Input should be a valid integer": "должно быть целым числом",
    "Input should be a valid number": "должно быть числом",
    "Input should be a valid date": "должна быть дата (ГГГГ-ММ-ДД)",
    "String should have at most {max_length} characters": "слишком длинное значение",
    "value is not a valid enumeration member": "недопустимое значение",
}


def _translate_reason(msg: str) -> str:
    for key, human in _TRANSLATIONS.items():
        if msg.startswith(key.split("{")[0].strip()):
            return human
    return msg
