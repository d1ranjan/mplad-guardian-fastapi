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
  return <div className="portal-team-grid"><form onSubmit={create} className="portal-import-card"><p className="portal-eyebrow portal-eyebrow-dark">Administrator control</p><h2>Add an analyst</h2><p>Create a reviewer or read-only viewer account. Share the temporary password securely; users can sign in through the same website.</p><label className="portal-field">Full name<input required value={name} onChange={event => setName(event.target.value)} /></label><label className="portal-field">Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label className="portal-field">Temporary password<input required type="password" minLength={12} value={password} onChange={event => setPassword(event.target.value)} /></label><label className="portal-field">Role<select value={role} onChange={event => setRole(event.target.value as "reviewer" | "viewer")}><option value="reviewer">Reviewer — can inspect and review alerts</option><option value="viewer">Viewer — read-only access</option></select></label><button disabled={busy} className="portal-action-button mt-5">{busy ? "Saving…" : "Create analyst account"}</button>{error && <p className="mt-4 text-sm text-rose-700">{error}</p>}</form><section className="portal-card overflow-hidden"><SectionTitle title="Analyst accounts" text="Deactivate access when a user no longer needs the workspace. The initial administrator cannot deactivate the current session." />{users.length ? <div className="divide-y divide-slate-100">{users.map(managed => <div key={managed.id} className="portal-analyst-row"><div><p>{managed.name}</p><span>{managed.email} · {humanise(managed.role)} · {managed.is_active ? "Active" : "Deactivated"}</span></div>{managed.id !== user.id && <div className="flex flex-wrap gap-2"><select value={managed.role === "admin" ? "reviewer" : managed.role} disabled={managed.role === "admin" || busy} onChange={event => update(managed, { role: event.target.value })} className="portal-mini-select"><option value="reviewer">Reviewer</option><option value="viewer">Viewer</option></select><button disabled={busy || managed.role === "admin"} onClick={() => update(managed, { is_active: !managed.is_active })} className="portal-mini-button">{managed.is_active ? "Deactivate" : "Reactivate"}</button></div>}</div>)}</div> : <Loading text="Loading analyst accounts…" />}</section></div>;
}
