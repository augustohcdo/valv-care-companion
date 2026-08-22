import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Trash2, Loader2, Download, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { documentTypeLabels, formatBytes } from "@/lib/clinicalLabels";
import { logAudit } from "@/lib/auditLog";
import { checarUpload, ACCEPT_DOCUMENTOS } from "@/lib/upload";
import { CaseLaudoReader, podeLerLaudo } from "@/components/CaseLaudoReader";

interface Props {
  caseId: string;
  readOnly?: boolean;
  /**
   * O caso, para a leitura do laudo saber o que já está preenchido.
   *
   * Sem ele o botão de ler laudo não aparece — não porque falte permissão, mas
   * porque comparar o laudo com nada seria oferecer substituir o que o médico
   * já digitou sem nem saber que ele digitou.
   */
  caso?: Record<string, unknown>;
  nomeDoMedico?: string | null;
  onAplicado?: () => void;
}

export const caseDocumentsKey = (caseId: string) => ["case-documents", caseId] as const;

export const CaseDocuments = ({ caseId, readOnly = false, caso, nomeDoMedico, onAplicado }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<string>("ecocardiograma");

  const { data: docs = [], isLoading: loading } = useQuery({
    queryKey: caseDocumentsKey(caseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_documents")
        .select("*")
        .eq("case_id", caseId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const load = () => queryClient.invalidateQueries({ queryKey: caseDocumentsKey(caseId) });

  const handleFile = async (file: File) => {
    if (!user) return;
    const check = checarUpload(file, "medical-documents");
    if (!check.ok) {
      toast.error("Arquivo não aceito", { description: check.motivo });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${caseId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("medical-documents")
      // O tipo vem da extensão, não do que o navegador declara: para .dcm o
      // `file.type` chega vazio e o bucket recusaria a imagem médica.
      .upload(path, file, { contentType: check.contentType });

    if (upErr) {
      setUploading(false);
      toast.error("Falha no upload", { description: upErr.message });
      return;
    }

    const { error: dbErr } = await supabase.from("case_documents").insert({
      case_id: caseId,
      uploaded_by: user.id,
      document_type: docType as any,
      file_name: file.name,
      storage_path: path,
      file_size: file.size,
      mime_type: file.type,
    });

    setUploading(false);
    if (dbErr) {
      toast.error("Falha ao registrar", { description: dbErr.message });
      return;
    }
    toast.success("Documento anexado");
    if (fileInput.current) fileInput.current.value = "";
    load();
  };

  const downloadDoc = async (doc: any) => {
    const { data, error } = await supabase.storage
      .from("medical-documents")
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data) {
      toast.error("Não foi possível abrir o arquivo");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  // O arquivo NÃO é apagado do storage, de propósito.
  //
  // Antes era, e a linha logo abaixo marcava a linha como soft-deleted — ou
  // seja, o registro dizia "recuperável" sobre bytes que já não existiam. Era o
  // único ponto do sistema onde um clique era irreversível, num documento que é
  // prontuário e tem retenção de 20 anos publicada na página do DPO.
  //
  // Documento do paciente (`PacienteDocumentos.tsx`) continua sendo apagado de
  // verdade: aquele arquivo é dele, e a LGPD lhe dá esse controle. Aqui o dono
  // do registro é o prontuário.
  //
  // Apagar de verdade um exame segue possível pelo atendimento de LGPD, que
  // roda com service_role.
  const deleteDoc = async (doc: any) => {
    if (!confirm(`Remover "${doc.file_name}" da lista?\n\nO arquivo continua guardado no prontuário.`)) return;
    const { data: alteradas, error } = await supabase
      .from("case_documents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", doc.id)
      .select("id");
    // Zero linhas com `error` nulo é como a RLS recusa: para o PostgREST,
    // atualizar nada é sucesso. Sem esta checagem, um documento de outro
    // médico sairia da tela como se tivesse sido removido.
    if (error || !alteradas?.length) {
      toast.error("Não foi possível remover o documento", {
        description: error?.message ?? "Você pode não ter permissão sobre este documento.",
      });
      return;
    }
    // Mensagem própria em vez do helper: aqui a informação que importa não é
    // "deu certo", é que o arquivo continua no prontuário.
    toast.success("Documento removido da lista", {
      description: "O arquivo permanece guardado no prontuário.",
    });
    logAudit("document_deleted", "case_documents", doc.id, { case_id: caseId, file_name: doc.file_name });
    load();
  };

  return (
    <Card className="shadow-sm-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Paperclip className="h-5 w-5 text-primary" /> Documentos anexados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && (
          <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg bg-secondary/40 border border-dashed border-border">
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(documentTypeLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileInput}
              type="file"
              hidden
              accept={ACCEPT_DOCUMENTOS}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button
              variant="outline"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="sm:flex-1"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Enviando..." : "Selecionar arquivo (até 20 MB)"}
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : docs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhum documento anexado.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {docs.map((d) => (
              <li key={d.id} className="py-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{d.file_name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">{documentTypeLabels[d.document_type]}</Badge>
                    <span className="text-xs text-muted-foreground">{formatBytes(d.file_size)}</span>
                    <span className="text-xs text-muted-foreground">
                      • {new Date(d.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
                {/* Só onde há laudo escrito a transcrever: DICOM e Word não
                    são formato de documento legível para a leitura. */}
                {!readOnly && caso && podeLerLaudo(d) && (
                  <CaseLaudoReader
                    caseId={caseId}
                    caso={caso}
                    documento={d}
                    nomeDoMedico={nomeDoMedico}
                    onAplicado={onAplicado}
                  />
                )}
                <Button variant="ghost" size="icon" onClick={() => downloadDoc(d)}>
                  <Download className="h-4 w-4" />
                </Button>
                {!readOnly && (
                  <Button variant="ghost" size="icon" onClick={() => deleteDoc(d)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Anexos são organizacionais. ValvePath não interpreta imagens nem realiza diagnóstico
          automático — a leitura de laudo transcreve o texto impresso, e o que ela lê você confere
          antes de entrar no prontuário.
        </p>
      </CardContent>
    </Card>
  );
};
