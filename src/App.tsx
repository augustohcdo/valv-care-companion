import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicLayout } from "@/components/PublicLayout";
import { AppLayout } from "@/components/AppLayout";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";

import Aprender from "./pages/public/Aprender";
import TopicDetail from "./pages/public/TopicDetail";
import Glossario from "./pages/public/Glossario";
import FAQPage from "./pages/public/FAQPage";
import Seguranca from "./pages/public/Seguranca";
import Referencias from "./pages/public/Referencias";
import Termos from "./pages/public/Termos";
import Privacidade from "./pages/public/Privacidade";
import AvisoMedico from "./pages/public/AvisoMedico";

import Login from "./pages/auth/Login";
import Cadastro from "./pages/auth/Cadastro";
import RecuperarSenha from "./pages/auth/RecuperarSenha";
import RedefinirSenha from "./pages/auth/RedefinirSenha";
import AuthCallback from "./pages/auth/AuthCallback";

import MedicoHome from "./pages/app/MedicoHome";
import PacienteHome from "./pages/app/PacienteHome";
import NovoCaso from "./pages/app/NovoCaso";
import ListaCasos from "./pages/app/ListaCasos";
import CasoDetalhe from "./pages/app/CasoDetalhe";
import MedicoPacientes from "./pages/app/MedicoPacientes";
import PacienteJornada from "./pages/app/PacienteJornada";
import Biblioteca from "./pages/app/Biblioteca";
import BibliotecaDetalhe from "./pages/app/BibliotecaDetalhe";
import MedicoPerfil from "./pages/app/MedicoPerfil";
import PacientePerfil from "./pages/app/PacientePerfil";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Auth (sem PublicLayout para visual focado) */}
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
              <Route
                path="/app/medico"
                element={
                  <ProtectedRoute requiredType="medico">
                    <MedicoHome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/medico/pacientes"
                element={<ProtectedRoute requiredType="medico"><MedicoPacientes /></ProtectedRoute>}
              />
              <Route
                path="/app/medico/casos"
                element={<ProtectedRoute requiredType="medico"><ListaCasos /></ProtectedRoute>}
              />
              <Route
                path="/app/medico/casos/novo"
                element={<ProtectedRoute requiredType="medico"><NovoCaso /></ProtectedRoute>}
              />
              <Route
                path="/app/medico/casos/:id"
                element={<ProtectedRoute requiredType="medico"><CasoDetalhe /></ProtectedRoute>}
              />
              <Route
                path="/app/medico/biblioteca"
                element={<ProtectedRoute requiredType="medico"><Biblioteca /></ProtectedRoute>}
              />
              <Route
                path="/app/medico/biblioteca/:slug"
                element={<ProtectedRoute requiredType="medico"><BibliotecaDetalhe /></ProtectedRoute>}
              />
              <Route
                path="/app/medico/perfil"
                element={<ProtectedRoute requiredType="medico"><MedicoPerfil /></ProtectedRoute>}
              />

              <Route
                path="/app/paciente"
                element={
                  <ProtectedRoute requiredType="paciente">
                    <PacienteHome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/paciente/jornada"
                element={<ProtectedRoute requiredType="paciente"><PacienteJornada /></ProtectedRoute>}
              />
              <Route
                path="/app/paciente/medico"
                element={
                  <ProtectedRoute requiredType="paciente">
                    <ComingSoon eyebrow="Próxima fase" title="Meu médico" description="Vincule ou troque seu médico pelo CRM." />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/paciente/documentos"
                element={
                  <ProtectedRoute requiredType="paciente">
                    <ComingSoon eyebrow="Próxima fase" title="Meus documentos" description="Upload organizado de exames e laudos." />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/paciente/perfil"
                element={<ProtectedRoute requiredType="paciente"><PacientePerfil /></ProtectedRoute>}
              />
            </Route>

            {/* Público com layout */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/aprender" element={<Aprender />} />
              <Route path="/aprender/glossario" element={<Glossario />} />
              <Route path="/aprender/faq" element={<FAQPage />} />
              <Route path="/aprender/:slug" element={<TopicDetail />} />

              <Route path="/seguranca" element={<Seguranca />} />
              <Route path="/referencias" element={<Referencias />} />
              <Route path="/termos" element={<Termos />} />
              <Route path="/privacidade" element={<Privacidade />} />
              <Route path="/aviso-medico" element={<AvisoMedico />} />

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
