import { PageHeader } from "@/components/PageHeader";
import { TrustBadges } from "@/components/TrustBadges";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import {
  ShieldCheck, Lock, Eye, FileKey, Database, UserCheck, Download, Trash2,
  AlertCircle, KeyRound, ServerCog, Users, FileSignature, ArrowRight, HeartPulse, BookOpen,
} from "lucide-react";

const purpose = [
  {
    icon: HeartPulse,
    title: "Apoio clínico, não substituição",
    desc: "ValvePath organiza casos de doença valvar, apoia decisão e educa — mas a decisão sempre é do médico.",
  },
  {
    icon: Users,
    title: "Médico e paciente conectados",
    desc: "Um espaço seguro para o cardiologista acompanhar e o paciente entender sua jornada.",
  },
  {
    icon: BookOpen,
    title: "Educação baseada em diretrizes",
    desc: "Conteúdo derivado das diretrizes ESC/EACTS e ACC/AHA, em linguagem para cada perfil.",
  },
];

const measures = [
  { icon: Lock, title: "Criptografia em trânsito e em repouso", desc: "TLS 1.2+ no transporte e criptografia gerenciada no armazenamento." },
  { icon: KeyRound, title: "Senhas verificadas (HIBP)", desc: "Bloqueamos senhas que apareceram em vazamentos públicos via Have I Been Pwned." },
  { icon: ShieldCheck, title: "Row-Level Security (RLS)", desc: "Toda tabela clínica tem políticas que isolam dados por usuário, vínculo e papel." },
  { icon: UserCheck, title: "Papéis segregados", desc: "Médico, paciente e admin com permissões distintas em tabela dedicada — sem escalada de privilégio." },
  { icon: FileKey, title: "Vínculo médico-paciente autorizado", desc: "A conexão exige aceite. O paciente vê e revoga o vínculo a qualquer momento." },
  { icon: Database, title: "Minimização de dados", desc: "Coletamos apenas o estritamente necessário para a função clínica e educacional." },
  { icon: Eye, title: "Trilha de auditoria", desc: "Consentimentos, vínculos e alterações relevantes ficam registrados de forma imutável." },
  { icon: ServerCog, title: "Realtime restrito", desc: "Eventos em tempo real só chegam ao usuário dono do canal — não há vazamento por canais." },
];

const rights = [
  { icon: Eye, title: "Acesso", desc: "Veja todos os seus dados pessoais e clínicos no app." },
  { icon: Download, title: "Portabilidade", desc: "Exporte seu prontuário ou histórico em PDF/CSV a qualquer momento." },
  { icon: FileSignature, title: "Consentimento granular", desc: "Aceite ou revogue cada finalidade de tratamento de forma independente." },
  { icon: Trash2, title: "Eliminação", desc: "Solicite a exclusão definitiva da conta com o Encarregado de Dados (DPO)." },
];

const Seguranca = () => {
  return (
    <>
      <PageHeader
        eyebrow="Confiança e proteção"
        title="Segurança, privacidade e LGPD"
        description="Por que ValvePath existe, como tratamos dados de saúde e o que você controla."
      />

      <section className="container-vp pt-10">
        <TrustBadges variant="grid" />
      </section>

      {/* Intuito do app */}
      <section className="container-vp py-12">
        <h2 className="font-display text-2xl font-semibold text-foreground mb-6">Por que existimos</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {purpose.map((p) => (
            <Card key={p.title} className="p-6 card-elevated">
              <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display font-semibold text-base text-foreground mb-1.5">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Medidas técnicas */}
      <section className="container-vp pb-12">
        <h2 className="font-display text-2xl font-semibold text-foreground mb-2">Como protegemos seus dados</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
          Aplicamos defesa em profundidade: regras no banco, validações no servidor e UX que evita exposição acidental.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {measures.map((it) => (
            <Card key={it.title} className="p-6 card-elevated">
              <div className="h-11 w-11 rounded-lg bg-success/15 text-success flex items-center justify-center mb-3">
                <it.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display font-semibold text-base text-foreground mb-1.5">{it.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Direitos LGPD */}
      <section className="container-vp pb-12">
        <h2 className="font-display text-2xl font-semibold text-foreground mb-2">Seus direitos sob a LGPD</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
          A Lei 13.709/2018 garante a você o controle dos seus dados pessoais. No ValvePath, eles estão a um clique.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {rights.map((r) => (
            <Card key={r.title} className="p-5">
              <div className="h-10 w-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center mb-3">
                <r.icon className="h-4 w-4" />
              </div>
              <h3 className="font-display font-semibold text-sm text-foreground mb-1">{r.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
            </Card>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/app/privacidade"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Gerenciar meus consentimentos <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="mailto:dpo@valvepath.com"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Falar com o DPO (dpo@valvepath.com)
          </a>
        </div>
      </section>

      {/* Bases legais */}
      <section className="container-vp pb-12">
        <Card className="p-6 bg-secondary/40">
          <h3 className="font-display font-semibold text-base text-foreground mb-3">
            Bases legais e finalidades (Art. 7º e 11 da LGPD)
          </h3>
          <ul className="text-sm text-foreground/85 space-y-2 leading-relaxed">
            <li>• <strong>Consentimento:</strong> compartilhamento médico-paciente, comunicações por e-mail, processamento por IA clínica.</li>
            <li>• <strong>Tutela da saúde (Art. 11, II, "f"):</strong> registro e organização de informações clínicas pelo profissional habilitado.</li>
            <li>• <strong>Execução de contrato:</strong> manutenção de conta, autenticação e funcionalidades essenciais da plataforma.</li>
            <li>• <strong>Cumprimento de obrigação legal:</strong> retenção mínima exigida por normas sanitárias e regulatórias aplicáveis.</li>
          </ul>
        </Card>
      </section>

      {/* Aviso da versão */}
      <section className="container-vp pb-16">
        <Card className="p-6 border-warning/30 bg-warning/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display font-semibold text-base text-foreground mb-1.5">
                Aviso desta versão de demonstração
              </h3>
              <p className="text-sm text-foreground/85 leading-relaxed">
                Esta é uma versão em validação. A infraestrutura segue boas práticas de segurança, porém recomendamos
                <strong> não inserir dados reais identificáveis de pacientes </strong>
                antes do go-live oficial. Use dados fictícios para testes e demonstrações.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </>
  );
};

export default Seguranca;
