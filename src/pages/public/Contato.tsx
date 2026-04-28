import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrustBadges } from "@/components/TrustBadges";
import { CONTACT } from "@/lib/contact";
import {
  Mail, Instagram, Phone, ShieldCheck, Clock,
  Copy, Send, ExternalLink, MessageCircle, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const SUBJECTS = [
  { id: "duvida",       label: "Dúvida geral" },
  { id: "suporte",      label: "Suporte técnico" },
  { id: "verificacao",  label: "Verificação de CRM" },
  { id: "parceria",     label: "Parceria / institucional" },
  { id: "imprensa",     label: "Imprensa" },
  { id: "outro",        label: "Outro assunto" },
];

export default function Contato() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("duvida");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.email);
      toast.success("E-mail copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar — selecione manualmente");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      toast.error("Preencha nome, e-mail e mensagem.");
      return;
    }
    setSending(true);
    const subj = `[ValvePath · ${SUBJECTS.find((s) => s.id === subject)?.label}] ${name}`;
    const body = [
      `Nome: ${name}`,
      `E-mail: ${email}`,
      `Assunto: ${SUBJECTS.find((s) => s.id === subject)?.label}`,
      ``,
      `Mensagem:`,
      message,
      ``,
      `---`,
      `Enviado pelo formulário /contato em ${new Date().toLocaleString("pt-BR")}`,
    ].join("\n");
    const url = `mailto:${CONTACT.email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    setTimeout(() => {
      setSending(false);
      toast.success("Abrimos seu cliente de e-mail. Caso não tenha aberto, copie nosso e-mail.");
    }, 600);
  };

  return (
    <>
      <PageHeader
        eyebrow="Fale conosco"
        title="Entre em contato com a equipe ValvePath"
        description="Estamos aqui para ajudar pacientes, médicos e instituições. Respondemos em até 2 dias úteis."
      />

      <section className="container-vp py-10 max-w-5xl">
        {/* Canais */}
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">E-mail</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Canal principal</p>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="block mt-2 text-sm text-primary font-medium underline truncate"
                >
                  {CONTACT.email}
                </a>
                <div className="flex gap-2 mt-3">
                  <Button asChild size="sm" variant="default" className="h-8">
                    <a href={`mailto:${CONTACT.email}`}>
                      <Send className="h-3.5 w-3.5 mr-1.5" /> Enviar
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={copyEmail}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5 opacity-75">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                <Instagram className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">Instagram</h3>
                  <Badge variant="outline" className="text-[10px]">Em breve</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Conteúdo educacional e novidades</p>
                <p className="text-xs text-muted-foreground mt-3">Nosso perfil estará disponível em breve.</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 opacity-75">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                <Phone className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">Telefone / WhatsApp</h3>
                  <Badge variant="outline" className="text-[10px]">Em breve</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Atendimento em horário comercial</p>
                <p className="text-xs text-muted-foreground mt-3">Em breve disponibilizaremos um número direto.</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Aviso clínico */}
        <Card className="p-4 mb-8 bg-amber-500/5 border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-foreground/85 leading-relaxed">
            <strong>Não é canal de emergência médica.</strong> Em caso de mal-estar agudo, dor torácica, falta de ar
            intensa ou qualquer urgência, ligue <strong>192 (SAMU)</strong> ou procure o pronto-socorro mais próximo.
            O ValvePath não realiza diagnóstico, prescrição nem teleconsulta.
          </div>
        </Card>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Formulário */}
          <Card className="p-6 lg:col-span-3">
            <h2 className="font-display font-semibold text-xl mb-1 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" /> Envie uma mensagem
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Ao enviar, abriremos seu cliente de e-mail com a mensagem pré-preenchida para{" "}
              <strong>{CONTACT.email}</strong>.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Assunto</Label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSubject(s.id)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        subject === s.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-secondary"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="msg">Mensagem *</Label>
                <Textarea
                  id="msg"
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Como podemos ajudar?"
                  required
                />
              </div>

              <Button type="submit" disabled={sending} className="w-full sm:w-auto">
                <Send className="h-4 w-4 mr-2" />
                {sending ? "Abrindo e-mail…" : "Enviar mensagem"}
              </Button>
            </form>
          </Card>

          {/* Lateral */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Tempo de resposta
              </h3>
              <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                <li>• Dúvidas gerais: até <strong>2 dias úteis</strong></li>
                <li>• Suporte técnico: até <strong>1 dia útil</strong></li>
                <li>• Solicitações LGPD: até <strong>15 dias</strong> (Art. 19, LGPD)</li>
                <li>• Verificação de CRM: até <strong>3 dias úteis</strong></li>
              </ul>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-success" /> Canais especializados
              </h3>
              <ul className="text-xs space-y-2 leading-relaxed">
                <li>
                  <Link to="/dpo" className="text-primary hover:underline inline-flex items-center gap-1">
                    Direitos LGPD (DPO) <ExternalLink className="h-3 w-3" />
                  </Link>
                  <p className="text-muted-foreground">Acesso, correção, portabilidade, eliminação.</p>
                </li>
                <li>
                  <Link to="/seguranca" className="text-primary hover:underline inline-flex items-center gap-1">
                    Reportar incidente de segurança <ExternalLink className="h-3 w-3" />
                  </Link>
                  <p className="text-muted-foreground">Vulnerabilidades, vazamentos, suspeita de fraude.</p>
                </li>
                <li>
                  <Link to="/aprender/faq" className="text-primary hover:underline inline-flex items-center gap-1">
                    Perguntas frequentes <ExternalLink className="h-3 w-3" />
                  </Link>
                  <p className="text-muted-foreground">Talvez sua dúvida já esteja respondida.</p>
                </li>
              </ul>
            </Card>

            <TrustBadges />
          </div>
        </div>
      </section>
    </>
  );
}
