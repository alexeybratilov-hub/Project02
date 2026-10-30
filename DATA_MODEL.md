# DATA_MODEL

Модель данных первой версии. Решения этапа 0 утверждены (2026-10-22): СУБД — SQLite WAL через SQLAlchemy (D-002); идентификаторы — UUID v4 в `CHAR(36)`, генерируются приложением (D-012); должности — глобальный справочник (D-013); идентификация контингента — по D-004; история переводов — таблица `employment_history` (D-005). СНИЛС — строка (D-007).

## 1. Сущности

### 1.1. `legal_entities` — юридические лица

| Поле | Тип | Обяз. | Примечание |
|---|---|---|---|
| id | UUID | да | PK |
| full_name | string(500) | да | полное наименование |
| short_name | string(255) | нет | |
| inn | string(12) | нет | 10 или 12 цифр |
| kpp | string(9) | нет | 9 цифр |
| ogrn | string(15) | нет | 13 или 15 цифр |
| legal_address | text | нет | |
| actual_address | text | нет | |
| extra_info | text | нет | |
| status | enum(active, archived) | да | по умолчанию active |
| created_at | datetime | да | |
| updated_at | datetime | да | |

Ограничения: уникальность `(inn, kpp)` при заполненных значениях; уникальность `ogrn` при заполнении. Проверка контрольных сумм — на уровне приложения (предупреждение).

### 1.2. `departments` — подразделения

| Поле | Тип | Обяз. | Примечание |
|---|---|---|---|
| id | UUID | да | PK |
| legal_entity_id | UUID | да | FK → legal_entities |
| parent_id | UUID | нет | FK → departments |
| name | string(255) | да | |
| status | enum(active, archived) | да | |
| created_at, updated_at | datetime | да | |

Уникальность: `(legal_entity_id, parent_id, name)` с учётом NULL.

### 1.3. `positions` — должности

| Поле | Тип | Обяз. | Примечание |
|---|---|---|---|
| id | UUID | да | PK |
| name | string(255) | да | уникально по нормализованному значению (D-013) |
| normalized_name | string(255) | да | для проверки дубликатов, уникальный индекс |
| legal_entity_id | UUID | нет | NULL = глобальная должность; в v1 всегда NULL (D-013) |
| status | enum(active, archived) | да | |
| created_at, updated_at | datetime | да | |

Область действия — глобальный справочник (D-013 принято).

### 1.4. Справочники условий

- `work_schedules` — графики работы: id, name, status.
- `shift_patterns` — сменность: id, name, status.
- `work_condition_subclasses` — подклассы условий труда: id, code, name, status.
- `electrical_safety_groups` — группы по электробезопасности: id, name, status.

### 1.5. `contingent_records` — контингент

| Поле | Тип | Обяз. | Примечание |
|---|---|---|---|
| id | UUID | да | PK |
| legal_entity_id | UUID | да | FK → legal_entities |
| department_id | UUID | да | FK → departments |
| position_id | UUID | да | FK → positions |
| workplace_label | string(255) | нет | уточнение рабочего места |
| work_schedule_id | UUID | нет | FK → work_schedules |
| shift_pattern_id | UUID | нет | FK → shift_patterns |
| risk_card_number | string(100) | нет | номер карты ОПР |
| sout_card_number | string(100) | нет | номер карты СОУТ |
| work_condition_subclass_id | UUID | нет | FK → work_condition_subclasses |
| training_program | string(500) | нет | программа инструктажа |
| internship_program | string(500) | нет | программа стажировки |
| electrical_safety_group_id | UUID | нет | FK → electrical_safety_groups |
| status | enum(active, archived) | да | |
| created_at, updated_at | datetime | да | |

Проверка: `department.legal_entity_id = legal_entity_id`.

Идентификация записи — D-004 (принято): уникальное ограничение НЕ вводится; импорт идентифицирует кандидата по ключу `(legal_entity_id, department_id, position_id, workplace_label)` и требует подтверждения пользователем при неоднозначности. Индекс (не unique) по этим полям. Перспективная необязательная связь `workplace_id` (сущность «рабочее место») добавляется миграцией при появлении модулей СОУТ/ОПР.

### 1.6. `contingent_medical_items` — пункты приказов 29н/342н

| Поле | Тип | Обяз. | Примечание |
|---|---|---|---|
| id | UUID | да | PK |
| contingent_record_id | UUID | да | FK → contingent_records |
| order_type | enum(29н, 342н) | да | |
| item_number | string(50) | да | |
| note | string(255) | нет | |

Уникальность: `(contingent_record_id, order_type, item_number)`.

### 1.7. `employees` — работники

| Поле | Тип | Обяз. | Примечание |
|---|---|---|---|
| id | UUID | да | PK |
| legal_entity_id | UUID | да | FK → legal_entities |
| department_id | UUID | да | FK → departments |
| position_id | UUID | да | FK → positions |
| contingent_record_id | UUID | нет | FK → contingent_records; при неоднозначности выбора связь не устанавливается автоматически (D-004, FR-09) |
| last_name | string(100) | да | |
| first_name | string(100) | да | |
| middle_name | string(100) | нет | |
| hire_date | date | нет | проверка даты |
| birth_date | date | нет | проверка даты |
| snils | string(14) | нет | строка, формат XXX-XXX-XXX YY |
| status | enum(active, archived) | да | |
| created_at, updated_at | datetime | да | |

Ограничения: ФИО не является ключом. Уникальность СНИЛС в рамках одного юридического лица не гарантируется жёстко: возможны совпадения и внешние совместители; выдаётся предупреждение. Индексы: `(last_name, first_name)`, `snils`.

Проверки: подразделение и должность принадлежат тому же юридическому лицу; запись контингента принадлежит тому же юридическому лицу.

### 1.8. `attachments` — вложения (перспектива)

| Поле | Тип | Примечание |
|---|---|---|
| id | UUID | PK |
| entity_type | string | тип сущности |
| entity_id | UUID | идентификатор сущности |
| file_name | string | исходное имя |
| stored_path | string | путь в хранилище |
| mime_type | string | |
| size_bytes | integer | |
| checksum | string | |
| uploaded_at | datetime | |
| uploaded_by | string | |

Полиморфная связь без FK. В первой версии может не использоваться.

### 1.9. `audit_log` — журнал аудита

| Поле | Тип | Примечание |
|---|---|---|
| id | UUID | PK |
| entity_type | string | |
| entity_id | UUID | |
| action | enum(create, update, archive, restore, import) | |
| changed_at | datetime | |
| actor | string | пользователь или процесс |
| before_data | json | снимок до |
| after_data | json | снимок после |
| comment | text | |

Индекс: `(entity_type, entity_id, changed_at)`.

### 1.10. `schema_migrations`

| Поле | Тип |
|---|---|
| version | string PK |
| applied_at | datetime |
| description | string |

### 1.11. `module_registry` (опционально)

| Поле | Тип |
|---|---|
| module_id | string PK |
| enabled | boolean |
| settings | json |
| updated_at | datetime |

### 1.12. `employment_history` — история кадровых перемещений (D-005 принято)

| Поле | Тип | Обяз. | Примечание |
|---|---|---|---|
| id | UUID | да | PK |
| employee_id | UUID | да | FK → employees |
| start_date | date | нет | дата начала периода (дата приёма или перевода) |
| end_date | date | нет | NULL = текущий период |
| department_id | UUID | нет | FK → departments |
| position_id | UUID | нет | FK → positions |
| contingent_record_id | UUID | нет | FK → contingent_records |
| reason | string(255) | нет | приём, перевод, изменение контингента и т.п. |
| comment | text | нет | |
| created_at | datetime | да | |

При изменении подразделения/должности/контингента работника текущий период закрывается (`end_date`), создаётся новый; старая комбинация сохраняется. Исторические периоды не перезаписываются. Реализация — этап 4.

### 1.13. `users` (перспектива)

В первой версии не создаётся. Архитектура должна допустить её добавление без переделки основных сущностей.

### 1.14. `sout_cards` — карты СОУТ (Этап 6, 426-ФЗ)

Реализовано в `src/types.ts` (`SoutCard`) и `src/services/storage.ts` (ключ LocalStorage `saot_sout_cards`).

| Поле | Тип | Обяз. | Примечание |
|---|---|---|---|
| id | UUID | да | PK (D-012) |
| card_number | string(100) | да | номер карты СОУТ, уникален в пределах юрлица |
| legal_entity_id | UUID | да | FK → legal_entities |
| department_id | UUID | да | FK → departments |
| position_id | UUID | да | FK → positions |
| workplace_label | string | нет | уточнение рабочего места |
| is_analogous / analogous_basis | boolean / string | нет | признание аналогичным и основание |
| factors | json (массив `SoutHarmfulFactor`) | да | вредные/опасные производственные факторы с классами |
| final_class | string | да | итоговый класс условий труда (1, 2, 3.1–3.4, 4), авторасчёт по максимальному подклассу |
| employees_count / women_count / minors_count / disabled_count | int | да | численность занятых (с разбивкой) |
| guarantees | json (`SoutGuarantees`) | да | компенсации и гарантии по классу (ст. 7, 147 ТК РФ) |
| measurement_org / protocol_number | string | нет | лаборатория и протокол измерений |
| report_approved_at / expires_at | date | нет | утверждение отчёта КОУТ; плановая дата окончания (5 лет, ст. 8) |
| declaration_active / declaration_number | boolean / string | нет | декларация соответствия (ст. 11) |
| status | enum(`EntityStatus`) | да | active/archived (D-009) |
| created_at / updated_at | datetime | да | |

### 1.15. `sout_familiarizations` — ознакомления работников под роспись (Этап 6)

Ключ `saot_sout_familiarizations`. Поля: `id` (UUID PK), `sout_card_id` (FK → sout_cards), `employee_id` (FK → employees), `signed_at` (date, ст. 5 426-ФЗ), `comment`, `created_at`.

### 1.16. `opr_cards` — карты оценки профессиональных рисков (Этап 7, Приказ Минтруда 776н)

Реализовано в `src/types.ts` (`OprCard`, `OprHazard`) и `src/services/storage.ts` (ключ `saot_opr_cards`).

| Поле | Тип | Обяз. | Примечание |
|---|---|---|---|
| id | UUID | да | PK (D-012) |
| card_number | string(100) | да | номер карты ОПР («ОПР-001»), уникален в пределах юрлица |
| legal_entity_id / department_id / position_id | UUID | да | FK → legal_entities / departments / positions |
| contingent_record_id | UUID | нет | FK → contingent_records |
| workplace_label | string | нет | уточнение рабочего места |
| assessment_date | date | нет | дата оценки |
| assessment_method | string | да | «Матричный метод 5х5» / «Файна-Кинни» |
| commission_members | string | нет | состав комиссии |
| hazards | json (массив `OprHazard`) | да | идентифицированные опасности (каталог 776н — `DEFAULT_OPR_HAZARDS`) |
| overall_risk_score / overall_risk_level | int / enum(`RiskLevel`) | да | авторасчёт по максимуму баллов опасностей (D-016) |
| status | enum(`EntityStatus`) | да | active/archived (D-009) |
| created_at / updated_at | datetime | да | |

Структура `OprHazard`: `id`, `code` (шифр по каталогу 776н), `category`, `name`, `danger_source`, `severity` (1..5 — тяжесть последствий), `probability` (1..5 — вероятность), `risk_score` (= severity × probability, 1..25), `risk_level` (low <5, moderate 5–9, high 10–15, unacceptable ≥16), `existing_measures`, `recommended_measures`.

### 1.17. `opr_measures` — план мероприятий по снижению рисков (Этап 7)

Ключ `saot_opr_measures`. Поля: `id` (UUID PK), `opr_card_id` (FK → opr_cards), `hazard_id` (ссылка на опасность внутри карты), `measure_title` (обяз.), `deadline` (date), `responsible_person`, `status` (`planned` | `in_progress` | `completed`), `cost_estimate`, `comment`, `created_at`, `updated_at`.

### 1.18. `medical_cards` — карты медосмотров (Этап 8, Приказ Минздрава 29н)

Реализовано в `src/types.ts` (`MedicalExaminationCard`, `MedicalExamType`, `MedicalConclusion`) и `src/services/storage.ts` (ключ `saot_medical_cards`).

| Поле | Тип | Обяз. | Примечание |
|---|---|---|---|
| id | UUID | да | PK (D-012) |
| card_number | string(100) | да | номер карты («МЕД-001»), уникален в пределах юрлица |
| legal_entity_id | UUID | да | FK → legal_entities |
| employee_id | UUID | да | FK → employees (проверка: работник принадлежит юрлицу) |
| contingent_record_id | UUID | нет | FK → contingent_records (проверка: контингент принадлежит юрлицу) |
| sout_card_id | UUID | нет | FK → sout_cards (основание направления; проверка: карта СОУТ принадлежит юрлицу) |
| exam_type | enum(`MedicalExamType`) | да | `preliminary` (предварительный), `periodic` (периодический), `pre_shift` (предсменный/предрейсовый) |
| referral_date | date | нет | дата выдачи направления (не может быть в будущем) |
| exam_date | date | нет | дата прохождения осмотра (не может быть раньше направления и не в будущем) |
| next_due_date | date | нет | срок следующего осмотра (должен быть строго позже даты пройденного) |
| clinic_name | string | нет | медицинская организация |
| doctor_fio | string | нет | председатель врачебной комиссии / врач |
| conclusion | enum(`MedicalConclusion`) | да | `fit` (годен), `fit_restrictions` (годен с ограничениями), `unfit` (не годен), `pending` (заключение не получено) |
| conclusion_details | text | нет | подробности заключения, ограничения, выявленные противопоказания |
| contraindications_found | boolean | нет | флаг наличия противопоказаний |
| status | enum(`EntityStatus`) | да | active / archived (D-009) |
| created_at / updated_at | datetime | да | |

### 1.19. `psychiatric_exams` — акты психиатрического освидетельствования (Этап 8, Приказ Минздрава 342н)

Реализовано в `src/types.ts` (`PsychiatricExamination`, `PsychiatricConclusion`) и `src/services/storage.ts` (ключ `saot_psychiatric_exams`).

| Поле | Тип | Обяз. | Примечание |
|---|---|---|---|
| id | UUID | да | PK (D-012) |
| legal_entity_id | UUID | да | FK → legal_entities |
| employee_id | UUID | да | FK → employees (проверка: работник принадлежит юрлицу) |
| exam_date | date | нет | дата освидетельствования (не в будущем) |
| commission_members | string | нет | состав врачебной комиссии |
| conclusion | enum(`PsychiatricConclusion`) | да | `fit` (пригоден), `unfit` (непригоден), `fit_restricted` (допущен с ограничениями) |
| conclusion_protocol_number | string | нет | номер протокола / решения комиссии |
| valid_until | date | нет | срок действия заключения (должен быть позже даты освидетельствования) |
| basis | string | нет | вид деятельности / основание по Приказу 342н |
| comment | text | нет | примечание |
| status | enum(`EntityStatus`) | да | active / archived (D-009) |
| created_at / updated_at | datetime | да | |

### 1.20. Нормы выдачи СИЗ (`ppe_norms`)

Нормы бесплатной выдачи спецодежды, спецобуви и других СИЗ на основе ЕТН (Приказ Минтруда России № 767н) или ЛНА организации.

| Поле | Тип | Обязательно | Примечание |
|---|---|---|---|
| id | UUID | да | PK (D-012) |
| legal_entity_id | UUID | да | FK → legal_entities |
| department_id | UUID | нет | FK → departments (опциональная привязка к подразделению) |
| position_id | UUID | да | FK → positions |
| ppe_type | enum(`PpeCategory`) | да | `clothing`, `footwear`, `hands`, `head`, `eyes_face`, `respiratory`, `hearing`, `fall_protection`, `dermatological`, `other` |
| ppe_name | string | да | наименование СИЗ |
| protection_properties | string | нет | защитные свойства / маркировка (например, «ЗМи», «Мун») |
| quantity_per_period | number | да | количество выдачи (строго > 0) |
| period_months | number | да | срок носки в месяцах (0 = «до износа» для дежурных СИЗ) |
| unit | string | да | единица измерения (шт., пар, компл., мл, туб) |
| is_duty | boolean | да | признак дежурного СИЗ |
| norm_basis | string | нет | пункт ЕТН (Приказ 767н) или нормативного документа |
| hazard_or_factor | string | нет | идентифицированная опасность по 776н / вредный фактор |
| status | enum(`EntityStatus`) | да | active / archived (D-009) |
| created_at / updated_at | datetime | да | |

### 1.21. Личные карточки учёта выдачи СИЗ (`ppe_cards`)

Личные карточки работников в соответствии с Приложением № 2 к Приказу Минтруда России № 766н с фиксацией антропометрических размеров.

| Поле | Тип | Обязательно | Примечание |
|---|---|---|---|
| id | UUID | да | PK (D-012) |
| card_number | string | да | уникален в пределах юрлица («СИЗ-001») |
| legal_entity_id | UUID | да | FK → legal_entities |
| employee_id | UUID | да | FK → employees (один работник = одна активная карточка) |
| height | number | нет | рост в см (например, 178) |
| clothing_size | string | нет | размер одежды (например, «48-50 / 170-176») |
| shoe_size | string | нет | размер обуви (например, «42») |
| headwear_size | string | нет | размер головного убора (например, «58») |
| gasmask_size | string | нет | размер противогаза / респиратора (например, «2») |
| gloves_size | string | нет | размер перчаток (например, «9») |
| status | enum(`EntityStatus`) | да | active / archived (D-009) |
| created_at / updated_at | datetime | да | |

### 1.22. Записи выдачи и сдачи СИЗ (`ppe_issuances`)

Строки оборотной стороны личной карточки СИЗ (Приказ 766н): фактическая выдача, срок носки, плановая дата возврата, сдача/списание.

| Поле | Тип | Обязательно | Примечание |
|---|---|---|---|
| id | UUID | да | PK (D-012) |
| legal_entity_id | UUID | да | FK → legal_entities |
| ppe_card_id | UUID | да | FK → ppe_cards |
| employee_id | UUID | да | FK → employees |
| ppe_norm_item_id | UUID | нет | FK → ppe_norms (ссылка на норму ЕТН, если выдано по норме) |
| ppe_name | string | да | наименование выданного СИЗ |
| ppe_type | enum(`PpeCategory`) | да | категория СИЗ |
| protection_properties | string | нет | маркировка / защитные свойства |
| model_or_article | string | нет | артикул / модель изделия |
| issue_date | date | да | дата выдачи (не в будущем) |
| quantity | number | да | количество (строго > 0) |
| unit | string | да | единица измерения (шт., пар и т.д.) |
| wear_period_months | number | да | срок носки (0 = до износа) |
| due_return_date | date | нет | вычисляется автоматически: `issue_date + wear_period_months` |
| actual_return_date | date | нет | дата фактической сдачи/возврата/списания (>= `issue_date`) |
| return_reason | enum(`PpeReturnReason`) | нет | `wear`, `dismissal`, `unfit`, `transfer`, `other` |
| return_reason_text | string | нет | дополнительное описание причины списания |
| doc_number | string | нет | номер акта, ведомости или электронной подписи |
| status | enum(`EntityStatus`) | да | active / archived (D-009) |
| created_at / updated_at | datetime | да | |

### 1.23. Программы обучения (`saot_training_programs`, Подэтап 6.5)

Сущность `TrainingProgram` (Постановление Правительства РФ № 2464): `id`, `legal_entity_id`, `name`, `category` (`program_a` | `program_b` | `program_c` | `first_aid` | `ppe_use` | `intro_briefing` | `primary_briefing` | `repeated_briefing` | `unexpected_briefing` | `targeted_briefing`), `hours` (трудоемкость; валидация: Программа А — не менее 16 ч, первая помощь — не менее 8 ч), `recurring_months` (авторасчёт по справочнику `TRAINING_DEFAULT_RECURRING_MONTHS`: А/Б/ПП/СИЗ — 36 мес., В — 12 мес.), `positions`, `basis`, `status`, `created_at`, `updated_at`.

### 1.24. Назначения на обучение (`saot_training_assignments`, Подэтап 6.5)

Сущность `TrainingAssignment`: `id`, `legal_entity_id`, `employee_id`, `training_program_id`, `briefing_type` (для инструктажей), `assignment_date`, `planned_due_date`, `completed_protocol_id` (протокол, закрывающий назначение), `notes`, `status`, timestamps. Связи: работник и программа должны принадлежать одному юридическому лицу.

### 1.25. Протоколы проверки знаний (`saot_training_protocols`, Подэтап 6.5)

Сущность `TrainingProtocolItem`: `id`, `protocol_number` (номер протокола заседания комиссии), `legal_entity_id`, `training_program_id`, `session_date`, `chairperson` и `members` (`TrainingProtocolMember`: должность, ФИО, признак обучения по программе проверки знаний членов комиссий; состав не менее 3 человек — п. 27 Порядка 2464), `employee_id`, `result` (`passed` | `failed`), `issues_certificate` (запрет выдачи удостоверения при `failed` — п. 33), `certificate_number`, `registry_entry_number` (регистрационный номер в реестре обученных лиц Минтруда РФ — ЕИСОТ), `next_check_date` (авторасчёт: `session_date + recurring_months`), `invalidation_reason` (аннулирование — п. 35), `notes`, `status`, timestamps. Статусы действительности проверки знаний для реестра обученных: `valid` / `expiring` / `overdue` / `none` (`TrainingValidityStatus`).

## 2. Связи

```mermaid
erDiagram
    legal_entities ||--o{ departments : has
    legal_entities ||--o{ contingent_records : has
    legal_entities ||--o{ employees : has
    departments ||--o{ departments : parent
    departments ||--o{ contingent_records : contains
    departments ||--o{ employees : contains
    positions ||--o{ contingent_records : classifies
    positions ||--o{ employees : classifies
    contingent_records ||--o{ contingent_medical_items : has
    contingent_records ||--o{ employees : groups
    work_schedules ||--o{ contingent_records : schedule
    shift_patterns ||--o{ contingent_records : shift
    work_condition_subclasses ||--o{ contingent_records : subclass
    electrical_safety_groups ||--o{ contingent_records : group
    legal_entities ||--o{ sout_cards : has
    departments ||--o{ sout_cards : contains
    positions ||--o{ sout_cards : classifies
    sout_cards ||--o{ sout_familiarizations : has
    employees ||--o{ sout_familiarizations : signs
    legal_entities ||--o{ opr_cards : has
    departments ||--o{ opr_cards : contains
    positions ||--o{ opr_cards : classifies
    contingent_records ||--o| opr_cards : relates
    opr_cards ||--o{ opr_measures : plans
    legal_entities ||--o{ medical_cards : has
    employees ||--o{ medical_cards : undergoes
    contingent_records ||--o| medical_cards : links
    sout_cards ||--o| medical_cards : grounds
    legal_entities ||--o{ psychiatric_exams : has
    employees ||--o{ psychiatric_exams : undergoes
    legal_entities ||--o{ ppe_norms : establishes
    departments ||--o{ ppe_norms : scopes
    positions ||--o{ ppe_norms : standardizes
    legal_entities ||--o{ ppe_cards : maintains
    employees ||--o| ppe_cards : assigned
    ppe_cards ||--o{ ppe_issuances : records
    ppe_norms ||--o{ ppe_issuances : references
```

Логическая цепочка: юридическое лицо → подразделение → должность и контингент → работники; карты СОУТ/ОПР привязаны к тройке (юрлицо, подразделение, должность) и опционально к записи контингента; карты медосмотров привязаны к работнику и юрлицу, с опциональной привязкой к карте СОУТ и контингенту; нормы СИЗ привязаны к юрлицу и должности; личные карточки СИЗ привязаны к работнику и юрлицу (одна активная карточка на работника), а записи выдачи — к личной карточке СИЗ с контролем сроков возврата. Проверка ссылочной целостности внешних ключей карт СОУТ/ОПР, мероприятий плана, карт медосмотров, актов психиатрического освидетельствования, норм и личных карточек СИЗ выполняется в `verifyDataIntegrity()` (`src/services/storage.ts`).

## 3. Правила архивирования

- связанные записи не удаляются каскадно;
- архивирование — через `status`;
- по умолчанию показываются активные записи;
- архивные доступны по фильтру;
- жёсткое удаление связанных записей запрещено;
- удаление юридического лица с связями заменяется архивированием или отдельной процедурой с проверкой.

## 4. Правила изменения схемы

- только через миграции;
- обратная совместимость с ранее сохранёнными данными;
- новые поля — типизированные;
- JSON не используется вместо основной структуры;
- при изменении полей обновляются шаблоны импорта/экспорта и документация.

## 5. Закрытые вопросы этапа 0

Открытых вопросов нет. Принято: D-002 (SQLite WAL через SQLAlchemy ORM, путь к PostgreSQL), D-004 (идентификация контингента без unique-ограничения, подтверждение при неоднозначности), D-005 (таблица `employment_history`), D-012 (UUID v4 в CHAR(36)), D-013 (глобальный справочник должностей). Версия схемы хранится в таблице Alembic (`alembic_version`); сущность `schema_migrations` (§1.10) остаётся как описание принципа — фактическая реализация на Alembic (D-006).