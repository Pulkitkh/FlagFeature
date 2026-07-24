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

    Milestone 1 only uses rule_type="environment_override" to flip a flag
    on/off (or pin a value) for a specific environment. rule_type is kept
    generic so Milestone 2 can add percentage rollout / user-group rules
    without a schema change.
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
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow, index=True)
    actor = Column(String(100), nullable=False, default="system")
    action = Column(String(50), nullable=False)  # created, updated, deleted, toggled
    entity_type = Column(String(50), nullable=False)  # flag, environment, targeting_rule
    entity_id = Column(String(50), nullable=False)
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=True)
    details = Column(JSON, nullable=True, default=dict)
