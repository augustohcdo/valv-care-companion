import { Link } from "react-router-dom";
import {
  Stethoscope, ShieldCheck, BookOpen, CheckCircle2, ArrowRight, Mail,
  ClipboardCheck, FileHeart, BarChart3, Users, MessageSquare, Calculator,
} from "lucide-react";
import { Hero } from "@/components/Hero";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrustBadges } from "@/components/TrustBadges";
import { HeartTeamIllustration } from "@/components/illustrations/HeartTeamIllustration";
import { SolicitarAcessoForm } from "@/components/SolicitarAcessoForm";
import { CONTACT } from "@/lib/contact";

/**
 * A página do médico — entender e pedir acesso no mesmo lugar.
 *
 * Antes, "Para médicos" (o primeiro item do menu) levava a uma tela dizendo
 * "Esta área será liberada na próxima fase" e "Cadastre-se para acessar". As
 * duas coisas falsas: a área está no ar e o autocadastro de médico deixou de
 * existir. Quem chegava ali só tinha o botão "Voltar ao início" — e o caminho
 * real da solicitação estava disperso em seis pontos, todos abaixo da dobra ou
 * dentro de outra tela.
 *
 * Agora é uma página só, na ordem em que o médico decide: o que a plataforma
 * faz, como o acesso funciona, e o formulário.
 */

const RECURSOS = [
  { icon: ClipboardCheck, titulo: "Casos estruturados", desc: "Wizard de 3 minutos ou modo avançado, com formulários condicionais por valvopatia e severidade." },
  { icon: FileHeart, titulo: "Laudo lido por você e pela IA", desc: "Anexe o eco em PDF ou foto: o sistema transcreve os números e a identificação, e você confere antes de entrar no prontuário." },
  { icon: BarChart3, titulo: "Painéis e relatórios", desc: "Distribuição por status, NYHA, gravidade e conduta — com exportação em PDF e Excel." },
  { icon: MessageSquare, titulo: "Discussão de Heart Team", desc: "Convide colegas para o caso e registre a decisão da equipe, com autoria e data." },
  { icon: BookOpen, titulo: "Base clínica com citação", desc: "Sugestões ancoradas em diretriz, com a fonte à vista — e busca em literatura indexada quando você pedir." },
  { icon: Users, titulo: "Vínculo com o paciente", desc: "O paciente acompanha a própria jornada e envia sintomas; o vínculo só existe se você aceitar." },
];

const PASSOS = [
  {
    num: "01",
    titulo: "Você solicita",
    desc: "Preenche nome, e-mail e CRM. Leva menos de um minuto — o resto é opcional.",
  },
  {
    num: "02",
    titulo: "Conferimos seu registro",
    desc: "O responsável pelo ValvePath confere seu CRM no portal do Conselho Federal de Medicina. Não há liberação automática.",
  },
  {
    num: "03",
    titulo: "Você recebe o acesso",
    desc: "Chega um e-mail com um link para você definir a própria senha. Nunca enviamos senha pronta.",
  },
];

export default function Medicos() {
  return (
    <>
      <Hero
        eyebrow={
          <>
            <Stethoscope className="h-3.5 w-3.5" />
            Para médicos e clínicas
          </>
        }
        title="O caso valvar organizado, da primeira consulta à decisão do Heart Team."
        subtitle="Acesso profissional é liberado individualmente, depois da conferência do seu registro no CRM. Sem cadastro automático — e sem cobrança nesta fase."
        media={
          <div className="rounded-3xl bg-primary-foreground/5 border border-primary-foreground/10 backdrop-blur-sm p-6">
            <HeartTeamIllustration className="w-full h-auto" />
          </div>
        }
        actions={
          <>
            <Button asChild variant="accent" size="lg" className="min-h-[48px] w-full sm:w-auto">
              <a href="#solicitar">
                Solicitar acesso <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild variant="outline" size="lg"
              className="min-h-[48px] w-full sm:w-auto bg-background/10 border-primary-foreground/30 text-primary-foreground hover:bg-background hover:text-primary backdrop-blur-sm"
            >
              <Link to="/auth/login">Já tenho acesso</Link>
            </Button>
          </>
        }
        trustItems={[
          { icon: <ShieldCheck className="h-4 w-4 text-accent" />, label: "CRM conferido por pessoa" },
          { icon: <BookOpen className="h-4 w-4 text-accent" />, label: "Diretrizes ESC/EACTS & ACC/AHA" },
        ]}
      />

      {/* ---------------------------------------------------- o que a plataforma faz */}
      <section className="py-20 sm:py-24">
        <div className="container-vp">
          <ScrollReveal className="max-w-2xl mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-accent mb-3">
              O que você ganha
            </span>
            <h2 className="font-display font-semibold text-3xl sm:text-4xl text-foreground tracking-tight">
              Menos tempo organizando, mais tempo decidindo.
            </h2>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {RECURSOS.map((r, i) => (
              <ScrollReveal key={r.titulo} delay={i * 0.05}>
                <Card className="p-6 h-full card-elevated">
                  <div className="h-11 w-11 rounded-xl bg-accent/10 text-accent grid place-items-center mb-4">
                    <r.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display font-semibold text-base text-foreground mb-1.5">{r.titulo}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{r.desc}</p>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------ ferramentas livres, sem cadastro */}
      {/* Fica ACIMA do formulário de propósito: o médico que chega desconfiado
          consegue usar alguma coisa antes de decidir pedir acesso. */}
      <section className="pb-20 sm:pb-24">
        <div className="container-vp">
          <ScrollReveal>
            <Card className="p-6 sm:p-8 card-elevated border-accent/30">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                <div className="h-12 w-12 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">
                  <Calculator className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="inline-block text-xs font-semibold uppercase tracking-wider text-accent mb-2">
                    Sem cadastro
                  </span>
                  <h2 className="font-display font-semibold text-2xl sm:text-3xl text-foreground tracking-tight">
                    Ferramentas abertas, para usar agora.
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2 max-w-2xl">
                    Calculadora de <strong>EuroSCORE II</strong>, avaliação de{" "}
                    <strong>gradiente e risco de mismatch</strong> prótese-paciente e o{" "}
                    <strong>catálogo de próteses</strong> com tamanhos, faixa de anel e a fonte de
                    cada dado. Não precisa de conta, não precisa identificar o paciente, e nada do
                    que for digitado sai do seu navegador.
                  </p>
                </div>
                <Button asChild size="lg" variant="hero" className="shrink-0 gap-2">
                  <Link to="/ferramentas">
                    Abrir as ferramentas <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          </ScrollReveal>
        </div>
      </section>

      {/* ---------------------------------------------------- como o acesso funciona */}
      <section className="py-20 sm:py-24 bg-secondary/40 border-y border-border/60">
        <div className="container-vp">
          <ScrollReveal className="max-w-2xl mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-accent mb-3">
              Como o acesso funciona
            </span>
            <h2 className="font-display font-semibold text-3xl sm:text-4xl text-foreground tracking-tight">
              Três passos, e nenhum deles automático.
            </h2>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              O ValvePath organiza prontuário e apoia decisão clínica. Por isso quem entra
              é conferido um a um — não há criação de conta médica sem análise.
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-6">
            {PASSOS.map((p, i) => (
              <ScrollReveal key={p.num} delay={i * 0.1}>
                <Card className="p-7 h-full card-elevated">
                  <div className="font-display text-5xl font-bold text-accent/30 mb-3 leading-none">{p.num}</div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-2">{p.titulo}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </Card>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={0.3}>
            <Card className="mt-8 p-5 flex items-start gap-3 border-primary/30 bg-primary/5">
              <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">
                <span className="font-medium text-foreground">Prefere conversar antes?</span>{" "}
                <span className="text-muted-foreground">
                  Fale com o representante do ValvePath em{" "}
                  <a href={`mailto:${CONTACT.email}`} className="text-primary underline">{CONTACT.email}</a>{" "}
                  — dá para entender o processo e tirar dúvidas antes de enviar o pedido.
                </span>
              </p>
            </Card>
          </ScrollReveal>
        </div>
      </section>

      {/* ---------------------------------------------------- o formulário */}
      <section id="solicitar" className="py-20 sm:py-24 scroll-mt-20">
        <div className="container-vp max-w-3xl">
          <ScrollReveal className="mb-8">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-accent mb-3">
              Solicitar acesso
            </span>
            <h2 className="font-display font-semibold text-3xl sm:text-4xl text-foreground tracking-tight">
              Comece por aqui.
            </h2>
            <ul className="mt-5 space-y-2">
              {[
                "Nome, e-mail e CRM bastam para o pedido entrar na fila.",
                "Você recebe a resposta por e-mail — aprovando ou explicando o que faltou.",
                "Se aprovado, define sua própria senha por um link. Não enviamos senha pronta.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-foreground/85">{t}</span>
                </li>
              ))}
            </ul>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <SolicitarAcessoForm />
          </ScrollReveal>

          <ScrollReveal delay={0.2} className="mt-8">
            <TrustBadges />
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
