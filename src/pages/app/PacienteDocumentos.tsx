import { useEffect, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  Download,
  FolderOpen,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { documentTypeLabels, formatBytes } from "@/lib/clinicalLabels";

const PacienteDocumentos = () => {
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // form
  const [docType, setDocType] = useState<string>("ecocardiograma");
  const [description, setDescription] = useState("");
  const [shareWithDoctor, setShareWithDoctor] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: pat } = await supabase
      .from("patients")
      .select("id")
      .is("deleted_at", null)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!pat) {
      setLoading(false);
      return;
    }
    setPatientId(pat.id);
    const { data } = await supabase
      .from("patient_documents")
      .select("*")
      .eq("patient_id", pat.id)
      .order("created_at", { ascending: false });
    setDocs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleFile = async (file: File) => {
    if (!user || !patientId) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo excede 20 MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("patient-documents")
      .upload(path, file, { contentType: file.type });

    if (upErr) {
      setUploading(false);
      toast.error("Falha no upload", { description: upErr.message });
      return;
    }

    const { error: dbErr } = await supabase.from("patient_documents").insert({
      patient_id: patientId,
      uploaded_by: user.id,
      document_type: docType,
      file_name: file.name,
      storage_path: path,
      file_size: file.size,
      mime_type: file.type,
      description: description || null,
      shared_with_doctor: shareWithDoctor,
    });

    setUploading(false);
    if (dbErr) {
      toast.error("Falha ao registrar", { description: dbErr.message });
      return;
    }
    toast.success("Documento enviado");
    setDescription("");
    if (fileInput.current) fileInput.current.value = "";
    load();
  };

  const downloadDoc = async (doc: any) => {
    const { data, error } = await supabase.storage
      .from("patient-documents")
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data) {
      toast.error("Não foi possível abrir o arquivo");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const toggleShare = async (doc: any) => {
    await supabase
      .from("patient_documents")
      .update({ shared_with_doctor: !doc.shared_with_doctor })
      .eq("id", doc.id);
    toast.success(doc.shared_with_doctor ? "Compartilhamento desativado" : "Compartilhado com médico");
    load();
  };

  const deleteDoc = async (doc: any) => {
    if (!confirm(`Remover "${doc.file_name}"?`)) return;
    await supabase.storage.from("patient-documents").remove([doc.storage_path]);
    await supabase.from("patient_documents").delete().eq("id", doc.id);
    toast.success("Documento removido");
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Meus arquivos"
        title="Meus documentos"
        description="Organize seus exames, laudos e relatórios em um cofre privado. Compartilhe com seu médico vinculado quando quiser."
      />

      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-5 w-5 text-primary" /> Enviar novo documento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo de documento</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(documentTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ex: Eco de controle pós-cirurgia"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Compartilhar com meu médico</p>
                <p className="text-xs text-muted-foreground">
                  Permite que o cardiologista vinculado visualize este documento.
                </p>
              </div>
            </div>
            <Switch checked={shareWithDoctor} onCheckedChange={setShareWithDoctor} />
          </div>

          <input
            ref={fileInput}
            type="file"
            hidden
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button
            variant="default"
            onClick={() => fileInput.current?.click()}
            disabled={uploading || !patientId}
            className="w-full"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Enviando..." : "Selecionar arquivo (até 20 MB)"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Aceitamos PDF, imagens (JPG, PNG) e documentos do Word. Os arquivos ficam criptografados
            e acessíveis apenas a você e ao médico que você autorizar.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-5 w-5 text-primary" /> Meu acervo
            <Badge variant="secondary" className="ml-1 text-[10px]">{docs.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : docs.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
              Nenhum documento ainda. Envie seu primeiro exame acima.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="py-3 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{d.file_name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">
                        {documentTypeLabels[d.document_type] || d.document_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatBytes(d.file_size)}</span>
                      <span className="text-xs text-muted-foreground">
                        • {new Date(d.created_at).toLocaleDateString("pt-BR")}
                      </span>
                      {d.shared_with_doctor ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          <Eye className="h-2.5 w-2.5 mr-1" /> Compartilhado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          <EyeOff className="h-2.5 w-2.5 mr-1" /> Privado
                        </Badge>
                      )}
                    </div>
                    {d.description && (
                      <p className="text-xs text-muted-foreground mt-1">{d.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => toggleShare(d)} title="Alternar compartilhamento">
                      {d.shared_with_doctor ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => downloadDoc(d)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteDoc(d)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PacienteDocumentos;
