import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn } from "lucide-react";
import loginBg from "@/assets/login-bg.png";

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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Bem-vindo</h1>
            <p className="text-muted-foreground">Faça login para acessar o sistema</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Usuário</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Digite seu nome de usuário"
                autoComplete="username"
                className="h-11 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
                className="h-11 rounded-lg"
              />
            </div>
            <Button type="submit" className="w-full h-11 rounded-lg font-semibold shadow-sm" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? "Aguarde..." : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            CS Control — Cadastro Samel e Gestão Empresarial
          </p>
        </div>
      </div>

      {/* Right side - Image (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-[hsl(var(--muted))] relative overflow-hidden">
        <img
          src={loginBg}
          alt="CS Control - Cadastro Samel e Gestão Empresarial"
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
