import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck, Loader2, Send, CheckCircle2, Mail, Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { CONTACT } from "@/lib/contact";
import { UF_LIST } from "@/lib/validators";

/**
 * Acesso profissional é liberado por pessoa, não por formulário.
 *
 * Antes, qualquer um criava conta de médico e digitava um CRM que ninguém
 * conferia. Num sistema que organiza prontuário e sugere conduta, essa era a
 * porta mais larga que existia. Agora o profissional solicita, o responsável
 * confere o CRM e libera — e a tela diz isso com todas as letras, em vez de
 * parecer um cadastro que demora.
 */

const ESPECIALIDADES = [
  "Cardiologia clínica",
  "Cirurgia cardiovascular",
  "Hemodinâmica e cardiologia intervencionista",
  "Ecocardiografia",
  "Cardiologia pediátrica",
  "Clínica médica",
  "Outra",
];

export default function AcessoProfissional() {
  const [tipo, setTipo] = useState<"medico" | "clinica">("medico");
  const [form, setForm] = useState({
    nome: "", email: "", telefone: "", crm: "", crm_uf: "SP",
    especialidade: "", rqe: "", instituicao: "", cidade: "", uf: "SP", mensagem: "",
  });
  const [consentDiretorio, setConsentDiretorio] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleCaptcha = useCallback((t: string | null) => setCaptchaToken(t), []);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) {
      toast.error("Confirme a verificação de segurança");
      return;
    }
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("access-request", {
        body: { ...form, tipo, consent_diretorio: consentDiretorio, captchaToken },
      });
      // O token do Turnstile é de uso único: gasto aqui, mesmo numa recusa.
      setCaptchaToken(null);
      setCaptchaReset((n) => n + 1);

      if (error) {
        toast.error("Não foi possível enviar", { description: (error as Error)?.message });
        return;
      }
      if (data?.error) {
        toast.error(
          data.error === "captcha_failed"
            ? "A verificação de segurança expirou. Tente de novo."
            : data.error,
        );
        return;
      }
      setEnviado(true);
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div className="container-vp py-12 max-w-2xl">
        <Card className="border-success/40 bg-success/5">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
            <h1 className="font-serif text-2xl text-primary">Solicitação enviada</h1>
            <p className="text-sm text-foreground/80 leading-relaxed">
              Recebemos seus dados. O responsável vai conferir seu registro no Conselho
              Regional de Medicina e retornar por e-mail — aprovando o acesso ou
              explicando o que faltou.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Se preferir adiantar a conversa, fale com o representante em{" "}
              <a href={`mailto:${CONTACT.email}`} className="text-primary underline">{CONTACT.email}</a>.
            </p>
            <Button asChild variant="outline"><Link to="/">Voltar ao início</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-vp py-12 max-w-3xl">
      <PageHeader
        eyebrow="Acesso profissional"
        title="Solicitar acesso"
        description="O acesso de médicos e clínicas é liberado individualmente pelo responsável pelo ValvePath, depois da conferência do registro profissional."
      />

      <Card className="border-primary/30 bg-primary/5 mb-6">
        <CardContent className="p-5 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm leading-relaxed">
            <p className="font-medium text-foreground">Não há criação automática de conta.</p>
            <p className="text-muted-foreground mt-1">
              Recomendamos <strong>falar antes com o representante</strong> pelo e-mail{" "}
              <a href={`mailto:${CONTACT.email}`} className="text-primary underline">{CONTACT.email}</a>{" "}
              para entender o processo. O formulário abaixo dá entrada no pedido; a
              liberação depende da conferência do seu registro.
            </p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={enviar}>
        <Card className="shadow-sm-soft">
          <CardContent className="p-6 space-y-5">
            <div>
              <Label className="text-xs">Estou solicitando como</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as "medico" | "clinica")}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medico">Médico(a)</SelectItem>
                  <SelectItem value="clinica">Clínica ou hospital</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label className="text-xs">Nome completo *</Label>
                <Input required value={form.nome} onChange={(e) => set("nome", e.target.value)}
                  className="mt-1.5" placeholder="Como consta no seu registro" />
              </div>
              <div>
                <Label className="text-xs">E-mail *</Label>
                <Input required type="email" value={form.email}
                  onChange={(e) => set("email", e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)}
                  className="mt-1.5" placeholder="Com DDD" />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">
                  CRM {tipo === "medico" && "*"}
                </Label>
                <Input required={tipo === "medico"} inputMode="numeric" value={form.crm}
                  onChange={(e) => set("crm", e.target.value.replace(/\D/g, ""))}
                  className="mt-1.5" placeholder="Só números" />
              </div>
              <div>
                <Label className="text-xs">UF do CRM</Label>
                <Select value={form.crm_uf} onValueChange={(v) => set("crm_uf", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UF_LIST.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">RQE</Label>
                <Input value={form.rqe} onChange={(e) => set("rqe", e.target.value)}
                  className="mt-1.5" placeholder="Se tiver" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Especialidade</Label>
                <Select value={form.especialidade} onValueChange={(v) => set("especialidade", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {ESPECIALIDADES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Instituição / clínica</Label>
                <Input value={form.instituicao} onChange={(e) => set("instituicao", e.target.value)}
                  className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Cidade</Label>
                <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)}
                  className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">UF</Label>
                <Select value={form.uf} onValueChange={(v) => set("uf", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UF_LIST.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Como pretende usar o ValvePath</Label>
              <Textarea value={form.mensagem} onChange={(e) => set("mensagem", e.target.value)}
                className="mt-1.5 min-h-[90px]"
                placeholder="Volume de casos valvares, serviço onde atua, se já conversou com alguém da equipe..." />
            </div>

            {/* A anuência de aparecer no diretório é colhida no ato do pedido, e
                separada dos demais aceites: a Resolução CFM nº 2.336/2023 define
                publicidade médica como divulgação com anuência do médico. */}
            <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 flex items-start gap-3">
              <Checkbox id="diretorio" checked={consentDiretorio}
                onCheckedChange={(v) => setConsentDiretorio(v === true)} className="mt-0.5" />
              <label htmlFor="diretorio" className="text-sm leading-relaxed cursor-pointer">
                <span className="font-medium text-foreground">
                  Concordo em aparecer no diretório de profissionais.
                </span>
                <span className="block text-muted-foreground mt-1">
                  Pacientes com conta no ValvePath poderão ver meu nome, CRM/UF, RQE,
                  especialidade, cidade, instituição e a descrição que eu escrever, e
                  poderão me enviar pedido de vínculo — que só se concretiza se eu aceitar.
                  Não há nota, estrela nem classificação entre profissionais.{" "}
                  <strong>Posso sair do diretório quando quiser</strong>, pela minha
                  página de perfil. Detalhes nos{" "}
                  <Link to="/termos" target="_blank" className="text-primary underline">Termos de Uso</Link>{" "}
                  e na{" "}
                  <Link to="/privacidade" target="_blank" className="text-primary underline">Política de Privacidade</Link>.
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-3">
              <TurnstileWidget onToken={handleCaptcha} action="access-request" resetSignal={captchaReset} />
              <Button type="submit" variant="hero" className="w-full h-11"
                disabled={enviando || !captchaToken || !consentDiretorio}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar solicitação
              </Button>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Seus dados são usados só para analisar este pedido e, se aprovado, criar
                sua conta. Você nunca recebe senha por e-mail: recebe um link para
                definir a sua.
              </p>
            </div>
          </CardContent>
        </Card>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Já tem acesso?{" "}
        <Link to="/auth/login" className="text-primary font-medium hover:underline">Entrar</Link>
        {" · "}
        <span className="inline-flex items-center gap-1">
          <Mail className="h-3 w-3" />
          <a href={`mailto:${CONTACT.email}`} className="hover:underline">{CONTACT.email}</a>
        </span>
      </p>

    </div>
  );
}
