"""Индексы legal_entities (DATA_MODEL §1.1: уникальность по ИНН+КПП и ОГРН
реализована частичными индексами с проверкой на уровне приложения — D-004, FR-02;
в SQLite unique-индекс по NULL-строкам не подходит, поэтому обычные индексы).

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-22
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_legal_entity_indexes"
down_revision: str | None = "0001_base_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_legal_entities_inn_kpp", "legal_entities", ["inn", "kpp"])
    op.create_index("ix_legal_entities_ogrn", "legal_entities", ["ogrn"])
    op.create_index("ix_legal_entities_status", "legal_entities", ["status"])


def downgrade() -> None:
    op.drop_index("ix_legal_entities_status", table_name="legal_entities")
    op.drop_index("ix_legal_entities_ogrn", table_name="legal_entities")
    op.drop_index("ix_legal_entities_inn_kpp", table_name="legal_entities")
