import { useEffect, useState } from "react";
import { Accessibility, AlertTriangle, ArrowRight, BarChart3, BrainCircuit, ChevronDown, ClipboardCheck, Database, FileText, FileUp, Globe2, Landmark, LogIn, Menu, ShieldCheck, UserPlus, Users, X } from "lucide-react";
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
  const [introStage, setIntroStage] = useState(1);
  const [showIntro, setShowIntro] = useState(true);

  const clearSession = (message: string) => {
    window.sessionStorage.removeItem("guardian_access_token");
    setToken("");
    setUser(null);
    setProjects([]);
    setAlerts([]);
    setStatus(message);
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
        if (stored) await hydrate(stored);
        else {
          try {
            const renewed = await guardianRequest<{ access_token: string }>("/auth/refresh", undefined, { method: "POST" });
            if (active) await hydrate(renewed.access_token);
          } catch {
            if (active) setStatus(`${health.service} is available. Sign in to access the secure workspace.`);
          }
        }
      } catch (error) {
        if (active) setStatus(error instanceof Error ? `${error.message} Refresh in a moment and sign in again if needed.` : "The secure API service is temporarily unavailable. Refresh in a moment and sign in again if needed.");
      }
    };
    void initialise();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const stageTwo = window.setTimeout(() => setIntroStage(2), 1300);
    const stageThree = window.setTimeout(() => setIntroStage(3), 2200);
    const stageFour = window.setTimeout(() => setIntroStage(4), 5200);
    const finish = window.setTimeout(() => setShowIntro(false), 5800);
    return () => [stageTwo, stageThree, stageFour, finish].forEach(window.clearTimeout);
  }, []);

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "bootstrap") await guardianRequest("/auth/bootstrap-admin", undefined, { method: "POST", body: JSON.stringify({ name, email, password }) });
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

  const isWorkspaceRoute = ["/projects", "/imports", "/alerts", "/allocation", "/models", "/team"].some(route => location === route || location.startsWith(`${route}/`));
  const isGuestRoute = !user || !isWorkspaceRoute && location === "/";

  return <div className="quark-site-shell min-h-screen">
    <QuarkSplash visible={showIntro} stage={introStage} />
    <QuarkTopBar />
    <QuarkHeader user={user} signOut={signOut} />
    <QuarkNavigation path={location} user={user} />
    <main id="main-content">
      {isGuestRoute ? <PublicHome {...{ user, status, mode, setMode, name, email, password, setName, setEmail, setPassword, authenticate, busy }} /> : <div className="quark-workspace" key={location}><WorkspaceRoute path={location} alertId={alertParams?.id} allocationId={allocationParams?.id} token={token} user={user!} projects={projects} alerts={alerts} busy={busy} onRunAudit={runAudit} onHydrate={() => hydrate(token)} setStatus={setStatus} /></div>}
    </main>
    <QuarkFooter />
  </div>;
}

function QuarkTopBar() {
  const setTextSize = (size: string) => { document.documentElement.style.fontSize = size; };
  return <div className="quark-topbar"><div className="quark-container quark-topbar-inner"><div><span>भारत सरकार</span><span className="quark-separator">|</span><span>Government of India</span></div><div className="quark-topbar-tools"><a href="#main-content">Skip to main content</a><span className="quark-tool-divider">|</span><button onClick={() => setTextSize("14px")} aria-label="Decrease text size">A−</button><button onClick={() => setTextSize("16px")} aria-label="Default text size">A</button><button onClick={() => setTextSize("18px")} aria-label="Increase text size">A+</button><Globe2 aria-hidden="true" /><span>English</span><Accessibility aria-hidden="true" /></div></div></div>;
}

function QuarkHeader({ user, signOut }: { user: GuardianUser | null; signOut: () => Promise<void> }) {
  return <header className="quark-main-header"><div className="quark-container quark-main-header-inner"><Link href="/" className="quark-brand" aria-label="MPLAD Guardian home"><span className="quark-government-emblem"><Landmark /></span><span className="quark-brand-copy"><small>Government of India</small><strong>MPLAD Guardian</strong><em>AI-powered monitoring &amp; explainable review</em></span></Link><div className="quark-header-right"><ShieldCheck className="quark-header-symbol" aria-hidden="true" />{user ? <><span className="quark-user-label">{user.name} · {user.role}</span><button className="quark-signout" onClick={signOut}>Sign out</button></> : <a className="quark-doc-link" href={apiDocsUrl()} target="_blank" rel="noreferrer">API documentation</a>}</div></div></header>;
}

function QuarkNavigation({ path, user }: { path: string; user: GuardianUser | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  const workspaceTarget = user ? "/" : "/#secure-access";
  return <nav className="quark-navbar" aria-label="Primary navigation"><div className="quark-container quark-nav-container"><button className="quark-mobile-menu" onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} aria-label="Open navigation menu">{menuOpen ? <X /> : <Menu />}</button><ul className={`quark-nav-links ${menuOpen ? "active" : ""}`}>
    <li><Link href="/" onClick={close} className={path === "/" ? "active" : ""}>Home</Link></li>
    <li className="quark-dropdown"><button className="quark-dropdown-button">About MPLAD <ChevronDown /></button><div className="quark-dropdown-menu"><a href="/#introduction" onClick={close}>Platform overview</a><a href="/#personas" onClick={close}>Analyst roles</a><a href="/#reports" onClick={close}>Responsible use</a></div></li>
    <li className="quark-dropdown"><button className="quark-dropdown-button">Monitoring <ChevronDown /></button><div className="quark-dropdown-menu"><Link href={workspaceTarget} onClick={close}>Monitoring dashboard</Link><Link href="/projects" onClick={close}>MPLAD projects</Link><Link href="/imports" onClick={close}>Record imports</Link><Link href="/allocation" onClick={close}>Allocation context</Link></div></li>
    <li><Link href={user ? "/models" : "/#risk-detection"} onClick={close} className={path === "/models" ? "active" : ""}>AI Risk Detection</Link></li>
    <li><Link href={user ? "/allocation" : "/#analytics"} onClick={close} className={path === "/allocation" ? "active" : ""}>Analytics</Link></li>
    <li><Link href={user ? "/alerts" : "/#reports"} onClick={close} className={path.startsWith("/alerts") ? "active" : ""}>Reports</Link></li>
    <li><a href="#contact" onClick={close}>Contact</a></li>
  </ul></div></nav>;
}

function PublicHome({ user, status, mode, setMode, name, email, password, setName, setEmail, setPassword, authenticate, busy }: { user: GuardianUser | null; status: string; mode: "login" | "bootstrap"; setMode: (mode: "login" | "bootstrap") => void; name: string; email: string; password: string; setName: (value: string) => void; setEmail: (value: string) => void; setPassword: (value: string) => void; authenticate: (event: React.FormEvent) => Promise<void>; busy: boolean }) {
  return <>
    <section className="quark-hero" id="home"><img className="quark-hero-art" src="https://mpladguard-dtzanqrn.manus.space/manus-storage/quark-portal-hero_d968b7fa.png" alt="" /><div className="quark-container quark-hero-content"><span className="quark-gov-badge">Government monitoring platform</span><h1>Transparent Monitoring of MPLAD Projects</h1><p>An intelligent platform for monitoring public-project records, analysing fund utilisation, and surfacing unusual patterns through evidence-led data techniques.</p><div className="quark-hero-buttons">{user ? <Link href="/projects" className="quark-btn quark-btn-primary">Explore Projects</Link> : <a href="#secure-access" className="quark-btn quark-btn-primary">Explore Projects</a>}<a href="#risk-detection" className="quark-btn quark-btn-secondary">View Risk Detection</a></div></div></section>
    <section className="quark-notice-section"><div className="quark-container"><div className="quark-notice"><strong>Service status</strong><span>{status}</span><span className="quark-notice-url">{API_BASE_URL}</span></div></div></section>
    <section className="quark-quick-services"><div className="quark-container"><SectionHeading label="Platform services" title="One secure workspace for evidence-led review" text="The original portal composition is retained while MPLAD Guardian’s secure workflows are placed in the matching service-card structure." /><div className="quark-service-grid"><FeatureCard icon={<BarChart3 />} title="Monitoring Dashboard" text="View operational project and alert context after authentication." href={user ? "/" : "#secure-access"} /><FeatureCard icon={<BrainCircuit />} title="AI Risk Detection" text="Run explainable context signals; never treat a signal as a finding." href={user ? "/models" : "#risk-detection"} /><FeatureCard icon={<ClipboardCheck />} title="Allocation Context" text="Compare public allocation context with transparent peer statistics." href={user ? "/allocation" : "#analytics"} /><FeatureCard icon={<FileText />} title="Audit Reports" text="Work from the evidence-backed review queue and recorded decisions." href={user ? "/alerts" : "#reports"} /></div></div></section>
    <section className="quark-content-section quark-light" id="introduction"><div className="quark-container quark-two-column"><div><span className="quark-section-label">About MPLAD Guardian</span><h2>Monitoring designed for accountable human review.</h2><p>MPLAD Guardian keeps imports, source checksums, audit signals, model context, and reviewer actions together. It is designed to support informed assessment, not to make an automated finding of fraud or wrongdoing.</p><a className="quark-text-link" href="#secure-access">Enter the secure workspace <ArrowRight /></a></div><div className="quark-info-box"><h3>Platform objectives</h3><ul><li>Preserve provenance from every authorised import.</li><li>Prioritise review through explainable signals.</li><li>Separate public allocation context from verified evidence.</li><li>Keep analyst decisions in the audit trail.</li></ul></div></div></section>
    <section className="quark-stats-section"><div className="quark-container quark-stats-grid"><Stat label="Role-aware access" value="3" /><Stat label="Evidence-led review" value="100%" /><Stat label="Source-backed imports" value="CSV" /><Stat label="API documentation" value="Open" /></div></section>
    <section className="quark-content-section" id="projects"><div className="quark-container"><SectionHeading label="Project monitoring" title="A connected project register" text="Authorised project records are available within the protected workspace. Sign in to view the live PostgreSQL-backed register." /><div className="quark-table-wrapper"><table className="quark-table"><thead><tr><th>Project ID</th><th>District</th><th>Project</th><th>Source status</th><th>Review workflow</th></tr></thead><tbody><tr><td><strong>Secure access required</strong></td><td>Authorised data only</td><td>Project records remain protected</td><td><span className="quark-status progress">JWT-backed</span></td><td><a className="quark-table-action" href="#secure-access">Sign in</a></td></tr></tbody></table></div></div></section>
    <section className="quark-ai-section" id="risk-detection"><div className="quark-container"><SectionHeading inverse label="AI risk detection" title="Transparent signals, human conclusions." text="MPLAD Guardian provides review context from auditable data patterns. It does not represent alerts, anomaly scores, or semantic comparisons as proof of fraud." /><div className="quark-risk-demo"><div className="quark-risk-box"><span>Review posture</span><strong>Human</strong><p>Evidence remains central</p></div><div className="quark-risk-reasons"><h3>Available review signals</h3><div className="quark-reason"><strong>Numeric context</strong><p>IsolationForest-based context highlights records that warrant a closer look.</p></div><div className="quark-reason"><strong>Semantic similarity</strong><p>Sentence-transformer comparison identifies candidate language overlap for corroboration.</p></div><div className="quark-reason"><strong>Allocation variance</strong><p>Public allocation patterns provide peer context, not project-level verified outcomes.</p></div></div></div></div></section>
    <section className="quark-content-section quark-light" id="analytics"><div className="quark-container"><SectionHeading label="Analytics" title="Review context that stays explainable" text="The authenticated workspace provides current project, alert, allocation, and model-operation views with their source and interpretation boundaries." /><div className="quark-analytics-grid"><div className="quark-chart-card"><h3>Review workflow coverage</h3><Bar label="Import validation" value="100%" width="100%" /><Bar label="Evidence rationale" value="100%" width="100%" /><Bar label="Human action trail" value="100%" width="100%" /></div><div className="quark-chart-card"><h3>Signal interpretation</h3><div className="quark-risk-summary"><div><strong>Context</strong><span>Not proof</span></div><div><strong>Review</strong><span>Required</span></div><div><strong>Evidence</strong><span>Preserved</span></div></div></div></div></div></section>
    <section className="quark-content-section" id="personas"><div className="quark-container"><SectionHeading label="User personas" title="Role-specific access without hidden conclusions" text="Every workspace interaction is designed around authorised human responsibility." /><div className="quark-persona-grid"><Persona icon={<Users />} title="Administrator" text="Manages analysts, authorised imports, audit runs, and model operations." /><Persona icon={<ClipboardCheck />} title="Reviewer" text="Assesses transparent evidence and records an accountable review action." /><Persona icon={<Database />} title="Viewer" text="Consults permitted project context without changing case decisions." /></div></div></section>
    <section className="quark-content-section quark-light" id="reports"><div className="quark-container"><SectionHeading label="Reports & documentation" title="Use the system with its limits in view" text="Supporting guides are included alongside the secured FastAPI workflow." /><div className="quark-report-list"><Report icon={<FileText />} title="User guide" text="Administrator onboarding, import validation, audit review, allocation context, and model interpretation." href="https://github.com/d1ranjan/mplad-guardian-fastapi/blob/main/docs/user-guide.md" /><Report icon={<ClipboardCheck />} title="Presentation runbook" text="A responsible sequence for the fictional presentation dataset and public allocation context." href="https://github.com/d1ranjan/mplad-guardian-fastapi/blob/main/docs/presentation-runbook.md" /><Report icon={<Globe2 />} title="FastAPI OpenAPI documentation" text="Inspect the protected API contract and service endpoints." href={apiDocsUrl()} /></div></div></section>
    <section className="quark-contact-section" id="contact"><div className="quark-container quark-contact-grid"><div><span className="quark-section-label">Secure analyst access</span><h2>Enter the MPLAD monitoring workspace.</h2><p>Sign in with your assigned analyst credentials. The first-administrator option is available only before an account exists. Never share a password or token in chat.</p></div><AccessForm {...{ mode, setMode, name, email, password, setName, setEmail, setPassword, authenticate, busy }} /></div></section>
  </>;
}

function AccessForm({ mode, setMode, name, email, password, setName, setEmail, setPassword, authenticate, busy }: { mode: "login" | "bootstrap"; setMode: (mode: "login" | "bootstrap") => void; name: string; email: string; password: string; setName: (value: string) => void; setEmail: (value: string) => void; setPassword: (value: string) => void; authenticate: (event: React.FormEvent) => Promise<void>; busy: boolean }) {
  const field = (label: string, type: string, value: string, update: (value: string) => void, minLength?: number) => <label className="quark-login-field">{label}<input type={type} required value={value} minLength={minLength} onChange={event => update(event.target.value)} /></label>;
  return <form id="secure-access" onSubmit={authenticate} className="quark-login-card"><div className="quark-login-tabs"><button type="button" onClick={() => setMode("login")} className={mode === "login" ? "active" : ""}>Sign in</button><button type="button" onClick={() => setMode("bootstrap")} className={mode === "bootstrap" ? "active" : ""}>First administrator</button></div><h3>{mode === "bootstrap" ? "Initialize secure access" : "Analyst sign in"}</h3><p>{mode === "bootstrap" ? "One-time PostgreSQL administrator setup." : "Use your assigned JWT-backed analyst account."}</p>{mode === "bootstrap" && field("Full name", "text", name, setName)}{field("Email", "email", email, setEmail)}{field("Password", "password", password, setPassword, 12)}<button disabled={busy} className="quark-login-submit">{mode === "bootstrap" ? <UserPlus /> : <LogIn />}{busy ? "Working…" : mode === "bootstrap" ? "Create administrator" : "Sign in"}</button></form>;
}

function FeatureCard({ icon, title, text, href }: { icon: React.ReactNode; title: string; text: string; href: string }) { return <Link href={href} className="quark-service-card"><span className="quark-service-icon">{icon}</span><h3>{title}</h3><p>{text}</p><span>Open service <ArrowRight /></span></Link>; }
function Persona({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="quark-persona-card"><span className="quark-persona-icon">{icon}</span><h3>{title}</h3><p>{text}</p></div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="quark-stat-card"><strong>{value}</strong><span>{label}</span></div>; }
function Bar({ label, value, width }: { label: string; value: string; width: string }) { return <div className="quark-bar"><div><span>{label}</span><strong>{value}</strong></div><div className="quark-bar-track"><span style={{ width }} /></div></div>; }
function Report({ icon, title, text, href }: { icon: React.ReactNode; title: string; text: string; href: string }) { return <a className="quark-report-item" href={href} target="_blank" rel="noreferrer"><span>{icon}</span><div><h3>{title}</h3><p>{text}</p></div><span className="quark-report-button">View</span></a>; }
function SectionHeading({ label, title, text, inverse = false }: { label: string; title: string; text: string; inverse?: boolean }) { return <div className={`quark-section-heading ${inverse ? "inverse" : ""}`}><span>{label}</span><h2>{title}</h2><p>{text}</p></div>; }

function QuarkSplash({ visible, stage }: { visible: boolean; stage: number }) { return visible ? <div className={`quark-splash ${stage === 4 ? "quark-splash-exit" : ""}`} aria-hidden="true"><div className={`quark-splash-content stage-${stage}`}><div className="quark-splash-emblem"><Landmark /></div><div className="quark-splash-text"><span>Government of India</span><strong>MPLAD</strong><span>Guardian</span></div></div></div> : null; }

function QuarkFooter() { return <footer className="quark-footer"><div className="quark-container quark-footer-grid"><div><h3>MPLAD Guardian</h3><p>Evidence-led audit intelligence for accountable public-project review. Review signals are not findings of fraud or wrongdoing.</p></div><div><h4>Important links</h4><a href="/#introduction">About the platform</a><a href="/#risk-detection">Responsible AI use</a><a href="/#secure-access">Secure access</a></div><div><h4>Government resources</h4><a href="https://mplads.mospi.gov.in/digigov/dashboard.html" target="_blank" rel="noreferrer">MPLADS dashboard</a><a href={apiDocsUrl()} target="_blank" rel="noreferrer">API documentation</a></div></div><div className="quark-footer-bottom">© MPLAD Guardian · SIH26102 audit-intelligence project</div></footer>; }

function WorkspaceRoute({ path, alertId, allocationId, token, user, projects, alerts, busy, onRunAudit, onHydrate, setStatus }: { path: string; alertId?: string; allocationId?: string; token: string; user: GuardianUser; projects: GuardianProject[]; alerts: GuardianAlert[]; busy: boolean; onRunAudit: () => Promise<void>; onHydrate: () => Promise<void>; setStatus: (value: string) => void }) {
  const frame = (kind: string, content: React.ReactNode) => <div className={`quark-workflow-page ${kind}`}>{content}</div>;
  if (alertId) return frame("quark-alert-case-page", <AlertCaseView id={alertId} token={token} user={user} onHydrate={onHydrate} setStatus={setStatus} />);
  if (allocationId) return frame("quark-allocation-case-page", <AllocationCaseView id={allocationId} token={token} />);
  if (path === "/projects") return frame("quark-projects-page", <ProjectsView projects={projects} />);
  if (path === "/imports") return frame("quark-imports-page", <ImportsView token={token} user={user} onHydrate={onHydrate} setStatus={setStatus} />);
  if (path === "/alerts") return frame("quark-alerts-page", <AlertsView alerts={alerts} />);
  if (path === "/allocation") return frame("quark-allocation-page", <AllocationView token={token} user={user} />);
  if (path === "/models") return frame("quark-models-page", <ModelsView token={token} user={user} projects={projects} />);
  if (path === "/team") return frame("quark-analysts-page", <TeamView token={token} user={user} />);
  return frame("quark-overview-page", <DashboardView user={user} projects={projects} alerts={alerts} busy={busy} onRunAudit={onRunAudit} />);
}
