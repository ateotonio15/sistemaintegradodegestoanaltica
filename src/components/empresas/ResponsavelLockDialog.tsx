import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked: () => void;
  /** username do usuário logado — só 'adm.junior' vê a área de definir senha */
  currentUsername?: string | null;
}

const LOCK_KEY = "responsavel_contrato";

export function ResponsavelLockDialog({ open, onOpenChange, onUnlocked, currentUsername }: Props) {
  const { toast } = useToast();
  const [senha, setSenha] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [novaSenha2, setNovaSenha2] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const isAdmJunior = currentUsername === "adm.junior";

  useEffect(() => {
    if (!open) {
      setSenha("");
      setNovaSenha("");
      setNovaSenha2("");
    }
  }, [open]);

  const verificar = async () => {
    if (!senha) return;
    setVerificando(true);
    try {
      const { data, error } = await supabase.rpc("verify_lock_password" as any, {
        _lock_key: LOCK_KEY,
        _password: senha,
      });
      if (error) throw error;
      if (data === true) {
        toast({ title: "Cadeado liberado", description: "Você pode alterar o Responsável pelo Contrato." });
        onUnlocked();
        onOpenChange(false);
      } else {
        toast({ title: "Senha incorreta", description: "Não foi possível liberar a edição.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao verificar", description: err?.message ?? "Falha", variant: "destructive" });
    } finally {
      setVerificando(false);
    }
  };

  const salvarNovaSenha = async () => {
    if (novaSenha.length < 4) {
      toast({ title: "Senha muito curta", description: "Mínimo 4 caracteres.", variant: "destructive" });
      return;
    }
    if (novaSenha !== novaSenha2) {
      toast({ title: "As senhas não conferem", variant: "destructive" });
      return;
    }
    setSalvandoSenha(true);
    try {
      const { error } = await supabase.rpc("set_lock_password" as any, {
        _lock_key: LOCK_KEY,
        _new_password: novaSenha,
      });
      if (error) throw error;
      toast({ title: "Senha definida", description: "A nova senha do cadeado está ativa." });
      setNovaSenha("");
      setNovaSenha2("");
    } catch (err: any) {
      toast({ title: "Não foi possível salvar", description: err?.message ?? "Falha", variant: "destructive" });
    } finally {
      setSalvandoSenha(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Cadeado — Responsável pelo Contrato
          </DialogTitle>
          <DialogDescription>
            Este campo é protegido. Informe a senha do cadeado para liberar a edição.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label className="text-sm">Senha do cadeado</Label>
          <Input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Digite a senha"
            onKeyDown={(e) => { if (e.key === "Enter") verificar(); }}
            autoFocus
          />
          <Button onClick={verificar} disabled={!senha || verificando} className="w-full gap-2">
            {verificando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Liberar edição
          </Button>
        </div>

        {isAdmJunior && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4 text-amber-600" />
              Definir / alterar senha (exclusivo adm.junior)
            </div>
            <p className="text-xs text-muted-foreground">
              Somente você pode alterar esta senha. Nem administradores, nem o suporte, nem a IA conseguem trocá-la.
            </p>
            <div className="space-y-2">
              <Input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Nova senha (mín. 4)"
              />
              <Input
                type="password"
                value={novaSenha2}
                onChange={(e) => setNovaSenha2(e.target.value)}
                placeholder="Confirmar nova senha"
              />
              <Button
                variant="secondary"
                onClick={salvarNovaSenha}
                disabled={salvandoSenha || !novaSenha || !novaSenha2}
                className="w-full gap-2"
              >
                {salvandoSenha ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Salvar nova senha
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
