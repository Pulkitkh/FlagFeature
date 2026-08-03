import enum
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class FlagType(str, enum.Enum):
    boolean = "boolean"
    string = "string"
    number = "number"


class UserRole(str, enum.Enum):
    """Two roles, because that's the split that actually matters here.

    admin  — can change flags, targeting, environments and users.
    viewer — can see everything, including the audit log and analytics, but
             cannot change anything. Useful for support and stakeholders.
    """

    admin = "admin"
    viewer = "viewer"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False, default="")
    # bcrypt hash. The plaintext password is never stored or logged.
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.viewer)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.admin


class Environment(Base):
    __tablename__ = "environments"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, index=True, nullable=False)  # e.g. "production"
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    overrides = relationship(
        "TargetingRule", back_populates="environment", cascade="all, delete-orphan"
    )
    memberships = relationship(
        "UserGroupMembership", back_populates="environment", cascade="all, delete-orphan"
    )


class Flag(Base):
    __tablename__ = "flags"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    type = Column(Enum(FlagType), nullable=False, default=FlagType.boolean)
    default_value = Column(JSON, nullable=False, default=False)
    enabled = Column(Boolean, nullable=False, default=True)  # global kill switch
    description = Column(String(500), nullable=True, default="")
    owner_team = Column(String(100), nullable=True, default="")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    versions = relationship(
        "FlagVersion", back_populates="flag", cascade="all, delete-orphan",
        order_by="FlagVersion.version_number.desc()",
    )
    targeting_rules = relationship(
        "TargetingRule", back_populates="flag", cascade="all, delete-orphan"
    )

    def on_value(self, configured_value=None):
        """The value this flag serves when a rule matches.

        Boolean flags serve `True`. String/number flags serve the value stored
        on the rule, so "enabled for beta_users" can mean "beta_users see
        variant-b" rather than a meaningless `true`.
        """
        if configured_value is not None:
            return configured_value
        if self.type == FlagType.boolean:
            return True
        return self.default_value

    def off_value(self):
        """The value this flag serves when it is switched off.

        Boolean flags are hard `False`; typed flags fall back to their default,
        since `False` is not a valid string or number value.
        """
        if self.type == FlagType.boolean:
            return False
        return self.default_value


class FlagVersion(Base):
    __tablename__ = "flag_versions"

    id = Column(Integer, primary_key=True, index=True)
    flag_id = Column(Integer, ForeignKey("flags.id", ondelete="CASCADE"), index=True, nullable=False)
    version_number = Column(Integer, nullable=False)
    snapshot = Column(JSON, nullable=False)  # full flag config at this point in time
    change_note = Column(String(255), nullable=True, default="")
    created_by = Column(String(100), nullable=True, default="system")
    created_at = Column(DateTime(timezone=True), default=utcnow)

    flag = relationship("Flag", back_populates="versions")


class TargetingRule(Base):
    """Per-environment rule for a flag.

    All four rule kinds share this table and are distinguished by rule_type:
    "user_targeting", "group_targeting", "percentage_rollout" and
    "environment_override". `value` holds the value served when the rule
    matches, so non-boolean flags can serve a real string/number to targeted
    users instead of a bare `true`.
    """

    __tablename__ = "targeting_rules"

    id = Column(Integer, primary_key=True, index=True)
    flag_id = Column(Integer, ForeignKey("flags.id", ondelete="CASCADE"), index=True, nullable=False)
    environment_id = Column(
        Integer, ForeignKey("environments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    rule_type = Column(String(50), nullable=False, default="environment_override")
    priority = Column(Integer, nullable=False, default=0)
    conditions = Column(JSON, nullable=True, default=dict)  # e.g. {"enabled": false}
    value = Column(JSON, nullable=True)  # optional pinned resolved value
    rollout_percentage = Column(Float, nullable=True)  # reserved for Milestone 2
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("flag_id", "environment_id", "rule_type", name="uq_flag_env_rule"),
    )

    flag = relationship("Flag", back_populates="targeting_rules")
    environment = relationship("Environment", back_populates="overrides")


class UserGroupMembership(Base):
    """Reserved for Milestone 2 targeting; created now per the schema plan."""

    __tablename__ = "user_group_memberships"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), index=True, nullable=False)
    group_key = Column(String(100), index=True, nullable=False)
    environment_id = Column(
        Integer, ForeignKey("environments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_at = Column(DateTime(timezone=True), default=utcnow)

    environment = relationship("Environment", back_populates="memberships")


class AuditLog(Base):
    """One row per change, with enough state to answer "what actually changed?".

    `before_state` / `after_state` hold the full entity either side of the
    change and `diff` holds only the fields that moved, so the dashboard can
    render a readable diff without re-deriving it.
    """

    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow, index=True)
    actor = Column(String(100), nullable=False, default="system", index=True)
    action = Column(String(50), nullable=False, index=True)  # created, updated, deleted, toggled
    entity_type = Column(String(50), nullable=False, index=True)  # flag, environment, targeting_rule
    entity_id = Column(String(50), nullable=False)
    # The human-readable key (flag key, environment key, group key). entity_id
    # is a database id, which nobody can filter the audit log by.
    entity_key = Column(String(100), nullable=True, index=True)
    environment_id = Column(
        Integer, ForeignKey("environments.id"), index=True, nullable=True
    )
    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)
    diff = Column(JSON, nullable=True, default=dict)
    details = Column(JSON, nullable=True, default=dict)


class FlagEvaluationStat(Base):
    """Hourly evaluation counts, flushed out of Redis by scripts/flush_analytics.py.

    Redis holds the live counters (one INCR per evaluation); this table is the
    durable history the analytics chart reads.
    """

    __tablename__ = "flag_evaluation_stats"

    id = Column(Integer, primary_key=True, index=True)
    flag_key = Column(String(100), index=True, nullable=False)
    environment_key = Column(String(50), index=True, nullable=False)
    bucket_hour = Column(DateTime(timezone=True), index=True, nullable=False)
    count = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint(
            "flag_key", "environment_key", "bucket_hour", name="uq_stat_flag_env_hour"
        ),
    )


class FlagCleanupReview(Base):
    """Marks a stale-flag suggestion as dealt with, so it stops being suggested."""

    __tablename__ = "flag_cleanup_reviews"

    id = Column(Integer, primary_key=True, index=True)
    flag_id = Column(
        Integer, ForeignKey("flags.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    reviewed_by = Column(String(100), nullable=False, default="system")
    reviewed_at = Column(DateTime(timezone=True), default=utcnow)
    note = Column(String(500), nullable=True, default="")

    flag = relationship("Flag")
