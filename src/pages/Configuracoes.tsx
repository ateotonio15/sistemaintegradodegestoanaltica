import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Monitor, Moon, Sun, Settings, ShieldCheck, Info, Loader2, Eye, EyeOff } from "lucide-react";
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
import { systemVersion, lastSystemUpdate } from "@/config/system";
import { EmailRelatoriosForm } from "@/components/configuracoes/EmailRelatoriosForm";

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

function CampoSenha({
  id,
  label,
  placeholder,
  value,
  onChange,
  visivel,
  onToggle,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  visivel: boolean;
  onToggle: () => void;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visivel ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

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

  // Segurança — troca da própria senha (sempre do usuário logado)
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [verAtual, setVerAtual] = useState(false);
  const [verNova, setVerNova] = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const limparCamposSenha = () => {
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmarSenha("");
    setVerAtual(false);
    setVerNova(false);
    setVerConfirmar(false);
  };

  const handleTrocarSenha = async () => {
    if (!user?.id) {
      toast.error("Sessão expirada. Entre novamente para alterar a senha.");
      return;
    }
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      toast.error("Preencha todos os campos de senha.");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      toast.error("As novas senhas não coincidem.");
      return;
    }
    if (novaSenha.length < 8) {
      toast.error("A nova senha não atende aos requisitos de segurança.");
      return;
    }
    if (novaSenha === senhaAtual) {
      toast.error("A nova senha deve ser diferente da senha atual.");
      return;
    }

    setSalvandoSenha(true);
    try {
      // Reautenticação com o mesmo mecanismo de login do sistema
      if (user.email) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: senhaAtual,
        });
        if (authError) {
          toast.error("Senha atual incorreta.");
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("password")) {
          toast.error("A nova senha não atende aos requisitos de segurança.");
        } else {
          toast.error(error.message || "Não foi possível alterar a senha.");
        }
        return;
      }

      limparCamposSenha();
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

      <EmailRelatoriosForm />

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
              Segurança
            </CardTitle>
            <CardDescription>Gerencie sua senha de acesso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:max-w-md">
              <CampoSenha
                id="senha-atual"
                label="Senha Atual"
                placeholder="Digite sua senha atual"
                value={senhaAtual}
                onChange={setSenhaAtual}
                visivel={verAtual}
                onToggle={() => setVerAtual((v) => !v)}
                autoComplete="current-password"
              />
              <CampoSenha
                id="nova-senha"
                label="Nova Senha"
                placeholder="Digite a nova senha"
                value={novaSenha}
                onChange={setNovaSenha}
                visivel={verNova}
                onToggle={() => setVerNova((v) => !v)}
                autoComplete="new-password"
                hint="Mínimo de 8 caracteres."
              />
              <CampoSenha
                id="confirmar-senha"
                label="Confirmar Nova Senha"
                placeholder="Confirme a nova senha"
                value={confirmarSenha}
                onChange={setConfirmarSenha}
                visivel={verConfirmar}
                onToggle={() => setVerConfirmar((v) => !v)}
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A alteração vale apenas para a sua própria conta.
            </p>
            <div className="flex justify-end">
              <Button onClick={handleTrocarSenha} disabled={salvandoSenha}>
                {salvandoSenha && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Alterar Senha
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
              Informações do Sistema
            </CardTitle>
            <CardDescription>Dados da sua conta e do ambiente.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Versão</p>
              <p className="font-medium">{systemVersion}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Última atualização</p>
              <p className="font-medium">{lastSystemUpdate}</p>
            </div>
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
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
