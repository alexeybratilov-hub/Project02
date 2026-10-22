# TASKS

Единый список задач. Статусы: `planned`, `in_progress`, `done`, `blocked`.

## Этап 0

| ID | Задача | Приоритет | Статус | Зависимости | Критерий завершения | Результат проверки |
|---|---|---|---|---|---|---|
| T0-01 | Проверить наличие и состояние репозитория | высокий | done | — | зафиксировано в HANDOFF | git status чист, ветка рабочая (2026-10-22) |
| T0-02 | Утвердить стек (D-001) | высокий | done | T0-01 | решение принято и обосновано | D-001 принято: Python+FastAPI+SQLAlchemy+Alembic+Jinja2+openpyxl; версии проверены установкой и импортом |
| T0-03 | Утвердить СУБД (D-002) | высокий | done | T0-02 | решение принято | D-002 принято: SQLite WAL, ORM-абстракция, путь к PostgreSQL (D-016) |
| T0-04 | Утвердить упаковку Windows (D-003) | высокий | done | T0-02 | решение принято | D-003 принято: portable embedded Python + start.bat/stop.bat; ручная проверка на Windows — этап 1 |
| T0-05 | Утвердить идентификацию контингента (D-004) | высокий | done | T0-03 | решение принято | D-004 принято: ключ A без unique-ограничения, подтверждение при неоднозначности |
| T0-06 | Утвердить историю переводов (D-005) | средний | done | T0-05 | решение принято | D-005 принято: таблица employment_history (DATA_MODEL §1.12) |
| T0-07 | Утвердить стратегию обновления (D-006) | высокий | done | T0-03 | решение принято | D-006 принято: Alembic forward-only + обязательная копия |
| T0-08 | Уточнить модель данных | высокий | done | T0-02…T0-07 | DATA_MODEL согласован | обновлён: positions, contingent, employment_history, закрытые вопросы |
| T0-09 | Уточнить границы модулей | средний | done | T0-02 | MODULES согласован | противоречий с принятыми решениями не найдено |
| T0-10 | Проверить документацию на противоречия | средний | done | T0-08, T0-09 | противоречия устранены | устранены: ARCHITECTURE §12–15, IMPORT_EXPORT §4, README «стек не утверждён» |
| T0-11 | Зафиксировать результат этапа 0 | высокий | done | T0-01…T0-10 | HANDOFF обновлён | HANDOFF/PROJECT_CONTEXT/ROADMAP/CHANGELOG обновлены |

## Этап 1

Стек утверждён (D-001), поэтому задачи детализированы.

| ID | Задача | Статус | Критерий завершения | Результат проверки |
|---|---|---|---|---|
| T1-01 | Создать структуру приложения `app/` (core, modules, templates, static) | done | структура соответствует ARCHITECTURE §3, §13 | создана: app/core, app/modules/_sample, app/templates, app/static, app/tests; `.gitignore` исключает runtime-папки (2026-10-22) |
| T1-02 | Настроить конфигурацию (SAOT_DB_URL/HOST/PORT) и создание папок data/backups/logs | done | приложение читает конфигурацию без кода с путями | `app/core/config.py`: только env SAOT_*, `ensure_runtime_dirs()` создаёт data/backups/logs/attachments; тесты test_smoke |
| T1-03 | Реализовать подключение SQLAlchemy + SQLite WAL + PRAGMA foreign_keys | done | данные сохраняются между перезапусками (тест) | `app/core/db.py`: event-listener WAL+foreign_keys на каждом подключении; сохранение между запусками проверено вручную (TESTING.md §5.2) и тестом FK |
| T1-04 | Инициализировать Alembic, базовая миграция схемы (legal_entities, departments, positions, справочники, contingent_records, contingent_medical_items, employees, employment_history, audit_log) | done | `alembic upgrade head` проходит на чистой и повторной базе | миграция 0001_base_schema; тесты test_migrations (чистая база, повторный upgrade); автомиграция при запуске desktop-режима (SAOT_AUTO_MIGRATE) |
| T1-05 | Реализовать FastAPI-каркас: обработка ошибок (русские сообщения, без стек-трейсов), корреляционный ID | done | тест 404/валидации возвращает понятную ошибку | `app/core/errors.py` install_error_handling; тесты 404 — русские сообщения без стек-трейсов (test_smoke) |
| T1-06 | Реестр модулей: регистрация, включение/отключение, зависимость от ядра | done | отключение модуля не ломает запуск; тест | `app/core/module_registry.py` + демо-модуль `_sample`; состояния сохраняются в таблице module_registry и загружаются при старте; тесты test_core, test_stage1_acceptance; ручная проверка выключения между запусками (TESTING.md §5.2) |
| T1-07 | Базовая навигация и стиль (Jinja2 layout, меню из реестра модулей) | done | главная страница и пустые состояния отображаются | base.html/index.html + /static/style.css; меню строится из registry.enabled(); тесты test_smoke, test_stage1_acceptance (/, /static/style.css) |
| T1-08 | Журналирование в logs/ и запись audit_log (create/update/archive/import) | done | аудит пишется в транзакции изменения | `setup_logging()` → logs/saot.log (rotating); add_audit — в транзакции вызывающего (тесты create/rollback); write_audit — служебные операции (restore) |
| T1-09 | Резервное копирование sqlite backup API + манифест; восстановление с предварительной копией и проверкой целостности | done | тест copy→modify→restore→данные соответствуют | `app/core/backup.py`: sqlite3 backup API, манифест JSON, integrity_check до/после, страховочная копия перед restore, аудит restore; тесты test_backup, test_stage1_acceptance |
| T1-10 | start.bat / stop.bat для portable-папки + инструкция Windows | blocked | ручная проверка на целевой Windows (зафиксировать результат) | скрипты `start.bat`/`stop.bat` созданы; **ручная проверка на целевой Windows не выполнена** — в среде разработки нет Windows. Точка продолжения: прогнать start.bat на Windows-машине и зафиксировать результат здесь |
| T1-11 | pytest: инфраструктура (временная БД, TestClient) + тесты миграций, FK, аудита, бэкапа | done | `pytest -q` зелёный, результаты в TESTING.md | conftest: изолированная tmp_path-база со схемой Alembic + TestClient; 20 тестов, `python -m pytest` → **20 passed in 1.62s** (2026-10-22), результаты в TESTING.md §5.1 |

## Этапы 2–5

Задачи детализируются при переходе к этапу. Общие группы:

- T2 — юридические лица и главная страница (следующий этап);
- T3 — контингент;
- T4 — работники;
- T5 — стабилизация, резервное копирование, тесты, документация.

## Этап 6+

Каждый модуль — отдельное задание по шаблону. Список модулей — `MODULES.md`.

## Правила ведения

- не создавать несколько противоречащих списков задач;
- задача считается завершённой только после проверки;
- при блокировке указывать причину и точку продолжения;
- результаты проверок фиксировать в `TESTING.md` и `HANDOFF.md`.