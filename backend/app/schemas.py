from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models import FlagType, UserRole
from app.security import MIN_PASSWORD_LENGTH

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
    entity_key: Optional[str] = None
    environment_id: Optional[int] = None
    environment_key: Optional[str] = None
    before_state: Optional[dict] = None
    after_state: Optional[dict] = None
    diff: Optional[dict] = None
    summary: Optional[str] = None
    details: Optional[dict] = None


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


# ---------- Analytics (Day 16) ----------


class EvaluationPoint(BaseModel):
    date: str
    evaluations: int


class FlagAnalyticsOut(BaseModel):
    flag_key: str
    environment_key: Optional[str] = None
    days: int
    total: int
    series: list[EvaluationPoint]


# ---------- Cleanup suggestions (Day 17) ----------


class CleanupSuggestion(BaseModel):
    flag_key: str
    flag_id: int
    state: str  # "on" (fully rolled out) or "off" (fully disabled)
    reason: str
    owner_team: Optional[str] = None
    stale_since: datetime
    stale_days: int
    evaluations: int
    reviewed: bool = False
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None


class CleanupSuggestionsOut(BaseModel):
    stale_days: int
    suggestions: list[CleanupSuggestion]


class CleanupReviewCreate(BaseModel):
    note: Optional[str] = Field(default="", max_length=500)


class CleanupReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    flag_id: int
    reviewed_by: str
    reviewed_at: datetime
    note: Optional[str] = None


# ---------- Snapshot for the middleware SDK (Day 14) ----------


class SnapshotFlag(BaseModel):
    key: str
    type: FlagType
    default_value: Any
    enabled: bool
    user_ids: list[str] = Field(default_factory=list)
    group_keys: list[str] = Field(default_factory=list)
    percentage: Optional[float] = None
    targeted_value: Optional[Any] = None
    override_enabled: Optional[bool] = None
    override_value: Optional[Any] = None


class SnapshotOut(BaseModel):
    environment_key: str
    generated_at: datetime
    version: str
    flags: list[SnapshotFlag]
    group_members: dict[str, list[str]] = Field(
        default_factory=dict,
        description="group_key -> user ids, so the client can resolve group rules offline",
    )


# ---------- Authentication ----------


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255, examples=["admin@flagforge.local"])
    password: str = Field(..., min_length=1, max_length=200)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class UserCreate(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(
        ..., min_length=MIN_PASSWORD_LENGTH, max_length=72,
        description="At least 8 characters. Stored as a bcrypt hash.",
    )
    name: Optional[str] = ""
    role: UserRole = UserRole.viewer


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=MIN_PASSWORD_LENGTH, max_length=72)


class PasswordChange(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=200)
    new_password: str = Field(..., min_length=MIN_PASSWORD_LENGTH, max_length=72)
