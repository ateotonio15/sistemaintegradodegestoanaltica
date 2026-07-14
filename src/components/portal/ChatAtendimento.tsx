import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; setor?: string; atendimentoId?: string }
  | { role: "staff"; text: string; setor?: string };

const setorLabel: Record<string, string> = {
  cadastro: "Cadastro",
  relacionamento: "Relacionamento",
  financeiro: "Financeiro",
};

export function ChatAtendimento() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Olá! Descreva sua solicitação e eu encaminho para o setor certo (Cadastro, Relacionamento ou Financeiro).",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const subscribedRef = useRef<Set<string>>(new Set());

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
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
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
    </Card>
  );
}
