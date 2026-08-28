import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Search, ShieldAlert } from "lucide-react";
import { EsquemaProtese, familiaDe, NOME_DA_FAMILIA } from "./EsquemaProtese";
import { CitacaoDaFonte } from "./CitacaoDaFonte";
import { FONTE_EACVI_PROTESES } from "@/lib/fontes";
import { useCatalogoProteses, type ProteseDoCatalogo } from "@/hooks/useCatalogoProteses";
import { buscaDaFamilia, TEXTO_DO_RESULTADO, BUSCA_FEITA_EM, VARREDURA_DE_ALERTAS } from "@/data/buscaDeFontes";

/**
 * O catálogo de próteses.
 *
 * Agrupa por **família de modelo** (fabricante + modelo + posição), porque é
 * assim que o médico pensa: ele escolhe a Perimount e depois o tamanho, não uma
 * das 246 linhas soltas.
 *
 * Duas coisas que a tela diz e não disfarça:
 *
 * 1. **A cobertura de EOA de referência é parcial** — 29 de 246 —, e o número
 *    aparece no cabeçalho. Um catálogo que escondesse isso empurraria o médico
 *    a supor que o campo vazio significa "sem mismatch".
 * 2. **O desenho é esquema de família construtiva, não foto do produto.** A foto
 *    real está na página do fabricante, para onde cada cartão aponta.
 *
 * Sem nota, sem estrela, sem "recomendado" e sem ordenação por mérito: é
 * catálogo neutro entre fabricantes, a mesma disciplina já aplicada ao
 * diretório de profissionais.
 */

const ROTULO_TIPO: Record<string, string> = {
  biologica_aortica: "Bioprótese aórtica",
  biologica_mitral: "Bioprótese mitral",
  mecanica: "Prótese mecânica",
  anel_anuloplastia: "Anel de anuloplastia",
  tavi: "Válvula transcateter (TAVI)",
};
const ROTULO_POSICAO: Record<string, string> = {
  aortica: "aórtica", mitral: "mitral", tricuspide: "tricúspide",
};

const TODOS = "__todos__";

const ROTULO_ALERTA: Record<string, string> = {
  retirada_do_mercado: "Retirada do mercado — não indicar para novo implante",
  alerta_de_seguranca: "Alerta de segurança",
  descontinuada: "Descontinuada pelo fabricante",
};

interface Familia {
  chave: string;
  fabricante: string;
  modelo: string;
  tipo: string;
  posicao: string;
  descricao: string | null;
  referencia: string | null;
  imagem: string | null;
  alerta: { tipo: string; nota: string; url: string; data: string | null } | null;
  linhas: ProteseDoCatalogo[];
}

function agrupar(linhas: ProteseDoCatalogo[]): Familia[] {
  const mapa = new Map<string, Familia>();
  for (const l of linhas) {
    const chave = `${l.manufacturer}|${l.model_name}|${l.type}|${l.valve_position}`;
    let f = mapa.get(chave);
    if (!f) {
      f = {
        chave, fabricante: l.manufacturer, modelo: l.model_name, tipo: l.type,
        posicao: l.valve_position,
        // A descrição da menor medida é a do modelo; as demais repetem o tamanho.
        descricao: l.description, referencia: l.reference_url, imagem: l.image_url,
        alerta: l.advisory
          ? { tipo: l.advisory, nota: l.advisory_note ?? "", url: l.advisory_url ?? "", data: l.advisory_date }
          : null,
        linhas: [],
      };
      mapa.set(chave, f);
    }
    f.linhas.push(l);
    if (!f.referencia && l.reference_url) f.referencia = l.reference_url;
    if (!f.imagem && l.image_url) f.imagem = l.image_url;
  }
  for (const f of mapa.values()) f.linhas.sort((a, b) => (a.size ?? 0) - (b.size ?? 0));
  return [...mapa.values()];
}

const numeroPt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function CatalogoProteses() {
  const { data: catalogo = [], isLoading, error } = useCatalogoProteses();
  const [busca, setBusca] = useState("");
  const [fabricante, setFabricante] = useState(TODOS);
  const [tipo, setTipo] = useState(TODOS);

  const fabricantes = useMemo(
    () => [...new Set(catalogo.map((p) => p.manufacturer))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [catalogo],
  );
  const tipos = useMemo(() => [...new Set(catalogo.map((p) => p.type))], [catalogo]);

  const familias = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtradas = catalogo.filter(
      (p) =>
        (fabricante === TODOS || p.manufacturer === fabricante) &&
        (tipo === TODOS || p.type === tipo) &&
        (termo === "" ||
          `${p.manufacturer} ${p.model_name}`.toLowerCase().includes(termo)),
    );
    return agrupar(filtradas).sort(
      (a, b) =>
        a.fabricante.localeCompare(b.fabricante, "pt-BR") ||
        a.modelo.localeCompare(b.modelo, "pt-BR"),
    );
  }, [catalogo, busca, fabricante, tipo]);

  const comEoa = catalogo.filter((p) => p.effective_orifice_area != null).length;

  if (error) {
    return (
      <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
        Não foi possível carregar o catálogo. Recarregue a página.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="cat-busca" className="text-sm font-medium">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="cat-busca" className="h-10 pl-9" placeholder="Fabricante ou modelo"
                value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Fabricante</Label>
            <Select value={fabricante} onValueChange={setFabricante}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {fabricantes.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {tipos.map((t) => <SelectItem key={t} value={t}>{ROTULO_TIPO[t] ?? t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Carregando o catálogo…"
            : `${familias.length} modelos · ${familias.reduce((s, f) => s + f.linhas.length, 0)} tamanhos`}
        </p>
        {/* Só depois de o catálogo chegar.
            Visto numa foto da página: enquanto carregava, esta linha exibia
            "EOA de referência publicada em 0 de 0 tamanhos" — uma afirmação
            sobre a cobertura, em número, construída a partir de uma lista
            vazia. É a família de defeito que esta sessão persegue: a tela
            afirmando um estado que ela ainda não conhece. */}
        {!isLoading && catalogo.length > 0 && (
          <p className="text-xs text-muted-foreground">
            EOA de referência publicada em <strong>{comEoa} de {catalogo.length}</strong> tamanhos
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {familias.map((f) => <CartaoFamilia key={f.chave} familia={f} />)}
      </div>

      {!isLoading && familias.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum modelo com esses filtros.
        </CardContent></Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <CitacaoDaFonte fonte={FONTE_EACVI_PROTESES} />
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <p className="text-xs text-foreground/80 leading-relaxed">
            <strong>Sobre as imagens e os dados.</strong> Onde há foto, ela é a imagem oficial do
            produto, colhida na própria página do fabricante — e é para lá que o cartão aponta. Cada
            uma foi conferida uma a uma: quatro candidatas do rastreio foram recusadas por serem
            outro produto (a foto da Magna Ease casando com a Perimount, a da Ultra RESILIA casando
            com as outras Sapien, e a da Epic Max casando com a Epic). Onde não há foto conferida,
            o cartão mostra um esquema da família construtiva feito aqui, que não é a geometria do
            modelo. Tamanhos, faixas de anel e descrições vêm do material público do fabricante; a
            EOA de referência, quando existe, vem da publicação citada ao lado, e onde não existe o
            campo fica vazio em vez de estimado.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Catálogo neutro, para registro e consulta. A presença de um modelo aqui não é
            recomendação, e não há classificação de preferência entre fabricantes.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            <strong className="text-foreground">Alertas regulatórios:</strong> conferidos em{" "}
            {VARREDURA_DE_ALERTAS.feitaEm} contra {VARREDURA_DE_ALERTAS.fontes.length} fontes.{" "}
            {VARREDURA_DE_ALERTAS.comAlerta.length} modelo(s) com alerta que impede nova indicação;{" "}
            {VARREDURA_DE_ALERTAS.semAlerta.length} conferidos e sem alerta. "Sem alerta" também é
            uma afirmação, e por isso tem data.
          </p>
        </div>
      </div>
    </div>
  );
}

function CartaoFamilia({ familia: f }: { familia: Familia }) {
  const tamanhos = f.linhas.map((l) => l.size).filter((s): s is number => s != null);
  const anelMin = Math.min(...f.linhas.map((l) => l.annulus_min_mm ?? Infinity));
  const anelMax = Math.max(...f.linhas.map((l) => l.annulus_max_mm ?? -Infinity));
  const temAnel = Number.isFinite(anelMin) && Number.isFinite(anelMax);
  const comEoa = f.linhas.filter((l) => l.effective_orifice_area != null);
  const comGradiente = f.linhas.filter((l) => l.mean_gradient_ref != null);

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6 flex gap-4">
        <div className="shrink-0 w-24">
          <div className="w-24 h-24 rounded-xl bg-secondary/40 ring-1 ring-border overflow-hidden grid place-items-center text-primary">
            {f.imagem ? (
              <img
                src={f.imagem}
                alt={`${f.fabricante} ${f.modelo}`}
                className="w-full h-full object-contain p-1"
                loading="lazy"
              />
            ) : (
              <EsquemaProtese tipo={f.tipo} fabricante={f.fabricante} modelo={f.modelo} className="w-16 h-16" />
            )}
          </div>
          <p className="mt-1.5 text-[10px] leading-tight text-center text-muted-foreground">
            {f.imagem
              ? "foto do fabricante"
              : NOME_DA_FAMILIA[familiaDe(f.tipo, f.fabricante, f.modelo)]}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{f.fabricante}</p>
          <h3 className="font-display font-semibold text-base text-foreground leading-tight">{f.modelo}</h3>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="secondary" className="text-[11px]">{ROTULO_TIPO[f.tipo] ?? f.tipo}</Badge>
            <Badge variant="outline" className="text-[11px]">posição {ROTULO_POSICAO[f.posicao] ?? f.posicao}</Badge>
          </div>

          {f.alerta && (
            <div className="mt-2 rounded-lg border-2 border-destructive/50 bg-destructive/10 p-2.5">
              <p className="text-[11px] font-semibold text-destructive flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                {ROTULO_ALERTA[f.alerta.tipo] ?? "Alerta do fabricante"}
              </p>
              <p className="text-[11px] text-foreground/85 leading-relaxed mt-1">{f.alerta.nota}</p>
              <a href={f.alerta.url} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline mt-1">
                comunicado de {f.alerta.data} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {f.descricao && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-3">{f.descricao}</p>
          )}

          <dl className="mt-3 space-y-1 text-xs">
            <div className="flex gap-2">
              <dt className="text-muted-foreground shrink-0">Tamanhos</dt>
              <dd className="text-foreground">{tamanhos.map(numeroPt).join(" · ")} mm</dd>
            </div>
            {temAnel && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground shrink-0">Anel</dt>
                <dd className="text-foreground">{numeroPt(anelMin)}–{numeroPt(anelMax)} mm</dd>
              </div>
            )}
            {comGradiente.length > 0 && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground shrink-0">Grad. ref.</dt>
                <dd className="text-foreground">
                  {comGradiente
                    .map((l) => `${numeroPt(l.size!)} mm: ${l.mean_gradient_ref}${l.mean_gradient_ref_sd ? `±${l.mean_gradient_ref_sd}` : ""} mmHg`)
                    .join(" · ")}
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-muted-foreground shrink-0">EOA ref.</dt>
              <dd className="text-foreground">
                {comEoa.length > 0
                  ? comEoa.map((l) => `${numeroPt(l.size!)} mm: ${l.effective_orifice_area}${l.eoa_reference_sd ? `±${l.eoa_reference_sd}` : ""} cm²`).join(" · ")
                  : <SemEoa fabricante={f.fabricante} modelo={f.modelo} />}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-3 mt-3">
            {f.referencia && (
              <a href={f.referencia} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                Página do fabricante <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {comEoa[0]?.eoa_source_url && (
              <a href={comEoa[0].eoa_source_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                Fonte da EOA <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * O campo vazio de EOA, dito com precisão.
 *
 * "Sem valor publicado" tem dois sentidos clinicamente opostos: ninguém
 * procurou, ou procurou-se e não existe. Sem separar os dois, o médico não sabe
 * se o produto é mal documentado ou se o catálogo é incompleto — e pode ler a
 * ausência como "esta prótese não dá mismatch".
 */
function SemEoa({ fabricante, modelo }: { fabricante: string; modelo: string }) {
  const busca = buscaDaFamilia(fabricante, modelo);
  if (!busca) {
    return <span className="text-muted-foreground">ainda não pesquisado</span>;
  }
  return (
    <span className="text-muted-foreground">
      {TEXTO_DO_RESULTADO[busca.resultado]}{" "}
      <span className="text-[10px]">(busca de {BUSCA_FEITA_EM})</span>
      {busca.referencia && (
        <>
          {" "}
          <a
            href={busca.referencia.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            ver o estudo mais próximo
          </a>
        </>
      )}
    </span>
  );
}
