import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { AppLayout } from "@/components/AppLayout";
import Empresas from "./pages/Empresas";
import Movimentacoes from "./pages/Movimentacoes";
import Usuarios from "./pages/Usuarios";
import Dashboard from "./pages/Dashboard";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import DashboardVendas from "./pages/DashboardVendas";
import DashboardAdministradoras from "./pages/DashboardAdministradoras";
import Executivas from "./pages/Executivas";
import Financeiro from "./pages/Financeiro";
import Reajustes from "./pages/Reajustes";
import Arquivos from "./pages/Arquivos";
import Implantacao from "./pages/Implantacao";
import ContratosRecemImplantados from "./pages/ContratosRecemImplantados";
import VidasSamel from "./pages/VidasSamel";
import GestaoVidas from "./pages/GestaoVidas";
import VidasOperadora from "./pages/VidasOperadora";
import HondaExclusoes from "./pages/HondaExclusoes";
import CarteiraSamelLayout from "./modules/carteira-samel/CarteiraSamelLayout";
import CSVisaoGeral from "./modules/carteira-samel/pages/VisaoGeral";
import CSCarteira from "./modules/carteira-samel/pages/Carteira";
import CSSinistralidade from "./modules/carteira-samel/pages/Sinistralidade";
import CSScore from "./modules/carteira-samel/pages/ScoreRisco";
import CSAvaliacoesRH from "./modules/carteira-samel/pages/AvaliacoesRH";
import CSResponderRH from "./modules/carteira-samel/pages/ResponderRH";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

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
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/auth" replace />;
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

function HomeRoute() {
  const { isFinanceiro, isVendas, isAdministradoras } = useAuth();
  if (isFinanceiro) return <DashboardFinanceiro />;
  if (isVendas) return <DashboardVendas />;
  if (isAdministradoras) return <DashboardAdministradoras />;
  return <Dashboard />;
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
    <Route element={<AppShell />}>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/dashboard" element={<HomeRoute />} />
      <Route element={<RoleGate allow={["admin"]} />}>
        <Route path="/dashboard/geral" element={<Dashboard />} />
        <Route path="/dashboard/financeiro" element={<DashboardFinanceiro />} />
        <Route path="/dashboard/vendas" element={<DashboardVendas />} />
        <Route path="/dashboard/administradoras" element={<DashboardAdministradoras />} />
      </Route>

      <Route path="/empresas" element={<Empresas />} />
      <Route path="/movimentacoes" element={<Movimentacoes />} />

      <Route element={<RoleGate deny={[]} />}>
        <Route path="/vidas-samel" element={<VidasSamel />} />
        <Route path="/reajustes" element={<Reajustes />} />
      </Route>

      <Route element={<RoleGate allow={["admin", "diretora", "comum", "administradoras", "vendas"]} />}>
        <Route path="/gestao-vidas" element={<GestaoVidas />} />
        <Route path="/vidas-operadora" element={<VidasOperadora />} />
      </Route>

      <Route element={<RoleGate deny={["financeiro"]} />}>
        <Route path="/executivas" element={<Executivas />} />
      </Route>

      <Route element={<RoleGate deny={["financeiro"]} />}>
        <Route path="/implantacao" element={<Implantacao />} />
      </Route>

      <Route element={<RoleGate allow={["admin", "comum", "administradoras", "financeiro", "diretora"]} />}>
        <Route path="/contratos-recem-implantados" element={<ContratosRecemImplantados />} />
      </Route>

      <Route element={<RoleGate allow={["admin", "financeiro", "comum", "administradoras", "visualizacao", "diretora"]} />}>
        <Route path="/financeiro" element={<Financeiro />} />
      </Route>

      <Route element={<RoleGate allow={["admin", "financeiro"]} />}>
        <Route path="/arquivos" element={<Arquivos />} />
      </Route>

      <Route element={<RoleGate allow={["admin"]} />}>
        <Route path="/usuarios" element={<Usuarios />} />
      </Route>

      <Route path="/honda-exclusoes" element={<HondaExclusoes />} />

      <Route element={<RoleGate allow={["admin", "diretora", "comum", "executivo", "administradoras"]} />}>
        <Route path="/carteira-samel" element={<CarteiraSamelLayout />}>
          <Route index element={<CSVisaoGeral />} />
          <Route path="carteira" element={<CSCarteira />} />
          <Route path="sinistralidade" element={<CSSinistralidade />} />
          <Route path="score" element={<CSScore />} />
          <Route path="avaliacoes/rh" element={<CSAvaliacoesRH />} />
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
