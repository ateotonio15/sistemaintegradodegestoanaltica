import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import Empresas from "./pages/Empresas";
import Movimentacoes from "./pages/Movimentacoes";
import Usuarios from "./pages/Usuarios";
import Dashboard from "./pages/Dashboard";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import DashboardVendas from "./pages/DashboardVendas";
import Executivas from "./pages/Executivas";

import Financeiro from "./pages/Financeiro";
import Reajustes from "./pages/Reajustes";
import Arquivos from "./pages/Arquivos";
import Implantacao from "./pages/Implantacao";
import VidasSamel from "./pages/VidasSamel";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowFinanceiro = true }: { children: React.ReactNode; allowFinanceiro?: boolean }) {
  const { user, loading, isFinanceiro } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isFinanceiro && !allowFinanceiro) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminOrComumRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isExecutivo, isFinanceiro } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isExecutivo) return <Navigate to="/" replace />;
  if (isFinanceiro) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function FinanceiroRoute({ children }: { children: React.ReactNode }) {
  // Acessível para Admin, Financeiro, Cadastro (comum) e Visualização (somente leitura)
  const { user, loading, isAdmin, isFinanceiro, isComum, isViewOnly } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin && !isFinanceiro && !isComum && !isViewOnly) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function FinanceiroOnlyRoute({ children }: { children: React.ReactNode }) {
  // Acessível apenas para Admin e Financeiro
  const { user, loading, isAdmin, isFinanceiro } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin && !isFinanceiro) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRoute() {
  // Roteamento por perfil para a raiz
  const { user, loading, isFinanceiro, isVendas } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isFinanceiro) return <DashboardFinanceiro />;
  if (isVendas) return <DashboardVendas />;
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
    <Route path="/" element={<HomeRoute />} />
    <Route path="/dashboard" element={<HomeRoute />} />
    <Route path="/empresas" element={<ProtectedRoute><Empresas /></ProtectedRoute>} />
    <Route path="/movimentacoes" element={<ProtectedRoute><Movimentacoes /></ProtectedRoute>} />
    <Route path="/executivas" element={<ProtectedRoute allowFinanceiro={false}><Executivas /></ProtectedRoute>} />
    
    <Route path="/financeiro" element={<FinanceiroRoute><Financeiro /></FinanceiroRoute>} />
    <Route path="/reajustes" element={<ProtectedRoute><Reajustes /></ProtectedRoute>} />
    <Route path="/arquivos" element={<FinanceiroOnlyRoute><Arquivos /></FinanceiroOnlyRoute>} />
    <Route path="/implantacao" element={<ProtectedRoute allowFinanceiro={false}><Implantacao /></ProtectedRoute>} />
    <Route path="/vidas-samel" element={<ProtectedRoute><VidasSamel /></ProtectedRoute>} />
    <Route path="/usuarios" element={<AdminOnlyRoute><Usuarios /></AdminOnlyRoute>} />
    <Route path="*" element={<NotFound />} />
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
