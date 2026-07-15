import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ChevronRight,
  Circle,
  Clock,
  Headphones,
  History,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; setor?: string; atendimentoId?: string }
  | { role: "staff"; text: string; setor?: string };

const setorLabel: Record<string, string> = {
  cadastro: "Cadastro",
  relacionamento: "Relacionamento",
  financeiro: "Financeiro",
};

const setorClasses: Record<string, string> = {
  cadastro: "bg-primary/10 text-primary border-primary/20",
  relacionamento: "bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))] border-[hsl(var(--info)/0.25)]",
  financeiro: "bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.3)]",
};

const statusMeta: Record<string, { label: string; className: string }> = {
  aberto: {
    label: "Aberto",
    className:
      "bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.3)]",
  },
  em_andamento: {
    label: "Em andamento",
    className:
      "bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))] border-[hsl(var(--info)/0.25)]",
  },
  resolvido: {
    label: "Resolvido",
    className:
      "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.25)]",
  },
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

function fmtDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatAtendimento() {
  const { empresaVinculadaId } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const [openHistId, setOpenHistId] = useState<string | null>(null);

  function iniciarConversa() {
    setStarted(true);
    setMessages([
      {
        role: "assistant",
        text:
          "Olá! Descreva sua solicitação e eu encaminho para o setor certo (Cadastro, Relacionamento ou Financeiro).",
      },
    ]);
    setTimeout(() => inputRef.current?.focus(), 60);
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
        {
          event: "INSERT",
          schema: "public",
          table: "atendimentos_mensagens",
          filter: `atendimento_id=eq.${atendimentoId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row?.autor_tipo !== "staff") return;
          setMessages((m) => [...m, { role: "staff", text: row.mensagem as string }]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
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

  const msgsPorAtd = useMemo(
    () =>
      (histMsgs ?? []).reduce<Record<string, MsgHist[]>>((acc, m) => {
        (acc[m.atendimento_id] ??= []).push(m);
        return acc;
      }, {}),
    [histMsgs],
  );

  const abertos = (historico ?? []).filter((a) => a.status !== "resolvido").length;

  return (
    <Card className="flex h-[560px] flex-col overflow-hidden border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center gap-3 border-b bg-gradient-to-r from-primary/5 via-transparent to-transparent py-3">
        {started ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -ml-1 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setStarted(false);
              setMessages([]);
              setInput("");
            }}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Headphones className="h-4 w-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base leading-tight">Atendimento</CardTitle>
          <p className="text-xs text-muted-foreground">
            {started
              ? "Conversa em andamento"
              : abertos > 0
              ? `${abertos} conversa${abertos > 1 ? "s" : ""} em aberto`
              : "Fale com nossa equipe"}
          </p>
        </div>
        {!started && (
          <Button size="sm" onClick={iniciarConversa} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nova conversa
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-0 p-0">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {/* Mensagens do chat ativo */}
          {started &&
            messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                {m.role !== "user" && (
                  <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {m.role === "staff" ? (
                      <Headphones className="h-3.5 w-3.5" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                    m.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : m.role === "staff"
                      ? "rounded-bl-sm border border-border/60 bg-card text-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  {m.role === "assistant" && m.setor && (
                    <div className="mb-1.5">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-medium", setorClasses[m.setor])}
                      >
                        Encaminhado · {setorLabel[m.setor] ?? m.setor}
                      </Badge>
                    </div>
                  )}
                  {m.role === "staff" && (
                    <div className="mb-1.5">
                      <Badge className="text-[10px] font-medium">Resposta da equipe</Badge>
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

          {/* Histórico */}
          {!started && (
            <div>
              <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                Conversas anteriores
              </div>

              {(historico?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/30 px-6 py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Nenhuma conversa por aqui ainda
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Inicie uma nova conversa e nossa IA encaminha sua solicitação para o setor
                    responsável.
                  </p>
                  <Button size="sm" className="mt-2 gap-1.5" onClick={iniciarConversa}>
                    <Plus className="h-4 w-4" />
                    Iniciar conversa
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
                  {historico!.map((a) => {
                    const st = statusMeta[a.status] ?? {
                      label: a.status,
                      className: "bg-muted text-foreground border-border",
                    };
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => setOpenHistId(a.id)}
                          className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/50"
                        >
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                              setorClasses[a.setor_destino] ?? "bg-muted",
                            )}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium capitalize text-foreground">
                                {setorLabel[a.setor_destino] ?? a.setor_destino}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "gap-1 text-[10px] font-medium",
                                  st.className,
                                )}
                              >
                                <Circle className="h-1.5 w-1.5 fill-current" />
                                {st.label}
                              </Badge>
                            </div>
                            <p className="line-clamp-1 text-xs text-muted-foreground">
                              {a.resumo || a.mensagem_original}
                            </p>
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/80">
                              <Clock className="h-3 w-3" />
                              {fmtDataHora(a.criado_em)}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando sua solicitação...
              </div>
            </div>
          )}
        </div>

        {started && (
          <>
            <Separator />
            <div className="bg-muted/30 p-3">
              <div className="flex items-end gap-2 rounded-xl border border-border/70 bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Descreva sua solicitação..."
                  rows={2}
                  disabled={loading}
                  className="min-h-[44px] flex-1 resize-none border-0 bg-transparent p-1.5 text-sm shadow-none focus-visible:ring-0"
                />
                <Button
                  onClick={enviar}
                  disabled={loading || !input.trim()}
                  size="icon"
                  className="h-9 w-9 shrink-0"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
                <kbd className="rounded border border-border bg-background px-1 py-px text-[10px]">
                  Enter
                </kbd>{" "}
                enviar ·{" "}
                <kbd className="rounded border border-border bg-background px-1 py-px text-[10px]">
                  Shift+Enter
                </kbd>{" "}
                nova linha
              </p>
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={!!openHistId} onOpenChange={(o) => !o && setOpenHistId(null)}>
        <DialogContent className="max-w-lg">
          {(() => {
            const a = historico?.find((x) => x.id === openHistId);
            if (!a) return null;
            const ms = msgsPorAtd[a.id] ?? [];
            const st = statusMeta[a.status] ?? {
              label: a.status,
              className: "bg-muted text-foreground border-border",
            };
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md border",
                        setorClasses[a.setor_destino] ?? "bg-muted",
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </div>
                    Conversa · {setorLabel[a.setor_destino] ?? a.setor_destino}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-2 pt-1">
                    <Badge variant="outline" className={cn("gap-1 text-[10px]", st.className)}>
                      <Circle className="h-1.5 w-1.5 fill-current" />
                      {st.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{fmtDataHora(a.criado_em)}</span>
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
                  <div className="flex justify-end">
                    <div className="max-w-[82%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground shadow-sm">
                      <div className="whitespace-pre-wrap">{a.mensagem_original}</div>
                    </div>
                  </div>
                  {ms.map((m) => (
                    <div
                      key={m.id}
                      className={
                        m.autor_tipo === "empresa" ? "flex justify-end" : "flex justify-start"
                      }
                    >
                      <div
                        className={cn(
                          "max-w-[82%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                          m.autor_tipo === "empresa"
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm border border-border/60 bg-card",
                        )}
                      >
                        {m.autor_tipo === "staff" && (
                          <div className="mb-1">
                            <Badge className="text-[10px]">Equipe</Badge>
                          </div>
                        )}
                        <div className="whitespace-pre-wrap">{m.mensagem}</div>
                        <div className="mt-1 text-[10px] opacity-70">
                          {fmtDataHora(m.criado_em)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {ms.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Sem respostas da equipe ainda.
                    </p>
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
