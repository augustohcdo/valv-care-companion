import { useState } from "react";
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

export const PublicHeader = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, profile } = useAuth();
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
          className="md:hidden p-2 -mr-2 text-foreground"
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
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setOpen(false)}
                  className="px-3 py-3 text-sm font-medium rounded-md text-foreground hover:bg-secondary active:bg-secondary/80 min-h-[44px] flex items-center"
                >
                  {link.label}
                </Link>
              ))}
              <div className="border-t border-border my-2" />
              <Link to="/auth/login?type=medico" onClick={() => setOpen(false)} className="px-3 py-3 text-sm font-medium rounded-md text-foreground hover:bg-secondary active:bg-secondary/80 min-h-[44px] flex items-center">
                Login médico
              </Link>
              <Link to="/auth/login?type=paciente" onClick={() => setOpen(false)} className="px-3 py-3 text-sm font-medium rounded-md text-foreground hover:bg-secondary active:bg-secondary/80 min-h-[44px] flex items-center">
                Login paciente
              </Link>
              <Button asChild variant="hero" className="mt-2 min-h-[44px]">
                <Link to="/auth/cadastro" onClick={() => setOpen(false)}>Criar conta</Link>
              </Button>
            </div>
          </div>
        </>
      )}
    </header>
  );
};
