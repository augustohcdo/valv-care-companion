#!/usr/bin/env node
/**
 * Popula (ou remove) a base fictícia de demonstração.
 *
 *   SUPABASE_ACCESS_TOKEN=... node scripts/demo-seed.mjs --aplicar --medico email@exemplo.com
 *   SUPABASE_ACCESS_TOKEN=... node scripts/demo-seed.mjs --limpar
 *
 * É script, e não migration, de propósito: uma migration levaria paciente
 * inventado para dentro de toda restauração de desastre. Aqui a base de
 * demonstração é uma escolha explícita de quem roda.
 *
 * `--aplicar` limpa antes de inserir, então rodar duas vezes não duplica.
 * `--limpar` sozinho tem que devolver o banco exatamente ao estado anterior —
 * um seed que não sabe se desfazer é armadilha, não conveniência.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { CASOS, MEDICOS, dia, instante } from "./demo-data.mjs";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("Falta SUPABASE_ACCESS_TOKEN no ambiente (token da API de management do Supabase).");
  process.exit(1);
}

const config = readFileSync(resolve(raiz, "supabase/config.toml"), "utf8");
const REF = config.match(/project_id\s*=\s*"([^"]+)"/)?.[1];
if (!REF) { console.error("Não achei project_id em supabase/config.toml"); process.exit(1); }
const URL_BASE = `https://${REF}.supabase.co`;

const args = process.argv.slice(2);
const temFlag = (n) => args.includes(n);
const valorFlag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

// ---------------------------------------------------------------- infra
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`SQL falhou (${r.status}): ${texto.slice(0, 400)}\n${query.slice(0, 200)}`);
  return JSON.parse(texto);
}

let SERVICE_ROLE;
async function chaves() {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!r.ok) throw new Error(`Não consegui ler as chaves do projeto (${r.status})`);
  SERVICE_ROLE = (await r.json()).find((k) => k.name === "service_role").api_key;
}

const cabecalhos = () => ({
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  "Content-Type": "application/json",
});

async function inserir(tabela, linhas) {
  if (!linhas.length) return [];
  const r = await fetch(`${URL_BASE}/rest/v1/${tabela}`, {
    method: "POST",
    headers: { ...cabecalhos(), Prefer: "return=representation" },
    body: JSON.stringify(linhas),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Insert em ${tabela} falhou (${r.status}): ${texto.slice(0, 500)}`);
  return JSON.parse(texto);
}

// ------------------------------------------------------- PDF do laudo
/**
 * PDF mínimo com texto Helvetica, escrito à mão.
 *
 * Existe porque o documento anexado precisa ser um arquivo **de verdade**: o
 * painel de administração alarma sobre "documento sem arquivo"
 * (`documentos_sem_arquivo()`), e uma linha em `case_documents` apontando para
 * o vazio viraria alarme falso — a demonstração criando o defeito que o
 * sistema existe para detectar.
 */
function pdfDeLaudo(linhas) {
  const conteudo = ["BT", "/F1 10 Tf", "1 0 0 1 45 790 Tm", "13 TL"];
  for (const l of linhas) {
    conteudo.push(`(${l.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")}) Tj T*`);
  }
  conteudo.push("ET");
  const stream = Buffer.from(conteudo.join("\n"), "latin1");
  const objs = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
      + "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"),
    Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from("\nendstream")]),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
  ];
  let out = Buffer.from("%PDF-1.4\n");
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out = Buffer.concat([out, Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from("\nendobj\n")]);
  });
  const xref = out.length;
  let tabela = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) tabela += `${String(off).padStart(10, "0")} 00000 n \n`;
  return Buffer.concat([
    out, Buffer.from(tabela),
    Buffer.from(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`),
  ]);
}

function laudoDoCaso(caso, exame) {
  const num = (v, u) => (v == null ? null : `${v} ${u}`);
  return pdfDeLaudo([
    "CLINICA DE ECOCARDIOGRAFIA - DOCUMENTO FICTICIO DE DEMONSTRACAO",
    "",
    `Paciente: ${caso.patient_name.toUpperCase()}`,
    `Idade: ${caso.patient_age} anos     Sexo: ${caso.patient_sex === "F" ? "Feminino" : "Masculino"}`,
    `Data do exame: ${exame.data.split("-").reverse().join("/")}`,
    "",
    "ECOCARDIOGRAMA TRANSTORACICO COM DOPPLER",
    "",
    ...[
      num(exame.ejection_fraction, "%") && `Fracao de ejecao: ${exame.ejection_fraction}%`,
      num(exame.mean_gradient, "mmHg") && `Gradiente medio: ${exame.mean_gradient} mmHg`,
      num(exame.peak_gradient, "mmHg") && `Gradiente maximo: ${exame.peak_gradient} mmHg`,
      num(exame.valve_area, "cm2") && `Area valvar: ${String(exame.valve_area).replace(".", ",")} cm2`,
      num(exame.psap, "mmHg") && `PSAP estimada: ${exame.psap} mmHg`,
    ].filter(Boolean),
    "",
    `Observacao: ${exame.notes ?? "-"}`,
    "",
    "DOCUMENTO FICTICIO, GERADO PARA DEMONSTRACAO DO PRODUTO.",
    "Nao corresponde a exame de pessoa real.",
  ]);
}

// ---------------------------------------------------------------- limpar
async function limpar() {
  const [{ casos, medicos }] = await sql(`select
      (select count(*) from public.clinical_cases where is_demo) casos,
      (select count(*) from public.doctors where is_demo) medicos`);
  if (Number(casos) === 0 && Number(medicos) === 0) {
    console.log("Nada de demonstração para remover.");
    return;
  }

  // Os arquivos primeiro: apagar a linha antes deixaria o objeto órfão no
  // bucket, e o painel de administração conta objeto sem linha.
  const objetos = await sql(`select storage_path from public.case_documents
     where case_id in (select id from public.clinical_cases where is_demo)`);
  for (const { storage_path } of objetos) {
    await fetch(`${URL_BASE}/storage/v1/object/medical-documents/${storage_path}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${SERVICE_ROLE}` },
    });
  }

  // `case_comments` e `case_collaborators` não têm chave estrangeira para
  // `clinical_cases` (conferido em pg_constraint), então não cascateiam.
  await sql(`
    delete from public.case_comments where case_id in (select id from public.clinical_cases where is_demo);
    delete from public.case_collaborators where case_id in (select id from public.clinical_cases where is_demo);
    delete from public.clinical_cases where is_demo;
    delete from public.audit_logs where user_id in (select user_id from public.doctors where is_demo);
    delete from public.doctors where is_demo;`);

  const emails = MEDICOS.map((m) => `'${m.email}'`).join(",");
  await sql(`delete from auth.users where email in (${emails})`);
  console.log(`Removidos: ${casos} caso(s) de demonstração, ${medicos} médico(s) fictício(s), ${objetos.length} arquivo(s).`);
}

// --------------------------------------------------------------- aplicar
async function aplicar(emailMedico) {
  const [alvo] = await sql(`select d.id, d.user_id, u.email
      from public.doctors d join auth.users u on u.id = d.user_id
     where u.email = '${emailMedico.replace(/'/g, "''")}'`);
  if (!alvo) throw new Error(`Não achei registro de médico para ${emailMedico}.`);
  console.log(`Médico dono dos casos: ${alvo.email} (${alvo.id})`);

  await limpar();

  // --- os três colegas do Heart Team
  const porChave = {};
  for (const m of MEDICOS) {
    const r = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
      method: "POST", headers: cabecalhos(),
      body: JSON.stringify({
        email: m.email, email_confirm: true,
        user_metadata: { full_name: m.nome, account_type: "medico" },
        // Banido até 2099: a conta existe para assinar a discussão, nunca para
        // ser usada. Sem isso seriam três portas de entrada a mais.
        ban_duration: "876000h",
      }),
    });
    const criado = await r.json();
    if (!criado.id) throw new Error(`Falha ao criar ${m.email}: ${JSON.stringify(criado).slice(0, 300)}`);
    await sql(`update auth.users set confirmation_token='', recovery_token='',
               email_change='', email_change_token_new='' where id='${criado.id}'`);
    const [medico] = await inserir("doctors", [{
      user_id: criado.id, crm: m.crm, crm_uf: m.uf, specialty: m.especialidade,
      is_demo: true, verified: false,
    }]);
    porChave[m.chave] = { user_id: criado.id, doctor_id: medico.id };
  }
  console.log(`Médicos fictícios criados: ${MEDICOS.length} (contas banidas, sem acesso).`);

  // --- os casos
  let nExames = 0, nEventos = 0, nComentarios = 0, nCompromissos = 0, nColab = 0, nDocs = 0;
  for (const c of CASOS) {
    const [caso] = await inserir("clinical_cases", [{
      doctor_id: alvo.id, is_demo: true,
      patient_name: c.patient_name, patient_age: c.patient_age, patient_sex: c.patient_sex,
      valve_type: c.valve_type, valve_disease: c.valve_disease, severity: c.severity, nyha: c.nyha,
      symptoms: c.symptoms, comorbidities: c.comorbidities,
      ejection_fraction: c.ejection_fraction, mean_gradient: c.mean_gradient,
      peak_gradient: c.peak_gradient, valve_area: c.valve_area,
      regurgitation_grade: c.regurgitation_grade || null,
      proposed_management: c.proposed_management, clinical_notes: c.clinical_notes,
      status: c.status,
      created_at: instante(c.dias_atras, 9), updated_at: instante(Math.min(...c.exames.map((e) => e.dias)), 11),
    }]);

    const exames = await inserir("case_exams", c.exames.map((e) => ({
      case_id: caso.id, created_by: alvo.user_id, exam_type: e.tipo, exam_date: dia(e.dias),
      title: e.titulo, ejection_fraction: e.ejection_fraction ?? null,
      mean_gradient: e.mean_gradient ?? null, peak_gradient: e.peak_gradient ?? null,
      valve_area: e.valve_area ?? null, regurgitation_grade: e.regurgitation_grade ?? null,
      psap: e.psap ?? null, lv_diameter: e.lv_diameter ?? null, septal_thickness: e.septal_thickness ?? null,
      bnp: e.bnp ?? null, nt_probnp: e.nt_probnp ?? null, six_min_walk: e.six_min_walk ?? null,
      notes: e.notes ?? null, created_at: instante(e.dias, 10),
    })));
    nExames += exames.length;

    nEventos += (await inserir("case_events", c.eventos.map((e) => ({
      case_id: caso.id, created_by: alvo.user_id, event_type: e.tipo,
      event_date: dia(e.dias), title: e.titulo, description: e.descricao ?? null,
      created_at: instante(e.dias, 10),
    })))).length;

    // O comentário do dono sai com o usuário dele; os dos colegas, com o
    // usuário fictício correspondente — é o que dá autoria distinta na tela.
    nComentarios += (await inserir("case_comments", c.comentarios.map((m, i) => {
      const quem = m.autor ? porChave[m.autor] : { user_id: alvo.user_id, doctor_id: alvo.id };
      return {
        case_id: caso.id, author_id: quem.user_id, author_doctor_id: quem.doctor_id,
        body: m.body, is_heart_team_decision: m.heart_team === true,
        created_at: instante(Math.max(1, c.dias_atras - 7 - i * 2), 15),
      };
    }))).length;

    nCompromissos += (await inserir("appointments", c.compromissos.map((a) => ({
      case_id: caso.id, created_by: alvo.user_id, appointment_type: a.tipo,
      status: a.status, scheduled_at: instante(a.dias, 10),
      duration_minutes: a.duracao ?? 30, location: a.local ?? null, notes: a.notas ?? null,
      created_at: instante(c.dias_atras, 9),
    })))).length;

    nColab += (await inserir("case_collaborators", (c.colaboradores ?? []).map((chave) => ({
      case_id: caso.id, doctor_id: porChave[chave].doctor_id, invited_by: alvo.user_id,
      access_level: "comentar", status: "aceito",
    })))).length;

    // Laudo de verdade no bucket, para a leitura de laudo poder ser
    // demonstrada no próprio caso.
    if (c.laudo) {
      const eco = c.exames.find((e) => e.tipo === "eco");
      const bytes = laudoDoCaso(c, { ...eco, data: dia(eco.dias) });
      const caminho = `${caso.id}/${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.pdf`;
      const up = await fetch(`${URL_BASE}/storage/v1/object/medical-documents/${caminho}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/pdf" },
        body: bytes,
      });
      if (!up.ok) throw new Error(`Upload do laudo falhou (${up.status}): ${(await up.text()).slice(0, 300)}`);
      await inserir("case_documents", [{
        case_id: caso.id, uploaded_by: alvo.user_id, document_type: "ecocardiograma",
        file_name: `laudo-eco-${dia(eco.dias)}.pdf`, storage_path: caminho,
        file_size: bytes.length, mime_type: "application/pdf",
        created_at: instante(eco.dias, 10),
      }]);
      nDocs++;
    }
  }

  console.log(
    `Inseridos: ${CASOS.length} casos, ${nExames} exames, ${nEventos} eventos, ` +
    `${nComentarios} comentários, ${nCompromissos} compromissos, ${nColab} colaborações, ${nDocs} laudos.`,
  );
}

// ------------------------------------------------------------------ main
await chaves();
if (temFlag("--limpar") && !temFlag("--aplicar")) {
  await limpar();
} else if (temFlag("--aplicar")) {
  await aplicar(valorFlag("--medico") ?? "aholiveira98@gmail.com");
  const [m] = await sql("select public.admin_site_metrics() m");
  console.log(`Painel de administração: ${m.m.casos} caso(s) real(is), ${m.m.casos_demo} de demonstração; `
    + `${m.m.medicos} médico(s) real(is), ${m.m.medicos_demo} fictício(s).`);
} else {
  console.log("Use --aplicar [--medico email] ou --limpar.");
  process.exit(1);
}
