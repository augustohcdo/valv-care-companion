import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import {
  Stethoscope,
  Users,
  ShieldCheck,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Activity,
  FileHeart,
  Lock,
  HeartPulse,
  ClipboardCheck,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import heroImg from "@/assets/hero-heart.jpg";

const Index = () => {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
        <div className="absolute inset-0 opacity-30">
          <img
            src={heroImg}
            alt=""
            className="w-full h-full object-cover object-right"
            width={1600}
            height={1200}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/85 to-transparent" />

        <div className="container-vp relative py-20 sm:py-28 lg:py-36">
          <div className="max-w-3xl animate-fade-in-up">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/30 text-xs font-medium text-accent backdrop-blur-sm mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              ValvePath 2.0 — plataforma premium para doenças valvares
            </span>
            <h1 className="font-display font-semibold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">
              Apoio inteligente e seguro para a jornada das doenças valvares cardíacas.
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-primary-foreground/85 leading-relaxed max-w-2xl">
              Organize casos, eduque pacientes, acompanhe jornadas e apoie discussões clínicas com base em diretrizes internacionais e segurança de dados.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row flex-wrap gap-3">
              <Button asChild variant="accent" size="lg" className="min-h-[48px] w-full sm:w-auto">
                <Link to="/auth/cadastro?type=medico">
                  <Stethoscope className="h-4 w-4" /> Sou médico
                </Link>
              </Button>
              <Button asChild variant="accent" size="lg" className="min-h-[48px] w-full sm:w-auto">
                <Link to="/auth/cadastro?type=paciente">
                  <Users className="h-4 w-4" /> Sou paciente
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-h-[48px] w-full sm:w-auto bg-background/10 border-primary-foreground/30 text-primary-foreground hover:bg-background hover:text-primary backdrop-blur-sm">
                <Link to="/aprender">
                  Acessar sem cadastro <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-primary-foreground/75">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> LGPD-aware</span>
              <span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-accent" /> Diretrizes ESC/EACTS & ACC/AHA</span>
              <span className="flex items-center gap-2"><Lock className="h-4 w-4 text-accent" /> Vínculo médico-paciente seguro</span>
            </div>
          </div>
        </div>
      </section>

      {/* MÉTRICAS DE CONFIANÇA */}
      <section className="border-b border-border bg-background">
        <div className="container-vp py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { value: "4", label: "válvulas cardíacas cobertas em profundidade" },
              { value: "20+", label: "tópicos educacionais validados para pacientes" },
              { value: "3 min", label: "para iniciar um caso clínico estruturado" },
              { value: "100%", label: "decisões clínicas com o seu médico" },
            ].map((s, i) => (
              <div key={i} className="text-center md:text-left">
                <div className="font-display font-bold text-3xl sm:text-4xl text-gradient">{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground leading-snug">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PARA MÉDICOS */}
      <section id="medicos" className="py-20 sm:py-24">
        <div className="container-vp">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-wider text-accent mb-3">
                Para médicos
              </span>
              <h2 className="font-display font-semibold text-3xl sm:text-4xl text-foreground tracking-tight">
                Casos clínicos estruturados, do cadastro à decisão compartilhada.
              </h2>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
                Wizard rápido para cadastro de casos, formulários profundos por valvopatia, anexos organizados, dashboards analíticos e uma biblioteca clínica robusta — tudo apoiando a discussão em Heart Team.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Novo caso em 3 minutos com modo wizard ou avançado",
                  "Formulários condicionais por valvopatia e severidade",
                  "Upload de exames, laudos e imagens por caso",
                  "Dashboards por status, NYHA, tratamento e follow-up",
                  "Biblioteca clínica baseada em diretrizes",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
                <Button asChild variant="hero" className="min-h-[48px]">
                  <Link to="/auth/cadastro?type=medico">Cadastrar como médico</Link>
                </Button>
                <Button asChild variant="outline" className="min-h-[48px]">
                  <Link to="/medicos">Conhecer plataforma médica</Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: ClipboardCheck, title: "Casos estruturados", desc: "Etapas claras: identificação, exames, checklist e resumo." },
                { icon: FileHeart, title: "Anexos clínicos", desc: "PDF, imagens, laudos, ECG, eco — organizados por caso." },
                { icon: Activity, title: "Dashboards", desc: "Status, NYHA, valvopatia, tratamento e funil de jornada." },
                { icon: GraduationCap, title: "Biblioteca clínica", desc: "Diretrizes, armadilhas, follow-up e referências." },
              ].map((f, i) => (
                <Card key={i} className="p-5 card-elevated">
                  <div className="h-10 w-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center mb-3">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display font-semibold text-sm text-foreground mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PARA PACIENTES */}
      <section id="pacientes" className="py-20 sm:py-24 bg-secondary/40 border-y border-border">
        <div className="container-vp">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1 grid gap-4">
              {[
                { title: "Quero entender minha doença", desc: "Conteúdo claro sobre as quatro válvulas, estenose, insuficiência e sopros." },
                { title: "Vou fazer um exame", desc: "Ecocardiograma, tomografia, cateterismo, ressonância — explicados com calma." },
                { title: "Vou passar por procedimento", desc: "TAVI, cirurgia, reparo, terapias transcateter e o que esperar antes e depois." },
                { title: "Cuidados depois do tratamento", desc: "Recuperação, follow-up, sinais de alerta e medicações." },
              ].map((c, i) => (
                <Link key={i} to="/aprender" className="group">
                  <Card className="p-5 card-elevated flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-display font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{c.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.desc}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-accent shrink-0" />
                  </Card>
                </Link>
              ))}
            </div>

            <div className="order-1 lg:order-2">
              <span className="inline-block text-xs font-semibold uppercase tracking-wider text-accent mb-3">
                Para pacientes
              </span>
              <h2 className="font-display font-semibold text-3xl sm:text-4xl text-foreground tracking-tight">
                Informação confiável, em linguagem acolhedora — quando você mais precisa.
              </h2>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
                Acesse explicações sobre doenças valvares, exames, tratamentos e jornada hospitalar. Sem necessidade de cadastro. Se quiser, crie uma conta para se conectar ao seu médico e organizar sua saúde valvar com segurança.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="hero">
                  <Link to="/aprender">Explorar conteúdo</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/auth/cadastro?type=paciente">Criar conta de paciente</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEGURANÇA + BASE CIENTÍFICA */}
      <section className="py-20 sm:py-24">
        <div className="container-vp">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-7 sm:p-8 card-elevated">
              <div className="h-11 w-11 rounded-lg bg-success/15 text-success flex items-center justify-center mb-4">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="font-display font-semibold text-xl text-foreground mb-2">
                Segurança e privacidade no centro
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Dados de saúde são sensíveis. ValvePath foi pensado com controle granular de acesso, vínculo médico-paciente autorizado, consentimentos, exportação e exclusão de dados, em linha com a LGPD.
              </p>
              <Link to="/seguranca" className="text-sm font-medium text-accent inline-flex items-center gap-1 hover:gap-2 transition-all">
                Como protegemos seus dados <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Card>

            <Card className="p-7 sm:p-8 card-elevated">
              <div className="h-11 w-11 rounded-lg bg-accent-soft text-accent flex items-center justify-center mb-4">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="font-display font-semibold text-xl text-foreground mb-2">
                Base científica sólida
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Conteúdo orientado por diretrizes 2025 ESC/EACTS, 2020 ACC/AHA e materiais educacionais de AHA e CDC. ValvePath organiza dados e apoia discussões — sem substituir o julgamento clínico.
              </p>
              <Link to="/referencias" className="text-sm font-medium text-accent inline-flex items-center gap-1 hover:gap-2 transition-all">
                Ver referências <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-20 sm:py-24 bg-secondary/40 border-y border-border">
        <div className="container-vp">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-accent mb-3">
              Como funciona
            </span>
            <h2 className="font-display font-semibold text-3xl sm:text-4xl text-foreground tracking-tight">
              Conexão segura entre médicos e pacientes, com CRM como chave.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { num: "01", title: "Médico cria sua conta", desc: "Cadastro com CRM, especialidade e instituição. O CRM se torna sua chave de conexão." },
              { num: "02", title: "Paciente se vincula pelo CRM", desc: "Ao criar conta, o paciente informa o CRM do médico. O sistema cria um vínculo seguro, sujeito a aprovação." },
              { num: "03", title: "Acompanhamento conjunto", desc: "Sintomas, exames, anexos e jornada compartilhados — sempre sob consentimento do paciente." },
            ].map((step, i) => (
              <div key={i} className="relative">
                <Card className="p-7 h-full card-elevated">
                  <div className="font-display text-5xl font-bold text-accent/30 mb-3 leading-none">{step.num}</div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL + DISCLAIMER */}
      <section className="py-20 sm:py-24">
        <div className="container-vp">
          <div className="rounded-2xl bg-gradient-hero text-primary-foreground p-10 sm:p-14 text-center shadow-lg-soft">
            <HeartPulse className="h-12 w-12 text-accent mx-auto mb-4" />
            <h2 className="font-display font-semibold text-3xl sm:text-4xl tracking-tight max-w-2xl mx-auto">
              Comece agora a organizar a jornada valvar com segurança.
            </h2>
            <p className="mt-4 text-primary-foreground/85 max-w-xl mx-auto">
              Cadastro gratuito para médicos e pacientes nesta versão de demonstração.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild variant="accent" size="lg">
                <Link to="/auth/cadastro">Criar conta agora</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-background hover:text-primary">
                <Link to="/aprender">Explorar sem cadastro</Link>
              </Button>
            </div>
          </div>

          <div className="mt-10 max-w-3xl mx-auto">
            <MedicalDisclaimer />
          </div>
        </div>
      </section>
    </>
  );
};

export default Index;
