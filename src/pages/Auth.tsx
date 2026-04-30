import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogIn, User, Lock } from "lucide-react";
import loginBg from "@/assets/login-bg.png";

// SVG geometric pattern (subtle dots) encoded inline — no extra requests
const geometricPattern =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><g fill='none' fill-rule='evenodd'><g fill='%23ffffff' fill-opacity='0.08'><circle cx='30' cy='30' r='1.5'/><circle cx='0' cy='0' r='1.5'/><circle cx='60' cy='0' r='1.5'/><circle cx='0' cy='60' r='1.5'/><circle cx='60' cy='60' r='1.5'/></g><g stroke='%23ffffff' stroke-opacity='0.05' stroke-width='1'><path d='M0 30h60M30 0v60'/></g></g></svg>\")";

export default function Auth() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: email, error: lookupError } = await supabase.rpc("get_email_by_username", {
        _username: username,
      });

      if (lookupError || !email) {
        throw new Error("Usuário não encontrado");
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      const msg = err.message?.includes("Invalid login") ? "Usuário ou senha inválidos" : err.message;
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-sans">
      {/* Left side — gradient hero with geometric pattern */}
      <div
        className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden"
        style={{
          backgroundImage: `${geometricPattern}, linear-gradient(135deg, hsl(152 69% 35%) 0%, hsl(152 60% 45%) 50%, hsl(160 55% 28%) 100%)`,
        }}
      >
        {/* Soft radial glow overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, hsl(152 80% 60% / 0.25), transparent 60%), radial-gradient(circle at 70% 80%, hsl(160 70% 25% / 0.35), transparent 60%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center justify-center p-16 text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-8 shadow-2xl border border-white/20">
            <img
              src={loginBg}
              alt="CS Control"
              className="max-w-xs w-full h-auto object-contain"
            />
          </div>
          <h2 className="text-3xl font-semibold text-white tracking-tight mb-2">
            CS Control
          </h2>
          <p className="text-sm text-white/80 max-w-sm">
            Cadastro Samel e Gestão Empresarial
          </p>
        </div>
      </div>

      {/* Right side — login card */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-xl shadow-lg border border-border/50 p-8 lg:p-10">
            <div className="text-center space-y-1.5 mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Bem-vindo de volta
              </h1>
              <p className="text-sm text-muted-foreground">
                Faça login para acessar o sistema
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-foreground">
                  Usuário
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Digite seu nome de usuário"
                    autoComplete="username"
                    className="h-11 pl-10 rounded-lg border-input focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary focus-visible:ring-offset-0 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="h-11 pl-10 rounded-lg border-input focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary focus-visible:ring-offset-0 transition-colors"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-lg font-semibold shadow-sm hover:shadow-md hover:bg-primary/90 hover:-translate-y-0.5 transition-all duration-200"
                disabled={loading}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {loading ? "Aguarde..." : "Entrar"}
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            CS Control — Cadastro Samel e Gestão Empresarial
          </p>
        </div>
      </div>
    </div>
  );
}
