// Route prefetch registry — dynamic imports keyed by pathname prefix.
// Kicks lazy chunks on hover/touchstart so the tap navigation feels instant.

type Loader = () => Promise<unknown>;

const loaders: Array<[RegExp, Loader]> = [
  [/^\/aprender\/glossario/, () => import("@/pages/public/Glossario")],
  [/^\/aprender\/faq/, () => import("@/pages/public/FAQPage")],
  [/^\/aprender\/[^/]+/, () => import("@/pages/public/TopicDetail")],
  [/^\/aprender$/, () => import("@/pages/public/Aprender")],
  [/^\/seguranca/, () => import("@/pages/public/Seguranca")],
  [/^\/referencias/, () => import("@/pages/public/Referencias")],
  [/^\/termos/, () => import("@/pages/public/Termos")],
  [/^\/privacidade/, () => import("@/pages/public/Privacidade")],
  [/^\/cookies/, () => import("@/pages/public/Cookies")],
  [/^\/dpo/, () => import("@/pages/public/DPO")],
  [/^\/contato/, () => import("@/pages/public/Contato")],
  [/^\/parceiros/, () => import("@/pages/public/Parceiros")],
  [/^\/aviso-medico/, () => import("@/pages/public/AvisoMedico")],

  [/^\/app\/medico\/pacientes\/[^/]+/, () => import("@/pages/app/MedicoPacienteDetalhe")],
  [/^\/app\/medico\/pacientes/, () => import("@/pages/app/MedicoPacientes")],
  [/^\/app\/medico\/casos\/novo/, () => import("@/pages/app/NovoCaso")],
  [/^\/app\/medico\/casos\/[^/]+/, () => import("@/pages/app/CasoDetalhe")],
  [/^\/app\/medico\/casos/, () => import("@/pages/app/ListaCasos")],
  [/^\/app\/medico\/agenda/, () => import("@/pages/app/MedicoAgenda")],
  [/^\/app\/medico\/colaboracoes/, () => import("@/pages/app/MedicoColaboracoes")],
  [/^\/app\/medico\/relatorios/, () => import("@/pages/app/MedicoRelatorios")],
  [/^\/app\/medico\/biblioteca\/[^/]+/, () => import("@/pages/app/BibliotecaDetalhe")],
  [/^\/app\/medico\/biblioteca/, () => import("@/pages/app/Biblioteca")],
  [/^\/app\/medico\/perfil/, () => import("@/pages/app/MedicoPerfil")],
  [/^\/app\/medico$/, () => import("@/pages/app/MedicoHome")],

  [/^\/app\/paciente\/jornada/, () => import("@/pages/app/PacienteJornada")],
  [/^\/app\/paciente\/medico/, () => import("@/pages/app/PacienteMedico")],
  [/^\/app\/paciente\/documentos/, () => import("@/pages/app/PacienteDocumentos")],
  [/^\/app\/paciente\/diario/, () => import("@/pages/app/PacienteDiario")],
  [/^\/app\/paciente\/medicacoes/, () => import("@/pages/app/PacienteMedicacoes")],
  [/^\/app\/paciente\/aprender\/[^/]+/, () => import("@/pages/app/PacienteAprenderDetalhe")],
  [/^\/app\/paciente\/aprender/, () => import("@/pages/app/PacienteAprender")],
  [/^\/app\/paciente\/perfil/, () => import("@/pages/app/PacientePerfil")],
  [/^\/app\/paciente\/integracoes/, () => import("@/pages/app/PacienteIntegracoes")],
  [/^\/app\/paciente$/, () => import("@/pages/app/PacienteHome")],

  [/^\/app\/hospital/, () => import("@/pages/app/HospitalPortal")],
  [/^\/app\/admin\/integracoes/, () => import("@/pages/app/AdminIntegracoes")],
  [/^\/app\/admin\/fhir-sandbox/, () => import("@/pages/app/FhirSandbox")],
  [/^\/app\/privacidade/, () => import("@/pages/app/Privacidade")],
];

const started = new Set<string>();

export function prefetchRoute(pathname: string) {
  if (!pathname || started.has(pathname)) return;
  const match = loaders.find(([re]) => re.test(pathname));
  if (!match) return;
  started.add(pathname);
  // Fire and forget; errors are harmless (chunk will retry on real nav).
  match[1]().catch(() => started.delete(pathname));
}

/** Attach to Link/NavLink: onMouseEnter/onTouchStart/onFocus. */
export function prefetchHandlers(to: string) {
  const run = () => prefetchRoute(to);
  return {
    onMouseEnter: run,
    onFocus: run,
    onTouchStart: run,
  };
}
