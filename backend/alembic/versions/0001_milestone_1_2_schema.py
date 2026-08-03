"""Milestone 1 + 2 schema: environments, flags, versions, targeting, groups, audit log.

This is the schema the app previously created with `Base.metadata.create_all`.
A database that already has those tables can adopt migrations without
recreating anything by running `alembic stamp 0001` once.

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

FLAG_TYPE = sa.Enum("boolean", "string", "number", name="flagtype")


def upgrade() -> None:
    op.create_table(
        "environments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_environments_id", "environments", ["id"])
    op.create_index("ix_environments_key", "environments", ["key"], unique=True)

    op.create_table(
        "flags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("type", FLAG_TYPE, nullable=False),
        sa.Column("default_value", sa.JSON(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("owner_team", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_flags_id", "flags", ["id"])
    op.create_index("ix_flags_key", "flags", ["key"], unique=True)

    op.create_table(
        "flag_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("flag_id", sa.Integer(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("change_note", sa.String(length=255), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["flag_id"], ["flags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_flag_versions_id", "flag_versions", ["id"])
    op.create_index("ix_flag_versions_flag_id", "flag_versions", ["flag_id"])

    op.create_table(
        "targeting_rules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("flag_id", sa.Integer(), nullable=False),
        sa.Column("environment_id", sa.Integer(), nullable=False),
        sa.Column("rule_type", sa.String(length=50), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("conditions", sa.JSON(), nullable=True),
        sa.Column("value", sa.JSON(), nullable=True),
        sa.Column("rollout_percentage", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["flag_id"], ["flags.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["environment_id"], ["environments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("flag_id", "environment_id", "rule_type", name="uq_flag_env_rule"),
    )
    op.create_index("ix_targeting_rules_id", "targeting_rules", ["id"])
    op.create_index("ix_targeting_rules_flag_id", "targeting_rules", ["flag_id"])
    op.create_index("ix_targeting_rules_environment_id", "targeting_rules", ["environment_id"])

    op.create_table(
        "user_group_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=100), nullable=False),
        sa.Column("group_key", sa.String(length=100), nullable=False),
        sa.Column("environment_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["environment_id"], ["environments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_group_memberships_id", "user_group_memberships", ["id"])
    op.create_index("ix_user_group_memberships_user_id", "user_group_memberships", ["user_id"])
    op.create_index("ix_user_group_memberships_group_key", "user_group_memberships", ["group_key"])
    op.create_index(
        "ix_user_group_memberships_environment_id", "user_group_memberships", ["environment_id"]
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actor", sa.String(length=100), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.String(length=50), nullable=False),
        sa.Column("environment_id", sa.Integer(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["environment_id"], ["environments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_log_id", "audit_log", ["id"])
    op.create_index("ix_audit_log_timestamp", "audit_log", ["timestamp"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])
    op.create_index("ix_audit_log_entity_type", "audit_log", ["entity_type"])
    op.create_index("ix_audit_log_environment_id", "audit_log", ["environment_id"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("user_group_memberships")
    op.drop_table("targeting_rules")
    op.drop_table("flag_versions")
    op.drop_table("flags")
    op.drop_table("environments")
    FLAG_TYPE.drop(op.get_bind(), checkfirst=True)
