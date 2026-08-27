# FastAPI and PostgreSQL Backend

This release adds an independently operable **Python FastAPI backend** to MPLAD Guardian. In production, FastAPI runs as a direct Render Docker web service and the React analyst workspace is hosted separately on Manus. PostgreSQL is accessed through SQLAlchemy’s asynchronous `asyncpg` driver, and Alembic applies the versioned schema at container startup.

## Stack

| Layer | Implementation |
|---|---|
| API | FastAPI with generated OpenAPI and Swagger UI at `/docs` |
| Database | PostgreSQL via SQLAlchemy 2.0 and `asyncpg` |
| Migrations | Alembic, revision `0002_import_provenance` |
| Validation | Pydantic request contracts and field constraints |
| Authentication | bcrypt password hashes, short-lived JWT access tokens, secure refresh cookie, and role dependencies |
| ML | scikit-learn `IsolationForest` numeric-context service and lazy Sentence Transformers semantic comparison |
| Frontend | React workspace uses the public `VITE_API_BASE_URL`, with a same-origin `/api/v1` fallback for local development |

## Database setup

`POSTGRESQL_URL` is a secure server-side environment variable. Both standard `postgresql://` and SQLAlchemy `postgresql+asyncpg://` URI forms are accepted; the service normalises the former to the async driver. For Render, use the Supabase **Session Pooler** URI, with a hostname ending in `.pooler.supabase.com`; do not use the direct `db.<project-ref>.supabase.co` host because its network path is not reachable from this deployment. Apply the schema manually during local development:

```bash
cd backend
alembic upgrade head
```

The deployed container performs the same idempotent migration before starting Uvicorn. The initial schema contains users, vendors, projects, audit runs, alerts, reviewer actions, persisted import provenance, and model-run metadata. The schema uses foreign keys and JSONB evidence/provenance columns to preserve an inspectable audit trail.

## Render deployment and frontend connection

The committed `Dockerfile` starts FastAPI directly with `alembic upgrade head` followed by Uvicorn bound to Render’s supplied `PORT`. The accompanying `render.yaml` describes the Docker web service, automated health check, safe secret placeholders, and the `POSTGRESQL_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `ACCESS_TOKEN_MINUTES`, and `REFRESH_TOKEN_DAYS` settings.

`POSTGRESQL_URL` is deliberately marked `sync: false` in the Blueprint and must be pasted only in Render’s Environment settings. `JWT_SECRET` should be generated in Render. Neither value belongs in source control. `CORS_ORIGINS` must exactly match the published frontend origin: `https://mpladguard-dtzanqrn.manus.space`.

The Manus project stores the non-secret `VITE_API_BASE_URL` as `https://mplad-guardian-fastapi.onrender.com/api/v1`. The client opens Swagger at the matching Render `/docs` URL and sends its Bearer access token to that API base. The refresh cookie is configured as `HttpOnly`, `Secure`, and `SameSite=None` for the split-origin workflow. Browsers that block third-party cookies can still use the application after a normal sign-in, but may need to sign in again after an access token expires.

The Render service’s `/api/v1/health`, `/api/v1/ready`, `/docs`, and `/api/v1/openapi.json` routes were verified after the pooler configuration was applied. The public API correctly rejects a protected endpoint without a Bearer token, and its CORS preflight permits the published Manus frontend origin with credentials.

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

At the project root, also run `pnpm test`, `pnpm check`, and `pnpm build`. The deployed container builds the React bundle, includes a Python 3 runtime and CPU-only PyTorch installation for Sentence Transformers, then starts the FastAPI web service. Models are loaded lazily to avoid consuming memory until a protected semantic operation is requested.
