import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, BrainCircuit, ClipboardCheck, Database, FileUp, LogIn, Menu, ShieldCheck, Users, UserPlus, X } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { API_BASE_URL, apiDocsUrl } from "@/lib/api";
import { GuardianAlert, GuardianProject, GuardianUser, guardianRequest } from "@/lib/guardianApi";
import { AlertsView, DashboardView, ImportsView, ModelsView, ProjectsView } from "./FastApiViews";
import { AlertCaseView, AllocationCaseView, AllocationView } from "./FastApiCases";
import { TeamView } from "./FastApiTeam";

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
  const [showIntro, setShowIntro] = useState(() => {
    try { return window.sessionStorage.getItem("guardian_portal_intro_seen") !== "true"; } catch { return false; }
  });

  const clearSession = (message: string) => {
    window.sessionStorage.removeItem("guardian_access_token");
    setToken(""); setUser(null); setProjects([]); setAlerts([]); setStatus(message);
  };

  const hydrate = async (accessToken: string) => {
    if (!accessToken) throw new Error("Your session has expired. Please sign in again.");
    const [currentUser, projectData, alertData] = await Promise.all([
      guardianRequest<GuardianUser>("/auth/me", accessToken),
      guardianRequest<GuardianProject[]>("/projects", accessToken),
      guardianRequest<GuardianAlert[]>("/alerts", accessToken),
    ]);
    window.sessionStorage.setItem("guardian_access_token", accessToken);
    setToken(accessToken);
    setUser(currentUser);
    setProjects(projectData);
    setAlerts(alertData);
    setStatus("Connected to FastAPI and PostgreSQL.");
  };

  useEffect(() => {
    let active = true;
    const wait = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds));
    const checkHealth = async () => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try { return await guardianRequest<{ service: string }>("/health"); }
        catch (error) {
          lastError = error;
          if (active && attempt < 2) setStatus(`Waking the secure API service… retrying (${attempt + 1}/3).`);
          if (attempt < 2) await wait(2000 * (attempt + 1));
        }
      }
      throw lastError instanceof Error ? lastError : new Error("The secure API service is temporarily unavailable.");
    };
    const initialise = async () => {
      try {
        const health = await checkHealth();
        if (active) setStatus(`${health.service} is available.`);
        const stored = window.sessionStorage.getItem("guardian_access_token");
        if (stored) {
          await hydrate(stored);
        } else {
          const renewed = await guardianRequest<{ access_token: string }>("/auth/refresh", undefined, { method: "POST" });
          if (active) await hydrate(renewed.access_token);
        }
      } catch (error) {
        if (active) setStatus(error instanceof Error ? `${error.message} Refresh in a moment and sign in again if needed.` : "The secure API service is temporarily unavailable. Refresh in a moment and sign in again if needed.");
      }
    };
    void initialise();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!showIntro) return;
    const timer = window.setTimeout(() => {
      try { window.sessionStorage.setItem("guardian_portal_intro_seen", "true"); } catch { /* no persistent browser storage */ }
      setShowIntro(false);
    }, 880);
    return () => window.clearTimeout(timer);
  }, [showIntro]);

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
    clearSession("Signed out.");
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

  return <div className="portal-shell min-h-screen"><PortalIntro visible={showIntro} /><Header user={user} signOut={signOut} /><main className="portal-main"><Hero status={status} user={user} />{!user ? <AccessForm {...{ mode, setMode, name, email, password, setName, setEmail, setPassword, authenticate, busy }} /> : <><Navigation path={location} user={user} /><div key={location} className="portal-workspace animate-enter"><WorkspaceRoute path={location} alertId={alertParams?.id} allocationId={allocationParams?.id} token={token} user={user} projects={projects} alerts={alerts} busy={busy} onRunAudit={runAudit} onHydrate={() => hydrate(token)} setStatus={setStatus} /></div></>}</main><footer className="portal-footer"><div><strong>MPLAD Guardian</strong><span>Evidence-led audit intelligence for accountable project review.</span></div><span>FastAPI · PostgreSQL · Explainable review workflow</span></footer></div>;
}

function Header({ user, signOut }: { user: GuardianUser | null; signOut: () => Promise<void> }) {
  return <><div className="portal-topbar"><div className="portal-container"><span>Government monitoring workspace</span><span>Secure analyst access · Evidence-led review</span></div></div><header className="portal-header"><div className="portal-container portal-header-inner"><Link href="/" className="portal-brand"><span className="portal-emblem"><ShieldCheck /></span><span><small>Government of India · MPLADS review</small><strong>MPLAD Guardian</strong><em>Public-project intelligence & explainable audit review</em></span></Link><div className="portal-header-actions">{user && <span className="portal-user-chip">{user.name} · {user.role}</span>}<a href={apiDocsUrl()} target="_blank" rel="noreferrer" className="portal-docs-link">API docs</a>{user && <button onClick={signOut} className="portal-signout">Sign out</button>}</div></div></header></>;
}

function Hero({ status, user }: { status: string; user: GuardianUser | null }) {
  return <section className="portal-hero"><img className="portal-hero-art" src="https://mpladguard-dtzanqrn.manus.space/manus-storage/quark-portal-hero_d968b7fa.png" alt="Layered data platform illustration" /><div className="portal-container portal-hero-content"><div><p className="portal-eyebrow">Operational audit intelligence</p><h1>Transparent monitoring for public-project review.</h1><p>Securely import authorised records, generate explainable review signals, compare project language, and preserve every human decision with its evidence trail.</p><div className="portal-hero-actions">{user ? <Link href="/projects" className="portal-button portal-button-light">Explore projects</Link> : <a href="#secure-access" className="portal-button portal-button-light">Enter analyst workspace</a>}<Link href={user ? "/alerts" : "/"} className="portal-button portal-button-ghost">View review workflow</Link></div></div><aside className="portal-status-card"><span>Service status</span><strong>{status}</strong><small>{API_BASE_URL}</small></aside></div></section>;
}

function AccessForm({ mode, setMode, name, email, password, setName, setEmail, setPassword, authenticate, busy }: { mode: "login" | "bootstrap"; setMode: (mode: "login" | "bootstrap") => void; name: string; email: string; password: string; setName: (value: string) => void; setEmail: (value: string) => void; setPassword: (value: string) => void; authenticate: (event: React.FormEvent) => Promise<void>; busy: boolean }) {
  const field = (label: string, type: string, value: string, update: (value: string) => void, minLength?: number) => <label className="mt-4 block text-sm font-medium">{label}<input type={type} required value={value} minLength={minLength} onChange={event => update(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-300" /></label>;
  return <section id="secure-access" className="portal-access-section"><div className="portal-container portal-access-grid"><div><p className="portal-eyebrow portal-eyebrow-dark">Secure operations</p><h2>One workspace. Full evidence trail.</h2><p>Administrators create analysts, import validated records, trigger audit runs, and keep provenance in PostgreSQL. Reviewers work from a prioritised queue without treating signals as findings.</p><div className="portal-principles"><span>Role-aware access</span><span>Checksum-backed imports</span><span>Human review actions</span></div></div><form onSubmit={authenticate} className="portal-access-card"><div className="portal-access-tabs"><button type="button" onClick={() => setMode("login")} className={mode === "login" ? "active" : ""}>Sign in</button><button type="button" onClick={() => setMode("bootstrap")} className={mode === "bootstrap" ? "active" : ""}>First administrator</button></div><h2>{mode === "bootstrap" ? "Initialize secure access" : "Enter the analyst workspace"}</h2><p>{mode === "bootstrap" ? "This one-time setup is available only before any account exists in PostgreSQL." : "Use your JWT-backed analyst account to access project records and review workflows."}</p>{mode === "bootstrap" && field("Full name", "text", name, setName)}{field("Email", "email", email, setEmail)}{field("Password", "password", password, setPassword, 12)}<button disabled={busy} className="portal-submit">{mode === "bootstrap" ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}{busy ? "Working…" : mode === "bootstrap" ? "Create administrator" : "Sign in"}</button></form></div></section>;
}

function Navigation({ path, user }: { path: string; user: GuardianUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [["/", "Overview", BarChart3], ["/projects", "Projects", Database], ["/imports", "Imports", FileUp], ["/alerts", "Alerts", AlertTriangle], ["/allocation", "Allocation context", ClipboardCheck], ["/models", "Model operations", BrainCircuit], ...(user.role === "admin" ? [["/team", "Analysts", Users] as const] : [])] as const;
  return <nav className="portal-nav"><div className="portal-container portal-nav-inner"><button className="portal-menu-toggle" onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} aria-label="Toggle workspace navigation">{menuOpen ? <X /> : <Menu />}</button><div className={`portal-nav-links ${menuOpen ? "open" : ""}`}>{links.map(([href, text, Icon]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={path === href || (href !== "/" && path.startsWith(href)) ? "active" : ""}><Icon className="h-4 w-4" />{text}</Link>)}</div></div></nav>;
}

function PortalIntro({ visible }: { visible: boolean }) { return visible ? <div className="portal-intro" aria-hidden="true"><div className="portal-intro-mark"><ShieldCheck /><span>Government monitoring workspace</span><strong>MPLAD Guardian</strong></div></div> : null; }

function WorkspaceRoute({ path, alertId, allocationId, token, user, projects, alerts, busy, onRunAudit, onHydrate, setStatus }: { path: string; alertId?: string; allocationId?: string; token: string; user: GuardianUser; projects: GuardianProject[]; alerts: GuardianAlert[]; busy: boolean; onRunAudit: () => Promise<void>; onHydrate: () => Promise<void>; setStatus: (value: string) => void }) {
  if (alertId) return <AlertCaseView id={alertId} token={token} user={user} onHydrate={onHydrate} setStatus={setStatus} />;
  if (allocationId) return <AllocationCaseView id={allocationId} token={token} />;
  if (path === "/projects") return <ProjectsView projects={projects} />;
  if (path === "/imports") return <ImportsView token={token} user={user} onHydrate={onHydrate} setStatus={setStatus} />;
  if (path === "/alerts") return <AlertsView alerts={alerts} />;
  if (path === "/allocation") return <AllocationView token={token} user={user} />;
  if (path === "/models") return <ModelsView token={token} user={user} projects={projects} />;
  if (path === "/team") return <TeamView token={token} user={user} />;
  return <DashboardView user={user} projects={projects} alerts={alerts} busy={busy} onRunAudit={onRunAudit} />;
}
