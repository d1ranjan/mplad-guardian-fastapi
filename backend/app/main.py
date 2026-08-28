from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Literal
import jwt
import csv
import io
import re
from fastapi import Cookie, Depends, FastAPI, File, HTTPException, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from passlib.context import CryptContext
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, and_, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from .ml import AuditFeature, NumericContextModel, semantic_similarity


class Settings(BaseSettings):
    postgresql_url: str
    jwt_secret: str
    access_token_minutes: int = 20
    refresh_token_days: int = 14
    cors_origins: str = "http://localhost:3000"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
database_url = settings.postgresql_url.replace("postgresql://", "postgresql+asyncpg://", 1) if settings.postgresql_url.startswith("postgresql://") else settings.postgresql_url
engine = create_async_engine(database_url, pool_pre_ping=True, pool_size=5, max_overflow=5)
Session = async_sessionmaker(engine, expire_on_commit=False)

# The public static frontend is intentionally available through GitHub Pages and
# the managed project domain. Keep this an exact-origin allow-list; do not use
# a wildcard because cross-site requests include credentials.
OWNED_FRONTEND_ORIGINS = (
    "https://d1ranjan.github.io",
    "https://mpladguard-dtzanqrn.manus.space",
)


def cors_allowlist(configured_origins: str) -> list[str]:
    configured = [origin.strip() for origin in configured_origins.split(",") if origin.strip()]
    return list(dict.fromkeys([*configured, *OWNED_FRONTEND_ORIGINS]))


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(24), default="viewer")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Vendor(Base):
    __tablename__ = "vendors"
    id: Mapped[int] = mapped_column(primary_key=True)
    vendor_code: Mapped[str] = mapped_column(String(72), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    state: Mapped[str] = mapped_column(String(128))


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_code: Mapped[str] = mapped_column(String(72), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(128), index=True)
    state: Mapped[str] = mapped_column(String(128), index=True)
    district: Mapped[str] = mapped_column(String(128), index=True)
    locality: Mapped[str] = mapped_column(String(160))
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True)
    financial_year: Mapped[str] = mapped_column(String(16))
    sanctioned_amount: Mapped[float] = mapped_column(Numeric(16, 2))
    actual_expenditure: Mapped[float] = mapped_column(Numeric(16, 2), default=0)
    sanction_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expected_completion_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_update_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    project_status: Mapped[str] = mapped_column(String(24), default="ongoing")
    source_checksum: Mapped[str | None] = mapped_column(String(96), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProjectImport(Base):
    __tablename__ = "project_imports"
    id: Mapped[int] = mapped_column(primary_key=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    checksum: Mapped[str] = mapped_column(String(96), index=True)
    total_rows: Mapped[int] = mapped_column(Integer)
    accepted_rows: Mapped[int] = mapped_column(Integer)
    warning_count: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    imported_by_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditRun(Base):
    __tablename__ = "audit_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_code: Mapped[str] = mapped_column(String(72), unique=True, index=True)
    algorithm_version: Mapped[str] = mapped_column(String(96))
    source_digest: Mapped[str] = mapped_column(String(96))
    configuration: Mapped[dict] = mapped_column(JSONB, default=dict)
    total_projects: Mapped[int] = mapped_column(Integer)
    total_alerts: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(24))
    initiated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    audit_run_id: Mapped[int] = mapped_column(ForeignKey("audit_runs.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    risk_type: Mapped[str] = mapped_column(String(64), index=True)
    risk_score: Mapped[int] = mapped_column(Integer)
    risk_band: Mapped[str] = mapped_column(String(24))
    alert_status: Mapped[str] = mapped_column(String(32), default="open")
    title: Mapped[str] = mapped_column(String(255))
    rationale: Mapped[str] = mapped_column(Text)
    evidence: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReviewAction(Base):
    __tablename__ = "review_actions"
    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id", ondelete="CASCADE"), index=True)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    action: Mapped[str] = mapped_column(String(32))
    note: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ModelRun(Base):
    __tablename__ = "model_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    model_code: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    model_type: Mapped[str] = mapped_column(String(96))
    version: Mapped[str] = mapped_column(String(96))
    source_digest: Mapped[str] = mapped_column(String(96))
    feature_schema: Mapped[dict] = mapped_column(JSONB, default=dict)
    evaluation: Mapped[dict] = mapped_column(JSONB, default=dict)
    artifact_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    limitation: Mapped[str] = mapped_column(Text)
    trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OfficialAllocationImport(Base):
    __tablename__ = "official_allocation_imports"
    id: Mapped[int] = mapped_column(primary_key=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    source_url: Mapped[str] = mapped_column(String(512))
    source_scope: Mapped[str] = mapped_column(Text)
    source_sha256: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    row_count: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OfficialAllocationRecord(Base):
    __tablename__ = "official_allocation_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_import_id: Mapped[int] = mapped_column(ForeignKey("official_allocation_imports.id", ondelete="CASCADE"), index=True)
    source_row_number: Mapped[int] = mapped_column(Integer)
    state: Mapped[str] = mapped_column(String(128), index=True)
    mp_name: Mapped[str] = mapped_column(String(255))
    constituency: Mapped[str] = mapped_column(String(255))
    allocated_amount: Mapped[float] = mapped_column(Numeric(16, 2))


class AllocationModelRun(Base):
    __tablename__ = "allocation_model_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    model_code: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    model_version: Mapped[str] = mapped_column(String(96))
    source_import_id: Mapped[int] = mapped_column(ForeignKey("official_allocation_imports.id", ondelete="RESTRICT"), index=True)
    training_rows: Mapped[int] = mapped_column(Integer)
    methodology: Mapped[str] = mapped_column(Text)
    configuration: Mapped[dict] = mapped_column(JSONB, default=dict)
    evaluation: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(24), default="completed")
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AllocationModelScore(Base):
    __tablename__ = "allocation_model_scores"
    id: Mapped[int] = mapped_column(primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("allocation_model_runs.id", ondelete="CASCADE"), index=True)
    allocation_record_id: Mapped[int] = mapped_column(ForeignKey("official_allocation_records.id", ondelete="CASCADE"), index=True)
    context_band: Mapped[str] = mapped_column(String(32), index=True)
    model_score: Mapped[int] = mapped_column(Integer)
    variance_direction: Mapped[str] = mapped_column(String(32))
    state_peer_count: Mapped[int] = mapped_column(Integer)
    state_peer_median: Mapped[float] = mapped_column(Numeric(16, 2))
    national_peer_median: Mapped[float] = mapped_column(Numeric(16, 2))
    applied_variance_percent: Mapped[float] = mapped_column(Numeric(12, 2))


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=256)


class BootstrapAdminRequest(LoginRequest):
    name: str = Field(min_length=2, max_length=255)


class AnalystCreateRequest(LoginRequest):
    name: str = Field(min_length=2, max_length=255)
    role: Literal["reviewer", "viewer"] = "reviewer"


class AnalystUpdateRequest(BaseModel):
    role: Literal["reviewer", "viewer"] | None = None
    is_active: bool | None = None


class ProjectInput(BaseModel):
    project_code: str = Field(min_length=3, max_length=72)
    title: str = Field(min_length=3, max_length=255)
    description: str | None = None
    category: str
    state: str
    district: str
    locality: str
    vendor_name: str
    financial_year: str = Field(pattern=r"^20\d{2}-\d{2}$")
    sanctioned_amount: float = Field(gt=0)
    actual_expenditure: float = Field(ge=0)
    sanction_date: datetime
    expected_completion_date: datetime
    last_update_date: datetime
    progress_percent: int = Field(ge=0, le=100)
    project_status: Literal["planning", "ongoing", "completed", "on_hold", "cancelled"]


class ReviewInput(BaseModel):
    action: Literal["field_verification", "dismissed", "resolved"]
    note: str = Field(min_length=3, max_length=2000)


class DuplicateCompareInput(BaseModel):
    reference_project_id: int
    candidate_project_id: int


REQUIRED_CSV_HEADERS = {"project_code", "title", "category", "state", "district", "locality", "vendor_name", "financial_year", "sanctioned_amount", "actual_expenditure", "sanction_date", "expected_completion_date", "last_update_date", "progress_percent", "project_status"}
OFFICIAL_ALLOCATION_HEADERS = {"State", "Hon'ble Members of Parliaments", "Constituency", "Allocated AMOUNT ( ₹ )"}
OFFICIAL_ALLOCATION_HEADER_ALIASES = {
    "state": "state",
    "statename": "state",
    "honblemembersofparliaments": "mp_name",
    "honblemembersofparliament": "mp_name",
    "memberofparliament": "mp_name",
    "membersofparliament": "mp_name",
    "constituency": "constituency",
    "constituencyname": "constituency",
    "allocatedamount": "allocated_amount",
    "allocatedamountinr": "allocated_amount",
}
OFFICIAL_ALLOCATION_SOURCE_URL = "https://mplads.mospi.gov.in/digigov/dashboard.html"
OFFICIAL_ALLOCATION_SOURCE_SCOPE = "18th Lok Sabha public dashboard allocation export; state, MP, constituency, and allocated amount."


def parse_project_csv(content: bytes) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    try:
        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
        headers = set(reader.fieldnames or [])
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="CSV must use UTF-8 encoding.") from exc
    if not reader.fieldnames:
        raise HTTPException(status_code=422, detail="CSV must contain a header row.")
    missing = sorted(REQUIRED_CSV_HEADERS - headers)
    if missing:
        raise HTTPException(status_code=422, detail={"message": "Required columns are missing.", "missing_headers": missing})
    rows = list(reader)
    issues: list[dict[str, str]] = []
    seen: set[str] = set()
    for number, record in enumerate(rows, start=2):
        code = (record.get("project_code") or "").strip()
        if not code or code.casefold() in seen:
            issues.append({"row": str(number), "field": "project_code", "severity": "error", "message": "A non-unique or blank project code was found."})
        seen.add(code.casefold())
    return rows, issues


def validate_project_csv_rows(rows: list[dict[str, str]], issues: list[dict[str, str]]) -> list[dict[str, str]]:
    report = list(issues)
    for number, record in enumerate(rows, start=2):
        try:
            project = ProjectInput.model_validate(record)
        except Exception as exc:
            for error in getattr(exc, "errors", lambda: [{"loc": ["row"], "msg": str(exc)}])():
                field = ".".join(str(part) for part in error.get("loc", ["row"]))
                report.append({"row": str(number), "field": field, "severity": "error", "message": error.get("msg", "Invalid field value.")})
            continue
        if project.actual_expenditure > project.sanctioned_amount * 1.1:
            report.append({"row": str(number), "field": "actual_expenditure", "severity": "warning", "message": "Expenditure is more than 10% above the sanctioned amount."})
        if project.project_status == "completed" and project.progress_percent < 95:
            report.append({"row": str(number), "field": "progress_percent", "severity": "warning", "message": "Completed project reports progress below 95%."})
    return report


def parse_official_allocation_csv(content: bytes) -> tuple[list[dict[str, str | float | int]], list[dict[str, str | int]]]:
    try:
        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="Official allocation CSV must use UTF-8 encoding.") from exc
    header_map = {OFFICIAL_ALLOCATION_HEADER_ALIASES.get(re.sub(r"[^a-z0-9]+", "", header.lower())): header for header in (reader.fieldnames or []) if OFFICIAL_ALLOCATION_HEADER_ALIASES.get(re.sub(r"[^a-z0-9]+", "", header.lower()))}
    missing = sorted({"state", "mp_name", "constituency", "allocated_amount"} - set(header_map))
    if missing:
        raise HTTPException(status_code=422, detail={"message": "This is not the expected official allocation export. Expected State, MP, Constituency, and Allocated Amount columns.", "missing_headers": missing})
    parsed: list[dict[str, str | float | int]] = []
    skipped_rows: list[dict[str, str | int]] = []
    for row_number, row in enumerate(reader, start=2):
        state = (row.get(header_map["state"]) or "").strip()
        mp_name = (row.get(header_map["mp_name"]) or "").strip()
        constituency = (row.get(header_map["constituency"]) or "").strip()
        amount_text = (row.get(header_map["allocated_amount"]) or "").replace(",", "").replace("₹", "").strip()
        try:
            amount = float(amount_text)
        except ValueError:
            amount = -1
        if state.casefold() in {"grand total", "total"}:
            skipped_rows.append({"row": row_number, "message": "Summary footer excluded from allocation records."})
            continue
        if not state or not mp_name or not constituency or amount < 0:
            skipped_rows.append({"row": row_number, "message": "Incomplete official source row excluded because a state, MP, constituency, or allocated amount is missing."})
            continue
        parsed.append({"source_row_number": row_number, "state": state, "mp_name": mp_name, "constituency": constituency, "allocated_amount": amount})
    if len(parsed) < 20:
        raise HTTPException(status_code=422, detail="At least 20 official allocation records are required for peer-context analysis.")
    return parsed, skipped_rows


def median(values: list[float]) -> float:
    ordered = sorted(values)
    middle = len(ordered) // 2
    return ordered[middle] if len(ordered) % 2 else (ordered[middle - 1] + ordered[middle]) / 2


def text_overlap(left: str, right: str) -> float:
    left_terms = {term for term in re.findall(r"[a-z0-9]+", left.casefold()) if len(term) > 2}
    right_terms = {term for term in re.findall(r"[a-z0-9]+", right.casefold()) if len(term) > 2}
    union = left_terms | right_terms
    return len(left_terms & right_terms) / len(union) if union else 0.0


async def train_allocation_context_model(session: AsyncSession, source: OfficialAllocationImport) -> AllocationModelRun:
    records = list((await session.scalars(select(OfficialAllocationRecord).where(OfficialAllocationRecord.source_import_id == source.id))).all())
    if len(records) < 20:
        raise HTTPException(status_code=422, detail="At least 20 official allocation records are required for peer-context analysis.")
    national_median = median([float(record.allocated_amount) for record in records])
    by_state: dict[str, list[OfficialAllocationRecord]] = {}
    for record in records:
        by_state.setdefault(record.state, []).append(record)
    run = AllocationModelRun(
        model_code=f"ALLOC-{source.source_sha256[:10].upper()}-{datetime.now(timezone.utc):%H%M%S}",
        model_version="official-allocation-context-v1",
        source_import_id=source.id,
        training_rows=len(records),
        methodology="Unsupervised state peer-median allocation variance model. It is review context, not a fraud classifier; variance may have legitimate administrative explanations.",
        configuration={"minimum_state_peer_count": 5, "score": "absolute percentage deviation from state median with national fallback"},
        evaluation={"training_rows": len(records), "state_count": len(by_state), "national_peer_median": national_median, "validation": "Unsupervised peer-context model; no fraud labels are present, so precision/recall and fraud-classification claims are not calculated."},
        status="completed",
        completed_at=datetime.now(timezone.utc),
    )
    session.add(run)
    await session.flush()
    for record in records:
        peers = by_state[record.state]
        state_median = median([float(peer.allocated_amount) for peer in peers])
        baseline = state_median if len(peers) >= 5 else national_median
        variance = ((float(record.allocated_amount) - baseline) / max(baseline, 1)) * 100
        score = min(100, round(abs(variance)))
        session.add(AllocationModelScore(
            model_run_id=run.id,
            allocation_record_id=record.id,
            context_band="high_variance" if score >= 50 else "moderate_variance" if score >= 25 else "expected_range",
            model_score=score,
            variance_direction="above_peer_median" if variance > 0.5 else "below_peer_median" if variance < -0.5 else "at_peer_median",
            state_peer_count=len(peers), state_peer_median=state_median, national_peer_median=national_median,
            applied_variance_percent=round(variance, 2),
        ))
    return run


security = HTTPBearer(auto_error=False)
passwords = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def db():
    async with Session() as session:
        yield session


def issue_token(user: User, minutes: int) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user.id), "role": user.role, "iat": now, "exp": now + timedelta(minutes=minutes)}, settings.jwt_secret, algorithm="HS256")


async def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security), session: AsyncSession = Depends(db)) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Bearer access token required.")
    try:
        data = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
        user = await session.get(User, int(data["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token.") from exc
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User is unavailable.")
    return user


def requires(*roles: str):
    async def guard(user: User = Depends(current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient role for this operation.")
        return user
    return guard


app = FastAPI(title="MPLAD Guardian API", version="2.0.0", description="Production audit intelligence API. Scores are review context, not findings of wrongdoing.", openapi_url="/api/v1/openapi.json", docs_url="/docs", redoc_url="/redoc")
app.add_middleware(CORSMiddleware, allow_origins=cors_allowlist(settings.cors_origins), allow_credentials=True, allow_methods=["*"], allow_headers=["Authorization", "Content-Type"])


@app.get("/api/v1/health", tags=["Operations"])
async def health():
    return {"status": "ok", "service": "mplad-guardian-fastapi", "docs": "/docs"}


@app.get("/api/v1/ready", tags=["Operations"])
async def ready(session: AsyncSession = Depends(db)):
    await session.execute(select(1))
    return {"status": "ready", "database": "postgresql"}


@app.post("/api/v1/auth/login", tags=["Authentication"])
async def login(payload: LoginRequest, response: Response, session: AsyncSession = Depends(db)):
    user = await session.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not passwords.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    access = issue_token(user, settings.access_token_minutes)
    refresh = issue_token(user, settings.refresh_token_days * 24 * 60)
    response.set_cookie("guardian_refresh", refresh, httponly=True, secure=True, samesite="none", max_age=settings.refresh_token_days * 86400, path="/api/v1/auth")
    return {"access_token": access, "token_type": "bearer", "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}}


@app.post("/api/v1/auth/bootstrap-admin", tags=["Authentication"], status_code=201)
async def bootstrap_admin(payload: BootstrapAdminRequest, session: AsyncSession = Depends(db)):
    existing = await session.scalar(select(User.id).limit(1))
    if existing:
        raise HTTPException(status_code=409, detail="An account already exists. Use the standard administrator workflow.")
    user = User(email=payload.email.lower(), name=payload.name.strip(), password_hash=passwords.hash(payload.password), role="admin")
    session.add(user)
    await session.commit()
    return {"message": "Initial administrator created. Use /api/v1/auth/login to obtain an access token."}


@app.get("/api/v1/auth/me", tags=["Authentication"])
async def me(user: User = Depends(current_user)):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}


def user_summary(user: User) -> dict:
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "is_active": user.is_active, "created_at": user.created_at}


@app.get("/api/v1/users", tags=["User management"])
async def list_users(session: AsyncSession = Depends(db), _user: User = Depends(requires("admin"))):
    users = list((await session.scalars(select(User).order_by(User.created_at.desc(), User.id.desc()))).all())
    return [user_summary(user) for user in users]


@app.post("/api/v1/users", tags=["User management"], status_code=201)
async def create_user(payload: AnalystCreateRequest, session: AsyncSession = Depends(db), _user: User = Depends(requires("admin"))):
    existing = await session.scalar(select(User.id).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=409, detail="An account already exists for this email address.")
    user = User(email=payload.email.lower(), name=" ".join(payload.name.split()), password_hash=passwords.hash(payload.password), role=payload.role, is_active=True)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user_summary(user)


@app.patch("/api/v1/users/{user_id}", tags=["User management"])
async def update_user(user_id: int, payload: AnalystUpdateRequest, session: AsyncSession = Depends(db), administrator: User = Depends(requires("admin"))):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")
    if user.id == administrator.id and payload.is_active is False:
        raise HTTPException(status_code=422, detail="An administrator cannot deactivate their own active session.")
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    await session.commit()
    await session.refresh(user)
    return user_summary(user)


@app.post("/api/v1/auth/refresh", tags=["Authentication"])
async def refresh(guardian_refresh: str | None = Cookie(default=None), session: AsyncSession = Depends(db)):
    if not guardian_refresh:
        raise HTTPException(status_code=401, detail="Refresh token is required.")
    try:
        data = jwt.decode(guardian_refresh, settings.jwt_secret, algorithms=["HS256"])
        user = await session.get(User, int(data["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.") from exc
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User is unavailable.")
    return {"access_token": issue_token(user, settings.access_token_minutes), "token_type": "bearer", "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}}


@app.post("/api/v1/auth/logout", tags=["Authentication"], status_code=204)
async def logout(response: Response):
    response.delete_cookie("guardian_refresh", path="/api/v1/auth")


@app.get("/api/v1/projects", tags=["Projects"])
async def projects(session: AsyncSession = Depends(db), _user: User = Depends(current_user)):
    rows = (await session.execute(select(Project, Vendor.name).outerjoin(Vendor, Project.vendor_id == Vendor.id).order_by(Project.created_at.desc()).limit(500))).all()
    return [{"id": project.id, "project_code": project.project_code, "title": project.title, "category": project.category, "state": project.state, "district": project.district, "vendor_name": vendor_name, "sanctioned_amount": float(project.sanctioned_amount), "actual_expenditure": float(project.actual_expenditure), "progress_percent": project.progress_percent, "project_status": project.project_status} for project, vendor_name in rows]


@app.post("/api/v1/projects/import", tags=["Projects"], status_code=201)
async def import_projects(rows: list[ProjectInput], session: AsyncSession = Depends(db), _user: User = Depends(requires("admin"))):
    if not rows:
        raise HTTPException(status_code=422, detail="At least one project is required.")
    errors = []
    codes = set()
    for offset, row in enumerate(rows, start=2):
        if row.project_code.casefold() in codes: errors.append({"row": offset, "field": "project_code", "message": "Duplicate code in import."})
        codes.add(row.project_code.casefold())
        if row.expected_completion_date <= row.sanction_date: errors.append({"row": offset, "field": "expected_completion_date", "message": "Completion must follow sanction."})
    if errors: raise HTTPException(status_code=422, detail={"message": "CSV validation failed.", "errors": errors})
    for row in rows:
        vendor = await session.scalar(select(Vendor).where(Vendor.name == row.vendor_name, Vendor.state == row.state))
        if not vendor:
            vendor = Vendor(vendor_code=f"IMP-{sha256((row.vendor_name + row.state).encode()).hexdigest()[:12].upper()}", name=row.vendor_name, state=row.state)
            session.add(vendor); await session.flush()
        session.add(Project(**row.model_dump(exclude={"vendor_name"}), vendor_id=vendor.id, source_checksum=sha256(row.model_dump_json().encode()).hexdigest()))
    await session.commit()
    return {"accepted_rows": len(rows), "message": "Project records imported with source checksums."}


@app.post("/api/v1/imports/validate", tags=["Imports"])
async def validate_import(file: UploadFile = File(...), _user: User = Depends(requires("reviewer", "admin"))):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=422, detail="Upload a .csv file.")
    content = await file.read()
    if len(content) > 5_000_000:
        raise HTTPException(status_code=413, detail="CSV files are limited to 5 MB.")
    rows, issues = parse_project_csv(content)
    report = validate_project_csv_rows(rows, issues)
    return {"filename": file.filename, "checksum": sha256(content).hexdigest(), "total_rows": len(rows), "accepted_rows": len(rows) - len({issue["row"] for issue in report if issue["severity"] == "error"}), "issues": report}


@app.post("/api/v1/imports", tags=["Imports"], status_code=201)
async def import_csv(file: UploadFile = File(...), session: AsyncSession = Depends(db), user: User = Depends(requires("admin"))):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=422, detail="Upload a .csv file.")
    content = await file.read()
    if len(content) > 5_000_000:
        raise HTTPException(status_code=413, detail="CSV files are limited to 5 MB.")
    rows, issues = parse_project_csv(content)
    report = validate_project_csv_rows(rows, issues)
    errors = [issue for issue in report if issue["severity"] == "error"]
    if errors:
        raise HTTPException(status_code=422, detail={"message": "CSV import is blocked by validation errors.", "issues": report})
    digest = sha256(content).hexdigest()
    imported = ProjectImport(original_filename=file.filename, checksum=digest, total_rows=len(rows), accepted_rows=len(rows), warning_count=len(report), imported_by_id=user.id)
    session.add(imported)
    for record in rows:
        project_data = ProjectInput.model_validate(record)
        vendor = await session.scalar(select(Vendor).where(Vendor.name == project_data.vendor_name, Vendor.state == project_data.state))
        if not vendor:
            vendor = Vendor(vendor_code=f"CSV-{sha256((project_data.vendor_name + project_data.state).encode()).hexdigest()[:12].upper()}", name=project_data.vendor_name, state=project_data.state)
            session.add(vendor)
            await session.flush()
        session.add(Project(**project_data.model_dump(exclude={"vendor_name"}), vendor_id=vendor.id, source_checksum=digest))
    await session.commit()
    return {"import_id": imported.id, "accepted_rows": len(rows), "checksum": digest, "message": "CSV and import provenance were persisted."}


@app.post("/api/v1/allocations/import", tags=["Official allocation context"], status_code=201)
async def import_official_allocations(file: UploadFile = File(...), session: AsyncSession = Depends(db), _user: User = Depends(requires("admin"))):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=422, detail="Upload the official allocation .csv export.")
    content = await file.read()
    if len(content) > 5_000_000:
        raise HTTPException(status_code=413, detail="CSV files are limited to 5 MB.")
    records, skipped_rows = parse_official_allocation_csv(content)
    digest = sha256(content).hexdigest()
    existing = await session.scalar(select(OfficialAllocationImport).where(OfficialAllocationImport.source_sha256 == digest))
    if existing:
        existing_model = await session.scalar(select(AllocationModelRun).where(AllocationModelRun.source_import_id == existing.id).order_by(AllocationModelRun.completed_at.desc()))
        if not existing_model:
            existing_model = await train_allocation_context_model(session, existing)
            await session.commit()
            return {"import_id": existing.id, "model_code": existing_model.model_code, "row_count": existing.row_count, "message": "The preserved official source did not have a context model, so a new peer-context model was created."}
        return {"import_id": existing.id, "model_code": existing_model.model_code, "row_count": existing.row_count, "message": "This official source export and its peer-context model are already preserved."}
    source_scope = OFFICIAL_ALLOCATION_SOURCE_SCOPE if not skipped_rows else f"{OFFICIAL_ALLOCATION_SOURCE_SCOPE} {len(skipped_rows)} incomplete or summary row(s) were excluded from modelling and retained in source-file provenance."
    imported = OfficialAllocationImport(original_filename=file.filename, source_url=OFFICIAL_ALLOCATION_SOURCE_URL, source_scope=source_scope, source_sha256=digest, retrieved_at=datetime.now(timezone.utc), row_count=len(records))
    session.add(imported)
    await session.flush()
    session.add_all([OfficialAllocationRecord(source_import_id=imported.id, **record) for record in records])
    await session.flush()
    model = await train_allocation_context_model(session, imported)
    await session.commit()
    return {"import_id": imported.id, "model_code": model.model_code, "row_count": imported.row_count, "skipped_rows": skipped_rows, "message": f"Official allocation provenance and peer-context model were persisted from {imported.row_count} valid rows; {len(skipped_rows)} incomplete or summary row(s) were excluded."}


@app.get("/api/v1/allocations", tags=["Official allocation context"])
async def allocation_dashboard(session: AsyncSession = Depends(db), _user: User = Depends(current_user)):
    model = await session.scalar(select(AllocationModelRun).where(AllocationModelRun.status == "completed").order_by(AllocationModelRun.completed_at.desc()).limit(1))
    if not model:
        raise HTTPException(status_code=404, detail="No official allocation context model has been created yet.")
    source = await session.get(OfficialAllocationImport, model.source_import_id)
    rows = (await session.execute(select(AllocationModelScore, OfficialAllocationRecord).join(OfficialAllocationRecord, AllocationModelScore.allocation_record_id == OfficialAllocationRecord.id).where(AllocationModelScore.model_run_id == model.id).order_by(AllocationModelScore.model_score.desc(), OfficialAllocationRecord.allocated_amount.desc()))).all()
    bands = ("high_variance", "moderate_variance", "expected_range")
    return {"model": {"model_code": model.model_code, "model_version": model.model_version, "methodology": model.methodology, "evaluation": model.evaluation, "completed_at": model.completed_at}, "source": {"source_url": source.source_url if source else None, "source_scope": source.source_scope if source else None, "source_sha256": source.source_sha256 if source else None, "retrieved_at": source.retrieved_at if source else None, "row_count": source.row_count if source else 0}, "kpis": {"record_count": len(rows), "state_count": len({record.state for _, record in rows}), "high_variance_count": sum(1 for score, _ in rows if score.context_band == "high_variance"), "median_allocation": float((model.evaluation or {}).get("national_peer_median", 0))}, "band_breakdown": [{"band": band, "count": sum(1 for score, _ in rows if score.context_band == band)} for band in bands], "records": [{"id": score.id, "context_band": score.context_band, "model_score": score.model_score, "variance_direction": score.variance_direction, "state_peer_count": score.state_peer_count, "state_peer_median": float(score.state_peer_median), "national_peer_median": float(score.national_peer_median), "applied_variance_percent": float(score.applied_variance_percent), "record": {"id": record.id, "source_row_number": record.source_row_number, "state": record.state, "mp_name": record.mp_name, "constituency": record.constituency, "allocated_amount": float(record.allocated_amount)}} for score, record in rows[:50]]}


@app.get("/api/v1/allocations/{score_id}", tags=["Official allocation context"])
async def allocation_case(score_id: int, session: AsyncSession = Depends(db), _user: User = Depends(current_user)):
    result = (await session.execute(select(AllocationModelScore, OfficialAllocationRecord, AllocationModelRun, OfficialAllocationImport).join(OfficialAllocationRecord, AllocationModelScore.allocation_record_id == OfficialAllocationRecord.id).join(AllocationModelRun, AllocationModelScore.model_run_id == AllocationModelRun.id).join(OfficialAllocationImport, AllocationModelRun.source_import_id == OfficialAllocationImport.id).where(AllocationModelScore.id == score_id))).first()
    if not result:
        raise HTTPException(status_code=404, detail="Allocation context record not found.")
    score, record, model, source = result
    peers = (await session.execute(select(AllocationModelScore, OfficialAllocationRecord).join(OfficialAllocationRecord, AllocationModelScore.allocation_record_id == OfficialAllocationRecord.id).where(and_(AllocationModelScore.model_run_id == model.id, OfficialAllocationRecord.state == record.state)).order_by(OfficialAllocationRecord.allocated_amount.desc()))).all()
    return {"score": {"id": score.id, "context_band": score.context_band, "model_score": score.model_score, "variance_direction": score.variance_direction, "state_peer_count": score.state_peer_count, "state_peer_median": float(score.state_peer_median), "national_peer_median": float(score.national_peer_median), "applied_variance_percent": float(score.applied_variance_percent)}, "record": {"id": record.id, "state": record.state, "mp_name": record.mp_name, "constituency": record.constituency, "allocated_amount": float(record.allocated_amount)}, "model": {"model_code": model.model_code, "model_version": model.model_version, "methodology": model.methodology, "evaluation": model.evaluation}, "source": {"source_url": source.source_url, "source_scope": source.source_scope, "source_sha256": source.source_sha256, "retrieved_at": source.retrieved_at}, "state_peers": [{"record_id": peer_record.id, "mp_name": peer_record.mp_name, "constituency": peer_record.constituency, "allocated_amount": float(peer_record.allocated_amount), "model_score": peer_score.model_score, "applied_variance_percent": float(peer_score.applied_variance_percent)} for peer_score, peer_record in peers]}


@app.post("/api/v1/audits/run", tags=["Audit workflow"])
async def run_audit(session: AsyncSession = Depends(db), user: User = Depends(requires("admin"))):
    projects = list((await session.scalars(select(Project))).all())
    digest = sha256("|".join(f"{project.project_code}:{project.actual_expenditure}" for project in projects).encode()).hexdigest()
    run = AuditRun(run_code=f"AUD-{datetime.now(timezone.utc):%Y%m%d%H%M%S}", algorithm_version="explainable-rules-v2", source_digest=digest, configuration={"cost_threshold": 55, "stalled_days": 90}, total_projects=len(projects), total_alerts=0, status="running", initiated_by_id=user.id)
    session.add(run); await session.flush()
    peer_groups: dict[tuple[str, str, str], list[Project]] = {}
    for project in projects: peer_groups.setdefault((project.category, project.state, project.financial_year), []).append(project)
    for project in projects:
        peers = peer_groups[(project.category, project.state, project.financial_year)]
        if len(peers) >= 3:
            values = sorted(float(peer.actual_expenditure) for peer in peers); peer_median = values[len(values) // 2]; deviation = ((float(project.actual_expenditure) - peer_median) / max(peer_median, 1)) * 100
            if deviation >= 55:
                session.add(Alert(audit_run_id=run.id, project_id=project.id, risk_type="cost_outlier", risk_score=min(100, round(deviation)), risk_band="high" if deviation < 80 else "critical", title="Expenditure exceeds transparent peer context", rationale=f"Actual expenditure is {deviation:.1f}% above the median of {len(peers)} comparable records.", evidence={"actual_expenditure": float(project.actual_expenditure), "peer_median": peer_median, "deviation_percent": round(deviation, 2), "peer_count": len(peers)})); run.total_alerts += 1
        days_since_update = max(0, (datetime.now(timezone.utc) - project.last_update_date).days)
        if project.project_status == "on_hold" or (project.project_status == "ongoing" and project.progress_percent < 60 and days_since_update >= 90):
            session.add(Alert(audit_run_id=run.id, project_id=project.id, risk_type="stalled_project", risk_score=min(100, 55 + min(40, days_since_update // 6)), risk_band="high", title="Delivery status requires current implementation context", rationale=f"Status is {project.project_status.replace('_', ' ')} with {project.progress_percent}% progress and an update age of {days_since_update} days.", evidence={"project_status": project.project_status, "progress_percent": project.progress_percent, "days_since_update": days_since_update, "review_question": "Obtain a current milestone update and documented reason for the delay before escalation."})); run.total_alerts += 1
    vendor_groups: dict[int, list[Project]] = {}
    for project in projects:
        if project.vendor_id:
            vendor_groups.setdefault(project.vendor_id, []).append(project)
    for vendor_id, vendor_projects in vendor_groups.items():
        share = len(vendor_projects) / max(len(projects), 1)
        if len(vendor_projects) >= 4 and share >= 0.25:
            for project in vendor_projects:
                session.add(Alert(audit_run_id=run.id, project_id=project.id, risk_type="vendor_concentration", risk_score=min(100, round(share * 100)), risk_band="moderate", title="Vendor concentration warrants portfolio review", rationale=f"One vendor is linked to {len(vendor_projects)} of {len(projects)} records in this imported portfolio ({share:.1%}).", evidence={"vendor_id": vendor_id, "vendor_project_count": len(vendor_projects), "portfolio_project_count": len(projects), "project_share_percent": round(share * 100, 2), "review_question": "Check procurement segmentation, competition records, and delivery capacity."})); run.total_alerts += 1
    location_groups: dict[tuple[str, str, str, str], list[Project]] = {}
    for project in projects:
        location_groups.setdefault((project.category.casefold(), project.state.casefold(), project.district.casefold(), project.locality.casefold()), []).append(project)
    for group in location_groups.values():
        for offset, reference in enumerate(group):
            for candidate in group[offset + 1:]:
                overlap = text_overlap(f"{reference.title} {reference.description or ''}", f"{candidate.title} {candidate.description or ''}")
                if overlap >= 0.35:
                    for project, counterpart in ((reference, candidate), (candidate, reference)):
                        session.add(Alert(audit_run_id=run.id, project_id=project.id, risk_type="duplicate_language_candidate", risk_score=round(overlap * 100), risk_band="moderate", title="Comparable project language requires source-record review", rationale=f"Project language overlaps {overlap:.0%} with {counterpart.project_code} in the same category and locality.", evidence={"counterpart_project_code": counterpart.project_code, "term_overlap": round(overlap, 4), "same_category": True, "same_locality": True, "review_question": "Compare scope, work order, geo-evidence, dates, and source records before treating this as a duplicate."})); run.total_alerts += 1
    run.status = "completed"; run.completed_at = datetime.now(timezone.utc); await session.commit()
    return {"run_code": run.run_code, "total_projects": run.total_projects, "total_alerts": run.total_alerts, "source_digest": run.source_digest}


@app.get("/api/v1/alerts", tags=["Audit workflow"])
async def alerts(session: AsyncSession = Depends(db), _user: User = Depends(current_user)):
    rows = (await session.execute(select(Alert, Project).join(Project, Alert.project_id == Project.id).order_by(Alert.risk_score.desc()).limit(500))).all()
    return [{"id": alert.id, "risk_type": alert.risk_type, "risk_score": alert.risk_score, "risk_band": alert.risk_band, "alert_status": alert.alert_status, "title": alert.title, "rationale": alert.rationale, "evidence": alert.evidence, "project": {"id": project.id, "code": project.project_code, "title": project.title}} for alert, project in rows]


@app.get("/api/v1/alerts/{alert_id}", tags=["Audit workflow"])
async def alert_case(alert_id: int, session: AsyncSession = Depends(db), _user: User = Depends(current_user)):
    result = (await session.execute(select(Alert, Project, AuditRun).join(Project, Alert.project_id == Project.id).join(AuditRun, Alert.audit_run_id == AuditRun.id).where(Alert.id == alert_id))).first()
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found.")
    alert, project, run = result
    history = list((await session.scalars(select(ReviewAction).where(ReviewAction.alert_id == alert_id).order_by(ReviewAction.created_at.desc()))).all())
    return {"case": {"id": alert.id, "risk_type": alert.risk_type, "risk_score": alert.risk_score, "risk_band": alert.risk_band, "alert_status": alert.alert_status, "title": alert.title, "rationale": alert.rationale, "evidence": alert.evidence}, "project": {"project_code": project.project_code, "title": project.title, "description": project.description, "category": project.category, "state": project.state, "district": project.district, "locality": project.locality, "sanctioned_amount": float(project.sanctioned_amount), "actual_expenditure": float(project.actual_expenditure), "progress_percent": project.progress_percent, "project_status": project.project_status}, "provenance": {"run_code": run.run_code, "algorithm_version": run.algorithm_version, "source_digest": run.source_digest, "completed_at": run.completed_at}, "review_history": [{"action": action.action, "note": action.note, "reviewer_id": action.reviewer_id, "created_at": action.created_at} for action in history]}


@app.post("/api/v1/alerts/{alert_id}/review", tags=["Audit workflow"])
async def review_alert(alert_id: int, payload: ReviewInput, session: AsyncSession = Depends(db), user: User = Depends(requires("reviewer", "admin"))):
    alert = await session.get(Alert, alert_id)
    if not alert: raise HTTPException(status_code=404, detail="Alert not found.")
    alert.alert_status = payload.action
    session.add(ReviewAction(alert_id=alert.id, reviewer_id=user.id, action=payload.action, note=" ".join(payload.note.split())))
    await session.commit()
    return {"alert_id": alert.id, "status": alert.alert_status, "message": "Review action recorded."}


@app.post("/api/v1/models/numeric-context/train", tags=["Model management"])
async def train_numeric_context_model(session: AsyncSession = Depends(db), _user: User = Depends(requires("admin"))):
    projects = list((await session.scalars(select(Project))).all())
    now = datetime.now(timezone.utc)
    features = [AuditFeature(project.id, float(project.sanctioned_amount), float(project.actual_expenditure), project.progress_percent, (project.expected_completion_date - project.sanction_date).days, max(0, (now - project.last_update_date).days)) for project in projects]
    model = NumericContextModel()
    try:
        evaluation = model.fit(features)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    digest = sha256("|".join(f"{item.project_id}:{item.vector()}" for item in features).encode()).hexdigest()
    run = ModelRun(model_code=f"NUM-{datetime.now(timezone.utc):%Y%m%d%H%M%S}", model_type="numeric_anomaly_context", version="sklearn-isolation-forest-v1", source_digest=digest, feature_schema={"features": model.feature_names}, evaluation=evaluation, limitation=evaluation["interpretation"])
    session.add(run); await session.commit(); await session.refresh(run)
    return {"model_code": run.model_code, "model_type": run.model_type, "training_rows": evaluation["training_rows"], "limitation": run.limitation}


@app.post("/api/v1/models/semantic-duplicates/compare", tags=["Model management"])
async def compare_semantic_duplicates(payload: DuplicateCompareInput, session: AsyncSession = Depends(db), _user: User = Depends(requires("reviewer", "admin"))):
    reference, candidate = await session.get(Project, payload.reference_project_id), await session.get(Project, payload.candidate_project_id)
    if not reference or not candidate:
        raise HTTPException(status_code=404, detail="Both project records must exist.")
    result = semantic_similarity(f"{reference.title}. {reference.description or ''}", f"{candidate.title}. {candidate.description or ''}")
    result.update({"reference_project_id": reference.id, "candidate_project_id": candidate.id, "same_category": reference.category.casefold() == candidate.category.casefold(), "same_locality": reference.locality.casefold() == candidate.locality.casefold(), "day_gap": abs((candidate.sanction_date - reference.sanction_date).days)})
    return result


static_dir = Path(__file__).resolve().parents[2] / "dist/public"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def frontend(path: str):
        target = static_dir / path
        if path and target.is_file():
            return FileResponse(target)
        return FileResponse(static_dir / "index.html")
