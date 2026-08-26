# MPLAD Guardian

MPLAD Guardian is an **evidence-first audit-intelligence platform** for prioritising review of public-project records. It models projects, vendors, locations, financial milestones, timelines, and progress; runs transparent detector rules; preserves analysis provenance; and gives analysts a structured workflow to inspect, verify, dismiss, or resolve a case.

> **Important:** A risk score is a review priority, not a finding of fraud or fault. The included demo records are explicitly synthetic and use fictional project and vendor names.

## Capabilities

| Area | What the application provides |
|---|---|
| Project foundation | Project-level records with category, geography, vendor, amounts, timeline, progress, source import, and milestones. |
| Cost review | Comparable peer median by category, state, and financial year with deviation and peer-count evidence. |
| Duplicate-work review | Normalised text similarity paired with locality, distance, and date-window signals. |
| Vendor review | Project/value share and Herfindahl–Hirschman concentration within a transparent comparison cohort. |
| Delivery review | Days overdue, progress, expenditure ratio, and update staleness evidence. |
| Provenance | Audit-run code, algorithm version, source digest, preserved evidence rows, CSV checksum, and storage reference. |
| Human review | Field-verification, dismiss, and resolve actions with retained notes and timestamps. |
| Analyst experience | Responsive command centre, filterable queue, detailed case file, project register, and CSV preview/validation/import flow. |
| Official allocation context | A versioned, trained unsupervised peer-median model based on the [MPLADS e-SAKSHI public allocation export](https://mplads.mospi.gov.in/digigov/dashboard.html), with source checksum, record-level context, and explicit interpretation guardrails. |

## Architecture

The application uses React 19, Tailwind CSS, tRPC, Express, Drizzle ORM, MySQL/TiDB, object storage, and Manus OAuth. Client screens use typed `trpc.*` hooks. The backend stores the audit foundation and calls deterministic, explainable detector functions; it does **not** use an opaque model to make determinations.

The central domain is documented in [docs/architecture.md](docs/architecture.md). The detailed field definitions are in [docs/data-dictionary.md](docs/data-dictionary.md). The official-source assessment and model boundary are documented in [docs/training-data-assessment.md](docs/training-data-assessment.md).

## Local setup

The managed project environment already includes its database credentials and supporting services. For local development in this workspace:

```bash
pnpm install
pnpm dev
```

The first public dashboard query seeds the explicitly synthetic workspace and creates a completed audit run when no projects are present. For a normal deployment, use an administrator account to run the audit again after imports.

### Database migration

The reviewed schema migration is stored at `drizzle/0001_next_blue_shield.sql` and has been applied to the managed database. When changing the schema in the future, follow this sequence:

```bash
pnpm drizzle-kit generate
pnpm check
```

Review generated SQL before applying it through the managed database migration workflow. Avoid destructive alterations to audit evidence and reviewer history.

### Quality checks

```bash
pnpm check
pnpm test
pnpm build
```

The unit suite covers the four seeded detector patterns, data-quality evidence, CSV validation boundaries, reviewer action mapping, risk aggregation, official-allocation parsing, and the peer-median model’s variance scoring.

## Official allocation-context model

The **Allocation context** workspace contains a persisted model run trained on 543 records from the public MPLADS allocation export retrieved on 26 August 2026. The model learns a median allocation baseline for each state with five or more records and falls back to the national median for smaller state groups. Its score is the absolute percentage difference from that peer baseline; the application retains the source URL, source checksum, model version, training-row count, method, evaluation summary, and every scored record.

This model is intentionally **not** a fraud classifier. The public export contains allocation, state, MP, and constituency fields; it does not expose project-level costs, vendors, payment history, inspection outcomes, or verified fraud labels. High variance can have valid administrative explanations. The UI therefore calls results “context,” prevents fraud language, and directs analysts to seek documentary context rather than drawing conclusions.

## CSV import

Use **Data import** to download the template, select a CSV, preview records in the browser, validate headers/fields, view blocking errors and non-blocking warnings, and import valid data. The original CSV is stored in object storage; its filename, checksum, storage key, URL, row counts, validation outcome, and import status are retained in `data_imports`.

Required columns are:

```text
projectCode,title,description,category,state,district,locality,latitude,longitude,
vendorName,financialYear,sanctionedAmount,estimatedAmount,actualExpenditure,
sanctionDate,expectedCompletionDate,lastUpdateDate,progressPercent,status
```

`status` must be one of `planning`, `ongoing`, `completed`, `on_hold`, or `cancelled`. Dates should use ISO-8601 form such as `2026-01-20`. Amounts must be numeric INR values without currency symbols.

## Typed API surface

| Procedure | Access | Purpose |
|---|---|---|
| `audit.dashboard` | Public demo read | Executive KPIs, recent audit, detector chart, and queue preview. |
| `audit.listAlerts` | Public demo read | Filterable alert queue. |
| `audit.alertCase` | Public demo read | Case data, evidence, linked projects, milestones, provenance, and review history. |
| `audit.projects` | Public demo read | Project register with active-case priority. |
| `audit.run` | Administrator | Create a reproducible audit run and persisted alerts/evidence. |
| `audit.review` | Authenticated reviewer | Record a review disposition and note. |
| `imports.validate` | Public demo read | Validate parsed CSV project records. |
| `imports.execute` | Administrator | Preserve CSV provenance and import validated project records. |
| `allocation.dashboard` | Public context read | Versioned official source, model metadata, band counts, and allocation-context register. |
| `allocation.case` | Public context read | One public allocation record, peer median comparison, state peer set, source, and model limitations. |
| `allocation.retrain` | Administrator | Verify/reuse the preserved official source model in the current model scope. |

## Security and operating notes

The platform separates public demo read procedures from authenticated reviewer actions and administrator-only audit/import operations. In a production government deployment, additionally enforce organisation-level data segregation, a formal role model, retention policy, source-system authentication, immutable external audit logging, incident response, encryption and key-management controls, rate limits, privacy review, and independent validation of each detector against approved datasets.

## Demo

Use the five-minute walkthrough in [docs/demo-narrative.md](docs/demo-narrative.md). The synthetic demo intentionally includes cases for cost deviation, potential duplicate work, vendor concentration, stalled delivery, and a source-data exception.

## Supporting documents

| Document | Purpose |
|---|---|
| [Architecture](docs/architecture.md) | Domain, detector, score, provenance, and workflow design. |
| [Data dictionary](docs/data-dictionary.md) | Data-grain and field descriptions. |
| [Demo narrative](docs/demo-narrative.md) | Concise presentation script and expected evidence. |
| [Accessibility](docs/accessibility.md) | Current accessibility implementation and final acceptance checklist. |
| [Verification notes](docs/verification-notes.md) | Recorded desktop/mobile visual verification outcome. |
| [Training-data assessment](docs/training-data-assessment.md) | Official data coverage, model boundary, and the requirements for future supervised training. |
