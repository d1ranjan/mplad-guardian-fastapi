import { useEffect, useState } from "react";
import { GuardianUser, guardianRequest, humanise } from "@/lib/guardianApi";
import { ErrorPanel, Loading, SectionTitle } from "./FastApiViews";

type ManagedUser = GuardianUser & { is_active: boolean; created_at: string };

export function TeamView({ token, user }: { token: string; user: GuardianUser }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"reviewer" | "viewer">("reviewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    try { setUsers(await guardianRequest<ManagedUser[]>("/users", token)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load analyst accounts."); }
  };
  useEffect(() => { void load(); }, [token]);
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      await guardianRequest("/users", token, { method: "POST", body: JSON.stringify({ name, email, password, role }) });
      setName(""); setEmail(""); setPassword(""); setRole("reviewer"); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create analyst account."); }
    finally { setBusy(false); }
  };
  const update = async (managed: ManagedUser, update: Record<string, unknown>) => {
    setBusy(true);
    try { await guardianRequest(`/users/${managed.id}`, token, { method: "PATCH", body: JSON.stringify(update) }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update analyst account."); }
    finally { setBusy(false); }
  };
  if (user.role !== "admin") return <ErrorPanel text="Only administrators can manage analyst accounts." />;
  return <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]"><form onSubmit={create} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.15em] text-[#1d5d8c]">Administrator control</p><h2 className="mt-2 font-display text-2xl font-semibold">Add an analyst</h2><p className="mt-2 text-sm leading-6 text-slate-600">Create a reviewer or read-only viewer account. Share the temporary password securely; users can sign in through the same website.</p><label className="mt-5 block text-sm font-medium">Full name<input required value={name} onChange={event => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="mt-4 block text-sm font-medium">Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="mt-4 block text-sm font-medium">Temporary password<input required type="password" minLength={12} value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="mt-4 block text-sm font-medium">Role<select value={role} onChange={event => setRole(event.target.value as "reviewer" | "viewer")} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"><option value="reviewer">Reviewer — can inspect and review alerts</option><option value="viewer">Viewer — read-only access</option></select></label><button disabled={busy} className="mt-5 rounded-lg bg-[#102f4c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Create analyst account"}</button>{error && <p className="mt-4 text-sm text-rose-700">{error}</p>}</form><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><SectionTitle title="Analyst accounts" text="Deactivate access when a user no longer needs the workspace. The initial administrator cannot deactivate the current session." />{users.length ? <div className="divide-y divide-slate-100">{users.map(managed => <div key={managed.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900">{managed.name}</p><p className="mt-1 text-xs text-slate-500">{managed.email} · {humanise(managed.role)} · {managed.is_active ? "Active" : "Deactivated"}</p></div>{managed.id !== user.id && <div className="flex flex-wrap gap-2"><select value={managed.role === "admin" ? "reviewer" : managed.role} disabled={managed.role === "admin" || busy} onChange={event => update(managed, { role: event.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-xs"><option value="reviewer">Reviewer</option><option value="viewer">Viewer</option></select><button disabled={busy || managed.role === "admin"} onClick={() => update(managed, { is_active: !managed.is_active })} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50">{managed.is_active ? "Deactivate" : "Reactivate"}</button></div>}</div>)}</div> : <Loading text="Loading analyst accounts…" />}</section></div>;
}
