import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CookieBanner } from "@/components/CookieBanner";

import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicLayout } from "@/components/PublicLayout";
import { AppLayout } from "@/components/AppLayout";
import { PageSkeleton } from "@/components/PageSkeleton";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";

// Auth: pequenas, importadas direto
import Login from "./pages/auth/Login";
import Cadastro from "./pages/auth/Cadastro";
import RecuperarSenha from "./pages/auth/RecuperarSenha";
import RedefinirSenha from "./pages/auth/RedefinirSenha";
import AuthCallback from "./pages/auth/AuthCallback";

// Públicas: lazy
const Aprender = lazy(() => import("./pages/public/Aprender"));
const TopicDetail = lazy(() => import("./pages/public/TopicDetail"));
const Glossario = lazy(() => import("./pages/public/Glossario"));
const FAQPage = lazy(() => import("./pages/public/FAQPage"));
const Seguranca = lazy(() => import("./pages/public/Seguranca"));
const Referencias = lazy(() => import("./pages/public/Referencias"));
const Termos = lazy(() => import("./pages/public/Termos"));
const PrivacidadePublic = lazy(() => import("./pages/public/Privacidade"));
const AvisoMedico = lazy(() => import("./pages/public/AvisoMedico"));
const CookiesPage = lazy(() => import("./pages/public/Cookies"));
const DPOPage = lazy(() => import("./pages/public/DPO"));
const Contato = lazy(() => import("./pages/public/Contato"));
const Parceiros = lazy(() => import("./pages/public/Parceiros"));

// App (autenticado): lazy — corta drasticamente o bundle inicial
const MedicoHome = lazy(() => import("./pages/app/MedicoHome"));
const PacienteHome = lazy(() => import("./pages/app/PacienteHome"));
const NovoCaso = lazy(() => import("./pages/app/NovoCaso"));
const ListaCasos = lazy(() => import("./pages/app/ListaCasos"));
const CasoDetalhe = lazy(() => import("./pages/app/CasoDetalhe"));
const MedicoPacientes = lazy(() => import("./pages/app/MedicoPacientes"));
const MedicoPacienteDetalhe = lazy(() => import("./pages/app/MedicoPacienteDetalhe"));
const MedicoAgenda = lazy(() => import("./pages/app/MedicoAgenda"));
const MedicoColaboracoes = lazy(() => import("./pages/app/MedicoColaboracoes"));
const MedicoRelatorios = lazy(() => import("./pages/app/MedicoRelatorios"));
const PacienteJornada = lazy(() => import("./pages/app/PacienteJornada"));
const Biblioteca = lazy(() => import("./pages/app/Biblioteca"));
const BibliotecaDetalhe = lazy(() => import("./pages/app/BibliotecaDetalhe"));
const MedicoPerfil = lazy(() => import("./pages/app/MedicoPerfil"));
const PacientePerfil = lazy(() => import("./pages/app/PacientePerfil"));
const PacienteMedico = lazy(() => import("./pages/app/PacienteMedico"));
const PacienteDocumentos = lazy(() => import("./pages/app/PacienteDocumentos"));
const PacienteAprender = lazy(() => import("./pages/app/PacienteAprender"));
const PacienteAprenderDetalhe = lazy(() => import("./pages/app/PacienteAprenderDetalhe"));
const PacienteDiario = lazy(() => import("./pages/app/PacienteDiario"));
const PacienteMedicacoes = lazy(() => import("./pages/app/PacienteMedicacoes"));
const AppPrivacidade = lazy(() => import("./pages/app/Privacidade"));
const HospitalPortal = lazy(() => import("./pages/app/HospitalPortal"));
const AdminIntegracoes = lazy(() => import("./pages/app/AdminIntegracoes"));
const PacienteIntegracoes = lazy(() => import("./pages/app/PacienteIntegracoes"));

// QueryClient com defaults sensatos: cache mais longo, sem refetch agressivo
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const withSuspense = (node: JSX.Element, variant?: "dashboard" | "list" | "detail" | "form") => (
  <Suspense fallback={<PageSkeleton variant={variant} />}>{node}</Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CookieBanner />
          <Routes>
            {/* Auth */}
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/cadastro" element={<Cadastro />} />
            <Route path="/auth/recuperar" element={<RecuperarSenha />} />
            <Route path="/auth/redefinir" element={<RedefinirSenha />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Área autenticada */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/app/medico" element={<ProtectedRoute requiredType="medico">{withSuspense(<MedicoHome />)}</ProtectedRoute>} />
              <Route path="/app/medico/pacientes" element={<ProtectedRoute requiredType="medico">{withSuspense(<MedicoPacientes />, "list")}</ProtectedRoute>} />
              <Route path="/app/medico/pacientes/:id" element={<ProtectedRoute requiredType="medico">{withSuspense(<MedicoPacienteDetalhe />, "detail")}</ProtectedRoute>} />
              <Route path="/app/medico/casos" element={<ProtectedRoute requiredType="medico">{withSuspense(<ListaCasos />, "list")}</ProtectedRoute>} />
              <Route path="/app/medico/casos/novo" element={<ProtectedRoute requiredType="medico">{withSuspense(<NovoCaso />, "form")}</ProtectedRoute>} />
              <Route path="/app/medico/casos/:id" element={<ProtectedRoute requiredType="medico">{withSuspense(<CasoDetalhe />, "detail")}</ProtectedRoute>} />
              <Route path="/app/medico/agenda" element={<ProtectedRoute requiredType="medico">{withSuspense(<MedicoAgenda />)}</ProtectedRoute>} />
              <Route path="/app/medico/colaboracoes" element={<ProtectedRoute requiredType="medico">{withSuspense(<MedicoColaboracoes />, "list")}</ProtectedRoute>} />
              <Route path="/app/medico/relatorios" element={<ProtectedRoute requiredType="medico">{withSuspense(<MedicoRelatorios />)}</ProtectedRoute>} />
              <Route path="/app/medico/biblioteca" element={<ProtectedRoute requiredType="medico">{withSuspense(<Biblioteca />, "list")}</ProtectedRoute>} />
              <Route path="/app/medico/biblioteca/:slug" element={<ProtectedRoute requiredType="medico">{withSuspense(<BibliotecaDetalhe />, "detail")}</ProtectedRoute>} />
              <Route path="/app/medico/perfil" element={<ProtectedRoute requiredType="medico">{withSuspense(<MedicoPerfil />, "form")}</ProtectedRoute>} />

              <Route path="/app/paciente" element={<ProtectedRoute requiredType="paciente">{withSuspense(<PacienteHome />)}</ProtectedRoute>} />
              <Route path="/app/paciente/jornada" element={<ProtectedRoute requiredType="paciente">{withSuspense(<PacienteJornada />, "detail")}</ProtectedRoute>} />
              <Route path="/app/paciente/medico" element={<ProtectedRoute requiredType="paciente">{withSuspense(<PacienteMedico />)}</ProtectedRoute>} />
              <Route path="/app/paciente/documentos" element={<ProtectedRoute requiredType="paciente">{withSuspense(<PacienteDocumentos />, "list")}</ProtectedRoute>} />
              <Route path="/app/paciente/diario" element={<ProtectedRoute requiredType="paciente">{withSuspense(<PacienteDiario />, "form")}</ProtectedRoute>} />
              <Route path="/app/paciente/medicacoes" element={<ProtectedRoute requiredType="paciente">{withSuspense(<PacienteMedicacoes />, "list")}</ProtectedRoute>} />
              <Route path="/app/paciente/aprender" element={<ProtectedRoute requiredType="paciente">{withSuspense(<PacienteAprender />, "list")}</ProtectedRoute>} />
              <Route path="/app/paciente/aprender/:slug" element={<ProtectedRoute requiredType="paciente">{withSuspense(<PacienteAprenderDetalhe />, "detail")}</ProtectedRoute>} />
              <Route path="/app/paciente/perfil" element={<ProtectedRoute requiredType="paciente">{withSuspense(<PacientePerfil />, "form")}</ProtectedRoute>} />

              <Route path="/app/privacidade" element={<ProtectedRoute>{withSuspense(<AppPrivacidade />)}</ProtectedRoute>} />
            </Route>

            {/* Público com layout */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/aprender" element={withSuspense(<Aprender />)} />
              <Route path="/aprender/glossario" element={withSuspense(<Glossario />)} />
              <Route path="/aprender/faq" element={withSuspense(<FAQPage />)} />
              <Route path="/aprender/:slug" element={withSuspense(<TopicDetail />, "detail")} />

              <Route path="/seguranca" element={withSuspense(<Seguranca />)} />
              <Route path="/referencias" element={withSuspense(<Referencias />)} />
              <Route path="/termos" element={withSuspense(<Termos />)} />
              <Route path="/privacidade" element={withSuspense(<PrivacidadePublic />)} />
              <Route path="/cookies" element={withSuspense(<CookiesPage />)} />
              <Route path="/dpo" element={withSuspense(<DPOPage />, "form")} />
              <Route path="/contato" element={withSuspense(<Contato />, "form")} />
              <Route path="/parceiros" element={withSuspense(<Parceiros />)} />
              <Route path="/aviso-medico" element={withSuspense(<AvisoMedico />)} />

              <Route
                path="/medicos"
                element={
                  <ComingSoon
                    eyebrow="Para médicos"
                    title="Plataforma médica ValvePath"
                    description="Cadastre-se para acessar casos clínicos, dashboards e biblioteca."
                    features={[
                      "Cadastro médico com CRM e UF",
                      "Wizard 'Novo caso em 3 minutos'",
                      "Vínculo médico-paciente por CRM",
                      "Dashboards e biblioteca clínica",
                    ]}
                  />
                }
              />

              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
