import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, ArrowRightLeft, CheckCircle2, PlayCircle, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type Setor = "cadastro" | "relacionamento" | "financeiro";
type Status = "aberto" | "em_andamento" | "resolvido";

interface Atendimento {
  id: string;
  empresa_id: string;
  mensagem_original: string;
  resumo: string | null;
  setor_destino: Setor;
  setor_original: Setor;
  status: Status;
  criado_em: string;
  atualizado_em: string;
  empresas?: { nome: string | null; cnpj: string | null } | null;
}

interface Redirecionamento {
  id: string;
  setor_de: Setor;
  setor_para: Setor;
  observacao: string | null;
  criado_em: string;
  redirecionado_por: string;
}

const SETORES: Setor[] = ["cadastro", "relacionamento", "financeiro"];

const statusBadge = (s: Status) => {
  const map: Record<Status, { label: string; variant: "default" | "secondary" | "outline" }> = {
    aberto: { label: "Aberto", variant: "default" },
    em_andamento: { label: "Em andamento", variant: "secondary" },
    resolvido: { label: "Resolvido", variant: "outline" },
  };
  return map[s];
};

export default function FilaAtendimento() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<Setor>("cadastro");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [redirectSetor, setRedirectSetor] = useState<Setor | "">("");
  const [redirectObs, setRedirectObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const { data: atendimentos, isLoading } = useQuery({
    queryKey: ["fila-atendimentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos")
        .select("*, empresas:empresa_id (nome, cnpj)")
        .order("status", { ascending: true })
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Atendimento[];
    },
  });

  const selected = useMemo(
    () => atendimentos?.find((a) => a.id === selectedId) ?? null,
    [atendimentos, selectedId],
  );

  const { data: historico } = useQuery({
    queryKey: ["atendimento-historico", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos_redirecionamentos")
        .select("*")
        .eq("atendimento_id", selectedId!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Redirecionamento[];
    },
  });

  const { data: mensagens } = useQuery({
    queryKey: ["atendimento-mensagens", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("atendimentos_mensagens")
        .select("*")
        .eq("atendimento_id", selectedId!)
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; autor_tipo: "staff" | "empresa"; mensagem: string; criado_em: string }>;
    },
  });

  async function enviarResposta() {
    if (!selected || !user || !replyText.trim()) return;
    setSendingReply(true);
    const { error } = await (supabase as any).from("atendimentos_mensagens").insert({
      atendimento_id: selected.id,
      autor_tipo: "staff",
      autor_id: user.id,
      mensagem: replyText.trim(),
    });
    setSendingReply(false);
    if (error) return toast.error(error.message);
    setReplyText("");
    toast.success("Mensagem enviada");
    qc.invalidateQueries({ queryKey: ["atendimento-mensagens", selected.id] });
    if (selected.status === "aberto") {
      await supabase.from("atendimentos").update({ status: "em_andamento" }).eq("id", selected.id);
      qc.invalidateQueries({ queryKey: ["fila-atendimentos"] });
    }
  }

  const filtered = useMemo(() => {
    const list = (atendimentos ?? []).filter((a) => a.setor_destino === tab);
    const order: Record<Status, number> = { aberto: 0, em_andamento: 1, resolvido: 2 };
    return [...list].sort((a, b) => {
      const s = order[a.status] - order[b.status];
      if (s !== 0) return s;
      return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
    });
  }, [atendimentos, tab]);

  const counts = useMemo(() => {
    const c: Record<Setor, number> = { cadastro: 0, relacionamento: 0, financeiro: 0 };
    (atendimentos ?? []).forEach((a) => {
      if (a.status === "aberto") c[a.setor_destino] = (c[a.setor_destino] ?? 0) + 1;
    });
    return c;
  }, [atendimentos]);

  async function atualizarStatus(novo: Status) {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("atendimentos")
      .update({ status: novo })
      .eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Marcado como ${statusBadge(novo).label.toLowerCase()}`);
    qc.invalidateQueries({ queryKey: ["fila-atendimentos"] });
  }

  async function redirecionar() {
    if (!selected || !redirectSetor) return;
    if (redirectSetor === selected.setor_destino) {
      return toast.error("Selecione um setor diferente do atual.");
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setSaving(false);
      return toast.error("Sessão expirada.");
    }
    const setorDe = selected.setor_destino;
    const { error: histErr } = await supabase.from("atendimentos_redirecionamentos").insert({
      atendimento_id: selected.id,
      setor_de: setorDe,
      setor_para: redirectSetor,
      redirecionado_por: uid,
      observacao: redirectObs || null,
    });
    if (histErr) {
      setSaving(false);
      return toast.error(histErr.message);
    }
    const { error: updErr } = await supabase
      .from("atendimentos")
      .update({ setor_destino: redirectSetor })
      .eq("id", selected.id);
    setSaving(false);
    if (updErr) return toast.error(updErr.message);
    toast.success(`Redirecionado para ${redirectSetor}`);
    setRedirectSetor("");
    setRedirectObs("");
    qc.invalidateQueries({ queryKey: ["fila-atendimentos"] });
    qc.invalidateQueries({ queryKey: ["atendimento-historico", selected.id] });
    setTab(redirectSetor as Setor);
    setSelectedId(null);
  }

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Fila de Atendimento</h1>
        <p className="text-muted-foreground text-sm">
          Atendimentos recebidos das empresas, organizados por setor.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Setor)}>
        <TabsList>
          {SETORES.map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">
              {s}
              {counts[s] > 0 && (
                <Badge variant="destructive" className="ml-2">{counts[s]}</Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {SETORES.map((s) => (
          <TabsContent key={s} value={s} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="capitalize text-base">Setor: {s}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum atendimento neste setor.</p>
                ) : (
                  <div className="divide-y">
                    {filtered.map((a) => {
                      const b = statusBadge(a.status);
                      return (
                        <button
                          key={a.id}
                          onClick={() => setSelectedId(a.id)}
                          className="w-full text-left py-3 px-2 hover:bg-muted/50 transition-colors rounded"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium truncate">
                                  {a.empresas?.nome ?? "Empresa"}
                                </span>
                                <Badge variant={b.variant}>{b.label}</Badge>
                                {a.setor_original !== a.setor_destino && (
                                  <Badge variant="outline" className="text-xs">
                                    origem: {a.setor_original}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {a.resumo || a.mensagem_original}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(a.criado_em).toLocaleString("pt-BR")}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.empresas?.nome ?? "Empresa"}</DialogTitle>
                <DialogDescription>
                  {selected.empresas?.cnpj ?? "—"} ·{" "}
                  {new Date(selected.criado_em).toLocaleString("pt-BR")}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                <Badge variant={statusBadge(selected.status).variant}>
                  {statusBadge(selected.status).label}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  destino: {selected.setor_destino}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  original: {selected.setor_original}
                </Badge>
              </div>

              {selected.resumo && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Resumo</h4>
                  <p className="text-sm text-muted-foreground">{selected.resumo}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-1">Mensagem original</h4>
                <div className="text-sm bg-muted/50 p-3 rounded whitespace-pre-wrap">
                  {selected.mensagem_original}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-2">Conversa com a empresa</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 mb-2">
                  {(!mensagens || mensagens.length === 0) ? (
                    <p className="text-xs text-muted-foreground">Nenhuma mensagem trocada ainda.</p>
                  ) : (
                    mensagens.map((m) => (
                      <div key={m.id} className={m.autor_tipo === "staff" ? "flex justify-end" : "flex justify-start"}>
                        <div className={
                          m.autor_tipo === "staff"
                            ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                            : "max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm"
                        }>
                          <MensagemBody text={m.mensagem} />
                          <div className={"text-[10px] mt-1 opacity-70"}>
                            {new Date(m.criado_em).toLocaleString("pt-BR")}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex items-end gap-2">
                  <Textarea
                    placeholder="Escreva uma resposta para a empresa..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={2}
                    className="resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        enviarResposta();
                      }
                    }}
                  />
                  <Button onClick={enviarResposta} disabled={sendingReply || !replyText.trim()} size="icon">
                    {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>


              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saving || selected.status === "em_andamento"}
                  onClick={() => atualizarStatus("em_andamento")}
                >
                  <PlayCircle className="h-4 w-4 mr-1" /> Em andamento
                </Button>
                <Button
                  size="sm"
                  disabled={saving || selected.status === "resolvido"}
                  onClick={() => atualizarStatus("resolvido")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Resolvido
                </Button>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" /> Redirecionar para outro setor
                </h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={redirectSetor} onValueChange={(v) => setRedirectSetor(v as Setor)}>
                    <SelectTrigger className="sm:w-56">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {SETORES.filter((s) => s !== selected.setor_destino).map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={redirecionar} disabled={saving || !redirectSetor}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redirecionar"}
                  </Button>
                </div>
                <Textarea
                  className="mt-2"
                  placeholder="Observação (opcional)"
                  value={redirectObs}
                  onChange={(e) => setRedirectObs(e.target.value)}
                />
              </div>

              {historico && historico.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-2">Histórico de redirecionamentos</h4>
                  <ul className="space-y-2 text-sm">
                    {historico.map((h) => (
                      <li key={h.id} className="bg-muted/40 rounded p-2">
                        <div className="flex justify-between">
                          <span className="capitalize">
                            {h.setor_de} → <strong>{h.setor_para}</strong>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(h.criado_em).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        {h.observacao && (
                          <p className="text-xs text-muted-foreground mt-1">{h.observacao}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
