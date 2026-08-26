import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import NotFound from "./pages/NotFound";

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
    <Route path="/"><Workspace><Dashboard /></Workspace></Route>
    <Route path="/alerts"><Workspace><AlertQueue /></Workspace></Route>
    <Route path="/alerts/:id"><Workspace><AlertCase /></Workspace></Route>
    <Route path="/projects"><Workspace><Projects /></Workspace></Route>
    <Route path="/imports"><Workspace><Imports /></Workspace></Route>
    <Route path="/allocation"><Workspace><AllocationContext /></Workspace></Route>
    <Route path="/allocation/:id"><Workspace><AllocationCase /></Workspace></Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
