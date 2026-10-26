import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { validarConfigEmail, type ConfigEmailRelatorios } from "@/lib/config-email-relatorios";

const inicial: ConfigEmailRelatorios = { dominio: "samel.com.br", nome_remetente: "", email_remetente: "", email_resposta: "" };

export function EmailRelatoriosForm() {
  const { user, isAdmin } = useAuth();
  const client = useQueryClient();
  const [form, setForm] = useState<ConfigEmailRelatorios>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const consulta = useQuery({
    queryKey: ["config-email-relatorios", user?.id],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("config_email_relatorios").select("dominio,nome_remetente,email_remetente,email_resposta").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (consulta.data) setForm({ ...consulta.data, email_resposta: consulta.data.email_resposta ?? "" });
  }, [consulta.data]);

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !isAdmin) return;
    const mensagem = validarConfigEmail(form);
    setErro(mensagem);
    if (mensagem) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from("config_email_relatorios").upsert({
        id: 1, dominio: form.dominio.trim().toLowerCase(), nome_remetente: form.nome_remetente.trim(),
        email_remetente: form.email_remetente.trim().toLowerCase(), email_resposta: form.email_resposta.trim() || null,
        atualizado_por: user.id, atualizado_em: new Date().toISOString(),
      });
      if (error) throw error;
      await client.invalidateQueries({ queryKey: ["config-email-relatorios", user.id] });
      toast.success("Dados do remetente salvos. O envio de e-mails continua desativado.");
    } catch {
      setErro("Não foi possível salvar os dados do remetente. Tente novamente.");
    } finally { setSalvando(false); }
  };

  return (
    <section className="space-y-4 border-t pt-6" aria-labelledby="email-relatorios-titulo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="email-relatorios-titulo" className="flex items-center gap-2 text-base font-semibold"><Mail className="h-4 w-4 text-primary" />E-mail dos Relatórios</h2>
        <Badge variant="secondary">Envio não ativado</Badge>
      </div>
      {!isAdmin ? <p className="text-sm text-muted-foreground">O cadastro do remetente está disponível para o perfil Administrador do sistema. A ativação do domínio exige um administrador ou proprietário do espaço de trabalho no Lovable.</p> : (
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {([
              ["dominio", "Domínio", "samel.com.br", "text"],
              ["nome_remetente", "Nome do remetente", "Nome que aparecerá no e-mail", "text"],
              ["email_remetente", "E-mail do remetente", "Endereço de envio", "email"],
              ["email_resposta", "E-mail para respostas (opcional)", "Usar o remetente se não preenchido", "email"],
            ] as const).map(([campo, titulo, placeholder, tipo]) => (
              <div key={campo} className="space-y-2">
                <Label htmlFor={`email-relatorios-${campo}`}>{titulo}</Label>
                <Input id={`email-relatorios-${campo}`} type={tipo} placeholder={placeholder} value={form[campo]} maxLength={254}
                  disabled={consulta.isLoading || !!consulta.error || salvando} required={campo !== "email_resposta"}
                  onChange={e => { setForm(f => ({ ...f, [campo]: e.target.value })); setErro(null); }} />
              </div>
            ))}
          </div>
          {consulta.isLoading && <p className="text-sm text-muted-foreground">Carregando dados do remetente...</p>}
          {consulta.error && <div className="flex items-center gap-2"><p role="alert" className="text-sm text-destructive">Não foi possível carregar os dados.</p><Button type="button" variant="outline" size="sm" onClick={() => consulta.refetch()}>Tentar novamente</Button></div>}
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <p className="text-sm text-muted-foreground">Domínio pendente de configuração. A ativação exige um administrador ou proprietário do espaço de trabalho no Lovable. Não informe senhas ou chaves neste formulário.</p>
          <div className="flex justify-end"><Button type="submit" disabled={consulta.isLoading || !!consulta.error || salvando}>{salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar dados do remetente</Button></div>
        </form>
      )}
    </section>
  );
}