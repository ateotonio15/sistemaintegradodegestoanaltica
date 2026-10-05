import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function TrocarSenha() {
  const { user, refreshAuthFlags, signOut } = useAuth();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) return toast.error("A senha precisa ter ao menos 8 caracteres.");
    if (senha !== confirmar) return toast.error("As senhas não coincidem.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("user_id", user!.id);
      if (pErr) throw pErr;
      await refreshAuthFlags();
      toast.success("Senha atualizada.");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao atualizar senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Trocar senha</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sua senha é provisória. Crie uma nova senha e confirme para continuar.
          </p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="senha">Nova senha</Label>
              <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="conf">Confirmar nova senha</Label>
              <Input id="conf" type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
            <Button type="button" variant="ghost" onClick={signOut}>Sair</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
