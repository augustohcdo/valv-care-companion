import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { PublicLayout } from "@/components/PublicLayout";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import ComingSoon from "./pages/ComingSoon.tsx";

import Aprender from "./pages/public/Aprender.tsx";
import TopicDetail from "./pages/public/TopicDetail.tsx";
import Glossario from "./pages/public/Glossario.tsx";
import FAQPage from "./pages/public/FAQPage.tsx";
import Seguranca from "./pages/public/Seguranca.tsx";
import Referencias from "./pages/public/Referencias.tsx";
import Termos from "./pages/public/Termos.tsx";
import Privacidade from "./pages/public/Privacidade.tsx";
import AvisoMedico from "./pages/public/AvisoMedico.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
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
                  eyebrow="Para médicos — Fase 2"
                  title="Plataforma médica ValvePath"
                  description="Cadastro profissional, casos clínicos, dashboards e biblioteca clínica."
                  features={[
                    "Cadastro médico com CRM e UF",
                    "Wizard 'Novo caso em 3 minutos'",
                    "Formulários profundos por valvopatia",
                    "Dashboards com gráficos e funil de jornada",
                    "Biblioteca clínica baseada em diretrizes",
                    "Vínculo médico-paciente por CRM",
                  ]}
                />
              }
            />
            <Route
              path="/auth/login"
              element={<ComingSoon eyebrow="Autenticação — Fase 2" title="Login" description="Acesso seguro com Lovable Cloud." />}
            />
            <Route
              path="/auth/cadastro"
              element={
                <ComingSoon
                  eyebrow="Cadastro — Fase 2"
                  title="Criar conta no ValvePath"
                  description="Cadastro de médicos e pacientes com vínculo por CRM."
                  features={[
                    "Cadastro médico com validação de CRM",
                    "Cadastro de paciente com vínculo opcional por CRM do médico",
                    "Aceite de termos e consentimento LGPD",
                    "Autenticação segura via Lovable Cloud",
                  ]}
                />
              }
            />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
