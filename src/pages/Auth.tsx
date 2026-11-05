import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ArrowRight,
  User as UserIcon,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Workflow,
  Layers3,
  ChartNoAxesCombined,
  Loader2,
} from "lucide-react";
import logo from "@/assets/logo-cs-control.png";
import hospitalFoto from "@/assets/hospital_samel.jpg.asset.json";
import loginVisual from "@/assets/siga-login-visual.webp";
import LoginAnalyticsVisual from "@/components/LoginAnalyticsVisual";

export default function Auth() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const year = new Date().getFullYear();
  const reducedMotion = useReducedMotion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "resolve-username",
        { body: { username, password } },
      );
      if (fnError || !data?.session?.access_token) {
        throw new Error(data?.error || "Usuário ou senha inválidos");
      }
      const { error } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (error) throw error;
    } catch (err: any) {
      const msg = err.message?.includes("Invalid login")
        ? "Usuário ou senha inválidos"
        : err.message;
      toast({ title: "Não foi possível entrar", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="siga-login min-h-svh grid md:grid-cols-2 lg:grid-cols-[3fr_2fr] text-foreground">
      <section className="siga-login-brand relative flex flex-col overflow-hidden px-7 py-6 sm:px-8 md:py-10 lg:px-16 lg:py-12 xl:px-20" aria-label="SIGA">
        <picture>
        <source media="(max-width: 639px)" srcSet="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" />
        <img
          src={loginVisual}
          alt=""
          width={960}
          height={960}
          fetchPriority="high"
          className="siga-login-art absolute inset-0 hidden h-full w-full object-cover sm:block"
        />
        </picture>
        <div className="siga-login-shade absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3">
          <img src={logo} alt="" width={44} height={44} className="h-11 w-11 object-contain" />
          <div>
            <span className="text-xl font-semibold">SIGA<span className="siga-login-brand-muted ml-3 hidden text-xs font-normal lg:inline">Gestão Analítica</span></span>
            <p className="siga-login-brand-muted mt-1 text-xs leading-relaxed sm:hidden">Sistema Integrado de Gestão Analítica</p>
          </div>
        </div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="siga-login-content relative z-10 my-10 hidden w-full max-w-xl sm:block md:my-auto md:py-8"
        >
          <div className="siga-login-eyebrow mb-5 flex items-center gap-2 text-xs font-medium">
            <span className="siga-login-line h-px w-8" aria-hidden="true" />
            Sistema Integrado de Gestão Analítica
          </div>
          <motion.h1 initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="text-6xl font-semibold leading-none lg:text-7xl xl:text-8xl">SIGA</motion.h1>
          <motion.p initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.12 }} className="siga-login-tagline mt-5 max-w-xl text-2xl font-medium leading-snug lg:text-3xl xl:text-4xl">
            Dados, processos e decisões<span className="block">em um só lugar.</span>
          </motion.p>
          <LoginAnalyticsVisual />
        </motion.div>
        <p className="siga-login-footer relative z-10 hidden lg:block">© {year} SIGA · Cadastro Samel e Gestão Empresarial</p>
      </section>

      <section className="siga-login-access relative flex flex-col items-center justify-center px-5 py-10 sm:px-10 lg:px-8 xl:px-14" aria-label="Acesso ao sistema">
        <img src={hospitalFoto.url} alt="" aria-hidden="true" className="siga-login-photo absolute inset-0 h-full w-full object-cover" />
        <div className="siga-login-photo-fade absolute inset-0" aria-hidden="true" />
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: reducedMotion ? 0 : 0.6 }}
          className="siga-login-card relative w-full max-w-[440px] rounded-2xl px-6 py-8 lg:px-10 lg:py-11"
        >
          <div className="mb-8">
            <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-semibold leading-tight">Bem-vindo de volta</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Entre com suas credenciais para acessar o SIGA.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">Usuário</Label>
              <div className="relative group">
                <UserIcon aria-hidden="true" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="seu.usuario"
                  autoComplete="username"
                  className="siga-login-input rounded-lg border-input bg-background pl-10 focus-visible:border-primary focus-visible:ring-primary/25"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                <Dialog>
                  <DialogTrigger asChild>
                    <button type="button" className="text-xs font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none">
                      Esqueci minha senha
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Esqueceu sua senha?</DialogTitle>
                      <DialogDescription>
                        Por segurança, a senha é redefinida pelo administrador do SIGA. Fale com o administrador do sistema informando seu usuário para receber uma nova senha.
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative group">
                <Lock aria-hidden="true" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={1}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="siga-login-input rounded-lg border-input bg-background pl-10 pr-12 focus-visible:border-primary focus-visible:ring-primary/25"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="siga-login-submit h-12 w-full rounded-lg text-sm font-semibold">
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</>
              ) : (
                <>Entrar<ArrowRight className="ml-3 h-4 w-4" /></>
              )}
            </Button>
          </form>
          <div className="siga-login-security mt-7 flex items-center justify-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>Conexão segura • Sessão protegida</span>
          </div>
        </motion.div>
        <p className="siga-login-footer mt-8 text-center lg:hidden">© {year} SIGA · Cadastro Samel e Gestão Empresarial</p>
      </section>
    </main>
  );
}
