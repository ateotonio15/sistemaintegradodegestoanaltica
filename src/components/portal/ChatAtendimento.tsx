import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChevronRight } from "lucide-react";
import { MessageCircle, Send, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/useAuth";

type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; setor?: string; atendimentoId?: string }
  | { role: "staff"; text: string; setor?: string };

const setorLabel: Record<string, string> = {
  cadastro: "Cadastro",
  relacionamento: "Relacionamento",
  financeiro: "Financeiro",
};

interface AtendimentoHist {
  id: string;
  mensagem_original: string;
  resumo: string | null;
  setor_destino: string;
  status: string;
  criado_em: string;
}

interface MsgHist {
  id: string;
  atendimento_id: string;
  autor_tipo: "staff" | "empresa";
  mensagem: string;
  criado_em: string;
}

export function ChatAtendimento() {
  const { empresaVinculadaId } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const hasStarted = started;
  const [openHistId, setOpenHistId] = useState<string | null>(null);

  function iniciarConversa() {
    setStarted(true);
    setMessages([
      {
        role: "assistant",
        text: "Olá! Descreva sua solicitação e eu encaminho para o setor certo (Cadastro, Relacionamento ou Financeiro).",
      },
    ]);
  }

  const { data: historico } = useQuery({
    queryKey: ["portal-atendimentos-hist", empresaVinculadaId],
    enabled: !!empresaVinculadaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("atendimentos")
        .select("id, mensagem_original, resumo, setor_destino, status, criado_em")
        .eq("empresa_id", empresaVinculadaId!)
        .order("criado_em", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as AtendimentoHist[];
    },
  });

  const ids = (historico ?? []).map((a) => a.id);
  const { data: histMsgs } = useQuery({
    queryKey: ["portal-atendimentos-hist-msgs", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("atendimentos_mensagens")
        .select("id, atendimento_id, autor_tipo, mensagem, criado_em")
        .in("atendimento_id", ids)
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MsgHist[];
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function subscribeRespostas(atendimentoId: string) {
    if (subscribedRef.current.has(atendimentoId)) return;
    subscribedRef.current.add(atendimentoId);
    const channel = supabase
      .channel(`atd-msg-${atendimentoId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "atendimentos_mensagens", filter: `atendimento_id=eq.${atendimentoId}` },
        (payload) => {
          const row = payload.new as any;
          if (row?.autor_tipo !== "staff") return;
          setMessages((m) => [...m, { role: "staff", text: row.mensagem as string }]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async function enviar() {
    const texto = input.trim();
    if (!texto || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: texto }]);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("classificar-atendimento", {
        body: { mensagem: texto },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const atendimentoId = (data as any).atendimento_id as string | undefined;
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: (data as any).resposta as string,
          setor: (data as any).setor_destino as string,
          atendimentoId,
        },
      ]);
      if (atendimentoId) subscribeRespostas(atendimentoId);
    } catch (err: any) {
      const msg = err?.message ?? "Erro ao enviar solicitação";
      toast.error(msg);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `Não consegui encaminhar sua solicitação agora. ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  const showHistorico = !hasStarted && (historico?.length ?? 0) > 0;
  const msgsPorAtd = (histMsgs ?? []).reduce<Record<string, MsgHist[]>>((acc, m) => {
    (acc[m.atendimento_id] ??= []).push(m);
    return acc;
  }, {});

  return (
    <Card className="flex h-[520px] flex-col">
      <CardHeader className="flex flex-row items-center gap-2 border-b">
        <MessageCircle className="h-5 w-5 text-primary" />
        <CardTitle>Atendimento</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 p-0">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground"
                    : "max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2 text-sm"
                }
              >
                {m.role === "assistant" && m.setor && (
                  <div className="mb-1">
                    <Badge variant="secondary">Encaminhado: {setorLabel[m.setor] ?? m.setor}</Badge>
                  </div>
                )}
                {m.role === "staff" && (
                  <div className="mb-1">
                    <Badge>Resposta da equipe</Badge>
                  </div>
                )}
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {showHistorico && (
            <div className="pt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <History className="h-3.5 w-3.5" />
                Conversas anteriores
              </div>
              <div className="divide-y rounded-lg border bg-background/50">
                {historico!.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setOpenHistId(a.id)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {setorLabel[a.setor_destino] ?? a.setor_destino}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {a.status.replace("_", " ")}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(a.criado_em).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {a.resumo || a.mensagem_original}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando sua solicitação...
              </div>
            </div>
          )}
        </div>
        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Descreva sua solicitação..."
              rows={2}
              disabled={loading}
              className="resize-none"
            />
            <Button onClick={enviar} disabled={loading || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </CardContent>

      <Dialog open={!!openHistId} onOpenChange={(o) => !o && setOpenHistId(null)}>
        <DialogContent className="max-w-lg">
          {(() => {
            const a = historico?.find((x) => x.id === openHistId);
            if (!a) return null;
            const ms = msgsPorAtd[a.id] ?? [];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    Conversa · {setorLabel[a.setor_destino] ?? a.setor_destino}
                  </DialogTitle>
                  <DialogDescription>
                    {new Date(a.criado_em).toLocaleString("pt-BR")} ·{" "}
                    <span className="capitalize">{a.status.replace("_", " ")}</span>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                      <div className="whitespace-pre-wrap">{a.mensagem_original}</div>
                    </div>
                  </div>
                  {ms.map((m) => (
                    <div key={m.id} className={m.autor_tipo === "empresa" ? "flex justify-end" : "flex justify-start"}>
                      <div className={
                        m.autor_tipo === "empresa"
                          ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                          : "max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm"
                      }>
                        {m.autor_tipo === "staff" && (
                          <div className="mb-1"><Badge className="text-[10px]">Equipe</Badge></div>
                        )}
                        <div className="whitespace-pre-wrap">{m.mensagem}</div>
                        <div className="text-[10px] opacity-70 mt-1">
                          {new Date(m.criado_em).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    </div>
                  ))}
                  {ms.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sem respostas da equipe ainda.</p>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

