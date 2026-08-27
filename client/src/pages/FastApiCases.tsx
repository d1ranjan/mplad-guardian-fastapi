import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, BarChart3, Database, MapPin } from "lucide-react";
import { Link } from "wouter";
import { AllocationDashboard, GuardianAlert, GuardianUser, guardianRequest, formatMoney, humanise } from "@/lib/guardianApi";
import { fetchOfficialAllocationCsv, officialAllocationFilename } from "@/lib/officialAllocation";
import { ErrorPanel, Loading, Metric, SectionTitle } from "./FastApiViews";

type AlertCase = { case: GuardianAlert & { evidence: Record<string, unknown> }; project: Record<string, unknown>; provenance: Record<string, unknown>; review_history: { action: string; note: string; reviewer_id: number; created_at: string }[] };
type AllocationCase = { score: { id: number; context_band: string; model_score: number; state_peer_count: number; state_peer_median: number; applied_variance_percent: number }; record: { state: string; mp_name: string; constituency: string; allocated_amount: number }; model: { model_code: string; methodology: string }; source: { source_url: string }; state_peers: { record_id: number; mp_name: string; constituency: string; allocated_amount: number; model_score: number; applied_variance_percent: number }[] };

export function AlertCaseView({ id, token, user, onHydrate, setStatus }: { id: string; token: string; user: GuardianUser; onHydrate: () => Promise<void>; setStatus: (value: string) => void }) {
  const [item, setItem] = useState<AlertCase | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try { setItem(await guardianRequest<AlertCase>(`/alerts/${id}`, token)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load this alert case."); }
  };
  useEffect(() => { void load(); }, [id, token]);
  const review = async (action: "field_verification" | "dismissed" | "resolved") => {
    if (note.trim().length < 3) { setError("Add a review note of at least three characters."); return; }
    setBusy(true);
    try {
      await guardianRequest(`/alerts/${id}/review`, token, { method: "POST", body: JSON.stringify({ action, note }) });
      setNote(""); await load(); await onHydrate(); setStatus("Review action recorded.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Review could not be recorded."); }
    finally { setBusy(false); }
  };
  if (error && !item) return <ErrorPanel text={error} />;
  if (!item) return <Loading text="Loading alert case…" />;
  return <div className="portal-view-stack"><Link href="/alerts" className="portal-back-link"><ArrowLeft className="h-4 w-4" />Back to alert queue</Link><section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="portal-card portal-card-pad"><p className="portal-eyebrow portal-eyebrow-dark">{humanise(item.case.risk_type)} · {item.case.risk_band}</p><h2>{item.case.title}</h2><p>{item.case.rationale}</p><div className="portal-evidence-block"><p>Evidence payload</p><pre>{JSON.stringify(item.case.evidence, null, 2)}</pre></div></div><div className="portal-context-card"><p>Project context</p><strong>{String(item.project.project_code)}</strong><span>{String(item.project.title)}</span><dl><div><dt>Audit run</dt><dd>{String(item.provenance.run_code)}</dd></div><div><dt>Algorithm</dt><dd>{String(item.provenance.algorithm_version)}</dd></div></dl></div></section>{user.role !== "viewer" && <section className="portal-card portal-card-pad"><p className="portal-eyebrow portal-eyebrow-dark">Human decision</p><h2>Human review action</h2><p>Record an evidence-led decision without altering the source audit evidence.</p><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Explain the review decision and evidence required…" className="portal-textarea" /><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={() => review("field_verification")} className="portal-action-button">Request field verification</button><button disabled={busy} onClick={() => review("resolved")} className="portal-outline-button">Resolve</button><button disabled={busy} onClick={() => review("dismissed")} className="portal-outline-button">Dismiss</button></div>{error && <p className="mt-3 text-sm text-rose-700">{error}</p>}</section>}<section className="portal-card overflow-hidden"><SectionTitle title="Review history" text="Persisted reviewer actions for this alert case." /><div className="divide-y divide-slate-100">{item.review_history.length ? item.review_history.map((entry, index) => <div key={`${entry.created_at}-${index}`} className="px-5 py-4"><p className="font-semibold text-slate-800">{humanise(entry.action)}</p><p className="mt-1 text-sm text-slate-600">{entry.note}</p></div>) : <p className="px-5 py-8 text-sm text-slate-500">No reviewer action has been recorded.</p>}</div></section></div>;
}

export function AllocationView({ token, user }: { token: string; user: GuardianUser }) {
  const [data, setData] = useState<AllocationDashboard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try { setData(await guardianRequest<AllocationDashboard>("/allocations", token)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load official allocation context."); }
  };
  useEffect(() => { void load(); }, [token]);
  const importPackagedOfficialSource = async () => {
    setBusy(true);
    setError("");
    try {
      const csv = await fetchOfficialAllocationCsv();
      const body = new FormData(); body.append("file", new File([csv], officialAllocationFilename, { type: "text/csv" }));
      await guardianRequest("/allocations/import", token, { method: "POST", body });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Official allocation import failed."); }
    finally { setBusy(false); }
  };
  if (!data) return <section className="portal-import-card"><p className="portal-eyebrow portal-eyebrow-dark">Official public source</p><h2>Official allocation context is not loaded.</h2><p>{error || "Import the packaged public MPLADS allocation export to create a versioned peer-context model. It highlights variance for explanation; it does not classify fraud or wrongdoing."}</p>{user.role === "admin" && <div className="mt-5"><button onClick={importPackagedOfficialSource} disabled={busy} className="portal-action-button">{busy ? "Importing official source…" : "Import packaged official allocation source"}</button><p className="mt-2 text-xs leading-5 text-slate-600">Uses the supplied public allocation export and records its checksum, source scope, and retrieval time. No local file selection is required.</p></div>}</section>;
  return <div className="portal-view-stack"><section className="portal-context-card"><p>Official source · peer-context model</p><strong>Allocation variance deserves context, not conclusions.</strong><span>{data.model.methodology}</span><small>{data.model.model_code} · {data.source.row_count} public records</small></section><div className="portal-metrics-grid sm:grid-cols-4"><Metric label="Public records" value={data.kpis.record_count} icon={<Database />} /><Metric label="States / UTs" value={data.kpis.state_count} icon={<MapPin />} /><Metric label="High variance" value={data.kpis.high_variance_count} icon={<AlertTriangle />} /><Metric label="Median allocation" value={formatMoney(data.kpis.median_allocation)} icon={<BarChart3 />} /></div><section className="portal-card overflow-hidden"><SectionTitle title="Allocation context register" text="Sorted by variance from a state peer median, with national fallback for smaller peer groups." /><div className="overflow-x-auto"><table className="portal-table min-w-full text-left text-sm"><thead><tr><th className="px-5 py-3">Band</th><th className="px-5 py-3">Constituency</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Peer context</th><th className="px-5 py-3">Variance</th></tr></thead><tbody className="divide-y divide-slate-100">{data.records.map(row => <tr key={row.id}><td className="px-5 py-4"><span className="portal-risk-pill">{humanise(row.context_band)}</span></td><td className="px-5 py-4"><Link href={`/allocation/${row.id}`} className="portal-table-link">{row.record.constituency}</Link><p className="mt-1 text-xs text-slate-500">{row.record.state} · {row.record.mp_name}</p></td><td className="px-5 py-4">{formatMoney(row.record.allocated_amount)}</td><td className="px-5 py-4 text-slate-600">{row.state_peer_count} peers · {formatMoney(row.state_peer_median)}</td><td className="px-5 py-4 font-semibold">{row.applied_variance_percent > 0 ? "+" : ""}{row.applied_variance_percent.toFixed(1)}%</td></tr>)}</tbody></table></div></section></div>;
}

export function AllocationCaseView({ id, token }: { id: string; token: string }) {
  const [data, setData] = useState<AllocationCase | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { guardianRequest<AllocationCase>(`/allocations/${id}`, token).then(setData).catch(reason => setError(reason instanceof Error ? reason.message : "Could not load allocation case.")); }, [id, token]);
  if (error) return <ErrorPanel text={error} />;
  if (!data) return <Loading text="Loading allocation context…" />;
  return <div className="portal-view-stack"><Link href="/allocation" className="portal-back-link"><ArrowLeft className="h-4 w-4" />Back to allocation context</Link><section className="grid gap-5 lg:grid-cols-[1fr_.8fr]"><div className="portal-card portal-card-pad"><p className="portal-eyebrow portal-eyebrow-dark">{humanise(data.score.context_band)} · score {data.score.model_score}</p><h2>{data.record.constituency}</h2><p>{data.record.mp_name} · {data.record.state}</p><dl className="mt-5 grid gap-4 sm:grid-cols-2"><Info label="Allocated amount" value={formatMoney(data.record.allocated_amount)} /><Info label="Applied variance" value={`${data.score.applied_variance_percent > 0 ? "+" : ""}${data.score.applied_variance_percent.toFixed(1)}%`} /><Info label="State peer median" value={formatMoney(data.score.state_peer_median)} /><Info label="State peers" value={String(data.score.state_peer_count)} /></dl></div><div className="portal-guardrail"><p>Interpretation guardrail</p><span>A high-variance public allocation can have legitimate administrative explanations. It is a request for context, never evidence of misconduct.</span><a href={data.source.source_url} target="_blank" rel="noreferrer">Open official dashboard</a></div></section><section className="portal-card overflow-hidden"><SectionTitle title="State peer group" text="Records used for comparative context in the current model run." /><div className="overflow-x-auto"><table className="portal-table min-w-full text-left text-sm"><thead><tr><th className="px-5 py-3">MP</th><th className="px-5 py-3">Constituency</th><th className="px-5 py-3">Allocation</th><th className="px-5 py-3">Variance</th></tr></thead><tbody className="divide-y divide-slate-100">{data.state_peers.map(peer => <tr key={peer.record_id}><td className="px-5 py-4">{peer.mp_name}</td><td className="px-5 py-4">{peer.constituency}</td><td className="px-5 py-4">{formatMoney(peer.allocated_amount)}</td><td className="px-5 py-4">{peer.applied_variance_percent > 0 ? "+" : ""}{peer.applied_variance_percent.toFixed(1)}%</td></tr>)}</tbody></table></div></section></div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-lg font-semibold text-slate-900">{value}</dd></div>; }
