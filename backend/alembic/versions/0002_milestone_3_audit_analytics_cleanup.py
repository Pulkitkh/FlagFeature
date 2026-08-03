"""Milestone 3: audit diffs, evaluation analytics, cleanup reviews.

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Day 15: audit log gains an entity key and before/after/diff state ---
    with op.batch_alter_table("audit_log") as batch:
        batch.add_column(sa.Column("entity_key", sa.String(length=100), nullable=True))
        batch.add_column(sa.Column("before_state", sa.JSON(), nullable=True))
        batch.add_column(sa.Column("after_state", sa.JSON(), nullable=True))
        batch.add_column(sa.Column("diff", sa.JSON(), nullable=True))

    op.create_index("ix_audit_log_entity_key", "audit_log", ["entity_key"])
    op.create_index("ix_audit_log_actor", "audit_log", ["actor"])

    # --- Day 16: hourly evaluation counts flushed out of Redis ---
    op.create_table(
        "flag_evaluation_stats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("flag_key", sa.String(length=100), nullable=False),
        sa.Column("environment_key", sa.String(length=50), nullable=False),
        sa.Column("bucket_hour", sa.DateTime(timezone=True), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "flag_key", "environment_key", "bucket_hour", name="uq_stat_flag_env_hour"
        ),
    )
    op.create_index("ix_flag_evaluation_stats_id", "flag_evaluation_stats", ["id"])
    op.create_index("ix_flag_evaluation_stats_flag_key", "flag_evaluation_stats", ["flag_key"])
    op.create_index(
        "ix_flag_evaluation_stats_environment_key", "flag_evaluation_stats", ["environment_key"]
    )
    op.create_index("ix_flag_evaluation_stats_bucket_hour", "flag_evaluation_stats", ["bucket_hour"])

    # --- Day 17: cleanup suggestions that have been signed off ---
    op.create_table(
        "flag_cleanup_reviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("flag_id", sa.Integer(), nullable=False),
        sa.Column("reviewed_by", sa.String(length=100), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["flag_id"], ["flags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_flag_cleanup_reviews_id", "flag_cleanup_reviews", ["id"])
    # Unique index rather than a separate constraint: one review per flag, and
    # this is exactly what the model's `unique=True, index=True` produces.
    op.create_index(
        "ix_flag_cleanup_reviews_flag_id", "flag_cleanup_reviews", ["flag_id"], unique=True
    )


def downgrade() -> None:
    op.drop_table("flag_cleanup_reviews")
    op.drop_table("flag_evaluation_stats")
    op.drop_index("ix_audit_log_actor", table_name="audit_log")
    op.drop_index("ix_audit_log_entity_key", table_name="audit_log")
    with op.batch_alter_table("audit_log") as batch:
        batch.drop_column("diff")
        batch.drop_column("after_state")
        batch.drop_column("before_state")
        batch.drop_column("entity_key")
