import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  HeartPulse,
  Activity,
  Pill,
  BookOpen,
  Users,
  FileText,
  Calendar,
  FilePlus2,
} from "lucide-react";
import { useDebouncedNav } from "@/hooks/useDebouncedNav";

const patientItems = [
  { to: "/app/paciente", label: "Início", icon: LayoutDashboard, exact: true },
  { to: "/app/paciente/jornada", label: "Jornada", icon: HeartPulse },
  { to: "/app/paciente/diario", label: "Diário", icon: Activity },
  { to: "/app/paciente/medicacoes", label: "Remédios", icon: Pill },
  { to: "/app/paciente/aprender", label: "Aprender", icon: BookOpen },
];

const doctorItems = [
  { to: "/app/medico", label: "Início", icon: LayoutDashboard, exact: true },
  { to: "/app/medico/pacientes", label: "Pacientes", icon: Users },
  { to: "/app/medico/casos", label: "Casos", icon: FileText },
  { to: "/app/medico/casos/novo", label: "Novo", icon: FilePlus2 },
  { to: "/app/medico/agenda", label: "Agenda", icon: Calendar },
];

interface Props {
  variant: "medico" | "paciente";
}

/**
 * Barra inferior mobile, no estilo iOS, com 5 itens essenciais.
 * Aparece apenas em telas <lg para não competir com a sidebar.
 */
export const MobileBottomNav = ({ variant }: Props) => {
  const location = useLocation();
  const go = useDebouncedNav();
  const items = variant === "medico" ? doctorItems : patientItems;

  return (
    <nav
      aria-label="Navegação rápida"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to) &&
              !(item.to === "/app/medico/casos" && location.pathname.startsWith("/app/medico/casos/novo"));
          return (
            <li key={item.to}>
              <a
                href={item.to}
                onClick={go(item.to)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors select-none ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`h-9 w-12 grid place-items-center rounded-xl transition-colors ${
                    active ? "bg-primary/10" : ""
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="leading-none">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
