import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Lock, Eye, FileKey, Database, UserCheck, Download, Trash2, AlertCircle } from "lucide-react";

const items = [
  { icon: ShieldCheck, title: "Dados de saúde são sensíveis", desc: "Tratamos com o cuidado que os dados clínicos exigem, em linha com a LGPD." },
  { icon: UserCheck, title: "Consentimento explícito", desc: "Compartilhamento médico-paciente exige autorização clara, registrada e revogável a qualquer momento." },
  { icon: Lock, title: "Controle de acesso por perfil", desc: "Cada perfil (médico, paciente, admin) tem permissões específicas e segregadas." },
  { icon: FileKey, title: "Vínculo médico-paciente autorizado", desc: "A conexão por CRM exige aprovação. O paciente sempre controla quem acessa seus dados." },
  { icon: Database, title: "Minimização de dados", desc: "Coletamos apenas o necessário para a função clínica e educacional." },
  { icon: Lock, title: "Criptografia em trânsito e em repouso", desc: "Requisito de produção. Dados protegidos por padrões modernos de criptografia." },
  { icon: Eye, title: "Logs e trilha de auditoria", desc: "Registros de acesso e ações relevantes em ambiente de produção, para rastreabilidade." },
  { icon: Download, title: "Exportação de dados", desc: "Pacientes e médicos podem solicitar exportação dos próprios dados." },
  { icon: Trash2, title: "Exclusão e portabilidade", desc: "Direito ao esquecimento conforme LGPD, com fluxo de solicitação e confirmação." },
];

const Seguranca = () => {
  return (
    <>
      <PageHeader
        eyebrow="Confiança e proteção"
        title="Segurança e privacidade"
        description="Dados de saúde exigem padrões elevados. Veja como ValvePath protege médicos e pacientes."
      />
      <section className="container-vp py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it, i) => (
            <Card key={i} className="p-6 card-elevated">
              <div className="h-11 w-11 rounded-lg bg-success/15 text-success flex items-center justify-center mb-3">
                <it.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display font-semibold text-base text-foreground mb-1.5">{it.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-8 p-6 border-warning/30 bg-warning/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display font-semibold text-base text-foreground mb-1.5">Aviso desta versão de demonstração</h3>
              <p className="text-sm text-foreground/85 leading-relaxed">
                Esta é uma versão de demonstração. Embora a infraestrutura siga boas práticas, recomendamos <strong>não inserir dados reais de pacientes</strong> antes da habilitação completa do backend seguro de produção. Use dados fictícios para testes e apresentações.
              </p>
            </div>
          </div>
        </Card>

        <Card className="mt-6 p-6 bg-secondary/40">
          <h3 className="font-display font-semibold text-base text-foreground mb-2">Conformidade e referências</h3>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li>• Lei Geral de Proteção de Dados Pessoais (LGPD) — Lei nº 13.709/2018, especialmente para dados pessoais sensíveis de saúde.</li>
            <li>• Anvisa RDC 657/2022 — Software as a Medical Device, quando aplicável a funções clínicas.</li>
            <li>• Boas práticas internacionais para sistemas de saúde digital.</li>
          </ul>
        </Card>
      </section>
    </>
  );
};

export default Seguranca;
