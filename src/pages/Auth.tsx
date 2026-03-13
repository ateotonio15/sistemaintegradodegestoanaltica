import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2, LogIn } from "lucide-react";

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative rounded-2xl shadow-xl border-border/50 animate-scale-in">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Building2 className="h-7 w-7" />
            </div>
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl font-bold">CS Control</CardTitle>
            <CardDescription className="text-muted-foreground">Faça login para acessar o sistema</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
