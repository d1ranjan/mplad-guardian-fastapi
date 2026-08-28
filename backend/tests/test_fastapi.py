import os
os.environ.setdefault("POSTGRESQL_URL", "postgresql+asyncpg://postgres:postgres@localhost/postgres")
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")
from fastapi.testclient import TestClient
from app.main import app, cors_allowlist, parse_official_allocation_csv, parse_project_csv, text_overlap

def test_health_and_docs_are_exposed():
    client = TestClient(app)
    assert client.get("/api/v1/health").status_code == 200
    assert client.get("/api/v1/ready").json()["database"] == "postgresql"
    openapi = client.get("/api/v1/openapi.json").json()
    assert "/api/v1/auth/login" in openapi["paths"]
    assert "/api/v1/auth/bootstrap-admin" in openapi["paths"]
    assert "/api/v1/users" in openapi["paths"]
    assert "/api/v1/audits/run" in openapi["paths"]
    assert "/api/v1/allocations" in openapi["paths"]


def test_cors_allows_both_owned_frontend_origins_without_permitting_unknown_origins():
    client = TestClient(app)
    for origin in ("https://d1ranjan.github.io", "https://mpladguard-dtzanqrn.manus.space"):
        response = client.options("/api/v1/auth/login", headers={"Origin": origin, "Access-Control-Request-Method": "POST"})
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin
    assert "https://not-owned.example" not in cors_allowlist("https://d1ranjan.github.io")


def test_csv_parser_reports_duplicate_project_codes_without_accepting_them():
    content = b"project_code,title,category,state,district,locality,vendor_name,financial_year,sanctioned_amount,actual_expenditure,sanction_date,expected_completion_date,last_update_date,progress_percent,project_status\nMPL-001,Drain,Drainage,Odisha,Cuttack,Naraj,Works Co,2025-26,100000,20000,2025-04-01T00:00:00Z,2025-06-01T00:00:00Z,2025-04-15T00:00:00Z,20,ongoing\nMPL-001,Drain two,Drainage,Odisha,Cuttack,Naraj,Works Co,2025-26,100000,20000,2025-04-01T00:00:00Z,2025-06-01T00:00:00Z,2025-04-15T00:00:00Z,20,ongoing\n"
    rows, issues = parse_project_csv(content)
    assert len(rows) == 2
    assert issues[0]["field"] == "project_code"


def test_official_allocation_parser_reads_expected_columns_and_currency_values():
    header = "\ufeff\"Sr. No.\",State,Hon'ble Members of Parliaments,Constituency,Allocated AMOUNT ( ₹ )\n"
    records = "".join(f"{index},Odisha,Example MP {index},Example Constituency {index},\"1,000\"\n" for index in range(1, 21))
    rows, skipped_rows = parse_official_allocation_csv((header + records).encode())
    assert len(rows) == 20
    assert skipped_rows == []
    assert rows[0]["state"] == "Odisha"
    assert rows[0]["allocated_amount"] == 1000.0


def test_official_allocation_parser_accepts_normalised_official_column_names():
    header = "Serial Number,State Name,Member of Parliament,Constituency Name,Allocated Amount\n"
    records = "".join(f"{index},Odisha,Example MP {index},Example Constituency {index},147000000\n" for index in range(1, 21))
    rows, skipped_rows = parse_official_allocation_csv((header + records).encode())
    assert len(rows) == 20
    assert skipped_rows == []
    assert rows[0]["mp_name"] == "Example MP 1"


def test_text_overlap_identifies_related_project_language_without_claiming_a_duplicate():
    overlap = text_overlap("Construct a covered concrete storm-water drainage channel near Market Road", "Build a cement concrete drainage pathway for storm water beside Market Road")
    assert overlap >= 0.35
    assert text_overlap("solar lights", "health facility") == 0.0
