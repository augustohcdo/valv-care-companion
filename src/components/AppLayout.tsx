import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  Globe,
  Users,
  FilePlus2,
  BookOpen,
  FolderLock,
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
  Hospital,
  ShieldAlert,
  BookOpenCheck,
  ScrollText,
  Plug,
  type LucideIcon, UserPlus,
  Calculator,
  PlayCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useDoctor } from "@/hooks/useDoctor";
import { usePatient } from "@/hooks/usePatient";
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

/** Item de menu. O `exact` só existe no "Início", que casaria com tudo sem ele. */
type NavItem = { to: string; label: string; icon: LucideIcon; exact?: boolean };

const doctorNav: NavItem[] = [
  { to: "/app/medico", label: "Início", icon: LayoutDashboard, exact: true },
  { to: "/app/medico/pacientes", label: "Pacientes", icon: Users },
  { to: "/app/medico/casos", label: "Casos clínicos", icon: FileText },
  { to: "/app/medico/casos/novo", label: "Novo caso", icon: FilePlus2 },
  { to: "/app/medico/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/medico/colaboracoes", label: "Colaborações", icon: UsersRound },
  { to: "/app/medico/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/app/medico/biblioteca", label: "Biblioteca", icon: BookOpen },
  { to: "/app/medico/tecnica", label: "Técnica cirúrgica", icon: PlayCircle },
  { to: "/app/medico/ferramentas", label: "Ferramentas", icon: Calculator },
  { to: "/app/medico/perfil", label: "Perfil", icon: User },
];

const patientNav: NavItem[] = [
  { to: "/app/paciente", label: "Início", icon: LayoutDashboard, exact: true },
  { to: "/app/paciente/jornada", label: "Minha jornada", icon: HeartPulse },
  { to: "/app/paciente/diario", label: "Diário", icon: Activity },
  { to: "/app/paciente/medicacoes", label: "Medicações", icon: Pill },
  { to: "/app/paciente/medico", label: "Meu médico", icon: Stethoscope },
  { to: "/app/paciente/encontrar", label: "Encontrar profissional", icon: UserPlus },
  { to: "/app/paciente/documentos", label: "Documentos", icon: FileText },
  { to: "/app/paciente/integracoes", label: "Integrações", icon: Hospital },
  { to: "/app/paciente/aprender", label: "Aprender", icon: BookOpen },
  { to: "/app/paciente/perfil", label: "Perfil", icon: User },
];

/**
 * Telas de administração. Existiam só por URL digitada — e como não havia
 * administrador nenhum no sistema, ninguém nunca as abriu. Um painel que
 * ninguém alcança é o mesmo que não ter painel.
 */
const adminNav: NavItem[] = [
  { to: "/app/admin", label: "Administração", icon: ShieldCheck, exact: true },
  { to: "/app/admin/acessos", label: "Solicitações de acesso", icon: UserPlus },
  { to: "/app/admin/usuarios", label: "Usuários e papéis", icon: Users },
  { to: "/app/admin/conteudo", label: "Revisão de conteúdo", icon: BookOpenCheck },
  { to: "/app/admin/fontes", label: "Fontes da IA", icon: Globe },
  { to: "/app/admin/biblioteca", label: "Biblioteca de referência", icon: BookOpen },
  { to: "/app/admin/arquivos", label: "Arquivos de trabalho", icon: FolderLock },
  { to: "/app/admin/erros", label: "Erros e tarefas", icon: ShieldAlert },
  { to: "/app/admin/dpo", label: "Pedidos LGPD", icon: ScrollText },
  { to: "/app/admin/integracoes", label: "Integrações", icon: Plug },
];

// Prefetch da chunk da rota ao passar o mouse no link
const routeLoader: Record<string, () => Promise<unknown>> = {
  "/app/admin/acessos": () => import("@/pages/app/AdminAcessos"),
  "/app/paciente/encontrar": () => import("@/pages/app/PacienteEncontrar"),
  "/app/medico": () => import("@/pages/app/MedicoHome"),
  "/app/medico/pacientes": () => import("@/pages/app/MedicoPacientes"),
  "/app/medico/casos": () => import("@/pages/app/ListaCasos"),
  "/app/medico/casos/novo": () => import("@/pages/app/NovoCaso"),
  "/app/medico/agenda": () => import("@/pages/app/MedicoAgenda"),
  "/app/medico/colaboracoes": () => import("@/pages/app/MedicoColaboracoes"),
  "/app/medico/relatorios": () => import("@/pages/app/MedicoRelatorios"),
  "/app/medico/biblioteca": () => import("@/pages/app/Biblioteca"),
  "/app/medico/tecnica": () => import("@/pages/app/TecnicaCirurgica"),
  "/app/medico/ferramentas": () => import("@/pages/app/MedicoFerramentas"),
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

  const { isAdmin } = useIsAdmin();
  const { data: medico, isLoading: carregandoMedico } = useDoctor();
  const { data: paciente, isLoading: carregandoPaciente } = usePatient();

  const isDoctor = profile?.account_type === "medico";

  // O papel de administrador é somado ao menu clínico, não trocado por ele:
  // a mesma pessoa pode acompanhar casos e cuidar da plataforma.
  //
  // Mas `account_type` sozinho mente sobre a conta administrativa. O
  // `profiles_account_type_check` só aceita `medico` e `paciente`, então ela é
  // obrigada a se declarar médica — e recebia o menu clínico inteiro, com
  // Pacientes, Casos e Agenda, sem ter registro em `doctors`. Quem entrava via
  // ali só encontrava pedidos para completar um cadastro que não faz sentido.
  //
  // O registro clínico é o que separa os dois casos: um médico recém-cadastrado
  // **ainda não** tem linha em `doctors` e precisa da área clínica para criá-la;
  // a conta administrativa não tem e nunca terá. Por isso a supressão só vale
  // para quem é admin — para todo o resto, nada muda.
  const registroConhecido = isDoctor ? !carregandoMedico : !carregandoPaciente;
  const temRegistroClinico = isDoctor ? !!medico : !!paciente;
  // Enquanto não se sabe, o admin fica sem o menu clínico: é melhor ele
  // aparecer um instante depois do que piscar para quem não deveria vê-lo.
  const mostrarClinico = isAdmin ? registroConhecido && temRegistroClinico : true;

  const nav = [
    ...(mostrarClinico ? (isDoctor ? doctorNav : patientNav) : []),
    ...(isAdmin ? adminNav : []),
  ];

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
      <ExportQueueDock />
    </div>
  );
};
