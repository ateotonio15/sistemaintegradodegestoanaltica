import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { AppLayout } from "@/components/AppLayout";
import Configuracoes from "./pages/Configuracoes";
import Empresas from "./pages/Empresas";
import Movimentacoes from "./pages/Movimentacoes";
import Usuarios from "./pages/Usuarios";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import DashboardVendas from "./pages/DashboardVendas";
import DashboardAdministradoras from "./pages/DashboardAdministradoras";

import Financeiro from "./pages/Financeiro";
import PainelTvFinanceiro from "./pages/PainelTvFinanceiro";
import Reajustes from "./pages/Reajustes";
import Arquivos from "./pages/Arquivos";
import Cartas from "./pages/Cartas";
import Implantacao from "./pages/Implantacao";
import ContratosRecemImplantados from "./pages/ContratosRecemImplantados";
import VidasSamel from "./pages/VidasSamel";
import Vidas from "./pages/Vidas";
import HondaExclusoes from "./pages/HondaExclusoes";
import CarteiraSamelLayout from "./modules/carteira-samel/CarteiraSamelLayout";
import CSVisaoGeral from "./modules/carteira-samel/pages/VisaoGeral";
import CSCarteira from "./modules/carteira-samel/pages/Carteira";
import CSSinistralidade from "./modules/carteira-samel/pages/Sinistralidade";
import CSScore from "./modules/carteira-samel/pages/ScoreRisco";
import CSAvaliacoesRH from "./modules/carteira-samel/pages/AvaliacoesRH";
import CSResponderRH from "./modules/carteira-samel/pages/ResponderRH";
import CSResponderToken from "./modules/carteira-samel/pages/ResponderPorToken";
import CSResponderPlantao from "./modules/carteira-samel/pages/ResponderPlantao";
import CSDashboardDiretoria from "./modules/carteira-samel/pages/DashboardDiretoria";
import EmpresasGroupLayout from "./components/EmpresasGroupLayout";
import InteligenciaModulo from "./pages/InteligenciaModulo";
import Demandas from "./pages/Demandas";
import DemandasDashboard from "./pages/DemandasDashboard";
import DemandasForaDoPrazo from "./pages/DemandasForaDoPrazo";
import NovaDemanda from "./pages/NovaDemanda";
import Plantoes from "./pages/Plantoes";
import PlantoesCalendario from "./pages/PlantoesCalendario";
import PlantoesEmpresa from "./pages/PlantoesEmpresa";
import PlantaoAtendimentos from "./pages/PlantaoAtendimentos";
import PlantoesRelatorios from "./pages/PlantoesRelatorios";
import PlantoesDashboard from "./pages/PlantoesDashboard";
import UberCorridas from "./pages/UberCorridas";
import UberDashboard from "./pages/UberDashboard";
import SaudeEmpresasLista from "./modules/saude-empresas/pages/SaudeEmpresasLista";
import SaudeEmpresaAcoes from "./modules/saude-empresas/pages/SaudeEmpresaAcoes";
import SaudeAcaoTriagens from "./modules/saude-empresas/pages/SaudeAcaoTriagens";
import SaudeVisaoGeral from "./modules/saude-empresas/pages/SaudeVisaoGeral";
import CalendarioPreventivas from "./modules/saude-empresas/pages/CalendarioPreventivas";
import CalendarioPalestras from "./modules/saude-empresas/pages/CalendarioPalestras";
import PesquisaSatisfacao from "./modules/saude-empresas/pages/PesquisaSatisfacao";
import ResponderPesquisa from "./modules/saude-empresas/pages/ResponderPesquisa";
import PesquisaTablet from "./modules/saude-empresas/pages/PesquisaTablet";
import DashboardExecutivo from "./modules/saude-empresas/pages/DashboardExecutivo";
import AcoesColeta from "./modules/saude-empresas/pages/AcoesColeta";
import InscricaoColeta from "./modules/saude-empresas/pages/InscricaoColeta";
import MailingBrindes from "./pages/MailingBrindes";
import ApresentacaoIndicadores from "./pages/ApresentacaoIndicadores";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import CadastrarEmpresa from "./pages/CadastrarEmpresa";
import FilaAtendimento from "./pages/FilaAtendimento";
import TrocarSenha from "./pages/TrocarSenha";
import Portal from "./pages/Portal";
import MeuPainel from "./pages/MeuPainel";
import EmpresasAcesso from "./pages/EmpresasAcesso";
import AnaliseContrato from "./pages/AnaliseContrato";
import ProducaoGuias from "./pages/ProducaoGuias";
import AgendaCirurgica from "./pages/AgendaCirurgica";
import DependentesUEA from "./pages/DependentesUEA";
import { useMinhaPermissaoUea } from "@/hooks/useUeaPermissoes";

// Desativa gatilhos globais de foco/reconexão: voltar para a aba não deve reiniciar/refazer telas.
focusManager.setEventListener(() => () => {});
onlineManager.setEventListener(() => () => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mantém cache vivo entre navegações e impede refetch automático ao trocar/voltar de aba.
      staleTime: 2 * 60_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});

const Loading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
    Carregando...
  </div>
);

// Shell único e persistente: AppLayout monta UMA vez; só o <Outlet/> troca entre rotas.
function AppShell() {
  const { user, loading, mustChangePassword, isAdminEmpresa, isAdminInterno, isCorretora } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/auth" replace />;
  if (mustChangePassword && location.pathname !== "/trocar-senha") {
    return <Navigate to="/trocar-senha" replace />;
  }
  // Empresas com papel admin_empresa/colaborador (e não admin_interno) só enxergam suas telas
  const empresaOnlyPaths = ["/portal", "/meu-painel", "/trocar-senha"];
  const isEmpresaPath = empresaOnlyPaths.some((p) => location.pathname.startsWith(p));
  if ((isAdminEmpresa || isCorretora) && !isAdminInterno && !isEmpresaPath) {
    return <Navigate to="/meu-painel" replace />;
  }
  // Telas do portal/meu painel rodam com layout próprio (sem sidebar)
  if (isEmpresaPath) {
    return <Outlet />;
  }
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

// Gate de papéis: renderiza <Outlet/> se passar, senão redireciona.
function RoleGate({
  allow,
  deny,
  redirect = "/",
}: {
  allow?: string[];
  deny?: string[];
  redirect?: string;
}) {
  const { loading, role } = useAuth();
  if (loading) return <Loading />;
  if (deny && role && deny.includes(role)) return <Navigate to={redirect} replace />;
  if (allow && (!role || !allow.includes(role))) return <Navigate to={redirect} replace />;
  return <Outlet />;
}

function AdminInternoGate() {
  const { loading, isAdminInterno } = useAuth();
  if (loading) return <Loading />;
  if (!isAdminInterno) return <Navigate to="/" replace />;
  return <Outlet />;
}

// Dependentes UEA: acesso por permissão individual (bloqueia também a URL direta).
function UeaGate({ children }: { children: React.ReactNode }) {
  const { canVerUea, isLoading } = useMinhaPermissaoUea();
  if (isLoading) return <Loading />;
  if (!canVerUea) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminOuInternoGate() {
  const { loading, isAdmin, isAdminInterno } = useAuth();
  if (loading) return <Loading />;
  if (!isAdmin && !isAdminInterno) return <Navigate to="/" replace />;
  return <Outlet />;
}

function HomeRoute() {
  const { isVendas } = useAuth();
  if (isVendas) return <Navigate to="/dashboard/vendas" replace />;
  return <Home />;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<AuthRoute />} />
    
    <Route path="/carteira-samel/avaliacoes/rh/responder/:formId" element={<CSResponderRH />} />
    <Route path="/avaliar/:token" element={<CSResponderToken />} />
    <Route path="/avaliacoes/rh/responder/:token" element={<CSResponderToken />} />
    <Route path="/avaliacoes/plantao/responder/:token" element={<CSResponderPlantao />} />
    <Route path="/pesquisa/tablet/:token" element={<PesquisaTablet />} />
    <Route path="/coleta/:token" element={<InscricaoColeta />} />
    <Route path="/pesquisa/:token" element={<ResponderPesquisa />} />
    <Route element={<AppShell />}>
      <Route path="/portal" element={<Portal />} />
      <Route path="/meu-painel" element={<MeuPainel />} />
      <Route path="/trocar-senha" element={<TrocarSenha />} />
      <Route path="/configuracoes" element={<Configuracoes />} />
      <Route element={<AdminInternoGate />}>
        <Route path="/admin/cadastrar-empresa" element={<CadastrarEmpresa />} />
      </Route>
      <Route element={<AdminOuInternoGate />}>
        <Route path="/admin/empresas-acesso" element={<EmpresasAcesso />} />
      </Route>
      <Route path="/admin/fila-atendimento" element={<FilaAtendimento />} />
      <Route path="/" element={<HomeRoute />} />
      <Route path="/dashboard" element={<HomeRoute />} />
      <Route element={<RoleGate allow={["admin"]} />}>
        <Route path="/dashboard/geral" element={<Dashboard />} />
        <Route path="/dashboard/administradoras" element={<DashboardAdministradoras />} />
      </Route>
      <Route element={<RoleGate allow={["admin", "vendas"]} />}>
        <Route path="/dashboard/vendas" element={<DashboardVendas />} />
      </Route>

      <Route element={<RoleGate allow={["admin", "financeiro"]} />}>
        <Route path="/dashboard/financeiro" element={<DashboardFinanceiro />} />
      </Route>

      <Route element={<RoleGate allow={["admin", "financeiro", "diretora"]} />}>
        <Route path="/financeiro/painel-tv" element={<PainelTvFinanceiro />} />
      </Route>

      <Route element={<EmpresasGroupLayout />}>
        <Route path="/empresas" element={<Empresas />} />
        <Route element={<RoleGate allow={["admin", "comum", "diretora", "executivo", "executivo_externo", "financeiro", "enfermeira", "tec_enfermagem", "visualizacao", "administradoras"]} />}>
          <Route path="/movimentacoes" element={<Movimentacoes />} />
        </Route>

        <Route element={<RoleGate allow={["admin", "diretora", "comum", "administradoras", "vendas"]} />}>
          <Route path="/vidas" element={<Vidas />} />
          <Route path="/gestao-vidas" element={<Vidas />} />
          <Route path="/vidas-operadora" element={<Vidas />} />
        </Route>


        <Route element={<RoleGate deny={["financeiro"]} />}>
          <Route path="/implantacao" element={<Implantacao />} />
        </Route>

        <Route element={<RoleGate allow={["admin", "comum", "administradoras", "financeiro", "diretora"]} />}>
          <Route path="/contratos-recem-implantados" element={<ContratosRecemImplantados />} />
        </Route>
      </Route>

      <Route element={<RoleGate deny={[]} />}>
        <Route path="/vidas-samel" element={<VidasSamel />} />
        <Route path="/reajustes" element={<Reajustes />} />
      </Route>

      <Route element={<RoleGate allow={["admin", "financeiro", "comum", "administradoras", "visualizacao", "diretora"]} />}>
        <Route path="/financeiro" element={<Financeiro />} />
      </Route>

      <Route element={<RoleGate allow={["admin", "financeiro"]} />}>
        <Route path="/arquivos" element={<Arquivos />} />
        <Route path="/cartas" element={<Cartas />} />
      </Route>

      <Route element={<RoleGate allow={["admin"]} />}>
        <Route path="/usuarios" element={<Usuarios />} />
      </Route>

      <Route path="/dependentes-uea" element={<UeaGate><DependentesUEA /></UeaGate>} />

      <Route element={<RoleGate allow={["admin", "comum", "vendas", "diretora", "financeiro", "administradoras"]} />}>
        <Route path="/analise-contrato" element={<AnaliseContrato />} />
      </Route>

      <Route element={<RoleGate allow={["admin", "diretora", "diretora_saude", "coordenadora", "executivo", "enfermeira", "tec_enfermagem"]} />}>
        <Route path="/producao-guias" element={<ProducaoGuias />} />
        <Route path="/agenda-cirurgica" element={<AgendaCirurgica />} />
      </Route>

      <Route path="/honda-exclusoes" element={<HondaExclusoes />} />
      <Route path="/inteligencia/:slug" element={<InteligenciaModulo />} />
      <Route path="/mailing-brindes" element={<MailingBrindes />} />
      <Route path="/demandas" element={<Demandas />} />
      <Route path="/demandas/nova" element={<NovaDemanda />} />
      <Route path="/demandas/dashboard" element={<DemandasDashboard />} />
      <Route path="/demandas/apresentacao" element={<ApresentacaoIndicadores />} />
      <Route path="/demandas/fora-do-prazo" element={<DemandasForaDoPrazo />} />

      <Route path="/plantoes" element={<Plantoes />} />
      <Route path="/plantoes/calendario" element={<PlantoesCalendario />} />
      <Route path="/plantoes/empresa/:empresaId" element={<PlantoesEmpresa />} />
      <Route path="/plantoes/:plantaoId/atendimentos" element={<PlantaoAtendimentos />} />
      <Route path="/plantoes/relatorios" element={<PlantoesRelatorios />} />
      <Route path="/plantoes/dashboard" element={<PlantoesDashboard />} />

      <Route path="/uber" element={<UberCorridas />} />
      <Route path="/uber/dashboard" element={<UberDashboard />} />

      <Route element={<RoleGate allow={["admin", "enfermeira", "tec_enfermagem", "executivo", "coordenadora", "diretora", "diretora_saude"]} />}>
        <Route path="/saude-empresas" element={<SaudeEmpresasLista />} />
        <Route path="/saude-empresas/visao-geral" element={<SaudeVisaoGeral />} />
        <Route path="/saude-empresas/dashboard-executivo" element={<DashboardExecutivo />} />
        <Route path="/saude-empresas/preventivas" element={<CalendarioPreventivas />} />
        <Route path="/saude-empresas/palestras" element={<CalendarioPalestras />} />
        <Route path="/saude-empresas/coleta" element={<AcoesColeta />} />
        <Route path="/saude-empresas/pesquisas" element={<PesquisaSatisfacao />} />
        <Route path="/saude-empresas/empresa/:empresaId" element={<SaudeEmpresaAcoes />} />
        <Route path="/saude-empresas/acao/:acaoId" element={<SaudeAcaoTriagens />} />
      </Route>




      <Route element={<RoleGate allow={["admin", "diretora", "comum", "executivo", "administradoras"]} />}>
        <Route path="/carteira-samel" element={<CarteiraSamelLayout />}>
          <Route index element={<CSVisaoGeral />} />
          <Route path="carteira" element={<CSCarteira />} />
          <Route path="sinistralidade" element={<CSSinistralidade />} />
          <Route path="score" element={<CSScore />} />
          <Route path="avaliacoes/rh" element={<CSAvaliacoesRH />} />
          <Route element={<RoleGate allow={["admin", "diretora"]} redirect="/carteira-samel" />}>
            <Route path="dashboard-diretoria" element={<CSDashboardDiretoria />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
