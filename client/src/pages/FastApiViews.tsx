import { useState } from "react";
import { AlertTriangle, Database, FileJson2, PlayCircle } from "lucide-react";
import { Link } from "wouter";
import { CsvIssue, GuardianAlert, GuardianProject, GuardianUser, guardianRequest, formatMoney, formatSemanticSimilarity, humanise } from "@/lib/guardianApi";
import { presentationDemoFile, presentationDemoRecordCount } from "@/lib/presentationDemo";

export function DashboardView({ user, projects, alerts, busy, onRunAudit }: { user: GuardianUser; projects: GuardianProject[]; alerts: GuardianAlert[]; busy: boolean; onRunAudit: () => Promise<void> }) {
  return <div className="portal-view-stack"><div className="portal-page-heading"><div><p className="portal-eyebrow portal-eyebrow-dark">Authenticated analyst workspace</p><h2>Welcome, {user.name}</h2><p>Role: {user.role}. Prioritise review queues with documented evidence.</p></div>{user.role === "admin" && <button onClick={onRunAudit} disabled={busy} className="portal-action-button"><PlayCircle className="h-4 w-4" />{busy ? "Running…" : "Run evidence audit"}</button>}</div><div className="portal-metrics-grid"><Metric icon={<Database />} label="Projects" value={projects.length} /><Metric icon={<AlertTriangle />} label="Review priorities" value={alerts.length} /><Metric icon={<FileJson2 />} label="REST API" value="OpenAPI" /></div><AlertsView alerts={alerts.slice(0, 8)} compact /></div>;
}

export function ProjectsView({ projects }: { projects: GuardianProject[] }) {
  return <section className="portal-card overflow-hidden"><SectionTitle title="Project register" text="PostgreSQL-backed project records supplied through the secured FastAPI import flow." /><div className="overflow-x-auto"><table className="portal-table min-w-full text-left text-sm"><thead><tr><th className="px-5 py-3">Project</th><th className="px-5 py-3">Location</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3">Progress</th><th className="px-5 py-3">Expenditure</th></tr></thead><tbody className="divide-y divide-slate-100">{projects.length ? projects.map(project => <tr key={project.id}><td className="px-5 py-4"><p className="font-semibold">{project.project_code}</p><p className="mt-1 text-xs text-slate-500">{project.title}</p></td><td className="px-5 py-4 text-slate-600">{project.district}, {project.state}</td><td className="px-5 py-4 text-slate-600">{project.vendor_name || "Unassigned"}</td><td className="px-5 py-4">{project.progress_percent}% · {humanise(project.project_status)}</td><td className="px-5 py-4">{formatMoney(project.actual_expenditure)} / {formatMoney(project.sanctioned_amount)}</td></tr>) : <EmptyRow columns={5} text="No project records have been imported yet." />}</tbody></table></div></section>;
}

export function ImportsView({ token, user, onHydrate, setStatus }: { token: string; user: GuardianUser; onHydrate: () => Promise<void>; setStatus: (value: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [issues, setIssues] = useState<CsvIssue[]>([]);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const importPresentationDemo = async () => {
    const demo = presentationDemoFile();
    setBusy(true);
    setIssues([]);
    try {
      const validationBody = new FormData(); validationBody.append("file", demo);
      const validation = await guardianRequest<{ accepted_rows: number; total_rows: number; issues: CsvIssue[] }>("/imports/validate", token, { method: "POST", body: validationBody });
      setIssues(validation.issues);
      if (validation.issues.some(issue => issue.severity === "error")) { setSummary("The presentation dataset did not pass validation, so nothing was imported."); return; }
      const importBody = new FormData(); importBody.append("file", demo);
      const result = await guardianRequest<{ accepted_rows: number }>("/imports", token, { method: "POST", body: importBody });
      setFile(demo); setSummary(`Imported ${result.accepted_rows} explicitly synthetic presentation records with checksum-backed provenance.`); setStatus("Synthetic presentation dataset imported."); await onHydrate();
    } catch (error) { setSummary(error instanceof Error ? error.message : "Presentation import failed."); }
    finally { setBusy(false); }
  };
  const validate = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData(); body.append("file", file);
      const result = await guardianRequest<{ accepted_rows: number; total_rows: number; issues: CsvIssue[] }>("/imports/validate", token, { method: "POST", body });
      setIssues(result.issues); setSummary(`${result.accepted_rows} of ${result.total_rows} rows can be imported.`);
    } catch (error) { setSummary(error instanceof Error ? error.message : "Validation failed."); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData(); body.append("file", file);
      const result = await guardianRequest<{ accepted_rows: number }>("/imports", token, { method: "POST", body });
      setSummary(`Imported ${result.accepted_rows} records with checksum-backed provenance.`); setStatus("Project import completed."); await onHydrate();
    } catch (error) { setSummary(error instanceof Error ? error.message : "Import failed."); }
    finally { setBusy(false); }
  };
  return <section className="portal-view-stack"><div className="portal-import-card"><p className="portal-eyebrow portal-eyebrow-dark">Data quality gateway</p><h2>Validate before importing</h2><p>CSV validation reports every available data-quality issue before a write is attempted.</p><div className="portal-demo-callout"><p>Presentation dataset</p><span>Import {presentationDemoRecordCount} explicitly synthetic records for a demonstration of imports, audit signals, model training, and review controls. They are fictional and are not MPLADS project evidence.</span>{user.role === "admin" && <button onClick={importPresentationDemo} disabled={busy}>{busy ? "Importing…" : "Import synthetic presentation data"}</button>}</div><input aria-label="Project CSV file" type="file" accept=".csv,text/csv" onChange={event => { setFile(event.target.files?.[0] ?? null); setIssues([]); setSummary(""); }} className="mt-5 block text-sm" />{user.role === "admin" ? <div className="mt-4 flex flex-wrap gap-3"><button onClick={validate} disabled={!file || busy} className="portal-outline-button">{busy ? "Working…" : "Validate my CSV"}</button><button onClick={submit} disabled={!file || busy || issues.some(issue => issue.severity === "error")} className="portal-action-button">Import my validated CSV</button></div> : <p className="mt-4 text-sm text-amber-800">Only administrators can validate and import project CSV files.</p>}{summary && <p className="mt-4 text-sm font-medium text-slate-700">{summary}</p>}</div>{issues.length > 0 && <section className="portal-card overflow-hidden"><SectionTitle title="Validation report" text="Errors block imports; warnings require analyst review." /><div className="divide-y divide-slate-100">{issues.map((issue, index) => <div key={`${issue.row}-${issue.field}-${index}`} className="flex gap-3 px-5 py-3 text-sm"><span className={`mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${issue.severity === "error" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{issue.severity}</span><p>Row {issue.row}{issue.field ? ` · ${issue.field}` : ""}: {issue.message}</p></div>)}</div></section>}</section>;
}

export function AlertsView({ alerts, compact = false }: { alerts: GuardianAlert[]; compact?: boolean }) {
  return <section className="portal-card overflow-hidden"><SectionTitle title={compact ? "Prioritised case queue" : "Alert review queue"} text="Persisted FastAPI alerts include their transparent audit rationale and are not determinations of wrongdoing." /><div className="overflow-x-auto"><table className="portal-table min-w-full text-left text-sm"><thead><tr><th className="px-5 py-3">Score</th><th className="px-5 py-3">Signal</th><th className="px-5 py-3">Project</th><th className="px-5 py-3">Evidence-led rationale</th><th className="px-5 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{alerts.length ? alerts.map(alert => <tr key={alert.id}><td className="px-5 py-4 font-display text-xl font-semibold">{alert.risk_score}</td><td className="px-5 py-4"><span className="portal-risk-pill">{humanise(alert.risk_type)}</span></td><td className="px-5 py-4"><p className="font-medium">{alert.project.code}</p><p className="mt-1 text-xs text-slate-500">{alert.project.title}</p></td><td className="max-w-md px-5 py-4 text-slate-600">{alert.rationale}</td><td className="px-5 py-4"><Link href={`/alerts/${alert.id}`} className="portal-table-link">Open case</Link></td></tr>) : <EmptyRow columns={5} text="No alerts are available. Run an audit after importing project data." />}</tbody></table></div></section>;
}

export function ModelsView({ token, user, projects }: { token: string; user: GuardianUser; projects: GuardianProject[] }) {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [numericResult, setNumericResult] = useState("");
  const [semanticResult, setSemanticResult] = useState("");
  const [busy, setBusy] = useState(false);
  const trainNumeric = async () => {
    setBusy(true);
    try {
      const result = await guardianRequest<{ model_code: string; training_rows: number; limitation: string }>("/models/numeric-context/train", token, { method: "POST" });
      setNumericResult(`${result.model_code} trained on ${result.training_rows} records. ${result.limitation}`);
    } catch (error) { setNumericResult(error instanceof Error ? error.message : "Numeric context training failed."); }
    finally { setBusy(false); }
  };
  const compare = async () => {
    if (!first || !second || first === second) { setSemanticResult("Select two different project records for comparison."); return; }
    setBusy(true);
    try {
      const result = await guardianRequest<{ semantic_similarity: number; interpretation: string }>("/models/semantic-duplicates/compare", token, { method: "POST", body: JSON.stringify({ reference_project_id: Number(first), candidate_project_id: Number(second) }) });
      setSemanticResult(`Similarity ${formatSemanticSimilarity(result.semantic_similarity)}. ${result.interpretation}`);
    } catch (error) { setSemanticResult(error instanceof Error ? error.message : "Semantic comparison failed."); }
    finally { setBusy(false); }
  };
  return <div className="portal-model-grid"><section className="portal-card portal-card-pad"><p className="portal-eyebrow portal-eyebrow-dark">Scikit-learn</p><h2>Numeric context model</h2><p>Train an IsolationForest-based anomaly context model using sanctioned amounts, expenditure, progress, delivery duration, and update recency. It is not a fraud classifier.</p>{user.role === "admin" ? <button onClick={trainNumeric} disabled={busy} className="portal-action-button">{busy ? "Working…" : "Train numeric context"}</button> : <p className="mt-5 text-sm text-amber-800">Only administrators can create a numeric model run.</p>}{numericResult && <p className="portal-result-note">{numericResult}</p>}</section><section className="portal-card portal-card-pad"><p className="portal-eyebrow portal-eyebrow-dark">Sentence Transformers</p><h2>Semantic duplicate candidate</h2><p>Compare two project descriptions for a candidate similarity signal. Corroborate any result with location, time, source records, and human review.</p>{user.role === "viewer" ? <p className="mt-5 text-sm text-amber-800">Reviewer or administrator access is required for semantic comparison.</p> : <div className="mt-5 space-y-3"><select value={first} onChange={event => setFirst(event.target.value)} className="portal-select"><option value="">Reference project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.project_code} — {project.title}</option>)}</select><select value={second} onChange={event => setSecond(event.target.value)} className="portal-select"><option value="">Candidate project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.project_code} — {project.title}</option>)}</select><button onClick={compare} disabled={busy || projects.length < 2} className="portal-action-button">Compare project language</button></div>}{semanticResult && <p className="portal-result-note">{semanticResult}</p>}</section></div>;
}

export function SectionTitle({ title, text }: { title: string; text: string }) { return <div className="portal-section-title"><p>Operational register</p><h2>{title}</h2><span>{text}</span></div>; }
export function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) { return <div className="portal-metric"><div><p>{label}</p>{icon}</div><strong>{value}</strong></div>; }
export function EmptyRow({ columns, text }: { columns: number; text: string }) { return <tr><td colSpan={columns} className="px-5 py-10 text-center text-slate-500">{text}</td></tr>; }
export function Loading({ text }: { text: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">{text}</div>; }
export function ErrorPanel({ text }: { text: string }) { return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800"><p className="font-semibold">This view could not load.</p><p className="mt-2 text-sm">{text}</p></div>; }
