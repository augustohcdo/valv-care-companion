import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { TrustBadges } from "./TrustBadges";
import { ShieldCheck, BookOpen, FileText } from "lucide-react";

export const PublicFooter = () => {
  return (
    <footer className="border-t border-border bg-secondary/40 mt-24">
      <div className="container-vp py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              Apoio educacional, organização de casos e suporte à discussão clínica em doenças valvares cardíacas.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              ValvePath é uma ferramenta de apoio. Não substitui avaliação médica, diagnóstico ou prescrição.
            </p>
          </div>

          <div>
            <h4 className="font-display font-semibold text-sm text-foreground mb-3">Para pacientes</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/aprender" className="text-muted-foreground hover:text-primary">Aprender sobre válvulas</Link></li>
              <li><Link to="/aprender/doencas" className="text-muted-foreground hover:text-primary">Doenças valvares</Link></li>
              <li><Link to="/aprender/exames" className="text-muted-foreground hover:text-primary">Exames</Link></li>
              <li><Link to="/aprender/jornada" className="text-muted-foreground hover:text-primary">Jornada do paciente</Link></li>
              <li><Link to="/aprender/glossario" className="text-muted-foreground hover:text-primary">Glossário</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-sm text-foreground mb-3">Para médicos</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/medicos" className="text-muted-foreground hover:text-primary">Plataforma médica</Link></li>
              <li><Link to="/biblioteca" className="text-muted-foreground hover:text-primary">Biblioteca clínica</Link></li>
              <li><Link to="/referencias" className="text-muted-foreground hover:text-primary">Referências e diretrizes</Link></li>
              <li><Link to="/auth/cadastro?type=medico" className="text-muted-foreground hover:text-primary">Cadastro profissional</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-sm text-foreground mb-3">Confiança e legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/seguranca" className="text-muted-foreground hover:text-primary flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Segurança e privacidade</Link></li>
              <li><Link to="/termos" className="text-muted-foreground hover:text-primary flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Termos de uso</Link></li>
              <li><Link to="/privacidade" className="text-muted-foreground hover:text-primary flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Política de privacidade</Link></li>
              <li><Link to="/cookies" className="text-muted-foreground hover:text-primary flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Política de cookies</Link></li>
              <li><Link to="/aviso-medico" className="text-muted-foreground hover:text-primary flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Aviso médico</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border space-y-4">
          <TrustBadges />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} ValvePath. Versão de demonstração — não inserir dados reais de pacientes.
            </p>
            <span className="text-xs text-muted-foreground">Baseado em diretrizes ESC/EACTS e ACC/AHA</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
