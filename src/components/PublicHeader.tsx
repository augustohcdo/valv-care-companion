import { useState, useCallback, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown, LayoutDashboard } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    Entrar <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link to="/auth/login?type=medico">Sou médico</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/auth/login?type=paciente">Sou paciente</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button asChild variant="hero" size="sm">
                <Link to="/auth/cadastro">Criar conta</Link>
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
              <a href="/auth/login?type=medico" onClick={go("/auth/login?type=medico", () => setOpen(false))} className="px-3 py-3 text-sm font-medium rounded-md text-foreground hover:bg-secondary active:bg-secondary/80 min-h-[44px] flex items-center select-none">
                Login médico
              </a>
              <a href="/auth/login?type=paciente" onClick={go("/auth/login?type=paciente", () => setOpen(false))} className="px-3 py-3 text-sm font-medium rounded-md text-foreground hover:bg-secondary active:bg-secondary/80 min-h-[44px] flex items-center select-none">
                Login paciente
              </a>
              <Button asChild variant="hero" className="mt-2 min-h-[44px]">
                <a href="/auth/cadastro" onClick={go("/auth/cadastro", () => setOpen(false))}>Criar conta</a>
              </Button>
            </div>
          </div>
        </>
      )}
    </header>
  );
};
