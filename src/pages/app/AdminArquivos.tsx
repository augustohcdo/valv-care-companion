import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, FolderLock, Loader2, Trash2, Upload, User, Bot } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { aplicar } from "@/lib/mutate";
import { logAudit } from "@/lib/auditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

/**
 * Arquivos de trabalho — o lugar privado e durável de guardar coisas.
 *
 * O pedido foi "uma pasta no meu computador para o assistente gravar e salvar
 * tudo". A premissa não se sustentava: o assistente roda num contêiner efêmero
 * na nuvem, recriado a cada sessão, que apaga tudo que não estiver versionado.
 * Uma pasta lá pareceria armazenamento sem ser.
 *
 * Os dois lugares que duram são o repositório — que é **público**, e portanto
 * não serve para nada sensível — e este bucket, privado e legível só por
 * administrador. Esta tela é a metade humana: o assistente grava pelo
 * `scripts/workspace.mjs`, e o que ele gravou aparece aqui marcado como tal.
 *
 * **O teto de 50 MB por arquivo é da plataforma**, não desta tela, e está
 * escrito onde a pessoa escolhe o arquivo. Prometer "espaço ilimitado" seria
 * verdade para a quantidade e mentira para o tamanho.
 */

const BUCKET = "workspace";
const MAX_BYTES = 50 * 1024 * 1024;

/** A mesma lista da migration e do script. Divergir daria erro só no servidor. */
const ACEITOS =
  ".pdf,.png,.jpg,.jpeg,.webp,.svg,.txt,.log,.md,.csv,.json,.zip,.docx,.xlsx,.pptx";

interface Arquivo {
  id: string;
  storage_path: string;
  titulo: string;
  descricao: string | null;
  mime_type: string | null;
  file_bytes: number | null;
  origem: string;
  created_at: string;
}

export const arquivosKey = () => ["workspace-files"] as const;

const tamanho = (b: number | null) =>
  b == null ? "—" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} kB`;

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function AdminArquivos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const { data: arquivos = [], isLoading } = useQuery({
    queryKey: arquivosKey(),
    queryFn: async (): Promise<Arquivo[]> => {
      const { data, error } = await supabase
        .from("workspace_files")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Arquivo[]) ?? [];
    },
  });

  const recarregar = () => queryClient.invalidateQueries({ queryKey: arquivosKey() });

  const enviar = async (arquivo: File) => {
    // O `accept` do input é dica de interface; quem barra de verdade é a
    // allowlist do bucket. Isto existe para a recusa vir com motivo legível em
    // vez de um 400 do servidor.
    const ext = `.${arquivo.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!ACEITOS.split(",").includes(ext)) {
      toast.error("Tipo não aceito", {
        description: `${ext || "sem extensão"} não está na lista. Aceitos: ${ACEITOS.replace(/,/g, " ")}`,
      });
      return;
    }
    if (arquivo.size > MAX_BYTES) {
      toast.error("Arquivo grande demais", {
        description:
          `${(arquivo.size / 1048576).toFixed(1)} MB — o teto da plataforma é 50 MB por arquivo. ` +
          "Comprima ou divida antes de enviar.",
      });
      return;
    }

    setEnviando(true);
    // Data e sufixo aleatório no caminho: dois envios do mesmo nome não se
    // sobrescrevem em silêncio.
    const limpo = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const caminho = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID().slice(0, 8)}-${limpo}`;

    const { error: erroUpload } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, arquivo, { contentType: arquivo.type || undefined, upsert: false });

    if (erroUpload) {
      setEnviando(false);
      toast.error("Falha no envio", { description: erroUpload.message });
      return;
    }

    const ok = await aplicar(
      supabase.from("workspace_files").insert({
        storage_path: caminho,
        titulo: titulo.trim() || arquivo.name,
        descricao: descricao.trim() || null,
        mime_type: arquivo.type || null,
        file_bytes: arquivo.size,
        origem: "humano",
        uploaded_by: user?.id ?? null,
      }),
      { sucesso: "Arquivo guardado", falha: "Não foi possível registrar o arquivo" },
    );
    setEnviando(false);

    if (!ok) {
      // Subiu o arquivo e a linha não entrou: sem isto o bucket ficaria com um
      // objeto que ninguém sabe de onde veio.
      await supabase.storage.from(BUCKET).remove([caminho]);
      return;
    }

    logAudit("workspace_file_added", "workspace_files", caminho, { titulo: titulo.trim() });
    setTitulo("");
    setDescricao("");
    if (arquivoRef.current) arquivoRef.current.value = "";
    recarregar();
  };

  const baixar = async (arquivo: Arquivo) => {
    // URL assinada de 5 minutos: o bucket é privado e continua sendo.
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(arquivo.storage_path, 300);
    if (error || !data?.signedUrl) {
      toast.error("Não consegui gerar o link", { description: error?.message });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const remover = async (arquivo: Arquivo) => {
    // A linha primeiro: se o banco recusar, o arquivo continua lá e a lista
    // continua verdadeira. `aplicar` existe para recusa não virar sucesso.
    const ok = await aplicar(
      supabase.from("workspace_files").delete().eq("id", arquivo.id),
      { sucesso: "Arquivo removido", falha: "Não foi possível remover" },
    );
    if (!ok) return;
    await supabase.storage.from(BUCKET).remove([arquivo.storage_path]);
    logAudit("workspace_file_removed", "workspace_files", arquivo.id, { titulo: arquivo.titulo });
    recarregar();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-primary flex items-center gap-2">
          <FolderLock className="h-6 w-6" /> Arquivos de trabalho
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Um lugar privado para guardar documentos, notas e material de apoio. Só administradores
          leem. O assistente também grava aqui, e o que veio dele aparece marcado.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Como você vai reconhecer isto depois"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={1}
                placeholder="Do que se trata"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="arquivo">Arquivo</Label>
            <Input
              id="arquivo"
              ref={arquivoRef}
              type="file"
              accept={ACEITOS}
              disabled={enviando}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void enviar(f);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Quantidade de arquivos sem limite. <strong>Até 50 MB por arquivo</strong> — é o teto
              do plano da plataforma, não uma regra desta tela.
            </p>
          </div>

          {enviando && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : arquivos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Upload className="h-8 w-8 mx-auto mb-3 opacity-40" />
            Nenhum arquivo guardado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {arquivos.map((a) => (
            <Card key={a.id}>
              <CardContent className="py-4 flex flex-wrap items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{a.titulo}</p>
                  <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      {a.origem === "assistente" ? (
                        <><Bot className="h-3 w-3" /> assistente</>
                      ) : (
                        <><User className="h-3 w-3" /> você</>
                      )}
                    </span>
                    <span>·</span>
                    <span>{tamanho(a.file_bytes)}</span>
                    <span>·</span>
                    <span>{quando(a.created_at)}</span>
                  </p>
                  {a.descricao && (
                    <p className="text-xs text-muted-foreground mt-1">{a.descricao}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => void baixar(a)}>
                    <Download className="h-4 w-4" /> Baixar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void remover(a)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
