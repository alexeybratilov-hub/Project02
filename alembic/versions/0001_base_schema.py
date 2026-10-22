"""базовая схема ядра v1

Идентификатор пересмотра: 0001_base_schema
Дата: 2026-10-22 (этап 1, T1-04). Соответствует DATA_MODEL.md §1.1–1.7, 1.9, 1.11, 1.12.
Миграции forward-only (D-006); downgrade не предусмотрен стратегией, но оставлен
для разработки.

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_base_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _uuid_pk() -> sa.Column:
    return sa.Column("id", sa.String(length=36), primary_key=True)


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "legal_entities",
        _uuid_pk(),
        sa.Column("full_name", sa.String(length=500), nullable=False),
        sa.Column("short_name", sa.String(length=255), nullable=True),
        sa.Column("inn", sa.String(length=12), nullable=True),
        sa.Column("kpp", sa.String(length=9), nullable=True),
        sa.Column("ogrn", sa.String(length=15), nullable=True),
        sa.Column("legal_address", sa.Text(), nullable=True),
        sa.Column("actual_address", sa.Text(), nullable=True),
        sa.Column("extra_info", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        *_timestamps(),
    )

    op.create_table(
        "departments",
        _uuid_pk(),
        sa.Column("legal_entity_id", sa.String(length=36), nullable=False),
        sa.Column("parent_id", sa.String(length=36), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        *_timestamps(),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.ForeignKeyConstraint(["parent_id"], ["departments.id"]),
        sa.UniqueConstraint("legal_entity_id", "parent_id", "name", name="uq_departments_le_parent_name"),
    )

    op.create_table(
        "positions",
        _uuid_pk(),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("legal_entity_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        *_timestamps(),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.UniqueConstraint("normalized_name", name="uq_positions_normalized_name"),
    )

    for table in ("work_schedules", "shift_patterns", "electrical_safety_groups"):
        op.create_table(
            table,
            _uuid_pk(),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
            *_timestamps(),
        )

    op.create_table(
        "work_condition_subclasses",
        _uuid_pk(),
        sa.Column("code", sa.String(length=50), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        *_timestamps(),
    )

    op.create_table(
        "contingent_records",
        _uuid_pk(),
        sa.Column("legal_entity_id", sa.String(length=36), nullable=False),
        sa.Column("department_id", sa.String(length=36), nullable=False),
        sa.Column("position_id", sa.String(length=36), nullable=False),
        sa.Column("workplace_label", sa.String(length=255), nullable=True),
        sa.Column("work_schedule_id", sa.String(length=36), nullable=True),
        sa.Column("shift_pattern_id", sa.String(length=36), nullable=True),
        sa.Column("risk_card_number", sa.String(length=100), nullable=True),
        sa.Column("sout_card_number", sa.String(length=100), nullable=True),
        sa.Column("work_condition_subclass_id", sa.String(length=36), nullable=True),
        sa.Column("training_program", sa.String(length=500), nullable=True),
        sa.Column("internship_program", sa.String(length=500), nullable=True),
        sa.Column("electrical_safety_group_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        *_timestamps(),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"]),
        sa.ForeignKeyConstraint(["position_id"], ["positions.id"]),
        sa.ForeignKeyConstraint(["work_schedule_id"], ["work_schedules.id"]),
        sa.ForeignKeyConstraint(["shift_pattern_id"], ["shift_patterns.id"]),
        sa.ForeignKeyConstraint(["work_condition_subclass_id"], ["work_condition_subclasses.id"]),
        sa.ForeignKeyConstraint(["electrical_safety_group_id"], ["electrical_safety_groups.id"]),
        # D-004: индекс идентификации, НЕ unique
    )
    op.create_index(
        "ix_contingent_identity",
        "contingent_records",
        ["legal_entity_id", "department_id", "position_id", "workplace_label"],
        unique=False,
    )

    op.create_table(
        "contingent_medical_items",
        _uuid_pk(),
        sa.Column("contingent_record_id", sa.String(length=36), nullable=False),
        sa.Column("order_type", sa.String(length=10), nullable=False),
        sa.Column("item_number", sa.String(length=50), nullable=False),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["contingent_record_id"], ["contingent_records.id"]),
        sa.UniqueConstraint("contingent_record_id", "order_type", "item_number", name="uq_medical_item"),
    )

    op.create_table(
        "employees",
        _uuid_pk(),
        sa.Column("legal_entity_id", sa.String(length=36), nullable=False),
        sa.Column("department_id", sa.String(length=36), nullable=False),
        sa.Column("position_id", sa.String(length=36), nullable=False),
        sa.Column("contingent_record_id", sa.String(length=36), nullable=True),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("middle_name", sa.String(length=100), nullable=True),
        sa.Column("hire_date", sa.Date(), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("snils", sa.String(length=14), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        *_timestamps(),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"]),
        sa.ForeignKeyConstraint(["position_id"], ["positions.id"]),
        sa.ForeignKeyConstraint(["contingent_record_id"], ["contingent_records.id"]),
    )
    op.create_index("ix_employees_last_first", "employees", ["last_name", "first_name"])
    op.create_index("ix_employees_snils", "employees", ["snils"])

    op.create_table(
        "employment_history",
        _uuid_pk(),
        sa.Column("employee_id", sa.String(length=36), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("department_id", sa.String(length=36), nullable=True),
        sa.Column("position_id", sa.String(length=36), nullable=True),
        sa.Column("contingent_record_id", sa.String(length=36), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"]),
        sa.ForeignKeyConstraint(["position_id"], ["positions.id"]),
        sa.ForeignKeyConstraint(["contingent_record_id"], ["contingent_records.id"]),
    )

    op.create_table(
        "audit_log",
        _uuid_pk(),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=36), nullable=False),
        sa.Column("action", sa.String(length=16), nullable=False),
        sa.Column("changed_at", sa.DateTime(), nullable=False),
        sa.Column("actor", sa.String(length=100), nullable=True),
        sa.Column("before_data", sa.Text(), nullable=True),
        sa.Column("after_data", sa.Text(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
    )
    op.create_index("ix_audit_entity_time", "audit_log", ["entity_type", "entity_id", "changed_at"])

    op.create_table(
        "module_registry",
        sa.Column("module_id", sa.String(length=64), primary_key=True),
        sa.Column("enabled", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("settings", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    for table in (
        "module_registry",
        "audit_log",
        "employment_history",
        "employees",
        "contingent_medical_items",
        "contingent_records",
        "electrical_safety_groups",
        "work_condition_subclasses",
        "shift_patterns",
        "work_schedules",
        "positions",
        "departments",
        "legal_entities",
    ):
        op.drop_table(table)
