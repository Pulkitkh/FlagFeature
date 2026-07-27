from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models import FlagType

# ---------- Environment ----------


class EnvironmentCreate(BaseModel):
    key: str = Field(..., min_length=1, max_length=50, examples=["production"])
    name: str = Field(..., min_length=1, max_length=100, examples=["Production"])


class EnvironmentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)


class EnvironmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    name: str
    created_at: datetime


# ---------- Flag ----------


class FlagCreate(BaseModel):
    key: str = Field(..., min_length=1, max_length=100, examples=["new-checkout-flow"])
    type: FlagType = FlagType.boolean
    default_value: Any = False
    enabled: bool = True
    description: Optional[str] = ""
    owner_team: Optional[str] = ""


class FlagUpdate(BaseModel):
    """All fields optional so PUT can be used as a partial update."""

    type: Optional[FlagType] = None
    default_value: Optional[Any] = None
    enabled: Optional[bool] = None
    description: Optional[str] = None
    owner_team: Optional[str] = None
    change_note: Optional[str] = Field(
        default=None, description="Optional note stored with the new flag version"
    )


class FlagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    type: FlagType
    default_value: Any
    enabled: bool
    description: Optional[str]
    owner_team: Optional[str]
    created_at: datetime
    updated_at: datetime


class FlagVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    version_number: int
    snapshot: dict
    change_note: Optional[str]
    created_by: Optional[str]
    created_at: datetime


# ---------- Environment override (targeting_rules, rule_type=environment_override) ----------


class EnvironmentOverrideSet(BaseModel):
    enabled: bool = Field(..., description="Whether the flag is on in this environment")
    value: Optional[Any] = Field(
        default=None, description="Optional pinned value to return instead of the flag default"
    )


class EnvironmentOverrideOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    environment_id: int
    conditions: dict
    value: Optional[Any]
    updated_at: datetime


class TargetingRulesUpdate(BaseModel):
    user_ids: list[str] = Field(default_factory=list)
    group_keys: list[str] = Field(default_factory=list)
    percentage: Optional[float] = Field(default=None, ge=0, le=100)
    value: Optional[Any] = Field(
        default=None,
        description=(
            "Value served to users a rule matches. Defaults to `true` for boolean "
            "flags; string/number flags should set the variant value explicitly."
        ),
    )


class TargetingRulesOut(BaseModel):
    flag_key: str
    environment_key: str
    user_ids: list[str]
    group_keys: list[str]
    percentage: Optional[float] = None
    value: Optional[Any] = None


class UserGroupMembersUpsert(BaseModel):
    group_key: str = Field(..., min_length=1, max_length=100)
    user_ids: list[str] = Field(default_factory=list)


class UserGroupMembersOut(BaseModel):
    group_key: str
    user_ids: list[str]


# ---------- Evaluation ----------


class EvaluationRequest(BaseModel):
    flag_key: str
    environment_key: str
    user_context: Optional[dict] = Field(default_factory=dict)


class EvaluationResult(BaseModel):
    flag_key: str
    environment_key: str
    value: Any
    reason: str
    cached: bool = False


# ---------- Audit log ----------


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    actor: str
    action: str
    entity_type: str
    entity_id: str
    environment_id: Optional[int]
    details: Optional[dict]


# ---------- Overview (dashboard aggregates) ----------


class OverviewTotals(BaseModel):
    flags: int
    enabled: int
    disabled: int
    environments: int
    groups: int
    members: int


class EnvironmentCoverage(BaseModel):
    key: str
    name: str
    targeted_flags: int
    overridden_flags: int
    total_flags: int
    avg_rollout: Optional[float] = None


class ActivityPoint(BaseModel):
    date: str
    changes: int


class RuleMix(BaseModel):
    user_targeting: int
    group_targeting: int
    percentage_rollout: int
    environment_override: int


class OverviewOut(BaseModel):
    totals: OverviewTotals
    by_type: dict[str, int]
    rule_mix: RuleMix
    environment_coverage: list[EnvironmentCoverage]
    activity: list[ActivityPoint]
    recent_activity: list[AuditLogOut]
