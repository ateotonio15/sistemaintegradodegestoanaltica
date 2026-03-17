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
import Executivas from "./pages/Executivas";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AdminOrComumRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isExecutivo } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isExecutivo) return <Navigate to="/" replace />;
  return <>{children}</>;
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
    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/empresas" element={<ProtectedRoute><Empresas /></ProtectedRoute>} />
    <Route path="/movimentacoes" element={<ProtectedRoute><Movimentacoes /></ProtectedRoute>} />
    <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} /> {/* Access controlled inside component */}
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
