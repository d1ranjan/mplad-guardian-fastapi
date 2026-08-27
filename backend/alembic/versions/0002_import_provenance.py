"""Add persisted CSV import provenance.

Revision ID: 0002_import_provenance
Revises: 0001_guardian
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_import_provenance"
down_revision = "0001_guardian"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("project_imports", sa.Column("id", sa.Integer, primary_key=True), sa.Column("original_filename", sa.String(255), nullable=False), sa.Column("checksum", sa.String(96), nullable=False), sa.Column("total_rows", sa.Integer, nullable=False), sa.Column("accepted_rows", sa.Integer, nullable=False), sa.Column("warning_count", sa.Integer, nullable=False, server_default="0"), sa.Column("error_count", sa.Integer, nullable=False, server_default="0"), sa.Column("imported_by_id", sa.Integer, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_project_imports_checksum", "project_imports", ["checksum"])

def downgrade():
    op.drop_table("project_imports")
