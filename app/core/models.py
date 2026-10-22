"""Модели SQLAlchemy ядра данных (DATA_MODEL.md §1).

Идентификаторы — UUID v4 строкой CHAR(36), генерируются приложением (D-012).
Статусы — enum(active, archived) строкой; каскадное удаление запрещено (§3).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


def _now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class StatusMixin:
    status: Mapped[str] = mapped_column(String(16), default="active", nullable=False)


class TimestampsMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now_utc, onupdate=_now_utc, nullable=False
    )


class LegalEntity(Base, StatusMixin, TimestampsMixin):
    """§1.1 legal_entities."""

    __tablename__ = "legal_entities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    full_name: Mapped[str] = mapped_column(String(500), nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(255))
    inn: Mapped[str | None] = mapped_column(String(12))
    kpp: Mapped[str | None] = mapped_column(String(9))
    ogrn: Mapped[str | None] = mapped_column(String(15))
    legal_address: Mapped[str | None] = mapped_column(Text)
    actual_address: Mapped[str | None] = mapped_column(Text)
    extra_info: Mapped[str | None] = mapped_column(Text)

    departments: Mapped[list["Department"]] = relationship(back_populates="legal_entity")


class Department(Base, StatusMixin, TimestampsMixin):
    """§1.2 departments (привязаны к юрлицу)."""

    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("legal_entity_id", "parent_id", "name", name="uq_departments_le_parent_name"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    legal_entity_id: Mapped[str] = mapped_column(
        ForeignKey("legal_entities.id"), nullable=False
    )
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    legal_entity: Mapped[LegalEntity] = relationship(back_populates="departments")


class Position(Base, StatusMixin, TimestampsMixin):
    """§1.3 positions — глобальный справочник (D-013)."""

    __tablename__ = "positions"
    __table_args__ = (UniqueConstraint("normalized_name", name="uq_positions_normalized_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False)
    legal_entity_id: Mapped[str | None] = mapped_column(ForeignKey("legal_entities.id"))


def normalize_position_name(name: str) -> str:
    """Нормализация названия должности для проверки дубликатов (D-013)."""
    return " ".join(name.strip().lower().split()).replace("\u00a0", " ")


class WorkSchedule(Base, StatusMixin, TimestampsMixin):
    """§1.4 справочник графиков работы."""

    __tablename__ = "work_schedules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)


class ShiftPattern(Base, StatusMixin, TimestampsMixin):
    """§1.4 справочник сменности."""

    __tablename__ = "shift_patterns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)


class WorkConditionSubclass(Base, StatusMixin, TimestampsMixin):
    """§1.4 подклассы условий труда."""

    __tablename__ = "work_condition_subclasses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    code: Mapped[str | None] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(255), nullable=False)


class ElectricalSafetyGroup(Base, StatusMixin, TimestampsMixin):
    """§1.4 группы по электробезопасности."""

    __tablename__ = "electrical_safety_groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)


class ContingentRecord(Base, StatusMixin, TimestampsMixin):
    """§1.5 contingent_records. Идентификация — D-004: без unique-ограничения."""

    __tablename__ = "contingent_records"
    __table_args__ = (
        Index(
            "ix_contingent_identity",
            "legal_entity_id",
            "department_id",
            "position_id",
            "workplace_label",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    legal_entity_id: Mapped[str] = mapped_column(ForeignKey("legal_entities.id"), nullable=False)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), nullable=False)
    position_id: Mapped[str] = mapped_column(ForeignKey("positions.id"), nullable=False)
    workplace_label: Mapped[str | None] = mapped_column(String(255))
    work_schedule_id: Mapped[str | None] = mapped_column(ForeignKey("work_schedules.id"))
    shift_pattern_id: Mapped[str | None] = mapped_column(ForeignKey("shift_patterns.id"))
    risk_card_number: Mapped[str | None] = mapped_column(String(100))
    sout_card_number: Mapped[str | None] = mapped_column(String(100))
    work_condition_subclass_id: Mapped[str | None] = mapped_column(
        ForeignKey("work_condition_subclasses.id")
    )
    training_program: Mapped[str | None] = mapped_column(String(500))
    internship_program: Mapped[str | None] = mapped_column(String(500))
    electrical_safety_group_id: Mapped[str | None] = mapped_column(
        ForeignKey("electrical_safety_groups.id")
    )

    medical_items: Mapped[list["ContingentMedicalItem"]] = relationship(
        back_populates="contingent_record"
    )


class ContingentMedicalItem(Base):
    """§1.6 contingent_medical_items (приказы 29н/342н)."""

    __tablename__ = "contingent_medical_items"
    __table_args__ = (
        UniqueConstraint(
            "contingent_record_id", "order_type", "item_number", name="uq_medical_item"
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    contingent_record_id: Mapped[str] = mapped_column(
        ForeignKey("contingent_records.id"), nullable=False
    )
    order_type: Mapped[str] = mapped_column(String(10), nullable=False)  # '29н' | '342н'
    item_number: Mapped[str] = mapped_column(String(50), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255))

    contingent_record: Mapped[ContingentRecord] = relationship(back_populates="medical_items")


class Employee(Base, StatusMixin, TimestampsMixin):
    """§1.7 employees."""

    __tablename__ = "employees"
    __table_args__ = (
        Index("ix_employees_last_first", "last_name", "first_name"),
        Index("ix_employees_snils", "snils"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    legal_entity_id: Mapped[str] = mapped_column(ForeignKey("legal_entities.id"), nullable=False)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), nullable=False)
    position_id: Mapped[str] = mapped_column(ForeignKey("positions.id"), nullable=False)
    contingent_record_id: Mapped[str | None] = mapped_column(ForeignKey("contingent_records.id"))
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100))
    hire_date: Mapped[date | None] = mapped_column(Date)
    birth_date: Mapped[date | None] = mapped_column(Date)
    snils: Mapped[str | None] = mapped_column(String(14))


class EmploymentHistory(Base):
    """§1.12 employment_history — история переводов (D-005). Реализация — этап 4."""

    __tablename__ = "employment_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    employee_id: Mapped[str] = mapped_column(ForeignKey("employees.id"), nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)  # NULL = текущий период
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"))
    position_id: Mapped[str | None] = mapped_column(ForeignKey("positions.id"))
    contingent_record_id: Mapped[str | None] = mapped_column(ForeignKey("contingent_records.id"))
    reason: Mapped[str | None] = mapped_column(String(255))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now_utc, nullable=False)


class AuditLog(Base):
    """§1.9 audit_log. Снимки до/после в JSON (D-014)."""

    __tablename__ = "audit_log"
    __table_args__ = (Index("ix_audit_entity_time", "entity_type", "entity_id", "changed_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False)
    action: Mapped[str] = mapped_column(String(16), nullable=False)  # create/update/archive/restore/import
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=_now_utc, nullable=False)
    actor: Mapped[str | None] = mapped_column(String(100))
    before_data: Mapped[str | None] = mapped_column(Text)  # JSON
    after_data: Mapped[str | None] = mapped_column(Text)  # JSON
    comment: Mapped[str | None] = mapped_column(Text)


class ModuleRegistry(Base):
    """§1.11 module_registry (опционально): состояние модулей."""

    __tablename__ = "module_registry"

    module_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    enabled: Mapped[int] = mapped_column(Integer, default=1, nullable=False)  # SQLite boolean
    settings: Mapped[str | None] = mapped_column(Text)  # JSON
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now_utc, onupdate=_now_utc, nullable=False
    )
