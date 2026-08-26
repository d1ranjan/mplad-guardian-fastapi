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

## Detector input expectations

| Detector | Required project fields | Key decision rule |
|---|---|---|
| Cost outlier | Category, state, financial year, actual expenditure | Compare to median of at least three peers; flag ≥55% above median. |
| Duplicate work | Title/description, district, category, locality, coordinates, sanction date | Require text similarity, geographic/locality evidence, and bounded date gap. |
| Vendor concentration | Vendor, state, district, category, financial year, sanctioned value | Flag vendor project share ≥60%; retain project/value share and HHI. |
| Stalled project | Expected completion, status, progress, last update, expenditure | Flag overdue, incomplete, and stale records. |
| Data quality | Status, progress, sanction, actual expenditure, last update | Flag inconsistent or implausible field relationships. |
