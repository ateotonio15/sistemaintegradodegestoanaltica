import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, ArrowLeft, Send, Loader2, CheckCircle2, PlayCircle, Paperclip, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MensagemBody } from "@/components/atendimentos/MensagemBody";
import { Ticks, statusFromMsg } from "@/components/atendimentos/Ticks";

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
  empresas?: { nome: string | null } | null;
}

interface Mensagem {
  id: string;
  autor_tipo: "staff" | "empresa";
  mensagem: string;
  criado_em: string;
  lida_em: string | null;
}

export function FloatingFilaChat() {
  const { user, role, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const setoresVisiveis = useMemo<Setor[]>(() => {
    if (role === "financeiro") return ["financeiro"];
    if (role === "comum" || role === "administradoras") return ["cadastro"];
    // Admin, executivo, executivo_externo, diretora, visualizacao, enfermeira, vendas, etc.
    return ["cadastro", "relacionamento", "financeiro"];
  }, [role]);

  const canShow = !!user && setoresVisiveis.length > 0;


  const { data: atendimentos = [] } = useQuery({
    queryKey: ["floating-fila", setoresVisiveis.join(",")],
    enabled: canShow && !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos")
        .select("*, empresas:empresa_id (nome)")
        .in("setor_destino", setoresVisiveis)
        .order("status", { ascending: true })
        .order("criado_em", { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data ?? []) as unknown as Atendimento[];
    },
  });

  // Realtime: refresh on any change
  useEffect(() => {
    if (!canShow || !user) return;
    const ch = supabase
      .channel("floating-fila-rt-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos" }, () => {
        qc.invalidateQueries({ queryKey: ["floating-fila"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos_mensagens" }, () => {
        qc.invalidateQueries({ queryKey: ["floating-mensagens"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [canShow, user, qc]);

  const { data: mensagens = [] } = useQuery({
    queryKey: ["floating-mensagens", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("atendimentos_mensagens")
        .select("id, autor_tipo, mensagem, criado_em, lida_em")
        .eq("atendimento_id", selectedId!)
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Mensagem[];
    },
  });

  const abertos = atendimentos.filter((a) => a.status !== "resolvido").length;
  const selected = atendimentos.find((a) => a.id === selectedId) ?? null;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensagens, selectedId]);

  // Marca mensagens da empresa como lidas ao abrir a conversa flutuante
  useEffect(() => {
    if (!selectedId || !open || mensagens.length === 0) return;
    const unread = mensagens.filter((m) => m.autor_tipo === "empresa" && !m.lida_em).map((m) => m.id);
    if (unread.length === 0) return;
    (async () => {
      await (supabase as any)
        .from("atendimentos_mensagens")
        .update({ lida_em: new Date().toISOString() })
        .in("id", unread);
      qc.invalidateQueries({ queryKey: ["floating-mensagens", selectedId] });
    })();
  }, [selectedId, open, mensagens, qc]);

  async function enviar() {
    if (!selected || !user || !reply.trim()) return;
    setSending(true);
    const { error } = await (supabase as any).from("atendimentos_mensagens").insert({
      atendimento_id: selected.id,
      autor_tipo: "staff",
      autor_id: user.id,
      mensagem: reply.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setReply("");
    qc.invalidateQueries({ queryKey: ["floating-mensagens", selected.id] });
    if (selected.status === "aberto") {
      await supabase.from("atendimentos").update({ status: "em_andamento" }).eq("id", selected.id);
      qc.invalidateQueries({ queryKey: ["floating-fila"] });
    }
  }

  async function marcarResolvido() {
    if (!selected) return;
    const { error } = await supabase.from("atendimentos").update({ status: "resolvido" }).eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Atendimento resolvido");
    qc.invalidateQueries({ queryKey: ["floating-fila"] });
    setSelectedId(null);
  }

  if (!canShow) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-4 right-4 z-40 flex items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all",
          "bg-primary text-primary-foreground border-primary/40 hover:brightness-110 h-12 w-12",
          abertos > 0 && "ring-2 ring-destructive/60",
        )}
        title="Central de atendimentos"
        aria-label="Central de atendimentos"
      >
        <MessageSquare className="h-5 w-5" />
        {abertos > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 ring-2 ring-background">
            {abertos > 99 ? "99+" : abertos}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          {selected ? (
            <>
              <SheetHeader className="p-4 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" onClick={() => setSelectedId(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-sm truncate">{selected.empresas?.nome ?? "Empresa"}</SheetTitle>
                    <SheetDescription className="text-xs capitalize">
                      Setor: {selected.setor_destino} · {selected.status.replace("_", " ")}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <ScrollArea className="flex-1">
                <div ref={scrollRef} className="p-4 space-y-3">
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Mensagem original</div>
                    {selected.mensagem_original}
                  </div>
                  {mensagens.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        m.autor_tipo === "staff"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      <MensagemBody text={m.mensagem} />
                      <div className={cn("text-[10px] mt-1 opacity-70 flex items-center gap-1", m.autor_tipo === "staff" && "justify-end")}>
                        <span>{new Date(m.criado_em).toLocaleString("pt-BR")}</span>
                        {m.autor_tipo === "staff" && (
                          <Ticks status={statusFromMsg({ key: m.id, lida_em: m.lida_em })} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="border-t p-3 space-y-2 bg-background">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Escreva uma resposta…"
                  rows={2}
                  className="resize-none text-sm"
                />
                <div className="flex items-center justify-between gap-2">
                  {selected.status !== "resolvido" ? (
                    <Button size="sm" variant="outline" onClick={marcarResolvido}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Resolver
                    </Button>
                  ) : <span />}
                  <Button size="sm" onClick={enviar} disabled={sending || !reply.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />} Enviar
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <SheetHeader className="p-4 border-b bg-muted/30">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4" /> Central de atendimentos
                </SheetTitle>
                <SheetDescription>
                  Mensagens direcionadas ao{setoresVisiveis.length > 1 ? "s" : ""} setor{setoresVisiveis.length > 1 ? "es" : ""}:{" "}
                  <span className="capitalize font-medium">{setoresVisiveis.join(", ")}</span>
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {atendimentos.length === 0 && (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Nenhum atendimento no momento.
                    </div>
                  )}
                  {atendimentos.map((a) => {
                    const statusColor =
                      a.status === "aberto" ? "destructive" :
                      a.status === "em_andamento" ? "secondary" : "outline";
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedId(a.id)}
                        className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate flex-1">
                            {a.empresas?.nome ?? "Empresa"}
                          </span>
                          <Badge variant={statusColor as any} className="text-[10px]">
                            {a.status === "em_andamento" ? "andamento" : a.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {a.resumo || a.mensagem_original}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] capitalize">{a.setor_destino}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(a.criado_em).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
