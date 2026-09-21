import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { MessageSquare, ArrowLeft, Send, Loader2, CheckCircle2, Paperclip, X as XIcon, Search, Inbox, Clock, CheckCheck, Building2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MensagemBody } from "@/components/atendimentos/MensagemBody";
import { Ticks, statusFromMsg } from "@/components/atendimentos/Ticks";

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function avatarColor(seed: string) {
  const palette = [
    "from-emerald-500/80 to-teal-600/80",
    "from-sky-500/80 to-blue-600/80",
    "from-violet-500/80 to-fuchsia-600/80",
    "from-amber-500/80 to-orange-600/80",
    "from-rose-500/80 to-pink-600/80",
    "from-cyan-500/80 to-emerald-600/80",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

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
  const [pendingImages, setPendingImages] = useState<Array<{ url: string; name: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todos" | Status>("todos");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function anexarImagem(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Imagem acima de 8MB"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("atendimentos-anexos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("atendimentos-anexos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed?.signedUrl) throw sErr ?? new Error("Erro ao gerar URL");
      setPendingImages((p) => [...p, { url: signed.signedUrl, name: file.name }]);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enviar imagem");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const setoresVisiveis = useMemo<Setor[]>(() => {
    if (role === "financeiro") return ["financeiro"];
    if (role === "comum" || role === "administradoras") return ["cadastro"];
    // Admin, executivo, executivo_externo, diretora, visualizacao, enfermeira, vendas, etc.
    return ["cadastro", "relacionamento", "financeiro"];
  }, [role]);

  const canShow = !!user && setoresVisiveis.length > 0 && role !== "financeiro";


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
  const contagens = {
    todos: atendimentos.length,
    aberto: atendimentos.filter((a) => a.status === "aberto").length,
    em_andamento: atendimentos.filter((a) => a.status === "em_andamento").length,
    resolvido: atendimentos.filter((a) => a.status === "resolvido").length,
  };
  const q = query.trim().toLowerCase();
  const listaFiltrada = atendimentos.filter((a) => {
    if (filter !== "todos" && a.status !== filter) return false;
    if (!q) return true;
    return (
      (a.empresas?.nome ?? "").toLowerCase().includes(q) ||
      (a.resumo ?? "").toLowerCase().includes(q) ||
      a.mensagem_original.toLowerCase().includes(q)
    );
  });
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
    if (!selected || !user) return;
    const text = reply.trim();
    if (!text && pendingImages.length === 0) return;
    const parts: string[] = [];
    if (text) parts.push(text);
    pendingImages.forEach((i) => parts.push(`![${i.name}](${i.url})`));
    const mensagem = parts.join("\n\n");
    setSending(true);
    const { error } = await (supabase as any).from("atendimentos_mensagens").insert({
      atendimento_id: selected.id,
      autor_tipo: "staff",
      autor_id: user.id,
      mensagem,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setReply("");
    setPendingImages([]);
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
          "fixed bottom-5 right-5 z-40 group flex items-center justify-center rounded-2xl h-14 w-14 shadow-xl transition-all duration-300",
          "bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground",
          "hover:scale-105 hover:shadow-2xl active:scale-95",
          "ring-1 ring-primary/20",
          abertos > 0 && "animate-[pulse_2.4s_ease-in-out_infinite]"
        )}
        title="Central de atendimentos"
        aria-label="Central de atendimentos"
      >
        <MessageSquare className="h-6 w-6 drop-shadow-sm transition-transform group-hover:rotate-[-6deg]" />
        {abertos > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 ring-2 ring-background shadow-md">
            {abertos > 99 ? "99+" : abertos}
          </span>
        )}
        {abertos > 0 && (
          <span className="absolute inset-0 rounded-2xl ring-2 ring-primary/40 animate-ping opacity-40 pointer-events-none" />
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
                {selected.status === "resolvido" ? (
                  <div className="text-center text-xs text-muted-foreground py-3">
                    Atendimento <strong>Resolvido</strong> — conversa encerrada.
                  </div>
                ) : (
                <>
                {pendingImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingImages.map((img, i) => (
                      <div key={i} className="relative">
                        <img src={img.url} alt={img.name} className="h-14 w-14 object-cover rounded border border-border" />
                        <button
                          type="button"
                          onClick={() => setPendingImages((p) => p.filter((_, idx) => idx !== i))}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) anexarImagem(f); }}
                />
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Escreva uma resposta…"
                  rows={2}
                  className="resize-none text-sm"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={marcarResolvido}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Resolver
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      title="Anexar imagem"
                    >
                      {uploading ? <Loader2 className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button size="sm" onClick={enviar} disabled={sending || (!reply.trim() && pendingImages.length === 0)}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />} Enviar
                  </Button>
                </div>
                </>
                )}
              </div>
            </>
          ) : (
            <>
              <SheetHeader className="p-4 border-b bg-gradient-to-br from-primary/10 via-background to-background space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shrink-0">
                      <MessageSquare className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                      <SheetTitle className="text-base leading-tight">Central de atendimentos</SheetTitle>
                      <SheetDescription className="text-xs mt-0.5 truncate">
                        Setor{setoresVisiveis.length > 1 ? "es" : ""}:{" "}
                        <span className="capitalize font-medium text-foreground/80">{setoresVisiveis.join(", ")}</span>
                      </SheetDescription>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar empresa ou mensagem…"
                    className="pl-9 h-9 bg-background/70"
                  />
                </div>

                <div className="flex items-center gap-1 -mx-1 overflow-x-auto scrollbar-none">
                  {([
                    { key: "todos", label: "Todos", icon: Inbox, count: contagens.todos },
                    { key: "aberto", label: "Abertos", icon: MessageSquare, count: contagens.aberto },
                    { key: "em_andamento", label: "Andamento", icon: Clock, count: contagens.em_andamento },
                    { key: "resolvido", label: "Resolvidos", icon: CheckCheck, count: contagens.resolvido },
                  ] as const).map((t) => {
                    const active = filter === t.key;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.key}
                        onClick={() => setFilter(t.key as any)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {t.label}
                        <span className={cn(
                          "ml-0.5 px-1.5 rounded-full text-[10px] tabular-nums",
                          active ? "bg-primary-foreground/20" : "bg-muted",
                        )}>
                          {t.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {listaFiltrada.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                        <Inbox className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">
                        {query ? "Nenhum resultado" : "Caixa vazia"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {query ? "Tente outra busca." : "Novos atendimentos aparecerão aqui."}
                      </p>
                    </div>
                  )}
                  {listaFiltrada.map((a) => {
                    const nome = a.empresas?.nome ?? "Empresa";
                    const isAberto = a.status === "aberto";
                    const isAndamento = a.status === "em_andamento";
                    const isResolvido = a.status === "resolvido";
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedId(a.id)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl transition-all group relative",
                          "hover:bg-muted/70 hover:shadow-sm active:scale-[0.99]",
                          "border border-transparent hover:border-border/60",
                          isAberto && "bg-destructive/[0.04]",
                          isResolvido && "opacity-75",
                        )}
                      >
                        {isAberto && (
                          <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r bg-destructive" />
                        )}
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-xs font-semibold shadow-sm ring-1 ring-black/5",
                              avatarColor(nome),
                            )}
                          >
                            {initials(nome) || <Building2 className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-sm truncate flex-1">{nome}</span>
                              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                {timeAgo(a.atualizado_em || a.criado_em)}
                              </span>
                            </div>
                            <p className={cn(
                              "text-xs line-clamp-2 leading-snug",
                              isAberto ? "text-foreground/90 font-medium" : "text-muted-foreground",
                            )}>
                              {a.resumo || a.mensagem_original}
                            </p>
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-medium capitalize text-muted-foreground">
                                {a.setor_destino}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium",
                                  isAberto && "bg-destructive/15 text-destructive",
                                  isAndamento && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                                  isResolvido && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                                )}
                              >
                                <span className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  isAberto && "bg-destructive animate-pulse",
                                  isAndamento && "bg-amber-500",
                                  isResolvido && "bg-emerald-500",
                                )} />
                                {isAberto ? "Aberto" : isAndamento ? "Em andamento" : "Resolvido"}
                              </span>
                            </div>
                          </div>
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
