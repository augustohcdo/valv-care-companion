import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { extrairTexto } from "@/lib/pdfTexto";
import { useAuth } from "@/hooks/useAuth";
import { aplicar } from "@/lib/mutate";
import { logAudit } from "@/lib/auditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

/**
 * Biblioteca de referência — onde ficam as obras que originam a base clínica.
 *
 * Existe porque livro não cabe em anexo de conversa: o teto deste projeto é
 * 50 MB por arquivo, e o do chat é bem menor. Aqui o upload sai do navegador
 * direto para um bucket privado, sem passar por lugar nenhum no meio.
 *
 * E fecha o outro lado da citação: `knowledge_sources` guarda a referência da
 * obra, esta tela guarda o documento. Quem revisar um trecho depois consegue
 * abrir a fonte e conferir o que foi sintetizado — sem isso, "citação
 * rastreável" seria só uma string bonita.
 */

const BUCKET = "reference-library";
const MAX_BYTES = 50 * 1024 * 1024;

interface Obra {
  id: string;
  title: string;
  authors: string | null;
  edition: string | null;
  year: number | null;
  publisher: string | null;
  storage_path: string;
  file_bytes: number | null;
  notes: string | null;
  kind: string;
  pages: number | null;
  created_at: string;
}

export const bibliotecaKey = () => ["reference-works"] as const;

const tamanho = (b: number | null) =>
  b == null ? "—" : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} kB`;

const vazio = { title: "", authors: "", edition: "", year: "", publisher: "", notes: "" };

export default function AdminBiblioteca() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...vazio });
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState<{ pagina: number; total: number } | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const textoRef = useRef<HTMLInputElement>(null);

  const { data: obras = [], isLoading } = useQuery({
    queryKey: bibliotecaKey(),
    queryFn: async (): Promise<Obra[]> => {
      const { data, error } = await supabase
        .from("reference_works")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Obra[]) ?? [];
    },
  });

  const recarregar = () => queryClient.invalidateQueries({ queryKey: bibliotecaKey() });

  const enviar = async (arquivo: File) => {
    if (!form.title.trim()) {
      toast.error("Informe o título da obra antes de enviar");
      return;
    }
    // O `accept` do input é dica de interface; a regra do bucket é quem barra de
    // verdade. Isto aqui só existe para a recusa vir com motivo legível.
    if (!arquivo.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Só PDF", { description: "A biblioteca aceita apenas arquivos .pdf." });
      return;
    }
    if (arquivo.size > MAX_BYTES) {
      toast.error("Arquivo grande demais", {
        description:
          `${(arquivo.size / 1024 / 1024).toFixed(0)} MB — o teto é 50 MB. ` +
          "Abra o PDF no navegador, use Imprimir → Salvar como PDF e escolha só o intervalo de páginas do capítulo.",
      });
      return;
    }

    setEnviando(true);
    // O caminho carrega a data e um sufixo aleatório: dois envios do mesmo
    // arquivo não se sobrescrevem em silêncio.
    const limpo = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const caminho = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID().slice(0, 8)}-${limpo}`;

    const { error: erroUpload } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, arquivo, { contentType: "application/pdf", upsert: false });

    if (erroUpload) {
      setEnviando(false);
      toast.error("Falha no envio", { description: erroUpload.message });
      return;
    }

    const ok = await aplicar(
      supabase.from("reference_works").insert({
        title: form.title.trim(),
        authors: form.authors.trim() || null,
        edition: form.edition.trim() || null,
        year: form.year ? Number(form.year) : null,
        publisher: form.publisher.trim() || null,
        notes: form.notes.trim() || null,
        storage_path: caminho,
        file_bytes: arquivo.size,
        uploaded_by: user?.id ?? null,
      }),
      { sucesso: "Obra enviada", falha: "Não foi possível registrar a obra" },
    );
    setEnviando(false);

    if (!ok) {
      // O arquivo subiu e a linha não: sem isto o bucket ficaria com um PDF que
      // ninguém sabe de onde veio.
      await supabase.storage.from(BUCKET).remove([caminho]);
      return;
    }

    logAudit("reference_work_added", "reference_works", caminho, { title: form.title.trim() });
    setForm({ ...vazio });
    recarregar();
  };

  /**
   * O caminho principal para obra grande: o PDF **não sobe**.
   *
   * O teto do projeto é 50 MB e não pode ser levantado no plano gratuito, mas o
   * arquivo grande não é o que interessa — um livro pesa 300 MB por causa de
   * imagem e fonte embutida, e o texto dele são poucos megabytes. Extrai-se
   * aqui, no navegador, e sobe só o texto, com a página junto para a citação
   * continuar chegando à página.
   */
  const enviarTexto = async (arquivo: File) => {
    if (!form.title.trim()) {
      toast.error("Informe o título da obra antes de enviar");
      return;
    }
    if (!arquivo.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Só PDF", { description: "A extração de texto lê apenas .pdf." });
      return;
    }

    setEnviando(true);
    setProgresso({ pagina: 0, total: 0 });
    let extraido;
    try {
      extraido = await extrairTexto(arquivo, (pagina, total) => setProgresso({ pagina, total }));
    } catch (e) {
      setEnviando(false);
      setProgresso(null);
      toast.error("Não consegui ler o PDF", {
        description: e instanceof Error ? e.message : String(e),
      });
      return;
    }
    setProgresso(null);

    if (extraido.semTextoLegivel) {
      setEnviando(false);
      // Dois motivos possíveis, mesma saída prática: ou a obra é digitalização
      // de imagem, ou a camada de texto existe e não decodifica (fonte sem mapa
      // Unicode, OCR antigo). Deixar qualquer um dos dois subir produziria um
      // arquivo com a cara certa e nada aproveitável dentro.
      const motivo =
        extraido.caracteres < 200
          ? "Este PDF não tem texto — é digitalização de imagem."
          : `O texto deste PDF não decodifica (só ${Math.round(extraido.legibilidade * 100)}% legível).`;
      toast.error(motivo, {
        description:
          "Recorte só as páginas do capítulo (Imprimir → Salvar como PDF) e use o envio do arquivo, " +
          "que cabe nos 50 MB — eu leio renderizando as páginas.",
      });
      return;
    }

    const conteudo = JSON.stringify({
      obra: form.title.trim(),
      extraido_em: new Date().toISOString(),
      paginas: extraido.paginas,
    });
    const blob = new Blob([conteudo], { type: "application/json" });
    const limpo = arquivo.name.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9._-]/g, "_");
    const caminho = `texto/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID().slice(0, 8)}-${limpo}.json`;

    const { error: erroUpload } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, blob, { contentType: "application/json", upsert: false });
    if (erroUpload) {
      setEnviando(false);
      toast.error("Falha no envio do texto", { description: erroUpload.message });
      return;
    }

    const ok = await aplicar(
      supabase.from("reference_works").insert({
        title: form.title.trim(),
        authors: form.authors.trim() || null,
        edition: form.edition.trim() || null,
        year: form.year ? Number(form.year) : null,
        publisher: form.publisher.trim() || null,
        notes: form.notes.trim() || null,
        storage_path: caminho,
        file_bytes: blob.size,
        kind: "texto",
        pages: extraido.totalPaginas,
        uploaded_by: user?.id ?? null,
      }),
      { sucesso: "Texto enviado", falha: "Não foi possível registrar a obra" },
    );
    setEnviando(false);
    if (!ok) {
      await supabase.storage.from(BUCKET).remove([caminho]);
      return;
    }

    const de = (arquivo.size / 1024 / 1024).toFixed(0);
    const para = (blob.size / 1024 / 1024).toFixed(1);
    toast.success(`${extraido.totalPaginas} páginas extraídas`, {
      description: `${de} MB de PDF viraram ${para} MB de texto — o arquivo não saiu do seu computador.`,
    });
    logAudit("reference_text_added", "reference_works", caminho, {
      title: form.title.trim(),
      paginas: extraido.totalPaginas,
    });
    setForm({ ...vazio });
    recarregar();
  };

  const baixar = async (obra: Obra) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(obra.storage_path, 300);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível gerar o link", { description: error?.message });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const remover = async (obra: Obra) => {
    const ok = await aplicar(
      supabase.from("reference_works").delete().eq("id", obra.id),
      { sucesso: "Obra removida", falha: "Não foi possível remover" },
    );
    if (!ok) return;
    await supabase.storage.from(BUCKET).remove([obra.storage_path]);
    logAudit("reference_work_removed", "reference_works", obra.id, { title: obra.title });
    recarregar();
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-primary" /> Biblioteca de referência
        </h1>
        <p className="text-muted-foreground">
          As obras que originam a base clínica. Ficam em armazenamento privado, visíveis só para
          administradores, e servem para conferir na fonte o que foi sintetizado.
        </p>
      </header>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="obra-titulo">Título da obra *</Label>
              <Input
                id="obra-titulo"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex.: Braunwald — Tratado de Doenças Cardiovasculares"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obra-autores">Autores</Label>
              <Input
                id="obra-autores"
                value={form.authors}
                onChange={(e) => setForm((f) => ({ ...f, authors: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obra-editora">Editora</Label>
              <Input
                id="obra-editora"
                value={form.publisher}
                onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obra-edicao">Edição</Label>
              <Input
                id="obra-edicao"
                value={form.edition}
                onChange={(e) => setForm((f) => ({ ...f, edition: e.target.value }))}
                placeholder="12ª"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obra-ano">Ano</Label>
              <Input
                id="obra-ano"
                inputMode="numeric"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value.replace(/\D/g, "") }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="obra-notas">Observação (ex.: capítulos incluídos)</Label>
              <Textarea
                id="obra-notas"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="min-h-[60px] text-sm"
                placeholder="Capítulos 66-70 — doença valvar"
              />
            </div>
          </div>

          <input
            ref={arquivoRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void enviar(f);
            }}
          />
          <input
            ref={textoRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void enviarTexto(f);
            }}
          />
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={() => textoRef.current?.click()} disabled={enviando}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Extrair texto e enviar
              </Button>
              <p className="text-xs text-muted-foreground min-w-0">
                <strong>Sem limite de tamanho.</strong> O PDF é lido aqui no seu navegador e{" "}
                <strong>não sai do seu computador</strong> — sobe só o texto, com o número de cada página.
              </p>
            </div>

            {progresso && (
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: progresso.total ? `${(progresso.pagina / progresso.total) * 100}%` : "0%" }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {progresso.total
                    ? `Lendo página ${progresso.pagina} de ${progresso.total}…`
                    : "Abrindo o documento…"}
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-border">
              <Button variant="outline" onClick={() => arquivoRef.current?.click()} disabled={enviando}>
                <Upload className="h-4 w-4" />
                Enviar o PDF inteiro
              </Button>
              <p className="text-xs text-muted-foreground min-w-0">
                Até 50 MB (teto do plano). Útil quando ter o original ajuda — capítulo recortado,
                diretriz curta, ou obra escaneada, que não tem texto para extrair.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : obras.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          Nenhuma obra enviada ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {obras.map((o) => (
            <Card key={o.id}>
              <CardContent className="py-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium">{o.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[o.authors, o.edition && `${o.edition} ed.`, o.year, o.publisher]
                      .filter(Boolean)
                      .join(" · ") || "sem dados de edição"}
                  </p>
                  {o.notes && <p className="text-xs text-muted-foreground mt-1">{o.notes}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {o.kind === "texto" ? "Texto extraído" : "PDF"}
                    {o.pages ? ` · ${o.pages} páginas` : ""} · {tamanho(o.file_bytes)} · enviado em{" "}
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => baixar(o)}>
                    <Download className="h-4 w-4" /> Abrir
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => remover(o)}
                  >
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
