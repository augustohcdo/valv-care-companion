import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  FilePlus2,
  BookOpen,
  User,
  LogOut,
  Menu,
  X,
  HeartPulse,
  Stethoscope,
  FileText,
  Calendar,
  UsersRound,
  Activity,
  Pill,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { NotificationsBell } from "@/components/NotificationsBell";
import { CommandPalette, CommandPaletteTrigger } from "@/components/CommandPalette";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ExportQueueDock } from "@/components/ExportQueueDock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const doctorNav = [
  { to: "/app/medico", label: "Início", icon: LayoutDashboard, exact: true },
  { to: "/app/medico/pacientes", label: "Pacientes", icon: Users },
  { to: "/app/medico/casos", label: "Casos clínicos", icon: FileText },
  { to: "/app/medico/casos/novo", label: "Novo caso", icon: FilePlus2 },
  { to: "/app/medico/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/medico/colaboracoes", label: "Colaborações", icon: UsersRound },
  { to: "/app/medico/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/app/medico/biblioteca", label: "Biblioteca", icon: BookOpen },
  { to: "/app/medico/perfil", label: "Perfil", icon: User },
];

const patientNav = [
  { to: "/app/paciente", label: "Início", icon: LayoutDashboard, exact: true },
  { to: "/app/paciente/jornada", label: "Minha jornada", icon: HeartPulse },
  { to: "/app/paciente/diario", label: "Diário", icon: Activity },
  { to: "/app/paciente/medicacoes", label: "Medicações", icon: Pill },
  { to: "/app/paciente/medico", label: "Meu médico", icon: Stethoscope },
  { to: "/app/paciente/documentos", label: "Documentos", icon: FileText },
  { to: "/app/paciente/aprender", label: "Aprender", icon: BookOpen },
  { to: "/app/paciente/perfil", label: "Perfil", icon: User },
];

// Prefetch da chunk da rota ao passar o mouse no link
const routeLoader: Record<string, () => Promise<unknown>> = {
  "/app/medico": () => import("@/pages/app/MedicoHome"),
  "/app/medico/pacientes": () => import("@/pages/app/MedicoPacientes"),
  "/app/medico/casos": () => import("@/pages/app/ListaCasos"),
  "/app/medico/casos/novo": () => import("@/pages/app/NovoCaso"),
  "/app/medico/agenda": () => import("@/pages/app/MedicoAgenda"),
  "/app/medico/colaboracoes": () => import("@/pages/app/MedicoColaboracoes"),
  "/app/medico/relatorios": () => import("@/pages/app/MedicoRelatorios"),
  "/app/medico/biblioteca": () => import("@/pages/app/Biblioteca"),
  "/app/medico/perfil": () => import("@/pages/app/MedicoPerfil"),
  "/app/paciente": () => import("@/pages/app/PacienteHome"),
  "/app/paciente/jornada": () => import("@/pages/app/PacienteJornada"),
  "/app/paciente/diario": () => import("@/pages/app/PacienteDiario"),
  "/app/paciente/medicacoes": () => import("@/pages/app/PacienteMedicacoes"),
  "/app/paciente/medico": () => import("@/pages/app/PacienteMedico"),
  "/app/paciente/documentos": () => import("@/pages/app/PacienteDocumentos"),
  "/app/paciente/aprender": () => import("@/pages/app/PacienteAprender"),
  "/app/paciente/perfil": () => import("@/pages/app/PacientePerfil"),
};

const prefetched = new Set<string>();
const prefetch = (to: string) => {
  if (prefetched.has(to)) return;
  const loader = routeLoader[to];
  if (loader) {
    prefetched.add(to);
    loader().catch(() => prefetched.delete(to));
  }
};

export const AppLayout = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isDoctor = profile?.account_type === "medico";
  const nav = isDoctor ? doctorNav : patientNav;

  const handleLogout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const initials =
    profile?.full_name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "VP";

  return (
    <div className="min-h-screen bg-secondary/30 flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card sticky top-0 h-screen">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Logo />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onMouseEnter={() => prefetch(item.to)}
                onFocus={() => prefetch(item.to)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm-soft"
                    : "text-foreground hover:bg-secondary hover:translate-x-0.5"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-0.5">
              {isDoctor ? "Área médica" : "Área do paciente"}
            </p>
            ValvePath não realiza diagnóstico. Conteúdo é apoio educativo.
          </div>
        </div>
      </aside>

      {/* Sidebar mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex animate-fade-in">
          <div className="w-72 bg-card flex flex-col animate-slide-in-right">
            <div className="h-16 flex items-center justify-between px-4 border-b border-border">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="p-2 rounded-md hover:bg-secondary transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = item.exact
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div
            className="flex-1 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card/90 backdrop-blur border-b border-border flex items-center px-4 lg:px-8 gap-3 sticky top-0 z-40">
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="lg:hidden p-2 -ml-2 rounded-md hover:bg-secondary transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden"><Logo /></div>
          <div className="flex-1" />

          <CommandPaletteTrigger />
          <NotificationsBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 hover:bg-secondary px-2 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="h-8 w-8 rounded-full bg-gradient-hero text-primary-foreground grid place-items-center text-xs font-semibold shadow-sm-soft">
                  {initials}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-foreground leading-tight">
                    {profile?.full_name || "Usuário"}
                  </p>
                  <p className="text-[11px] text-muted-foreground capitalize">{profile?.account_type}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Conta</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link to={isDoctor ? "/app/medico/perfil" : "/app/paciente/perfil"}>
                  <User className="h-4 w-4 mr-2" /> Meu perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/app/privacidade">
                  <ShieldCheck className="h-4 w-4 mr-2" /> Privacidade e LGPD
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main
          key={location.pathname}
          className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8 animate-fade-in"
        >
          <Outlet />
        </main>
      </div>

      {/* Bottom nav só aparece em mobile/tablet */}
      <MobileBottomNav variant={isDoctor ? "medico" : "paciente"} />

      <CommandPalette />
    </div>
  );
};
