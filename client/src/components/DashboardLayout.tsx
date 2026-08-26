import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Activity, BrainCircuit, Database, FileUp, FolderSearch, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";

const navigation = [
  { label: "Command centre", path: "/", icon: LayoutDashboard },
  { label: "Alert queue", path: "/alerts", icon: Activity },
  { label: "Project register", path: "/projects", icon: FolderSearch },
  { label: "Allocation context", path: "/allocation", icon: BrainCircuit },
  { label: "Data import", path: "/imports", icon: FileUp },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, loading, logout } = useAuth();
  const active = navigation.find(item => item.path === location) ?? navigation[0]!;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-slate-200/80 bg-[#0b1f33] text-slate-100">
        <SidebarHeader className="h-[88px] justify-center px-3">
          <div className="flex items-center gap-3 overflow-hidden px-2">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-[#10283f] shadow-lg shadow-black/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="font-display text-[17px] font-semibold tracking-tight text-white">MPLAD Guardian</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-sky-200/70">Audit intelligence</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-3 pt-3">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 group-data-[collapsible=icon]:hidden">Workspace</p>
          <SidebarMenu className="gap-1">
            {navigation.map(item => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  isActive={location === item.path}
                  tooltip={item.label}
                  onClick={() => setLocation(item.path)}
                  className="h-11 rounded-xl text-slate-300 transition-all hover:bg-white/10 hover:text-white data-[active=true]:bg-white data-[active=true]:font-medium data-[active=true]:text-[#10283f]"
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="mx-2 mt-7 rounded-xl border border-sky-200/10 bg-white/[0.045] p-3 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2 text-sky-200"><Database className="h-3.5 w-3.5" /><span className="text-[11px] font-semibold">Synthetic demo workspace</span></div>
            <p className="mt-2 text-xs leading-5 text-slate-400">Findings are review priorities with preserved evidence, not allegations.</p>
          </div>
        </SidebarContent>
        <SidebarFooter className="border-t border-white/10 p-3">
          {loading ? <div className="h-10 animate-pulse rounded-xl bg-white/10" /> : user ? (
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
              <Avatar className="h-9 w-9 border border-white/10"><AvatarFallback className="bg-sky-100 text-xs font-semibold text-[#15324f]">{user.name?.slice(0, 1).toUpperCase() ?? "A"}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-medium text-white">{user.name ?? "Analyst"}</p><p className="mt-0.5 text-[10px] capitalize text-slate-400">{user.role} reviewer</p></div>
              <button onClick={logout} aria-label="Sign out" className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:hidden"><LogOut className="h-4 w-4" /></button>
            </div>
          ) : (
            <Button onClick={() => startLogin()} className="h-10 w-full rounded-xl bg-white text-xs font-semibold text-[#10283f] hover:bg-sky-50 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:px-0" variant="secondary"><ShieldCheck className="h-4 w-4" /><span className="group-data-[collapsible=icon]:hidden">Sign in to review</span></Button>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-transparent">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200/70 bg-[#f7f5f0]/85 px-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3"><SidebarTrigger className="rounded-lg text-slate-500 hover:bg-slate-200/70" /><div><p className="text-sm font-semibold text-slate-900">{active.label}</p><p className="hidden text-xs text-slate-500 sm:block">Explainable project-risk review</p></div></div>
          <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Evidence-first workflow</div>
        </header>
        <main className="min-h-[calc(100vh-72px)] p-4 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
