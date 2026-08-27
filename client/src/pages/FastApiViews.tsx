import { useState } from "react";
import { AlertTriangle, Database, FileJson2, PlayCircle } from "lucide-react";
import { Link } from "wouter";
import { CsvIssue, GuardianAlert, GuardianProject, GuardianUser, guardianRequest, formatMoney, formatSemanticSimilarity, humanise } from "@/lib/guardianApi";

export function DashboardView({ user, projects, alerts, busy, onRunAudit }: { user: GuardianUser; projects: GuardianProject[]; alerts: GuardianAlert[]; busy: boolean; onRunAudit: () => Promise<void> }) {
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#1d5d8c]">Authenticated analyst</p><h2 className="mt-1 font-display text-3xl font-semibold">Welcome, {user.name}</h2><p className="mt-1 text-sm text-slate-500">Role: {user.role}. Prioritise review queues with documented evidence.</p></div>{user.role === "admin" && <button onClick={onRunAudit} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#102f4c] px-4 py-3 text-sm font-semibold text-white hover:bg-[#153f61] disabled:opacity-50"><PlayCircle className="h-4 w-4" />{busy ? "Running…" : "Run evidence audit"}</button>}</div><div className="grid gap-4 sm:grid-cols-3"><Metric icon={<Database />} label="Projects" value={projects.length} /><Metric icon={<AlertTriangle />} label="Review priorities" value={alerts.length} /><Metric icon={<FileJson2 />} label="REST API" value="OpenAPI" /></div><AlertsView alerts={alerts.slice(0, 8)} compact /></div>;
}

export function ProjectsView({ projects }: { projects: GuardianProject[] }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><SectionTitle title="Project register" text="PostgreSQL-backed project records supplied through the secured FastAPI import flow." /><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Project</th><th className="px-5 py-3">Location</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3">Progress</th><th className="px-5 py-3">Expenditure</th></tr></thead><tbody className="divide-y divide-slate-100">{projects.length ? projects.map(project => <tr key={project.id}><td className="px-5 py-4"><p className="font-semibold">{project.project_code}</p><p className="mt-1 text-xs text-slate-500">{project.title}</p></td><td className="px-5 py-4 text-slate-600">{project.district}, {project.state}</td><td className="px-5 py-4 text-slate-600">{project.vendor_name || "Unassigned"}</td><td className="px-5 py-4">{project.progress_percent}% · {humanise(project.project_status)}</td><td className="px-5 py-4">{formatMoney(project.actual_expenditure)} / {formatMoney(project.sanctioned_amount)}</td></tr>) : <EmptyRow columns={5} text="No project records have been imported yet." />}</tbody></table></div></section>;
}

export function ImportsView({ token, user, onHydrate, setStatus }: { token: string; user: GuardianUser; onHydrate: () => Promise<void>; setStatus: (value: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [issues, setIssues] = useState<CsvIssue[]>([]);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
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
  return <section className="space-y-5"><div className="rounded-2xl border border-sky-200 bg-sky-50 p-6"><h2 className="font-semibold text-slate-900">Validate before importing</h2><p className="mt-1 text-xs leading-5 text-slate-600">CSV validation reports every available data-quality issue before a write is attempted.</p><input aria-label="Project CSV file" type="file" accept=".csv,text/csv" onChange={event => { setFile(event.target.files?.[0] ?? null); setIssues([]); setSummary(""); }} className="mt-4 block text-sm" />{user.role === "admin" ? <div className="mt-4 flex flex-wrap gap-3"><button onClick={validate} disabled={!file || busy} className="rounded-lg border border-[#1d5d8c] px-3 py-2 text-sm font-semibold text-[#1d5d8c] disabled:opacity-50">{busy ? "Working…" : "Validate CSV"}</button><button onClick={submit} disabled={!file || busy || issues.some(issue => issue.severity === "error")} className="rounded-lg bg-[#1d5d8c] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Import validated CSV</button></div> : <p className="mt-4 text-sm text-amber-800">Only administrators can validate and import project CSV files.</p>}{summary && <p className="mt-4 text-sm font-medium text-slate-700">{summary}</p>}</div>{issues.length > 0 && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><SectionTitle title="Validation report" text="Errors block imports; warnings require analyst review." /><div className="divide-y divide-slate-100">{issues.map((issue, index) => <div key={`${issue.row}-${issue.field}-${index}`} className="flex gap-3 px-5 py-3 text-sm"><span className={`mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${issue.severity === "error" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{issue.severity}</span><p>Row {issue.row}{issue.field ? ` · ${issue.field}` : ""}: {issue.message}</p></div>)}</div></section>}</section>;
}

export function AlertsView({ alerts, compact = false }: { alerts: GuardianAlert[]; compact?: boolean }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><SectionTitle title={compact ? "Prioritised case queue" : "Alert review queue"} text="Persisted FastAPI alerts include their transparent audit rationale and are not determinations of wrongdoing." /><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Score</th><th className="px-5 py-3">Signal</th><th className="px-5 py-3">Project</th><th className="px-5 py-3">Evidence-led rationale</th><th className="px-5 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{alerts.length ? alerts.map(alert => <tr key={alert.id}><td className="px-5 py-4 font-display text-xl font-semibold">{alert.risk_score}</td><td className="px-5 py-4"><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{humanise(alert.risk_type)}</span></td><td className="px-5 py-4"><p className="font-medium">{alert.project.code}</p><p className="mt-1 text-xs text-slate-500">{alert.project.title}</p></td><td className="max-w-md px-5 py-4 text-slate-600">{alert.rationale}</td><td className="px-5 py-4"><Link href={`/alerts/${alert.id}`} className="text-xs font-semibold text-[#1d5d8c] hover:underline">Open case</Link></td></tr>) : <EmptyRow columns={5} text="No alerts are available. Run an audit after importing project data." />}</tbody></table></div></section>;
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
  return <div className="grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.15em] text-[#1d5d8c]">Scikit-learn</p><h2 className="mt-2 font-display text-2xl font-semibold">Numeric context model</h2><p className="mt-2 text-sm leading-6 text-slate-600">Train an IsolationForest-based anomaly context model using sanctioned amounts, expenditure, progress, delivery duration, and update recency. It is not a fraud classifier.</p>{user.role === "admin" ? <button onClick={trainNumeric} disabled={busy} className="mt-5 rounded-lg bg-[#102f4c] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Working…" : "Train numeric context"}</button> : <p className="mt-5 text-sm text-amber-800">Only administrators can create a numeric model run.</p>}{numericResult && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{numericResult}</p>}</section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.15em] text-[#1d5d8c]">Sentence Transformers</p><h2 className="mt-2 font-display text-2xl font-semibold">Semantic duplicate candidate</h2><p className="mt-2 text-sm leading-6 text-slate-600">Compare two project descriptions for a candidate similarity signal. Corroborate any result with location, time, source records, and human review.</p>{user.role === "viewer" ? <p className="mt-5 text-sm text-amber-800">Reviewer or administrator access is required for semantic comparison.</p> : <div className="mt-5 space-y-3"><select value={first} onChange={event => setFirst(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Reference project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.project_code} — {project.title}</option>)}</select><select value={second} onChange={event => setSecond(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Candidate project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.project_code} — {project.title}</option>)}</select><button onClick={compare} disabled={busy || projects.length < 2} className="rounded-lg bg-[#1d5d8c] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Compare project language</button></div>}{semanticResult && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{semanticResult}</p>}</section></div>;
}

export function SectionTitle({ title, text }: { title: string; text: string }) { return <div className="px-5 pt-5"><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>; }
export function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between text-[#1d5d8c]"><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">{label}</p>{icon}</div><p className="mt-3 font-display text-3xl font-semibold">{value}</p></div>; }
export function EmptyRow({ columns, text }: { columns: number; text: string }) { return <tr><td colSpan={columns} className="px-5 py-10 text-center text-slate-500">{text}</td></tr>; }
export function Loading({ text }: { text: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">{text}</div>; }
export function ErrorPanel({ text }: { text: string }) { return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800"><p className="font-semibold">This view could not load.</p><p className="mt-2 text-sm">{text}</p></div>; }
