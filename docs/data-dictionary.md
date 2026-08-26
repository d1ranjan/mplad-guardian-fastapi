# Data Dictionary

All timestamps are stored in UTC at the database/API layer and displayed in the analyst’s local timezone. Monetary values are INR numeric amounts without currency symbols.

## Project data foundation

| Entity | Field group | Description |
|---|---|---|
| `projects` | Identity | `projectCode`, title, and description provide a stable record and text evidence for duplicate-work review. |
| `projects` | Classification | Category and financial year define meaningful comparison cohorts. |
| `projects` | Location | State, district, locality, latitude, and longitude support geographic peer context and distance checks. |
| `projects` | Vendor | `vendorId` links the project to the registered vendor and supports concentration calculations. |
| `projects` | Financials | Sanctioned, estimated, and actual expenditure values support peer-cost and data-quality checks. |
| `projects` | Delivery | Sanction date, expected completion, last update, progress, and status support delayed-delivery review. |
| `financial_milestones` | Fund flow | Planned/paid amounts and milestone status show payment context in the case file. |
| `vendors` | Supplier record | Vendor code, name, state, and type maintain a reusable contractor/supplier identity. |

## Import and provenance

| Entity | Key fields | Purpose |
|---|---|---|
| `data_imports` | Filename, storage key/URL, checksum, row counts, warning/error counts, status | Preserves the source CSV and its validation context. |
| `data_quality_issues` | Import/project, row number, field, severity, message | Retains source-record warnings and errors separately from fraud-risk alerts. |
| `audit_runs` | Run code, algorithm version, source digest, configuration, counts, status, timestamps | Makes a result reproducible against an identifiable source snapshot. |

## Case and reviewer record

| Entity | Key fields | Purpose |
|---|---|---|
| `audit_alerts` | Detector type, score, band, status, rationale, peer group | One reviewable signal attached to one project and one audit run. |
| `alert_evidence` | Metric, observed value, benchmark, description | Human-readable measurements behind a detector result. |
| `alert_links` | Linked project and relation | Peer, potential-duplicate, or vendor-cohort relationships. |
| `reviewer_actions` | Reviewer, disposition, note, timestamp | Append-only human-review history retained with the case. |

## Official allocation-context model

| Entity | Key fields | Purpose |
|---|---|---|
| `official_allocation_imports` | Source URL, source scope, managed asset URL, SHA-256, retrieval timestamp, row count | Preserves the official public CSV source and identifies its exact scope. |
| `official_allocation_records` | State, MP name, constituency, allocated amount, source row | Stores the public export at its native MP-allocation grain. |
| `allocation_model_runs` | Code/version, source import, training rows, method, configuration, evaluation, status | Captures a reproducible trained context-model run. |
| `allocation_model_scores` | Band, score, direction, state/national median, peer count, applied variance | Preserves the peer-context calculation for each public allocation record. |

The allocation-context model uses an in-state median where there are at least five public records; otherwise it uses the national median. It assigns a context score equal to the absolute percentage difference from the applied baseline. Scores describe variation only and are not fraud probabilities or allegations.

## Detector input expectations

| Detector | Required project fields | Key decision rule |
|---|---|---|
| Cost outlier | Category, state, financial year, actual expenditure | Compare to median of at least three peers; flag ≥55% above median. |
| Duplicate work | Title/description, district, category, locality, coordinates, sanction date | Require text similarity, geographic/locality evidence, and bounded date gap. |
| Vendor concentration | Vendor, state, district, category, financial year, sanctioned value | Flag vendor project share ≥60%; retain project/value share and HHI. |
| Stalled project | Expected completion, status, progress, last update, expenditure | Flag overdue, incomplete, and stale records. |
| Data quality | Status, progress, sanction, actual expenditure, last update | Flag inconsistent or implausible field relationships. |
