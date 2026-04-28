import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TrustBadges } from "@/components/TrustBadges";
import { ShieldCheck, Mail, Clock, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const DPO_EMAIL = "dpo@valvepath.com";

const RIGHTS: { id: string; label: string; desc: string; article: string }[] = [
  { id: "confirmacao", label: "Confirmação de tratamento", desc: "Confirmar se tratamos seus dados pessoais.", article: "Art. 18, I" },
  { id: "acesso", label: "Acesso aos dados", desc: "Receber cópia dos dados que mantemos sobre você.", article: "Art. 18, II" },
  { id: "correcao", label: "Correção", desc: "Corrigir dados incompletos, inexatos ou desatualizados.", article: "Art. 18, III" },
  { id: "anonimizacao", label: "Anonimização ou bloqueio", desc: "Anonimizar, bloquear ou eliminar dados desnecessários ou tratados em desconformidade.", article: "Art. 18, IV" },
  { id: "portabilidade", label: "Portabilidade", desc: "Receber seus dados em formato estruturado e interoperável.", article: "Art. 18, V" },
  { id: "eliminacao", label: "Eliminação", desc: "Eliminar dados tratados com base em consentimento.", article: "Art. 18, VI" },
  { id: "compartilhamento", label: "Informação sobre compartilhamento", desc: "Saber com quais entidades públicas ou privadas compartilhamos seus dados.", article: "Art. 18, VII" },
  { id: "consentimento", label: "Revogação de consentimento", desc: "Revogar consentimento previamente concedido.", article: "Art. 18, IX" },
  { id: "revisao", label: "Revisão de decisão automatizada", desc: "Solicitar revisão de decisões tomadas exclusivamente por algoritmo.", article: "Art. 20" },
];

export default function DPO() {
  const [right, setRight] = useState<string>("acesso");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedRight = RIGHTS.find((r) => r.id === right);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !right) {
      toast.error("Preencha nome, e-mail e o direito desejado.");
      return;
    }
    setSubmitting(true);

    const subject = `[Solicitação LGPD] ${selectedRight?.label} — ${name}`;
    const body = [
      `Titular: ${name}`,
      `E-mail de contato: ${email}`,
      cpf ? `CPF (opcional): ${cpf}` : "",
      ``,
      `Direito solicitado: ${selectedRight?.label} (${selectedRight?.article})`,
      `Descrição: ${selectedRight?.desc}`,
      ``,
      `Detalhes adicionais:`,
      details || "(nenhum)",
      ``,
      `---`,
      `Enviado pelo formulário /dpo do ValvePath em ${new Date().toLocaleString("pt-BR")}`,
    ].filter(Boolean).join("\n");

    const mailto = `mailto:${DPO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;

    setTimeout(() => {
      setSubmitting(false);
      toast.success("Abrimos seu cliente de e-mail. Caso não tenha aberto, copie os dados e envie manualmente para " + DPO_EMAIL);
    }, 600);
  };

  return (
    <>
      <PageHeader
        eyebrow="Encarregado de Dados (DPO)"
        title="Exerça seus direitos como titular de dados"
        description="Lei Geral de Proteção de Dados (Lei nº 13.709/2018) — Art. 18. Respondemos em até 15 dias."
      />

      <section className="container-vp py-10 max-w-5xl">
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          <Card className="p-5 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Gratuito</h3>
              <p className="text-xs text-muted-foreground mt-1">O exercício dos seus direitos não tem custo (Art. 19, §3º, LGPD).</p>
            </div>
          </Card>
          <Card className="p-5 flex items-start gap-3">
            <Clock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Resposta em até 15 dias</h3>
              <p className="text-xs text-muted-foreground mt-1">Acompanhamos prazos da ANPD para todas as solicitações.</p>
            </div>
          </Card>
          <Card className="p-5 flex items-start gap-3">
            <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Identidade verificada</h3>
              <p className="text-xs text-muted-foreground mt-1">Para proteger você, podemos solicitar comprovação de identidade antes de atender.</p>
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          <Card className="p-6 lg:col-span-3">
            <h2 className="font-display font-semibold text-xl mb-1">Formulário de solicitação</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Preencha os campos abaixo. Ao enviar, abriremos seu cliente de e-mail para finalizar o envio ao DPO.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Direito que deseja exercer *</Label>
                <RadioGroup value={right} onValueChange={setRight} className="space-y-2">
                  {RIGHTS.map((r) => (
                    <label
                      key={r.id}
                      htmlFor={`r-${r.id}`}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        right === r.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"
                      }`}
                    >
                      <RadioGroupItem value={r.id} id={`r-${r.id}`} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm">{r.label}</span>
                          <span className="text-[10px] text-muted-foreground">{r.article}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome completo *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail de contato *</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cpf">CPF (opcional, ajuda a localizar seu cadastro)</Label>
                <Input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="details">Detalhes adicionais</Label>
                <Textarea
                  id="details"
                  rows={4}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Descreva sua solicitação, período, dados específicos etc."
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                <Mail className="h-4 w-4 mr-2" />
                {submitting ? "Abrindo e-mail…" : "Enviar solicitação ao DPO"}
              </Button>

              <p className="text-xs text-muted-foreground">
                Se preferir, envie diretamente para{" "}
                <a href={`mailto:${DPO_EMAIL}`} className="text-primary underline">
                  {DPO_EMAIL}
                </a>
                .
              </p>
            </form>
          </Card>

          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-success" /> Quem é o Encarregado?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O Encarregado pelo Tratamento de Dados Pessoais (DPO — Data Protection Officer) é o canal oficial entre você,
                o ValvePath e a Autoridade Nacional de Proteção de Dados (ANPD).
              </p>
              <p className="text-xs mt-3">
                <strong>E-mail:</strong>{" "}
                <a href={`mailto:${DPO_EMAIL}`} className="text-primary underline">{DPO_EMAIL}</a>
              </p>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-2">Limites legais</h3>
              <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                <li>• Dados clínicos podem ser retidos por <strong>20 anos</strong> (Lei 13.787/2018) mesmo após pedido de eliminação.</li>
                <li>• Logs de acesso são mantidos por <strong>6 meses</strong> (Marco Civil da Internet, Art. 15).</li>
                <li>• Podemos negar pedidos quando houver obrigação legal, exercício regular de direitos ou proteção da vida (Art. 7º e 11º, LGPD).</li>
              </ul>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-2">Não satisfeito?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Você pode peticionar diretamente à ANPD — Autoridade Nacional de Proteção de Dados.
              </p>
              <a
                href="https://www.gov.br/anpd/pt-br"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline inline-flex items-center gap-1 mt-2"
              >
                Acessar canal da ANPD <ExternalLink className="h-3 w-3" />
              </a>
            </Card>

            <TrustBadges />
          </div>
        </div>
      </section>
    </>
  );
}
