import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  LogIn,
  User as UserIcon,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  Building2,
  Loader2,
} from "lucide-react";
import logo from "@/assets/logo-cs-control.png";

export default function Auth() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const year = new Date().getFullYear();

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
    <div className="min-h-screen flex flex-col lg:flex-row bg-background text-foreground overflow-hidden">
      {/* ============== LEFT — Brand panel ============== */}
      <div className="relative hidden lg:flex flex-1 items-center justify-center overflow-hidden">
        {/* Gradient base */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,hsl(var(--primary)/0.25),transparent_60%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--card)))]" />
        {/* Soft animated orbs */}
        <motion.div
          aria-hidden
          className="absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-primary/30 blur-3xl"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute -bottom-40 -right-32 h-[520px] w-[520px] rounded-full bg-primary/20 blur-3xl"
          animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Subtle grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative z-10 max-w-lg px-12 text-center"
        >
          <div className="inline-flex items-center justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-primary/40 blur-2xl" />
              <div className="relative h-24 w-24 rounded-2xl bg-card/70 backdrop-blur-xl border border-border/60 shadow-2xl flex items-center justify-center">
                <img src={logo} alt="SIGA" className="h-16 w-16 object-contain" />
              </div>
            </div>
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold tracking-tight text-foreground">
            SIGA
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Sistema Integrado de Gestão Analítica
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              { icon: Building2, label: "Contratos" },
              { icon: Sparkles, label: "Automação" },
              { icon: ShieldCheck, label: "Segurança" },
            ].map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-md px-4 py-4 flex flex-col items-center gap-2"
              >
                <f.icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-muted-foreground/70">
          © {year} SIGA · Cadastro Samel e Gestão Empresarial
        </div>
      </div>

      {/* ============== RIGHT — Login card ============== */}
      <div className="relative flex-1 flex items-center justify-center p-6 lg:p-12">
        {/* Mobile gradient backdrop */}
        <div className="lg:hidden absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.25),transparent_60%)]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-card/70 backdrop-blur-xl border border-border shadow-lg flex items-center justify-center mb-3">
              <img src={logo} alt="SIGA" className="h-10 w-10 object-contain" />
            </div>
            <span className="text-lg font-semibold">SIGA</span>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/5 p-8 sm:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Entre com suas credenciais para acessar o painel.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Usuário
                </Label>
                <div className="relative group">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="seu.usuario"
                    autoComplete="username"
                    className="h-12 pl-10 rounded-xl bg-background/60 border-border/70 transition-all focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Senha
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="h-12 pl-10 pr-11 rounded-xl bg-background/60 border-border/70 transition-all focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl font-semibold text-base shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-primary/85 hover:from-primary hover:to-primary hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Entrar
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-border/50 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary/80" />
              <span>Conexão segura · Sessão protegida</span>
            </div>
          </div>

          <p className="lg:hidden mt-8 text-center text-xs text-muted-foreground">
            © {year} SIGA · v1.0
          </p>
        </motion.div>
      </div>
    </div>
  );
}
