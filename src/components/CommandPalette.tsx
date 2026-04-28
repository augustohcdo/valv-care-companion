import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Activity,
  BookOpen,
  Calendar,
  FilePlus2,
  FileText,
  HeartPulse,
  Pill,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
  UsersRound,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PALETTE_EVENT = "valvepath:open-command-palette";

export function CommandPaletteTrigger() {
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <Button
      variant="outline"
      size="sm"
      className="hidden md:inline-flex h-9 px-2.5 gap-2 text-muted-foreground"
      onClick={() => window.dispatchEvent(new Event(PALETTE_EVENT))}
    >
      <Search className="h-3.5 w-3.5" />
      <span className="text-xs">Buscar...</span>
      <kbd className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">
        {isMac ? "⌘" : "Ctrl"} K
      </kbd>
    </Button>
  );
}

interface SearchResult {
  result_type: string;
  result_id: string;
  title: string;
  subtitle: string | null;
  link: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isDoctor = profile?.account_type === "medico";

  // ⌘K / Ctrl+K + evento custom para botões
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const evt = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener(PALETTE_EVENT, evt);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener(PALETTE_EVENT, evt);
    };
  }, []);

  // Busca server-side com debounce
  useEffect(() => {
    if (!user || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_global", {
        _query: query.trim(),
        _user_id: user.id,
      });
      setResults((data as SearchResult[]) ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [query, user]);

  const go = (link: string) => {
    setOpen(false);
    setQuery("");
    navigate(link);
  };

  const doctorShortcuts = [
    { label: "Novo caso clínico", icon: FilePlus2, link: "/app/medico/casos/novo" },
    { label: "Lista de casos", icon: FileText, link: "/app/medico/casos" },
    { label: "Pacientes", icon: Users, link: "/app/medico/pacientes" },
    { label: "Agenda", icon: Calendar, link: "/app/medico/agenda" },
    { label: "Colaborações", icon: UsersRound, link: "/app/medico/colaboracoes" },
    { label: "Relatórios", icon: BarChart3, link: "/app/medico/relatorios" },
    { label: "Biblioteca", icon: BookOpen, link: "/app/medico/biblioteca" },
  ];
  const patientShortcuts = [
    { label: "Minha jornada", icon: HeartPulse, link: "/app/paciente/jornada" },
    { label: "Diário de sintomas", icon: Activity, link: "/app/paciente/diario" },
    { label: "Medicações", icon: Pill, link: "/app/paciente/medicacoes" },
    { label: "Meu médico", icon: Stethoscope, link: "/app/paciente/medico" },
    { label: "Documentos", icon: FileText, link: "/app/paciente/documentos" },
    { label: "Aprender", icon: BookOpen, link: "/app/paciente/aprender" },
  ];
  const shortcuts = isDoctor ? doctorShortcuts : patientShortcuts;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar pacientes, casos, atalhos..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {results.length > 0 && (
          <>
            <CommandGroup heading="Resultados">
              {results.map((r) => {
                const Icon = r.result_type === "case" ? FileText : Users;
                return (
                  <CommandItem
                    key={`${r.result_type}-${r.result_id}`}
                    onSelect={() => go(r.link)}
                    value={`${r.title} ${r.subtitle ?? ""}`}
                  >
                    <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm">{r.title}</p>
                      {r.subtitle && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {r.subtitle}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Ir para">
          {shortcuts.map((s) => {
            const Icon = s.icon;
            return (
              <CommandItem
                key={s.link}
                onSelect={() => go(s.link)}
                value={s.label}
              >
                <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
                {s.label}
              </CommandItem>
            );
          })}
          <CommandItem onSelect={() => go("/app/privacidade")} value="Privacidade LGPD">
            <ShieldCheck className="h-4 w-4 mr-2 text-muted-foreground" />
            Privacidade e LGPD
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
