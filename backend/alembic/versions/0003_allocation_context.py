"""Add official allocation provenance and peer-context scoring tables.

Revision ID: 0003_allocation_context
Revises: 0002_import_provenance
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_allocation_context"
down_revision = "0002_import_provenance"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("official_allocation_imports", sa.Column("id", sa.Integer, primary_key=True), sa.Column("original_filename", sa.String(255), nullable=False), sa.Column("source_url", sa.String(512), nullable=False), sa.Column("source_scope", sa.Text, nullable=False), sa.Column("source_sha256", sa.String(96), nullable=False, unique=True), sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False), sa.Column("row_count", sa.Integer, nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_official_allocation_imports_source_sha256", "official_allocation_imports", ["source_sha256"])
    op.create_table("official_allocation_records", sa.Column("id", sa.Integer, primary_key=True), sa.Column("source_import_id", sa.Integer, sa.ForeignKey("official_allocation_imports.id", ondelete="CASCADE"), nullable=False), sa.Column("source_row_number", sa.Integer, nullable=False), sa.Column("state", sa.String(128), nullable=False), sa.Column("mp_name", sa.String(255), nullable=False), sa.Column("constituency", sa.String(255), nullable=False), sa.Column("allocated_amount", sa.Numeric(16, 2), nullable=False))
    op.create_index("ix_official_allocation_records_source_import_id", "official_allocation_records", ["source_import_id"])
    op.create_index("ix_official_allocation_records_state", "official_allocation_records", ["state"])
    op.create_table("allocation_model_runs", sa.Column("id", sa.Integer, primary_key=True), sa.Column("model_code", sa.String(96), nullable=False, unique=True), sa.Column("model_version", sa.String(96), nullable=False), sa.Column("source_import_id", sa.Integer, sa.ForeignKey("official_allocation_imports.id", ondelete="RESTRICT"), nullable=False), sa.Column("training_rows", sa.Integer, nullable=False), sa.Column("methodology", sa.Text, nullable=False), sa.Column("configuration", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column("evaluation", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column("status", sa.String(24), nullable=False, server_default="completed"), sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_allocation_model_runs_model_code", "allocation_model_runs", ["model_code"])
    op.create_index("ix_allocation_model_runs_source_import_id", "allocation_model_runs", ["source_import_id"])
    op.create_table("allocation_model_scores", sa.Column("id", sa.Integer, primary_key=True), sa.Column("model_run_id", sa.Integer, sa.ForeignKey("allocation_model_runs.id", ondelete="CASCADE"), nullable=False), sa.Column("allocation_record_id", sa.Integer, sa.ForeignKey("official_allocation_records.id", ondelete="CASCADE"), nullable=False), sa.Column("context_band", sa.String(32), nullable=False), sa.Column("model_score", sa.Integer, nullable=False), sa.Column("variance_direction", sa.String(32), nullable=False), sa.Column("state_peer_count", sa.Integer, nullable=False), sa.Column("state_peer_median", sa.Numeric(16, 2), nullable=False), sa.Column("national_peer_median", sa.Numeric(16, 2), nullable=False), sa.Column("applied_variance_percent", sa.Numeric(12, 2), nullable=False))
    op.create_index("ix_allocation_model_scores_model_run_id", "allocation_model_scores", ["model_run_id"])
    op.create_index("ix_allocation_model_scores_allocation_record_id", "allocation_model_scores", ["allocation_record_id"])
    op.create_index("ix_allocation_model_scores_context_band", "allocation_model_scores", ["context_band"])


def downgrade():
    op.drop_table("allocation_model_scores")
    op.drop_table("allocation_model_runs")
    op.drop_table("official_allocation_records")
    op.drop_table("official_allocation_imports")
