#!/usr/bin/env python3
"""Coleta de dados públicos de válvulas cardíacas por API aberta (somente biblioteca padrão).

Uso:
  python3 coletar.py anvisa  --desde 2026-09-01 [--todos]
  python3 coletar.py pncp    --desde 2026-09-01 [--termos "tavi,valvula aortica"]
  python3 coletar.py fda     --desde 2026-09-01
  python3 coletar.py estudos --desde 2026-09-01
  python3 coletar.py pubmed  --desde 2026-09-01
  python3 coletar.py sec     [--empresas EW,MDT,ABT,BSX]
  python3 coletar.py tudo    --desde 2026-09-01

Saída em Markdown, com link e data em cada linha. Cada fonte falha de forma isolada e o erro é
impresso, para o briefing informar o que ficou sem checagem. Nada aqui substitui a leitura da
fonte primária: use os links para conferir antes de afirmar.
"""
import argparse, csv, os, datetime as dt, io, json, re, sys, time, urllib.error, urllib.parse, urllib.request

# Identificação enviada às APIs. Não contém dados pessoais. Se alguma API (ex.: SEC) exigir contato, defina VALVE_INTEL_CONTATO.
UA = "valve-intel/1.0 (pesquisa de inteligencia competitiva" + (f"; contato: {os.environ['VALVE_INTEL_CONTATO']}" if os.environ.get("VALVE_INTEL_CONTATO") else "") + ")"
# Foco: cirurgia valvar aberta (SAVR, mitral, tricúspide, raiz da aorta). Transcateter entra como contexto e concorrência.
TERMOS_PNCP = ["protese valvar biologica", "protese valvular mecanica", "bioprotese valvar", "protese valvular cardiaca",
               "valva cardiaca", "anel de anuloplastia", "valva aortica", "protese valvar mitral", "tubo valvado",
               "conduto valvado", "enxerto valvado", "sutureless",
               "valvula aortica transcateter", "TAVI", "clipe mitral"]
RELEVANTE_PNCP = re.compile(r"V[AÁ]LVUL|VALVAR|VALVA\b|ANEL.{0,20}ANULOPLAST|ENXERTO VALV|CONDUTO VALV|TUBO VALV|PR[OÓ]TESE (?:BIOL|MEC|VALV)|\bTAVI\b|\bTAVR\b|TRANSCATETER|CLIPE|BIOPR[OÓ]TESE|ANULOPLAST|MITRAL|TRIC[UÚ]SPIDE", re.I)
RELEVANTE_ESTUDO = re.compile(r"valv|TAVR|TAVI|TEER|mitral|tricuspid|aortic|transcatheter|annuloplasty|SAVR|bioprosthe", re.I)
SEGMENTO_TC = re.compile(r"TRANSCATETER|TRANSCATHETER|PERCUT|\bTHV\b|\bTAVI\b|\bTAVR\b|CLIPE|CLIP\b|EVOLUT|MYVAL|ALLEGRA|HARMONY|NAVITOR|PORTICO|SAPIEN|EVOQUE|VITAFLOW|TRICVALVE|ACURATE|MELODY|DELIVERY|SISTEMA DE ENTREGA|CERTITUDE|COMMANDER|OCTACOR", re.I)


def segmento(texto):
    return "Transcateter" if SEGMENTO_TC.search(texto or "") else "Cirúrgico/outro"
MARCAS = r"\b(?:SAPIEN|EVOQUE|PASCAL|EVOLUT|NAVITOR|PORTICO|MITRACLIP|TRICLIP|MYVAL|ACURATE|TRILOGY|DURAVR|TENDYNE|INTREPID|INSPIRIS|MITRIS|KONECT|INTUITY|PERIMOUNT|AVALUS|HANCOCK|OPEN PIVOT|SIMULUS|PERCEVAL|MITROFLOW|CARBOMEDICS|BICARBON|PERICARBON|TRIFECTA|INOVARE|DAFODIL|ON-X|LOTUS|CARDIOBAND|TRICVALVE|EPIC)\b"
TECNICO = r"V[AÁ]LVULAS? CARD|PR[OÓ]TESE VALVULAR|VALVULAR CARD|ANULOPLAST|INSTRUMENTAL PARA V[AÁ]LVULAS CARD|MEDIDOR PARA V[AÁ]LVULA CARD|TRANSCATETER"


def get(url, timeout=60, raw=False, tentativas=6):
    """GET com novas tentativas e espera crescente (APIs públicas recusam rajadas)."""
    for n in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
            return data if raw else json.loads(data)
        except urllib.error.HTTPError as e:
            if e.code in (400, 401, 403, 404) or n == tentativas - 1:
                raise
        except Exception:
            if n == tentativas - 1:
                raise
        time.sleep(3 * (n + 1))


def pdate(s):
    for f in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(s.strip()[:10], f).date()
        except Exception:
            pass
    return None


def anvisa(desde, todos=False):
    """Cadastro aberto de produtos para saúde (dados.anvisa.gov.br). Filtra válvulas e marcas."""
    print("## ANVISA: registros de válvulas e dispositivos relacionados")
    url = "https://dados.anvisa.gov.br/dados/TA_PRODUTO_SAUDE_SITE.csv"
    raw = get(url, 300, raw=True).decode("latin-1")
    rows = list(csv.DictReader(io.StringIO(raw), delimiter=";"))
    vistos, saida = set(), []
    for x in rows:
        nome = (x["NOME_TECNICO"] + " " + x["NOME_COMERCIAL"]).upper()
        if not (re.search(TECNICO, x["NOME_TECNICO"].upper()) or re.search(MARCAS, nome)):
            continue
        if re.search(r"HIDROCEFALIA|GASES|HEMOST|CONECTOR|TORNEIRA|EXTENSOR", nome) and not re.search(MARCAS, nome):
            continue
        chave = (x["NUMERO_REGISTRO_CADASTRO"], x["NOME_COMERCIAL"])
        if chave in vistos:
            continue
        vistos.add(chave)
        pub, upd = pdate(x["DT_PUB_REGISTRO_CADASTRO"]), None
        if not todos and not (pub and pub >= desde):
            continue
        saida.append((pub or dt.date.min, x, upd))
    saida.sort(key=lambda t: (segmento(t[1]["NOME_COMERCIAL"]) == "Transcateter", -(t[0].toordinal())))
    print(f"Fonte: {url} (arquivo baixado agora; {len(rows)} linhas no total). "
          f"Critério: data de publicação do registro a partir de {desde}. Itens: {len(saida)}. Cirurgia listada primeiro; a separação cirúrgico/transcateter é por palavras-chave no nome e pode errar em casos de borda.\n")
    print("| Segmento | Registro | Produto | Detentor | Fabricante (país) | Classe | Publicação | Validade |")
    print("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for pub, x, upd in saida[:200]:
        print(f"| {segmento(x['NOME_COMERCIAL'])} | {x['NUMERO_REGISTRO_CADASTRO']} | {x['NOME_COMERCIAL'][:80]} | {x['DETENTOR_REGISTRO_CADASTRO'][:40]} | "
              f"{x['NOME_FABRICANTE'][:30]} ({x['NOME_PAIS_FABRIC']}) | {x['CLASSE_RISCO']} | {x['DT_PUB_REGISTRO_CADASTRO']} | "
              f"{x['VALIDADE_REGISTRO_CADASTRO']} |")
    print("\nLimite: o campo de atualização do arquivo é a data da carga (igual para todas as linhas), então só a data de publicação "
          "detecta registros novos; revalidações, alterações e cancelamentos exigem comparar com uma cópia anterior do arquivo ou ler o DOU.")
    print("Atenção: o cadastro mostra o registro vigente, não a situação regulatória completa nem a indicação aprovada. "
          "Confirme na Consulta de Produtos da ANVISA e no DOU (busca: https://www.in.gov.br/consulta).")


def pncp(desde, termos):
    """Busca pública do PNCP: editais, atas e contratos."""
    print("## PNCP: compras públicas (editais, atas e contratos)")
    base = "https://pncp.gov.br/api/search/"
    achados = {}
    for tipo in ("edital", "ata", "contrato"):
        for t in termos:
            q = urllib.parse.urlencode({"q": t, "tipos_documento": tipo, "ordenacao": "-data",
                                        "pagina": 1, "tam_pagina": 50, "status": "todos"})
            time.sleep(2.0)
            try:
                d = get(f"{base}?{q}")
            except Exception as e:
                print(f"- Falha em {tipo}/{t}: {e}")
                continue
            for it in d.get("items", []):
                dia = pdate(it.get("data_publicacao_pncp") or it.get("createdAt") or "")
                if dia and dia >= desde and RELEVANTE_PNCP.search(it.get("description") or ""):
                    achados[it["id"]] = it
    unicos = {}
    for it in achados.values():  # mesmo objeto publicado em vários lotes/itens aparece repetido
        k = (it.get("orgao_cnpj"), it.get("unidade_codigo"), re.sub(r"\s+", " ", it.get("description") or "")[:120], (it.get("data_publicacao_pncp") or "")[:10], it.get("tipo_nome"))
        unicos.setdefault(k, it)
    achados = {i["id"]: i for i in unicos.values()}
    itens = sorted(achados.values(), key=lambda i: (segmento(i.get("description")) == "Transcateter", -int((i.get("data_publicacao_pncp") or "0")[:10].replace("-", "") or 0)))
    print(f"Fonte: {base}. Publicados a partir de {desde}, com termo de válvula no objeto. Cirurgia primeiro. Itens: {len(itens)}.\n")
    print("| Segmento | Publicação | Tipo | Órgão / unidade | UF | Município | Modalidade | Valor global (R$) | Objeto | Link |")
    print("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    for i in itens:
        obj = re.sub(r"\s+", " ", i.get("description") or "")[:200]
        link = "https://pncp.gov.br/app" + i.get("item_url", "")
        print(f"| {segmento(i.get('description'))} | {(i.get('data_publicacao_pncp') or '')[:10]} | {i.get('tipo_nome')} | "
              f"{i.get('orgao_nome')} / {i.get('unidade_nome')} | {i.get('uf')} | {i.get('municipio_nome')} | "
              f"{i.get('modalidade_licitacao_nome') or ''} | {i.get('valor_global') or ''} | {obj} | [PNCP]({link}) |")
    print("\nAtenção: `valor_global` costuma ser o total do contrato, não o unitário; itens e preços unitários estão nos documentos "
          "do link. A busca por texto pode trazer falsos positivos e perder editais com outra redação: confira o objeto.")


def fda(desde):
    """openFDA: recalls, PMA e eventos (MAUDE)."""
    print("## FDA (openFDA): recalls, aprovações PMA e eventos")
    d0 = desde.strftime("%Y%m%d"); d1 = dt.date.today().strftime("%Y%m%d")
    consultas = [
        ("Recalls de dispositivos (válvula)", "https://api.fda.gov/device/recall.json?search="
         + urllib.parse.quote(f'product_description:(valve OR "heart valve" OR annuloplasty OR bioprosthetic OR TAVR OR transcatheter) AND event_date_initiated:[{desde} TO {dt.date.today()}]') + "&limit=25",
         lambda r: f"{r.get('event_date_initiated','')} | {r.get('recalling_firm','')} | {r.get('product_description','')[:120]} | {r.get('reason_for_recall','')[:160]} | classe {r.get('openfda',{}).get('device_class','')}"),
        ("PMA: decisões recentes de válvulas", "https://api.fda.gov/device/pma.json?search="
         + urllib.parse.quote(f'(generic_name:valve OR trade_name:(INSPIRIS OR MITRIS OR KONECT OR INTUITY OR PERIMOUNT OR AVALUS OR HANCOCK OR MOSAIC OR EPIC OR TRIFECTA OR PERCEVAL OR ON-X OR MITROFLOW OR SAPIEN OR EVOQUE OR PASCAL OR EVOLUT OR NAVITOR OR TRICLIP OR MITRACLIP)) AND decision_date:[{desde} TO {dt.date.today()}]') + "&sort=decision_date:desc&limit=25",
         lambda r: f"{r.get('decision_date','')} | {r.get('applicant','')} | {r.get('trade_name','')} | {r.get('pma_number','')}{r.get('supplement_number','')} | {r.get('supplement_reason','')[:120]}"),
    ]
    for nome, url, fmt in consultas:
        try:
            d = get(url)
            res = d.get("results", [])
            print(f"\n**{nome}** ({len(res)} itens). Fonte: {url}")
            for r in res:
                print("- " + fmt(r))
        except urllib.error.HTTPError as e:
            print(f"\n**{nome}**: {'sem resultados no período' if e.code == 404 else 'falha HTTP %s' % e.code}")
        except Exception as e:
            print(f"\n**{nome}**: falha ({e})")
    print("\nAtenção: openFDA é não validado. MAUDE é notificação espontânea, não incidência. Confirme decisões no banco PMA da FDA.")


def estudos(desde):
    """ClinicalTrials.gov: estudos de válvulas atualizados desde a data. Cirurgia primeiro."""
    print("## ClinicalTrials.gov: estudos de válvulas com atualização recente")
    consultas = [
        ("Cirurgia valvar aberta", "(\"surgical aortic valve\" OR SAVR OR \"aortic valve replacement\" OR \"mitral valve repair\" OR \"mitral valve replacement\" OR annuloplasty OR bioprosthetic OR \"mechanical valve\" OR sutureless OR \"valve surgery\" OR \"tricuspid valve surgery\")"),
        ("Transcateter e geral (contexto)", "(transcatheter OR TAVR OR TAVI OR TEER) AND (valve OR valvular)"),
    ]
    vistos = set()
    for nome, termo in consultas:
        print(f"\n**{nome}**")
        cirurgica = nome.startswith("Cirurgia")
        q = urllib.parse.urlencode({
            "query.term": termo, "filter.advanced": f"AREA[LastUpdatePostDate]RANGE[{desde},MAX]",
            "sort": "LastUpdatePostDate:desc", "pageSize": 40,
            "fields": "NCTId,BriefTitle,OverallStatus,LeadSponsorName,LastUpdatePostDate,StudyFirstPostDate,Phase"})
        url = f"https://clinicaltrials.gov/api/v2/studies?{q}"
        try:
            time.sleep(1.0)
            for s_ in get(url).get("studies", []):
                p = s_["protocolSection"]; i = p["identificationModule"]; st = p["statusModule"]
                if not RELEVANTE_ESTUDO.search(i.get("briefTitle", "")) or i["nctId"] in vistos:
                    continue
                if cirurgica and re.search(r"transcatheter|TAVR|TAVI|TEER|percutaneous", i.get("briefTitle", ""), re.I):
                    continue
                vistos.add(i["nctId"])
                spons = p.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name", "")
                print(f"- {st.get('lastUpdatePostDateStruct',{}).get('date','')} (registrado {st.get('studyFirstPostDateStruct',{}).get('date','')}) | "
                      f"{st.get('overallStatus','')} | {spons} | {i.get('briefTitle','')[:130]} | [{i['nctId']}](https://clinicaltrials.gov/study/{i['nctId']})")
        except Exception as e:
            print(f"Falha: {e}")


def pubmed(desde):
    """PubMed: artigos indexados desde a data. Cirurgia valvar primeiro, depois transcateter e geral."""
    print("## PubMed: artigos novos")
    consultas = [
        ("Cirurgia valvar aberta", '("aortic valve replacement"[tiab] OR SAVR[tiab] OR "surgical aortic valve"[tiab] OR "mitral valve repair"[tiab] OR "mitral valve replacement"[tiab] OR "mitral valve surgery"[tiab] OR "tricuspid valve surgery"[tiab] OR "aortic root"[tiab] OR Bentall[tiab] OR "Ross procedure"[tiab] OR "valve-sparing"[tiab] OR annuloplasty[tiab] OR sutureless[tiab] OR "rapid-deployment valve"[tiab] OR "minimally invasive valve"[tiab] OR "mechanical valve"[tiab] OR "bioprosthetic valve"[tiab] OR "structural valve deterioration"[tiab] OR "valve reoperation"[tiab] OR "redo aortic"[tiab] OR "aortic valve surgery"[tiab] OR "cardiac valve surgery"[tiab]) AND (valve[tiab] OR valves[tiab] OR valvular[tiab]) NOT (transcatheter[tiab] OR TAVR[tiab] OR TAVI[tiab] OR TEER[tiab] OR percutaneous[tiab])'),
        ("Transcateter e geral (contexto)", '(TAVR OR TAVI OR "transcatheter aortic" OR "transcatheter edge-to-edge" OR "transcatheter tricuspid" OR "transcatheter mitral" OR "aortic stenosis")'),
    ]
    for nome, termo in consultas:
        print(f"\n**{nome}**")
        q = urllib.parse.urlencode({"db": "pubmed", "term": termo, "datetype": "edat", "mindate": desde.strftime("%Y/%m/%d"),
                                    "maxdate": dt.date.today().strftime("%Y/%m/%d"), "retmode": "json", "retmax": 40, "sort": "date"})
        try:
            time.sleep(1.0)
            ids = get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?" + q)["esearchresult"]["idlist"]
            if not ids:
                print("Sem artigos no período."); continue
            s = get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=" + ",".join(ids))["result"]
            for i in ids:
                r = s[i]
                print(f"- {r.get('pubdate','')} | {r.get('fulljournalname','')} | {r.get('title','')[:160]} | [PMID {i}](https://pubmed.ncbi.nlm.nih.gov/{i}/)")
        except Exception as e:
            print(f"Falha: {e}")
    print("\nAtenção: título e periódico são pista. Ler o resumo no PubMed antes de citar resultado. Relato de caso e revisão narrativa têm peso baixo de evidência.")


def sec(empresas):
    """SEC EDGAR: últimos comunicados (8-K, 10-Q, 10-K) das empresas listadas."""
    print("## SEC EDGAR: comunicados recentes")
    ciks = {"EW": ("Edwards Lifesciences", "0001099800"), "MDT": ("Medtronic", "0001613103"),
            "ABT": ("Abbott", "0000001800"), "BSX": ("Boston Scientific", "0000885725"),
            "AVN": ("Artivion", "0000784199")}
    for t in empresas:
        if t not in ciks:
            continue
        nome, cik = ciks[t]
        try:
            f = get(f"https://data.sec.gov/submissions/CIK{cik}.json")["filings"]["recent"]
            print(f"\n**{nome}** ({t})")
            n = 0
            for form, dia, acc, doc in zip(f["form"], f["filingDate"], f["accessionNumber"], f["primaryDocument"]):
                if form in ("8-K", "10-Q", "10-K", "S-4", "SC 13D", "425"):
                    print(f"- {dia} | {form} | [documento](https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-','')}/{doc})")
                    n += 1
                    if n >= 6: break
        except Exception as e:
            print(f"- {nome}: falha ({e})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("fonte", choices=["anvisa", "pncp", "fda", "estudos", "pubmed", "sec", "tudo"])
    ap.add_argument("--desde", default=str(dt.date.today() - dt.timedelta(days=1)), help="AAAA-MM-DD (padrão: ontem)")
    ap.add_argument("--termos", default=",".join(TERMOS_PNCP))
    ap.add_argument("--empresas", default="EW,MDT,ABT,BSX,AVN")
    ap.add_argument("--todos", action="store_true", help="anvisa: listar todos, sem filtro de data")
    a = ap.parse_args()
    desde = dt.date.fromisoformat(a.desde)
    print(f"# Coleta automática ({dt.datetime.now():%Y-%m-%d %H:%M}) | desde {desde}\n")
    passos = {"anvisa": lambda: anvisa(desde, a.todos), "pncp": lambda: pncp(desde, [t.strip() for t in a.termos.split(",")]),
              "fda": lambda: fda(desde), "estudos": lambda: estudos(desde), "pubmed": lambda: pubmed(desde),
              "sec": lambda: sec(a.empresas.split(","))}
    for nome in (passos if a.fonte == "tudo" else [a.fonte]):
        try:
            passos[nome](); print()
        except Exception as e:
            print(f"## {nome}: FALHOU ({e}). Registrar como não checado.\n")


if __name__ == "__main__":
    main()
