import { Link } from "react-router-dom";
import {
  Building2, ShieldCheck, Network, FileCode2, Lock, Activity,
  CheckCircle2, ArrowRight, Mail, Workflow, Eye, KeyRound, ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { CONTACT } from "@/lib/contact";

const Parceiros = () => {
  const subject = encodeURIComponent("[Parceria hospitalar] Interesse em integração FHIR");
  const body = encodeURIComponent(
    `Olá, equipe ValvePath.\n\nGostaríamos de avaliar uma integração com o app.\n\n` +
    `• Instituição:\n• CNPJ:\n• CNES (se houver):\n• Cidade/UF:\n` +
    `• Responsável técnico (nome, CRM/UF):\n• E-mail e telefone do TI:\n` +
    `• Sistema atual (Tasy/MV/Philips/outro):\n• Volume estimado de pacientes/mês:\n\n` +
    `Atenciosamente,`
  );
  const mailto = `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Para hospitais e clínicas"
        title="Integração FHIR com hospitais parceiros"
        description="Compartilhe laudos, exames e evolução clínica com o ValvePath usando o padrão internacional HL7 FHIR R4 — com consentimento granular do paciente, auditoria imutável e conformidade LGPD."
      />

      {/* Hero stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: FileCode2, label: "HL7 FHIR R4", desc: "Padrão da RNDS" },
          { icon: Lock, label: "TLS + HMAC", desc: "Em trânsito e repouso" },
          { icon: Eye, label: "Audit log", desc: "Imutável, 20 anos" },
          { icon: ShieldCheck, label: "LGPD", desc: "Consentimento por paciente" },
        ].map((s) => (
          <Card key={s.label} className="shadow-sm-soft">
            <CardContent className="p-4 text-center">
              <s.icon className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Benefícios */}
      <section>
        <h2 className="text-2xl font-display font-bold text-foreground mb-6">
          Por que integrar com o ValvePath?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-sm-soft">
            <CardHeader>
              <Network className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">Continuidade do cuidado</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Acesse a evolução longitudinal do paciente valvopata: sintomas relatados,
              medicações em uso, exames anteriores e decisões do Heart Team — tudo no contexto
              do atendimento atual.
            </CardContent>
          </Card>
          <Card className="shadow-sm-soft">
            <CardHeader>
              <Activity className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">Laudos sem fricção</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Envie laudos de eco, cateterismo, RM cardíaca e altas hospitalares como recursos
              FHIR. O paciente vê na timeline; o cardiologista vinculado é notificado em tempo real.
            </CardContent>
          </Card>
          <Card className="shadow-sm-soft">
            <CardHeader>
              <ShieldCheck className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">Conformidade pronta</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              LGPD (Art. 7º, V e Art. 11), CFM 2.314/2022 (telemedicina), Lei 13.787/2018
              (prontuário eletrônico) e alinhamento à RNDS — sem você ter que reinventar a roda.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Como funciona */}
      <section>
        <h2 className="text-2xl font-display font-bold text-foreground mb-6">
          Como funciona a integração
        </h2>
        <div className="space-y-4">
          {[
            {
              n: "1", icon: Building2, title: "Cadastro do hospital",
              desc: "Você envia CNPJ, CNES, dados do responsável técnico (CRM) e contato do TI. Nossa equipe valida e aprova.",
            },
            {
              n: "2", icon: KeyRound, title: "Emissão de chave de API",
              desc: "Geramos uma chave única (com prefixo + hash) por ambiente, com escopos (fhir.read / fhir.write), expiração de 180 dias e IP allowlist opcional.",
            },
            {
              n: "3", icon: Workflow, title: "Solicitação de acesso ao paciente",
              desc: "O hospital cria um pedido por paciente, indicando finalidade (continuidade, segunda opinião, pré/pós-operatório), escopo de recursos e validade. O paciente recebe notificação.",
            },
            {
              n: "4", icon: CheckCircle2, title: "Aprovação granular do paciente",
              desc: "Modelo open health: o paciente decide caso a caso, com expiração configurável (até 365 dias) e direito de revogar a qualquer momento.",
            },
            {
              n: "5", icon: FileCode2, title: "Troca FHIR autenticada",
              desc: "Endpoints REST FHIR R4 com Bearer token, assinatura HMAC opcional, rate limiting e validação de IP. Toda chamada é registrada no log de auditoria.",
            },
            {
              n: "6", icon: ScrollText, title: "Auditoria transparente",
              desc: "Hospital, paciente e ValvePath veem cada troca: quem acessou, quando, qual recurso, sucesso ou falha. Log imutável, retido por 20 anos.",
            },
          ].map((s) => (
            <Card key={s.n} className="shadow-sm-soft">
              <CardContent className="p-5 flex gap-4 items-start">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 font-display font-bold">
                  {s.n}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground">{s.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Recursos FHIR suportados */}
      <section>
        <h2 className="text-2xl font-display font-bold text-foreground mb-4">
          Recursos FHIR suportados
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Foco inicial em cardiologia valvar. Outros recursos podem ser adicionados sob demanda.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            "Patient", "Condition", "Observation", "DiagnosticReport",
            "Encounter", "Procedure", "MedicationStatement",
            "AllergyIntolerance", "CarePlan", "DocumentReference",
          ].map((r) => (
            <Badge key={r} variant="secondary" className="text-xs font-mono">{r}</Badge>
          ))}
        </div>
      </section>

      {/* Segurança */}
      <section className="bg-secondary/40 rounded-2xl p-8 border border-border">
        <h2 className="text-2xl font-display font-bold text-foreground mb-6 flex items-center gap-2">
          <Lock className="h-6 w-6 text-primary" /> Segurança em camadas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "TLS 1.3 obrigatório em todas as chamadas",
            "Chaves de API hash (bcrypt) — nunca armazenadas em texto",
            "Rotação de chaves a cada 180 dias (configurável)",
            "IP allowlist opcional por chave",
            "Rate limiting por hospital e por endpoint",
            "Assinatura HMAC opcional para webhooks de saída",
            "Row Level Security no banco para todos os recursos",
            "Audit log append-only — sem UPDATE ou DELETE",
            "Criptografia em repouso (AES-256) no Lovable Cloud",
            "Revogação imediata de acesso pelo paciente",
          ].map((s) => (
            <div key={s} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center bg-gradient-to-br from-primary/10 via-background to-primary/5 rounded-2xl p-10 border border-primary/20">
        <Building2 className="h-12 w-12 text-primary mx-auto mb-4" />
        <h2 className="text-3xl font-display font-bold text-foreground mb-3">
          Vamos conversar sobre integração?
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-6">
          Atendemos hospitais privados, clínicas de cardiologia e laboratórios de imagem cardíaca.
          Conte sobre sua instituição e nossa equipe técnica retorna em até 5 dias úteis.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <a href={mailto}>
              <Mail className="h-4 w-4" /> Solicitar parceria
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/seguranca">
              Ver políticas de segurança <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-6">
          Contato direto: <a href={`mailto:${CONTACT.email}`} className="text-primary hover:underline">{CONTACT.email}</a>
        </p>
      </section>

      {/* Disclaimer */}
      <div className="text-xs text-muted-foreground border-l-2 border-muted pl-4 py-2">
        <strong>Importante:</strong> O ValvePath é ferramenta de apoio educacional e organizacional —
        não emite laudos nem substitui sistemas de prontuário eletrônico (PEP) hospitalares. A integração
        FHIR visa enriquecer a jornada do paciente e a continuidade do cuidado, sempre sob responsabilidade
        do médico assistente. A homologação na RNDS (Rede Nacional de Dados em Saúde) é um caminho previsto
        no roadmap e exige certificado ICP-Brasil.
      </div>
    </div>
  );
};

export default Parceiros;
