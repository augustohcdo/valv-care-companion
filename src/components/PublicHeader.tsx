import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, LayoutDashboard, Stethoscope } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedNav } from "@/hooks/useDebouncedNav";

export const PublicHeader = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, profile } = useAuth();
  const go = useDebouncedNav();
  const dashboardPath = profile?.account_type === "medico" ? "/app/medico" : "/app/paciente";

  const navLinks = [
    { label: "Para médicos", href: "/medicos" },
    { label: "Para pacientes", href: "/aprender" },
    { label: "Segurança", href: "/seguranca" },
    { label: "Base científica", href: "/referencias" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="container-vp flex h-16 items-center justify-between">
        <Logo />

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors hover:text-primary hover:bg-secondary ${
                location.pathname === link.href ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <Button asChild variant="hero" size="sm" className="gap-2">
              <Link to={dashboardPath}>
                <LayoutDashboard className="h-4 w-4" /> Meu painel
              </Link>
            </Button>
          ) : (
            <>
              {/* Um botão só: as duas opções do menu antigo ("Sou médico" /
                  "Sou paciente") levavam à mesma tela de login. Ramo decorativo
                  ensina a pessoa a desconfiar do menu. */}
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth/login">Entrar</Link>
              </Button>
              {/* O caminho do médico em toda página: antes existia só abaixo da
                  dobra da home, no rodapé e dentro do login. */}
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link to="/medicos#solicitar">
                  <Stethoscope className="h-4 w-4" /> Acesso profissional
                </Link>
              </Button>
              <Button asChild variant="hero" size="sm">
                {/* Um filho só: o botão é flex com `gap`, então rótulo partido
                    em dois nós ganha o espaço do gap além do espaço do texto. */}
                <Link to="/auth/cadastro">
                  <span>Criar conta<span className="hidden lg:inline"> de paciente</span></span>
                </Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2 -mr-2 text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          />
          {/* Drawer */}
          <div className="md:hidden fixed inset-x-0 top-16 z-50 bg-background border-b border-border shadow-lg-soft animate-fade-in max-h-[70vh] overflow-y-auto">
            <div className="container-vp py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={go(link.href, () => setOpen(false))}
                  className="px-3 py-3 text-sm font-medium rounded-md text-foreground hover:bg-secondary active:bg-secondary/80 min-h-[44px] flex items-center select-none"
                >
                  {link.label}
                </a>
              ))}
              <div className="border-t border-border my-2" />
              <a href="/auth/login" onClick={go("/auth/login", () => setOpen(false))} className="px-3 py-3 text-sm font-medium rounded-md text-foreground hover:bg-secondary active:bg-secondary/80 min-h-[44px] flex items-center select-none">
                Entrar
              </a>
              <Button asChild variant="outline" className="mt-2 min-h-[44px] gap-1.5">
                <a href="/medicos#solicitar" onClick={go("/medicos#solicitar", () => setOpen(false))}>
                  <Stethoscope className="h-4 w-4" /> Acesso profissional
                </a>
              </Button>
              <Button asChild variant="hero" className="mt-2 min-h-[44px]">
                <a href="/auth/cadastro" onClick={go("/auth/cadastro", () => setOpen(false))}>Criar conta de paciente</a>
              </Button>
            </div>
          </div>
        </>
      )}
    </header>
  );
};
