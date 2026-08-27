# MPLAD Guardian user guide

MPLAD Guardian is a secure review website for organising public-project records, documenting audit signals, and recording human review decisions. Open the website at [https://d1ranjan.github.io/mplad-guardian-fastapi/](https://d1ranjan.github.io/mplad-guardian-fastapi/). The website is the normal working interface; the separate API documentation is only for technical administrators.

> **Important:** a risk signal is a prompt to verify evidence. It does not establish fraud, wrongdoing, or a final finding about any person, vendor, or project.

## 1. Sign in

If you are the first organisation administrator, choose **First administrator**, enter your name, email, and a strong password, then create the account. This option is intended to be used once. After that, use **Sign in** with the same email and password.

| User role | Typical use |
|---|---|
| **Administrator** | Imports project data, runs audits, trains the numeric-context model, and manages the first operational workspace. |
| **Reviewer** | Reviews alerts, compares project language, and records review actions. |
| **Viewer** | Reads project, alert, and allocation-context information without making changes. |

For security, do not share your password. If the Render service has been inactive, the first request can take longer while the service wakes up. Refresh after a short wait if the sign-in page still says that the API is being checked.

## 2. Start the presentation workspace without a CSV upload

Open **Imports** in the left navigation and select **Import synthetic presentation data**. This one click validates and imports 21 clearly labelled fictional records. No file is needed from your computer.

The data is made only for demonstrating the import, audit, model, and review screens. It should not be called real MPLADS project data in a presentation. You can also choose a real authorised project CSV using **Validate my CSV** and **Import my validated CSV**; errors must be corrected before import.

## 3. Run the evidence audit

Go to **Overview** and choose **Run evidence audit**. The audit creates a new, timestamped run and refreshes the alert queue. The presentation dataset is designed to demonstrate several explainable signals.

| Signal | What it means | What to check next |
|---|---|---|
| Cost outlier | Expenditure differs substantially from comparable records. | Scope, quantity, approvals, market context, bills, and milestones. |
| Stalled project | Status, progress, and update recency call for an implementation update. | Current milestone report, delay reason, site evidence, and revised completion plan. |
| Vendor concentration | A vendor appears in a material share of the imported portfolio. | Procurement segmentation, competition records, capability, and delivery capacity. |
| Duplicate-language candidate | Similar project words occur in the same category and locality. | Scope, work order, dates, locations, geo-evidence, and source documents. |

An alert is a review priority, not a conclusion. Each case includes its rationale, evidence payload, audit-run identifier, and algorithm version.

## 4. Review an alert case

Open **Alerts**, select **Open case**, read the evidence payload and project context, then enter a meaningful review note. Choose **Request field verification**, **Resolve**, or **Dismiss**. The selected action and note are saved to the case review history without altering the original audit evidence.

Use **Resolve** only when the review record supports it. Use **Request field verification** where further source or site evidence is needed. Use **Dismiss** only where the rationale has been checked and documented.

## 5. Train and use the models

Open **Model operations**. After the synthetic dataset is imported, select **Train numeric context**. The service trains an unsupervised scikit-learn IsolationForest model with 21 records, satisfying the minimum of 20 records. The result is a numeric anomaly-context model; it is not a fraud-probability model.

For a semantic language comparison, select `MPL-MH-201` as the reference project and `MPL-MH-202` as the candidate, then choose **Compare project language**. The Sentence Transformers result describes language similarity only. Confirm any meaningful similarity with scope, locality, dates, documents, and human review.

## 6. Load official allocation context without uploading a file

Open **Allocation context** and select **Import packaged official allocation source**. The website retrieves the supplied public allocation export, then the FastAPI service stores its checksum, declared source scope, retrieval time, and a peer-median context model. You do not need to select a file.

The allocation screen compares each record with state-level peers and uses a national fallback for smaller peer groups. Allocation variance may have legitimate administrative explanations; it is not a fraud finding. The source is the public [MPLADS dashboard](https://mplads.mospi.gov.in/digigov/dashboard.html).[1]

## 7. Using your own authorised project CSV

Your CSV must use UTF-8 and include the following columns:

```text
project_code,title,description,category,state,district,locality,vendor_name,
financial_year,sanctioned_amount,actual_expenditure,sanction_date,
expected_completion_date,last_update_date,progress_percent,project_status
```

Dates should be ISO timestamps such as `2026-08-27T00:00:00Z`; `financial_year` should look like `2025-26`; and project status must be one of `planning`, `ongoing`, `completed`, `on_hold`, or `cancelled`. First select **Validate my CSV**, resolve any errors in the report, then select **Import my validated CSV**.

## 8. Responsible operating rules

Always preserve source provenance, do not replace a recorded rationale without a documented new review, and avoid presenting synthetic results as official evidence. Do not train or claim a supervised fraud classifier until you have approved project-level historic records with verified audit or investigation outcomes, a documented label policy, leakage controls, and held-out evaluation. The public allocation export contains allocation context, not verified project-level outcomes.

## Reference

[1]: https://mplads.mospi.gov.in/digigov/dashboard.html "MPLADS public dashboard"
