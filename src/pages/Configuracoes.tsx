import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Monitor, Moon, Sun, Settings, ShieldCheck, Info, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import {
  IDIOMAS_DISPONIVEIS,
  useSaveUserPreferences,
  useUserPreferences,
} from "@/hooks/useUserPreferences";
import { cn } from "@/lib/utils";

const TEMAS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Modo Claro", icon: Sun },
  { value: "dark", label: "Modo Escuro", icon: Moon },
  { value: "system", label: "Usar tema do dispositivo", icon: Monitor },
];

const PERFIL_LABEL: Record<string, string> = {
  admin: "Administrador",
  admin_interno: "Administrador interno",
  comum: "Cadastro",
  executivo: "Executivo",
  executivo_externo: "Executivo externo",
  visualizacao: "Visualização",
  diretora: "Diretoria",
  enfermeira: "Enfermeira",
  tec_enfermagem: "Técnico de Enfermagem",
  financeiro: "Financeiro",
  vendas: "Vendas",
  administradoras: "Administradoras",
};

export default function Configuracoes() {
  const { user, role } = useAuth();
  const { mode, setMode } = useTheme();
  const { data: prefs, isLoading } = useUserPreferences();
  const salvar = useSaveUserPreferences();

  const [tema, setTema] = useState<ThemeMode>(mode);
  const [idioma, setIdioma] = useState("pt-BR");

  useEffect(() => {
    if (prefs) {
      setTema(prefs.tema);
      setIdioma(prefs.idioma);
    }
  }, [prefs]);

  const alterado = useMemo(() => {
    if (!prefs) return false;
    return prefs.tema !== tema || prefs.idioma !== idioma;
  }, [prefs, tema, idioma]);

  // Pré-visualização imediata
  const escolherTema = (value: ThemeMode) => {
    setTema(value);
    setMode(value);
  };

  const handleSalvar = async () => {
    try {
      await salvar.mutateAsync({ tema, idioma });
      setMode(tema);
      toast.success("Configurações salvas com sucesso.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar as configurações.");
    }
  };

  // Segurança — troca da própria senha
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const handleTrocarSenha = async () => {
    if (novaSenha.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSalvandoSenha(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
      setNovaSenha("");
      setConfirmarSenha("");
      toast.success("Senha alterada com sucesso.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível alterar a senha.");
    } finally {
      setSalvandoSenha(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Gerencie suas preferências, segurança e informações do sistema.
        </p>
      </header>

      {/* 1. Aparência e Preferências */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          1. Aparência e Preferências
        </h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aparência</CardTitle>
            <CardDescription>Personalize o tema da interface.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Tema</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {TEMAS.map((t) => {
                  const ativo = tema === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => escolherTema(t.value)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-medium transition-colors",
                        ativo
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-accent text-foreground"
                      )}
                    >
                      <t.icon className="h-4 w-4 shrink-0" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                A pré-visualização é aplicada imediatamente. Salve para manter a escolha nos próximos acessos.
              </p>
            </div>

            <Separator />

            <div className="space-y-2 sm:max-w-xs">
              <Label>Idioma</Label>
              <Select value={idioma} onValueChange={setIdioma}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar idioma" />
                </SelectTrigger>
                <SelectContent>
                  {IDIOMAS_DISPONIVEIS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSalvar}
                disabled={!alterado || salvar.isPending || isLoading}
              >
                {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Configurações
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 2. Segurança */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          2. Segurança
        </h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Senha de acesso
            </CardTitle>
            <CardDescription>Altere a senha da sua própria conta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nova-senha">Nova senha</Label>
                <Input
                  id="nova-senha"
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
                <Input
                  id="confirmar-senha"
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={handleTrocarSenha}
                disabled={salvandoSenha || !novaSenha || !confirmarSenha}
              >
                {salvandoSenha && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Alterar senha
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. Informações do Sistema */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          3. Informações do Sistema
        </h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-primary" />
              Sistema
            </CardTitle>
            <CardDescription>Dados da sua conta e do ambiente.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Usuário</p>
              <p className="font-medium">{user?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Perfil</p>
              <p className="font-medium">
                <Badge variant="secondary">{PERFIL_LABEL[role ?? ""] ?? "—"}</Badge>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sistema</p>
              <p className="font-medium">SIGA — Sistema Integrado de Gestão Analítica</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fuso horário</p>
              <p className="font-medium">
                {Intl.DateTimeFormat().resolvedOptions().timeZone || "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
