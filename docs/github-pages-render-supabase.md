# GitHub Pages frontend, Render API, and Supabase PostgreSQL

MPLAD Guardian is now published as a static React website at [https://d1ranjan.github.io/mplad-guardian-fastapi/](https://d1ranjan.github.io/mplad-guardian-fastapi/). The public website calls the independently deployed FastAPI API at [https://mplad-guardian-fastapi.onrender.com](https://mplad-guardian-fastapi.onrender.com), while all operational data remains in the configured Supabase PostgreSQL database.

| Component | Production location | Responsibility |
|---|---|---|
| Website | GitHub Pages | Static React interface, navigation, sign-in, and analyst workflow screens. |
| API | Render | FastAPI, JWT authorisation, CSV validation/import, audit logic, model operations, Alembic startup, and Swagger. |
| Data | Supabase PostgreSQL | Users, projects, imports, audit provenance, alerts, reviews, model runs, and allocation context. |

> GitHub Pages serves static files only. It does not receive the database URI, JWT signing secret, or any other private server credential. All protected operations stay on Render.

## Deployment operation

Pushing to `main` runs `.github/workflows/deploy-pages.yml`. The workflow creates a Pages-specific Vite build with the repository base path `/mplad-guardian-fastapi/`, the public Render API base URL, a `.nojekyll` marker, and an `index.html` fallback copy for direct SPA routes. GitHub Pages is configured to deploy with GitHub Actions.[1]

Render permits the exact Pages browser origin `https://d1ranjan.github.io` through `CORS_ORIGINS`; it is not a wildcard. The FastAPI service uses the Supabase Session Pooler server-side. `POSTGRESQL_URL` and `JWT_SECRET` remain Render-only environment variables and must never be added to GitHub, source files, or the static artifact.[2]

The Render API exposes `/api/v1/health`, `/api/v1/ready`, `/docs`, and `/api/v1/openapi.json`. The website and API were checked from the deployed Pages origin; the API health response succeeded and the CORS preflight returned the exact GitHub origin and credential support.

## Administrator onboarding

On the Pages website, open **First administrator** and provide an administrator name, email address, and strong password. This operation works only while no account exists. The website then signs in through FastAPI and uses an in-memory access token; the refresh token is held in a secure, HTTP-only cookie. Do not send the password in chat.

After the first administrator exists, the website exposes protected project, CSV import, alert review, allocation-context, and model-operations paths. The numerical anomaly and text-similarity services are review aids, not fraud findings. A supervised fraud classifier remains blocked until approved project-level historical records with verified outcomes are available.

## Operational note

Render’s Free service can cold-start after inactivity. The first visit may take longer than a warm request; this does not expose Supabase data or change the model results.[2]

## References

[1]: https://docs.github.com/pages "GitHub Pages documentation"
[2]: https://render.com/docs/configure-environment-variables "Render environment-variable and deployment documentation"
