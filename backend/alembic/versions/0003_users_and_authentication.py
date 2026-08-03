"""Users and authentication.

Defensive in the same way as 0002: a database whose tables were built by
`create_all` may already have this table, so it is created only if absent.

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

USER_ROLE = sa.Enum("admin", "viewer", name="userrole")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "users" not in set(inspector.get_table_names()):
        # Postgres needs the enum type to exist before the column references it;
        # checkfirst makes this a no-op elsewhere and on a re-run.
        USER_ROLE.create(bind, checkfirst=True)

        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column("role", USER_ROLE, nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    user_indexes = {index["name"] for index in sa.inspect(bind).get_indexes("users")}
    if "ix_users_id" not in user_indexes:
        op.create_index("ix_users_id", "users", ["id"])
    if "ix_users_email" not in user_indexes:
        op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_table("users")
    USER_ROLE.drop(op.get_bind(), checkfirst=True)
