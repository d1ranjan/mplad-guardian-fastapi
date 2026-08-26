# Official MPLADS Dashboard Training-Data Assessment

**Source reviewed:** [MPLADS e-SAKSHI public dashboard](https://mplads.mospi.gov.in/digigov/dashboard.html) on 26 August 2026.

## Public data currently observable

The public dashboard exposes an exportable, MP-level table with **state, MP name, constituency, and allocated amount**. It also displays national aggregate figures for works recommended, sanctioned, completed, and expenditure. The portal states that public dashboard data covers works recommended online on or after 1 April 2023 and is updated from stakeholder logins.[1]

The site explains that detailed work execution, vendor-payment requests, status/progress updates, photographs, and documents are supplied by district and implementing-agency users through authenticated workflows. These fields are not exposed in the observed public MP-allocation table.[1]

## Training suitability conclusion

| Requirement for a supervised fraud-risk model | Observed public dashboard coverage | Training impact |
|---|---|---|
| Project-level identity and description | Not in public export table | Cannot train duplicate-work or project-category features. |
| Vendor/contractor identifier | Not in public export table | Cannot train vendor concentration or relationship features. |
| Detailed cost, payment, and milestone history | Only national aggregate totals observed | Cannot calculate project-level cost or payment patterns. |
| Geo-coordinates or precise work locality | Not in public export table | Cannot train distance or spatial-overlap signals. |
| Verified audit/investigation outcome label | Not observed | Cannot fit or evaluate a supervised fraud classifier. |

> **Decision:** The public dashboard can be used as a reference or contextual allocation dataset, but it is not sufficient on its own for defensible supervised model training. A complete trained model requires authorised project-level records joined to verified historical audit or investigation outcomes.

## Recommended authorised training extract

Request a de-identified historical export through MoSPI/District Authority channels, containing stable project ID; type/category; district/locality; vendor ID; sanctioned, estimated, paid, and actual amounts; work and payment dates; progress/status; completion and inspection dates; and a final verified audit outcome. Add data-use approval, retention period, and label provenance for each record.

## Next safe step

The project now ingests the preserved public MP-allocation CSV as a **context-only source** and trains a versioned state peer-median variance model. Its reproducible record stores the CSV SHA-256, source scope, method, row count, model version, state-peer counts, median baselines, and each calculated variance. This is a trained unsupervised context model, not a predictive fraud model. No model should be represented as a fraud classifier until a verified labelled dataset is supplied and evaluated with temporal/geographic holdouts, calibration, and human-review safeguards.

## Reference

[1]: [MPLADS e-SAKSHI Dashboard](https://mplads.mospi.gov.in/digigov/dashboard.html)
