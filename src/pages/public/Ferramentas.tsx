import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Stethoscope, LockOpen } from "lucide-react";
import { PainelDeFerramentas } from "@/components/ferramentas/PainelDeFerramentas";
import { TrustBadges } from "@/components/TrustBadges";

/**
 * As ferramentas livres — o caminho do médico que ainda não quer conta.
 *
 * Sem cadastro, sem captcha e sem coleta: as contas rodam no navegador e nada
 * do que for digitado aqui sai da máquina de quem digitou. Isso está escrito na
 * página, porque uma calculadora clínica que não diz o que faz com o dado do
 * paciente é uma pergunta em aberto que o médico não deveria ter que fazer.
 */
const Ferramentas = () => {
  return (
    <>
      <PageHeader
        eyebrow="Acesso médico sem cadastro"
        title="Ferramentas de apoio ao Heart Team"
        description="EuroSCORE II, avaliação de gradiente e risco de mismatch prótese-paciente, e o catálogo de próteses com a procedência de cada dado. Abertas, sem conta e sem cobrança."
      />

      <section className="container-vp pb-4">
        <div className="rounded-xl border border-border bg-secondary/30 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <LockOpen className="h-5 w-5 text-primary shrink-0" />
          <p className="text-sm text-foreground/85 leading-relaxed flex-1">
            <strong>Nada do que você digitar aqui sai deste navegador.</strong> Os cálculos rodam
            na própria página; não há envio, não há registro e não é preciso identificar o
            paciente. Com conta, as mesmas ferramentas passam a vir preenchidas a partir do caso
            clínico e o resultado entra nos documentos gerados.
          </p>
          <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
            <Link to="/medicos#solicitar">
              <Stethoscope className="h-4 w-4" /> Solicitar acesso profissional
            </Link>
          </Button>
        </div>
      </section>

      <section className="container-vp py-8">
        <PainelDeFerramentas base="/ferramentas" />
      </section>

      <TrustBadges />
    </>
  );
};

export default Ferramentas;
