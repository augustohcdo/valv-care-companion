import { useEffect, useState, useRef } from "react";
import { Upload, FileText, Trash2, Loader2, Download, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { documentTypeLabels, formatBytes } from "@/lib/clinicalLabels";

interface Props {
  caseId: string;
  readOnly?: boolean;
}

export const CaseDocuments = ({ caseId, readOnly = false }: Props) => {
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<string>("ecocardiograma");

  const load = async () => {
    const { data } = await supabase
      .from("case_documents")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });
    setDocs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [caseId]);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo excede 20 MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${caseId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("medical-documents")
      .upload(path, file, { contentType: file.type });

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

  const deleteDoc = async (doc: any) => {
    if (!confirm(`Remover "${doc.file_name}"?`)) return;
    await supabase.storage.from("medical-documents").remove([doc.storage_path]);
    await supabase.from("case_documents").delete().eq("id", doc.id);
    toast.success("Documento removido");
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
              accept=".pdf,.jpg,.jpeg,.png,.dcm,.doc,.docx"
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
          Anexos são organizacionais. ValvePath não interpreta imagens nem realiza diagnóstico automático.
        </p>
      </CardContent>
    </Card>
  );
};
