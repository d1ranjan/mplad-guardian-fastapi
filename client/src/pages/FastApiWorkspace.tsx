import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, ClipboardCheck, Database, FileUp, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { API_BASE_URL, apiDocsUrl } from "@/lib/api";
import { GuardianAlert, GuardianProject, GuardianUser, guardianRequest } from "@/lib/guardianApi";
import { AlertsView, DashboardView, ImportsView, ProjectsView } from "./FastApiViews";
import { AlertCaseView, AllocationCaseView, AllocationView } from "./FastApiCases";

export default function FastApiWorkspace() {
  const [location] = useLocation();
  const [, alertParams] = useRoute("/alerts/:id");
  const [, allocationParams] = useRoute("/allocation/:id");
  const [token, setToken] = useState("");
  const [user, setUser] = useState<GuardianUser | null>(null);
  const [projects, setProjects] = useState<GuardianProject[]>([]);
  const [alerts, setAlerts] = useState<GuardianAlert[]>([]);
  const [status, setStatus] = useState("Checking FastAPI service…");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "bootstrap">("login");
  const [busy, setBusy] = useState(false);

  const hydrate = async (accessToken: string) => {
    const [currentUser, projectData, alertData] = await Promise.all([
      guardianRequest<GuardianUser>("/auth/me", accessToken),
      guardianRequest<GuardianProject[]>("/projects", accessToken),
      guardianRequest<GuardianAlert[]>("/alerts", accessToken),
    ]);
    setToken(accessToken);
    setUser(currentUser);
    setProjects(projectData);
    setAlerts(alertData);
    setStatus("Connected to FastAPI and PostgreSQL.");
  };

  useEffect(() => {
    let active = true;
    const initialise = async () => {
      try {
        const health = await guardianRequest<{ service: string }>("/health");
        if (active) setStatus(`${health.service} is available.`);
        const renewed = await guardianRequest<{ access_token: string }>("/auth/refresh", undefined, { method: "POST" });
        if (active) await hydrate(renewed.access_token);
      } catch {
        if (active) setStatus("Sign in to use the secured PostgreSQL workspace.");
      }
    };
    void initialise();
    return () => { active = false; };
  }, []);

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "bootstrap") {
        await guardianRequest("/auth/bootstrap-admin", undefined, { method: "POST", body: JSON.stringify({ name, email, password }) });
      }
      const result = await guardianRequest<{ access_token: string }>("/auth/login", undefined, { method: "POST", body: JSON.stringify({ email, password }) });
      await hydrate(result.access_token);
      setStatus("Authenticated successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await guardianRequest("/auth/logout", undefined, { method: "POST" }).catch(() => undefined);
    setToken(""); setUser(null); setProjects([]); setAlerts([]); setStatus("Signed out.");
  };

  const runAudit = async () => {
    setBusy(true);
    try {
      const result = await guardianRequest<{ total_alerts: number }>("/audits/run", token, { method: "POST" });
      await hydrate(token);
      setStatus(`Audit completed with ${result.total_alerts} evidence-backed review priorities.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Audit could not run.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="min-h-screen bg-[#f7f5f0] text-slate-900"><Header user={user} signOut={signOut} /><main className="mx-auto max-w-7xl px-4 py-6 md:px-6"><Hero status={status} />{!user ? <AccessForm {...{ mode, setMode, name, email, password, setName, setEmail, setPassword, authenticate, busy }} /> : <><Navigation path={location} /><WorkspaceRoute path={location} alertId={alertParams?.id} allocationId={allocationParams?.id} token={token} user={user} projects={projects} alerts={alerts} busy={busy} onRunAudit={runAudit} onHydrate={() => hydrate(token)} setStatus={setStatus} /></>}</main></div>;
}

function Header({ user, signOut }: { user: GuardianUser | null; signOut: () => Promise<void> }) {
  return <header className="border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur md:px-6"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4"><Link href="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300 text-[#102f4c]"><ShieldCheck className="h-5 w-5" /></span><div><p className="font-display text-xl font-semibold">MPLAD Guardian</p><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">FastAPI · PostgreSQL edition</p></div></Link><div className="flex items-center gap-2">{user && <span className="hidden text-xs text-slate-500 sm:block">{user.name} · {user.role}</span>}<a href={apiDocsUrl()} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">API docs</a>{user && <button onClick={signOut} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Sign out</button>}</div></div></header>;
}

function Hero({ status }: { status: string }) {
  return <section className="mb-6 grid gap-5 rounded-3xl bg-[#102f4c] p-6 text-white shadow-xl shadow-slate-900/10 lg:grid-cols-[1fr_270px]"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">Operational audit intelligence</p><h1 className="mt-2 font-display text-3xl font-semibold">Evidence-led public-project review.</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-sky-100/85">FastAPI, PostgreSQL, SQLAlchemy, Pydantic, JWT, Alembic, scikit-learn, and Sentence Transformers support an inspectable review workflow. Risk signals are prioritisation context, not findings of wrongdoing.</p></div><div className="rounded-2xl border border-white/10 bg-white/[.08] p-4 text-sm text-sky-100"><p className="font-semibold text-amber-200">Service status</p><p className="mt-2 leading-6">{status}</p><p className="mt-3 break-all text-[11px] text-sky-100/65">{API_BASE_URL}</p></div></section>;
}

function AccessForm({ mode, setMode, name, email, password, setName, setEmail, setPassword, authenticate, busy }: { mode: "login" | "bootstrap"; setMode: (mode: "login" | "bootstrap") => void; name: string; email: string; password: string; setName: (value: string) => void; setEmail: (value: string) => void; setPassword: (value: string) => void; authenticate: (event: React.FormEvent) => Promise<void>; busy: boolean }) {
  const field = (label: string, type: string, value: string, update: (value: string) => void, minLength?: number) => <label className="mt-4 block text-sm font-medium">{label}<input type={type} required value={value} minLength={minLength} onChange={event => update(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-300" /></label>;
  return <form onSubmit={authenticate} className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><div className="flex gap-2"><button type="button" onClick={() => setMode("login")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "login" ? "bg-[#102f4c] text-white" : "bg-slate-100 text-slate-600"}`}>Sign in</button><button type="button" onClick={() => setMode("bootstrap")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "bootstrap" ? "bg-[#102f4c] text-white" : "bg-slate-100 text-slate-600"}`}>First administrator</button></div><h2 className="mt-6 font-display text-3xl font-semibold">{mode === "bootstrap" ? "Initialize secure access" : "Enter the analyst workspace"}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{mode === "bootstrap" ? "This one-time setup is available only before any account exists in PostgreSQL." : "Use your JWT-backed analyst account to access project records and review workflows."}</p>{mode === "bootstrap" && field("Full name", "text", name, setName)}{field("Email", "email", email, setEmail)}{field("Password", "password", password, setPassword, 12)}<button disabled={busy} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-[#102f4c] transition hover:bg-amber-200 disabled:opacity-50">{mode === "bootstrap" ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}{busy ? "Working…" : mode === "bootstrap" ? "Create administrator" : "Sign in"}</button></form>;
}

function Navigation({ path }: { path: string }) {
  const links = [["/", "Overview", BarChart3], ["/projects", "Projects", Database], ["/imports", "Imports", FileUp], ["/alerts", "Alerts", AlertTriangle], ["/allocation", "Allocation context", ClipboardCheck]] as const;
  return <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">{links.map(([href, text, Icon]) => <Link key={href} href={href} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${path === href || (href !== "/" && path.startsWith(href)) ? "bg-[#102f4c] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}><Icon className="h-4 w-4" />{text}</Link>)}</nav>;
}

function WorkspaceRoute({ path, alertId, allocationId, token, user, projects, alerts, busy, onRunAudit, onHydrate, setStatus }: { path: string; alertId?: string; allocationId?: string; token: string; user: GuardianUser; projects: GuardianProject[]; alerts: GuardianAlert[]; busy: boolean; onRunAudit: () => Promise<void>; onHydrate: () => Promise<void>; setStatus: (value: string) => void }) {
  if (alertId) return <AlertCaseView id={alertId} token={token} user={user} onHydrate={onHydrate} setStatus={setStatus} />;
  if (allocationId) return <AllocationCaseView id={allocationId} token={token} />;
  if (path === "/projects") return <ProjectsView projects={projects} />;
  if (path === "/imports") return <ImportsView token={token} user={user} onHydrate={onHydrate} setStatus={setStatus} />;
  if (path === "/alerts") return <AlertsView alerts={alerts} />;
  if (path === "/allocation") return <AllocationView token={token} user={user} />;
  return <DashboardView user={user} projects={projects} alerts={alerts} busy={busy} onRunAudit={onRunAudit} />;
}
