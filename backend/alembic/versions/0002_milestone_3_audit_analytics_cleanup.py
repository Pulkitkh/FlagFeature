"""Milestone 3: audit diffs, evaluation analytics, cleanup reviews.

Written defensively. A database that was previously managed by
`Base.metadata.create_all` can be in a *hybrid* state: create_all adds tables
that don't exist yet, but it never alters an existing one. So a database
upgraded to the Milestone 3 code before migrations existed already has
`flag_evaluation_stats` and `flag_cleanup_reviews` while `audit_log` is still
missing its new columns — which is exactly the shape that produces
"column audit_log.entity_key does not exist" at runtime.

Every step below therefore checks first and creates only what's absent, so this
migration can adopt such a database without a "relation already exists" crash.

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _inspector():
    return sa.inspect(op.get_bind())


def _table_names() -> set[str]:
    return set(_inspector().get_table_names())


def _column_names(table: str) -> set[str]:
    return {column["name"] for column in _inspector().get_columns(table)}


def _index_names(table: str) -> set[str]:
    return {index["name"] for index in _inspector().get_indexes(table)}


def upgrade() -> None:
    # --- Day 15: audit log gains an entity key and before/after/diff state ---
    existing_columns = _column_names("audit_log")
    new_columns = {
        "entity_key": sa.Column("entity_key", sa.String(length=100), nullable=True),
        "before_state": sa.Column("before_state", sa.JSON(), nullable=True),
        "after_state": sa.Column("after_state", sa.JSON(), nullable=True),
        "diff": sa.Column("diff", sa.JSON(), nullable=True),
    }
    missing = {name: column for name, column in new_columns.items() if name not in existing_columns}

    if missing:
        with op.batch_alter_table("audit_log") as batch:
            for column in missing.values():
                batch.add_column(column)

    audit_indexes = _index_names("audit_log")
    if "ix_audit_log_entity_key" not in audit_indexes:
        op.create_index("ix_audit_log_entity_key", "audit_log", ["entity_key"])
    if "ix_audit_log_actor" not in audit_indexes:
        op.create_index("ix_audit_log_actor", "audit_log", ["actor"])

    tables = _table_names()

    # --- Day 16: hourly evaluation counts flushed out of Redis ---
    if "flag_evaluation_stats" not in tables:
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

    stat_indexes = _index_names("flag_evaluation_stats")
    for name, columns in (
        ("ix_flag_evaluation_stats_id", ["id"]),
        ("ix_flag_evaluation_stats_flag_key", ["flag_key"]),
        ("ix_flag_evaluation_stats_environment_key", ["environment_key"]),
        ("ix_flag_evaluation_stats_bucket_hour", ["bucket_hour"]),
    ):
        if name not in stat_indexes:
            op.create_index(name, "flag_evaluation_stats", columns)

    # --- Day 17: cleanup suggestions that have been signed off ---
    if "flag_cleanup_reviews" not in tables:
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

    review_indexes = _index_names("flag_cleanup_reviews")
    if "ix_flag_cleanup_reviews_id" not in review_indexes:
        op.create_index("ix_flag_cleanup_reviews_id", "flag_cleanup_reviews", ["id"])
    # Unique index rather than a separate constraint: one review per flag, and
    # this is exactly what the model's `unique=True, index=True` produces.
    if "ix_flag_cleanup_reviews_flag_id" not in review_indexes:
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
