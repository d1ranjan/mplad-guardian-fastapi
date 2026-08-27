# MPLAD Guardian: presentation runbook

Use the live website at [https://d1ranjan.github.io/mplad-guardian-fastapi/](https://d1ranjan.github.io/mplad-guardian-fastapi/). Sign in with the administrator account you created. The website communicates with the FastAPI service on Render, which stores data and audit provenance in Supabase PostgreSQL.

> **Demonstration discipline:** the built-in project dataset is explicitly synthetic. It demonstrates workflow controls and explainable review signals only; it is not an MPLADS project register, a finding of wrongdoing, or a source for supervised fraud claims.

| Sequence | Website action | Expected presentation outcome |
|---|---|---|
| 1 | Open **Imports** and choose **Load synthetic presentation data**. | The page selects 21 fictional records spanning water, drainage, lighting, and health-infrastructure scenarios. |
| 2 | Choose **Validate CSV**, then **Import validated CSV**. | A checksum-backed project import is recorded. Validation prevents malformed records before any data write. |
| 3 | Return to **Overview** and choose **Run evidence audit**. | The FastAPI audit produces transparent cost, stalled-work, vendor-concentration, and duplicate-language candidates. These are prioritisation signals, not determinations. |
| 4 | Open **Alerts**, then a case. Add a note and choose a reviewer action. | The alert’s rationale, evidence payload, algorithm version, and review history remain inspectable. |
| 5 | Open **Model operations**, select **Train numeric context**. | The scikit-learn IsolationForest model runs because the synthetic dataset exceeds the 20-record minimum. Its output is labelled as unsupervised review context, never fraud probability. |
| 6 | In **Model operations**, select `MPL-MH-201` and `MPL-MH-202`, then compare project language. | Sentence Transformers returns a semantic-similarity candidate. It must be corroborated by location, scope, dates, source records, and human review. The first request can be slower while the model loads. |
| 7 | Open **Allocation context** and upload the official MPLADS allocation CSV. | The system persists the source checksum and calculates a state peer-median allocation context. This public-source model is not an individual fraud assessment. |

## Demonstration cues

The cost signal for `MPL-OD-105` compares expenditure against the peer median. The `MPL-MH-201` / `MPL-MH-202` pairing illustrates why language overlap needs a human review. `MPL-AS-301` through `MPL-AS-306` show a concentration prompt for procurement and delivery-capacity review. `MPL-RJ-401` shows an implementation-update prompt. Every output states the review question rather than claiming misconduct.

## After the presentation

For a real deployment, replace synthetic records only with approved project-level source data and preserve import provenance. A supervised fraud model must not be trained or described as trained until an authorised historic dataset with verified investigation or audit outcomes, documented labels, leakage controls, and evaluation thresholds is available. The official dashboard allocation export provides allocation context only; it has no verified project-level outcomes.[1]

## Reference

[1]: https://mplads.mospi.gov.in/digigov/dashboard.html "MPLADS public dashboard"
