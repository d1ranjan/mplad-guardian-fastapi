import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Router as WouterRouter, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import NotFound from "./pages/NotFound";
import FastApiWorkspace from "./pages/FastApiWorkspace";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const AlertQueue = lazy(() => import("./pages/AlertQueue"));
const AlertCase = lazy(() => import("./pages/AlertCase"));
const Projects = lazy(() => import("./pages/Projects"));
const Imports = lazy(() => import("./pages/Imports"));
const AllocationContext = lazy(() => import("./pages/AllocationContext"));
const AllocationCase = lazy(() => import("./pages/AllocationCase"));

function Workspace({ children }: { children: React.ReactNode }) {
  return <DashboardLayout><Suspense fallback={<div className="mx-auto max-w-[1440px] p-8 text-sm text-slate-500">Preparing audit workspace…</div>}>{children}</Suspense></DashboardLayout>;
}

function Router() {
  return <Switch>
    <Route path="/" component={FastApiWorkspace} />
    <Route path="/alerts" component={FastApiWorkspace} />
    <Route path="/alerts/:id" component={FastApiWorkspace} />
    <Route path="/projects" component={FastApiWorkspace} />
    <Route path="/imports" component={FastApiWorkspace} />
    <Route path="/allocation" component={FastApiWorkspace} />
    <Route path="/allocation/:id" component={FastApiWorkspace} />
    <Route path="/models" component={FastApiWorkspace} />
    <Route path="/team" component={FastApiWorkspace} />
    <Route path="/contact" component={FastApiWorkspace} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
  return <WouterRouter base={base}><ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary></WouterRouter>;
}
