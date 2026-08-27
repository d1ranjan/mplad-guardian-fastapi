# FastAPI and PostgreSQL Backend

This release adds an independently operable **Python FastAPI backend** to MPLAD Guardian. In production, FastAPI serves both the React client and the `/api/v1` REST API from a single origin. PostgreSQL is accessed through SQLAlchemy’s asynchronous `asyncpg` driver, and Alembic applies the versioned schema at container startup.

## Stack

| Layer | Implementation |
|---|---|
| API | FastAPI with generated OpenAPI and Swagger UI at `/docs` |
| Database | PostgreSQL via SQLAlchemy 2.0 and `asyncpg` |
| Migrations | Alembic, revision `0001_guardian` |
| Validation | Pydantic request contracts and field constraints |
| Authentication | bcrypt password hashes, short-lived JWT access tokens, secure refresh cookie, and role dependencies |
| ML | scikit-learn `IsolationForest` numeric-context service and lazy Sentence Transformers semantic comparison |
| Frontend | React workspace calling the typed REST response shapes at `/api/v1` |

## Database setup

`POSTGRESQL_URL` is a secure server-side environment variable. Both standard `postgresql://` and SQLAlchemy `postgresql+asyncpg://` URI forms are accepted; the service normalises the former to the async driver. Apply the schema manually during local development:

```bash
cd backend
alembic upgrade head
```

The deployed container performs the same idempotent migration before starting Uvicorn. The initial schema contains users, vendors, projects, audit runs, alerts, reviewer actions, and persisted model-run metadata. The schema uses foreign keys and JSONB evidence/provenance columns to preserve an inspectable audit trail.

## First administrator and access control

When the PostgreSQL `users` table is empty, create the first administrator through Swagger using `POST /api/v1/auth/bootstrap-admin`. This endpoint becomes unavailable after the first account exists. Sign in through `POST /api/v1/auth/login`, copy the returned access token to Swagger’s bearer authorization control, and use the protected routes.

| Role | Allowed operations |
|---|---|
| `viewer` | Read protected project and alert records. |
| `reviewer` | Viewer access plus recorded alert-review actions and semantic comparisons. |
| `admin` | Reviewer access plus project import, audit execution, and numeric-model training. |

## REST API

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/health` and `GET /api/v1/ready` | Liveness and PostgreSQL readiness checks. |
| `POST /api/v1/auth/bootstrap-admin`, `/login`, `/refresh`, `/logout` | First-user initialization and JWT lifecycle. |
| `GET /api/v1/projects` and `POST /api/v1/projects/import` | Secured project registry and validated import. |
| `POST /api/v1/audits/run`, `GET /api/v1/alerts`, `POST /api/v1/alerts/{id}/review` | Persisted audit-run and human-review workflow. |
| `POST /api/v1/models/numeric-context/train` | Train the explainable scikit-learn numeric-context model. |
| `POST /api/v1/models/semantic-duplicates/compare` | Run semantic text comparison with a lazy Sentence Transformers model. |

## ML guardrails

The numeric model is an unsupervised `IsolationForest` used to identify unusual patterns in sanctioned amount, expenditure, progress, planned duration, and update recency. Its score is labeled **review context**, never a probability of fraud. The semantic service uses `all-MiniLM-L6-v2` to compare project language; a high cosine similarity only produces a candidate and must be corroborated by category, location, date, source record, and human review.

The model service needs at least 20 approved project records. A predictive fraud classifier must not be claimed without historically verified outcome labels, temporal/geographic holdout evaluation, calibration checks, and formal governance.

## Local verification

```bash
cd backend
pytest -q
alembic current
uvicorn app.main:app --reload
```

At the project root, also run `pnpm test`, `pnpm check`, and `pnpm build`. The deployed container has a Node build stage, a Python 3 runtime, and a CPU-only PyTorch installation for Sentence Transformers. Models are loaded lazily to avoid consuming memory until a protected semantic operation is requested.
