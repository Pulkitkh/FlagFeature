"""Users and authentication.

Defensive in the same way as 0002: a database whose tables were built by
`create_all` may already have this table, so it is created only if absent.

The enum needs care on Postgres. Passing a `sa.Enum` column to `create_table`
makes SQLAlchemy emit `CREATE TYPE` as a side effect, with `checkfirst=False` —
so creating the type first and *then* creating the table fails with
"type userrole already exists". On Postgres the type is therefore created
explicitly (idempotently) and the column is declared with `create_type=False`
so the table creation doesn't try again. Other dialects have no named types and
need none of this.

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

ROLE_VALUES = ("admin", "viewer")
ROLE_TYPE_NAME = "userrole"


def _role_column_type(bind):
    """The column type to use, with the enum already in place on Postgres."""
    if bind.dialect.name != "postgresql":
        return sa.Enum(*ROLE_VALUES, name=ROLE_TYPE_NAME)

    # checkfirst so a partially-applied earlier run doesn't block this one.
    postgresql.ENUM(*ROLE_VALUES, name=ROLE_TYPE_NAME).create(bind, checkfirst=True)
    # create_type=False: the type exists now, and create_table must not re-emit it.
    return postgresql.ENUM(*ROLE_VALUES, name=ROLE_TYPE_NAME, create_type=False)


def upgrade() -> None:
    bind = op.get_bind()

    if "users" not in set(sa.inspect(bind).get_table_names()):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column("role", _role_column_type(bind), nullable=False),
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
    sa.Enum(*ROLE_VALUES, name=ROLE_TYPE_NAME).drop(op.get_bind(), checkfirst=True)
