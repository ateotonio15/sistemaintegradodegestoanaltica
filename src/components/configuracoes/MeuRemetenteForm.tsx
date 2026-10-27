import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { validarRemetenteUsuario, type RemetenteUsuario } from "@/lib/config-email-relatorios";

const vazio: RemetenteUsuario = { nome_remetente: "", email_remetente: "", email_resposta: "" };

/** Remetente individual: disponível somente para o perfil Cadastro. */
export function MeuRemetenteForm() {
  const { user, isComum, isAdmin } = useAuth();
  const client = useQueryClient();
  const [form, setForm] = useState(vazio);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const habilitado = !!user && isComum && !isAdmin;
  const chave = ["meu-remetente-email", user?.id];
  const consulta = useQuery({
    queryKey: chave, enabled: habilitado, refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("config_email_remetente_usuario")
        .select("nome_remetente,email_remetente,email_resposta").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => { if (consulta.data) setForm({ ...consulta.data, email_resposta: consulta.data.email_resposta ?? "" }); }, [consulta.data]);
  if (!habilitado) return null;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = validarRemetenteUsuario(form);
    setErro(msg);
    if (msg) return;
    setSalvando(true);
    const { error } = await supabase.from("config_email_remetente_usuario").upsert({
      user_id: user!.id, nome_remetente: form.nome_remetente.trim(),
      email_remetente: form.email_remetente.trim().toLowerCase(),
      email_resposta: form.email_resposta.trim().toLowerCase() || null, atualizado_em: new Date().toISOString(),
    });
    setSalvando(false);
    if (error) { setErro("Não foi possível salvar seu remetente. Tente novamente."); return; }
    await client.invalidateQueries({ queryKey: chave });
    toast.success("Seu e-mail de envio foi salvo.");
  };

  return (
    <section className="space-y-4 border-t pt-6" aria-labelledby="meu-remetente-titulo">
      <h2 id="meu-remetente-titulo" className="flex items-center gap-2 text-base font-semibold"><UserRound className="h-4 w-4 text-primary" />Meu e-mail de envio</h2>
      <p className="text-sm text-muted-foreground">Os relatórios que você enviar sairão com seu nome e seu e-mail @samel.com.br. Não informe senhas.</p>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {([
            ["nome_remetente", "Nome do remetente", "text"],
            ["email_remetente", "Meu e-mail @samel.com.br", "email"],
            ["email_resposta", "E-mail para respostas (opcional)", "email"],
          ] as const).map(([campo, titulo, tipo]) => (
            <div key={campo} className="space-y-2">
              <Label htmlFor={`meu-remetente-${campo}`}>{titulo}</Label>
              <Input id={`meu-remetente-${campo}`} type={tipo} maxLength={254} value={form[campo]}
                disabled={consulta.isLoading || salvando}
                onChange={ev => { setForm(f => ({ ...f, [campo]: ev.target.value })); setErro(null); }} />
            </div>
          ))}
        </div>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end"><Button type="submit" disabled={consulta.isLoading || salvando}>{salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar meu remetente</Button></div>
      </form>
    </section>
  );
}
