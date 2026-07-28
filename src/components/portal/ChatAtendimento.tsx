import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
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

type ChatMsg =
  | { key: string; role: "user"; text: string; at?: string }
  | { key: string; role: "assistant"; text: string; setor?: string; at?: string }
  | { key: string; role: "staff"; text: string; at?: string };

const setorLabel: Record<string, string> = {
  cadastro: "Cadastro",
  relacionamento: "Relacionamento",
  financeiro: "Financeiro",
};

const setorClasses: Record<string, string> = {
  cadastro: "bg-primary/10 text-primary border-primary/20",
  relacionamento:
    "bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))] border-[hsl(var(--info)/0.25)]",
  financeiro:
    "bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.3)]",
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

type DialogMode = { kind: "new" } | { kind: "existing"; atendimentoId: string } | null;

export function ChatAtendimento() {
  const { user, empresaVinculadaId, activeEmpresaId } = useAuth();
  const empresaId = activeEmpresaId ?? empresaVinculadaId;
  const qc = useQueryClient();
  const [mode, setMode] = useState<DialogMode>(null);

  const { data: historico } = useQuery({
    queryKey: ["portal-atendimentos-hist", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("atendimentos")
        .select("id, mensagem_original, resumo, setor_destino, status, criado_em")
        .eq("empresa_id", empresaId!)
        .order("criado_em", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as AtendimentoHist[];
    },
  });

  const abertos = (historico ?? []).filter((a) => a.status !== "resolvido").length;

  return (
    <Card className="flex h-[560px] flex-col overflow-hidden border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center gap-3 border-b bg-gradient-to-r from-primary/5 via-transparent to-transparent py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Headphones className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base leading-tight">Atendimento</CardTitle>
          <p className="text-xs text-muted-foreground">
            {abertos > 0
              ? `${abertos} conversa${abertos > 1 ? "s" : ""} em aberto`
              : "Fale com nossa equipe"}
          </p>
        </div>
        <Button size="sm" onClick={() => setMode({ kind: "new" })} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nova conversa
        </Button>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-0 p-0">
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
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
              <Button size="sm" className="mt-2 gap-1.5" onClick={() => setMode({ kind: "new" })}>
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
                      onClick={() => setMode({ kind: "existing", atendimentoId: a.id })}
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
                            className={cn("gap-1 text-[10px] font-medium", st.className)}
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
      </CardContent>

      <ConversaDialog
        mode={mode}
        onClose={() => {
          setMode(null);
          qc.invalidateQueries({ queryKey: ["portal-atendimentos-hist", empresaVinculadaId] });
        }}
        historico={historico ?? []}
        userId={user?.id ?? null}
      />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Dialog unificado: nova conversa OU conversa existente                       */
/* -------------------------------------------------------------------------- */

function ConversaDialog({
  mode,
  onClose,
  historico,
  userId,
}: {
  mode: DialogMode;
  onClose: () => void;
  historico: AtendimentoHist[];
  userId: string | null;
}) {
  const open = !!mode;
  const isNew = mode?.kind === "new";
  const atendimentoId =
    mode?.kind === "existing" ? mode.atendimentoId : null;
  const atendimento = atendimentoId
    ? historico.find((h) => h.id === atendimentoId) ?? null
    : null;

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentAtdId, setCurrentAtdId] = useState<string | null>(null);
  const [currentSetor, setCurrentSetor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const subRef = useRef<string | null>(null);

  // Carrega mensagens ao abrir (existente) ou reseta (nova)
  useEffect(() => {
    if (!open) return;
    setInput("");
    if (isNew) {
      setMessages([
        {
          key: "greet",
          role: "assistant",
          text:
            "Olá! Descreva sua solicitação e eu encaminho para o setor certo (Cadastro, Relacionamento ou Financeiro).",
        },
      ]);
      setCurrentAtdId(null);
      setCurrentSetor(null);
    } else if (atendimento) {
      setCurrentAtdId(atendimento.id);
      setCurrentSetor(atendimento.setor_destino);
      (async () => {
        const { data } = await (supabase as any)
          .from("atendimentos_mensagens")
          .select("id, autor_tipo, mensagem, criado_em")
          .eq("atendimento_id", atendimento.id)
          .order("criado_em", { ascending: true });
        const initial: ChatMsg[] = [
          {
            key: `orig-${atendimento.id}`,
            role: "user",
            text: atendimento.mensagem_original,
            at: atendimento.criado_em,
          },
        ];
        (data ?? []).forEach((m: any) => {
          initial.push({
            key: m.id,
            role: m.autor_tipo === "empresa" ? "user" : "staff",
            text: m.mensagem,
            at: m.criado_em,
          });
        });
        setMessages(initial);
      })();
    }
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [open, isNew, atendimento?.id]);

  // Realtime: se conversa (nova recém-classificada ou existente) tiver id, ouve staff msgs
  useEffect(() => {
    if (!currentAtdId) return;
    if (subRef.current === currentAtdId) return;
    subRef.current = currentAtdId;
    const channel = supabase
      .channel(`portal-conv-${currentAtdId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "atendimentos_mensagens",
          filter: `atendimento_id=eq.${currentAtdId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row.autor_tipo !== "staff") return;
          setMessages((m) => [
            ...m,
            { key: row.id, role: "staff", text: row.mensagem, at: row.criado_em },
          ]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      subRef.current = null;
    };
  }, [currentAtdId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function enviar() {
    const texto = input.trim();
    if (!texto || loading) return;
    setInput("");
    const tempKey = `u-${Date.now()}`;
    setMessages((m) => [...m, { key: tempKey, role: "user", text: texto }]);
    setLoading(true);
    try {
      if (!currentAtdId) {
        // Nova conversa → classificar via edge function
        const { data, error } = await supabase.functions.invoke("classificar-atendimento", {
          body: { mensagem: texto },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        const atdId = (data as any).atendimento_id as string | undefined;
        const setor = (data as any).setor_destino as string | undefined;
        setMessages((m) => [
          ...m,
          {
            key: `a-${Date.now()}`,
            role: "assistant",
            text: (data as any).resposta as string,
            setor,
          },
        ]);
        if (atdId) {
          setCurrentAtdId(atdId);
          setCurrentSetor(setor ?? null);
        }
      } else {
        // Conversa existente → insere mensagem da empresa
        if (!userId) throw new Error("Sessão expirada");
        const { error } = await (supabase as any).from("atendimentos_mensagens").insert({
          atendimento_id: currentAtdId,
          autor_tipo: "empresa",
          autor_id: userId,
          mensagem: texto,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enviar mensagem");
      setMessages((m) => m.filter((x) => x.key !== tempKey));
      setInput(texto);
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

  const setor = currentSetor ?? atendimento?.setor_destino;
  const status = atendimento?.status ?? (isNew ? "aberto" : null);
  const st = status
    ? statusMeta[status] ?? { label: status, className: "bg-muted border-border" }
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/5 via-transparent to-transparent px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border",
                setor ? setorClasses[setor] : "bg-primary/10 text-primary border-primary/20",
              )}
            >
              <MessageSquare className="h-4 w-4" />
            </div>
            {isNew && !currentAtdId
              ? "Nova conversa"
              : `Conversa · ${setor ? setorLabel[setor] ?? setor : ""}`}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1 text-xs">
            {st && (
              <Badge variant="outline" className={cn("gap-1 text-[10px]", st.className)}>
                <Circle className="h-1.5 w-1.5 fill-current" />
                {st.label}
              </Badge>
            )}
            {atendimento && (
              <span className="text-muted-foreground">{fmtDataHora(atendimento.criado_em)}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/20 px-5 py-4">
          {messages.map((m) => (
            <div
              key={m.key}
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
                    : "rounded-bl-sm bg-card border border-border/60 text-foreground",
                )}
              >
                {m.role === "assistant" && (m as any).setor && (
                  <div className="mb-1.5">
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] font-medium", setorClasses[(m as any).setor])}
                    >
                      Encaminhado · {setorLabel[(m as any).setor] ?? (m as any).setor}
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
                {m.at && (
                  <div
                    className={cn(
                      "mt-1 text-[10px]",
                      m.role === "user" ? "opacity-80" : "text-muted-foreground",
                    )}
                  >
                    {fmtDataHora(m.at)}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm bg-card border border-border/60 px-4 py-2 text-sm text-muted-foreground shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {currentAtdId ? "Enviando..." : "Analisando sua solicitação..."}
              </div>
            </div>
          )}
        </div>

        <Separator />
        <div className="bg-background p-3">
          <div className="flex items-end gap-2 rounded-xl border border-border/70 bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={
                currentAtdId ? "Escreva uma resposta..." : "Descreva sua solicitação..."
              }
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
      </DialogContent>
    </Dialog>
  );
}
