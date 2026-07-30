import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Search, CheckCircle2, XCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type OrbitEmpresa = {
  id: string;
  nome: string;
  contrato?: string | null;
  responsavel?: string | null;
  status?: string | null;
  dia_emissao?: number | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresas: OrbitEmpresa[];
}

export function EnviarOrbitDialog({ open, onOpenChange, empresas }: Props) {
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [busca, setBusca] = useState("");
  const [statusSel, setStatusSel] = useState<string[]>([]);
  const [diaEmissaoSel, setDiaEmissaoSel] = useState<number[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [usuariosSel, setUsuariosSel] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [perfis, setPerfis] = useState<Array<{ display_name: string | null; username: string | null }>>([]);
  const [resultados, setResultados] = useState<Array<{ username: string; resolved: boolean; added?: number }>>([]);
  const [validando, setValidando] = useState(false);
  const [loginsValidos, setLoginsValidos] = useState<Set<string>>(new Set());
  const [validado, setValidado] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEtapa(1);
    setSel(new Set());
    setUsuariosSel(new Set());
    setBusca("");
    setStatusSel([]);
    setDiaEmissaoSel([]);
    setResultados([]);
    setLoginsValidos(new Set());
    setValidado(false);
    supabase
      .from("profiles")
      .select("display_name, username")
      .then(({ data }) => setPerfis((data ?? []) as any));
  }, [open]);

  // Empresas únicas por contrato/nome (o Financeiro repete a empresa por período/pagador)
  const unicas = useMemo(() => {
    const map = new Map<string, OrbitEmpresa>();
    empresas.forEach((e) => {
      const nome = (e.nome ?? "").trim();
      if (!nome) return;
      const key = `${e.contrato ?? ""}|${nome.toLowerCase()}`;
      if (!map.has(key)) map.set(key, { ...e, nome });
    });
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [empresas]);

  const statusDisponiveis = useMemo(() => {
    const s = new Set<string>();
    unicas.forEach((e) => e.status && s.add(e.status));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [unicas]);

  const diasEmissaoDisponiveis = useMemo(() => {
    const d = new Set<number>();
    unicas.forEach((e) => typeof e.dia_emissao === "number" && d.add(e.dia_emissao));
    return Array.from(d).sort((a, b) => a - b);
  }, [unicas]);

  const keyOf = (e: OrbitEmpresa) => `${e.contrato ?? ""}|${e.nome.toLowerCase()}`;

  const orbitUser = (resp?: string | null) => {
    const nome = (resp ?? "").trim();
    if (!nome) return "";
    const p = perfis.find((u) => (u.display_name ?? "").trim().toLowerCase() === nome.toLowerCase());
    return (p?.username || "").trim();
  };

  // ETAPA 1 — lista completa de empresas (sem filtro por validação)
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return unicas.filter((e) => {
      if (statusSel.length && !statusSel.includes(e.status ?? "")) return false;
      if (diaEmissaoSel.length && !(typeof e.dia_emissao === "number" && diaEmissaoSel.includes(e.dia_emissao))) return false;
      if (!q) return true;
      return `${e.nome} ${e.contrato ?? ""} ${e.responsavel ?? ""}`.toLowerCase().includes(q);
    });
  }, [unicas, busca, statusSel, diaEmissaoSel]);

  const toggle = (k: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const todasMarcadas = lista.length > 0 && lista.every((e) => sel.has(keyOf(e)));

  const selecionadas = useMemo(() => unicas.filter((e) => sel.has(keyOf(e))), [unicas, sel]);
  const empresasSelecionadasNomes = useMemo(
    () => Array.from(new Set(selecionadas.map((e) => e.nome))),
    [selecionadas]
  );

  // ETAPA 2 — descobre quais usuários do SIGA estão ativos no Orbit
  async function irParaEtapa2() {
    if (sel.size === 0) {
      toast.error("Selecione ao menos uma empresa.");
      return;
    }
    setEtapa(2);
    const logins = Array.from(
      new Set(perfis.map((p) => (p.username ?? "").trim()).filter(Boolean))
    );
    if (!logins.length) {
      setLoginsValidos(new Set());
      setValidado(true);
      return;
    }
    setValidando(true);
    setValidado(false);
    try {
      const { data, error } = await supabase.functions.invoke("orbit-daily-companies", {
        body: { entries: logins.map((user) => ({ user, companies: [] })) },
      });
      if (error) throw error;
      const results = ((data as any)?.results ?? []) as Array<{ username: string; resolved: boolean }>;
      setLoginsValidos(new Set(results.filter((r) => r.resolved).map((r) => r.username.toLowerCase())));
      setUsuariosSel(new Set());
    } catch (err: any) {
      toast.error("Não foi possível validar os usuários no Orbit", { description: err.message ?? String(err) });
      setLoginsValidos(new Set());
    } finally {
      setValidando(false);
      setValidado(true);
    }
  }

  // Usuários ativos no Orbit (login do SIGA que existe no Orbit)
  const usuariosOrbit = useMemo(() => {
    return perfis
      .map((p) => ({ login: (p.username ?? "").trim(), nome: (p.display_name ?? "").trim() }))
      .filter((u) => u.login && loginsValidos.has(u.login.toLowerCase()))
      .sort((a, b) => a.login.localeCompare(b.login, "pt-BR"));
  }, [perfis, loginsValidos]);

  const toggleUsuario = (login: string) =>
    setUsuariosSel((prev) => {
      const next = new Set(prev);
      const k = login.toLowerCase();
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });


  async function enviar() {
    const entries = gruposValidos
      .filter((g) => usuariosSel.has(g.login.toLowerCase()))
      .map((g) => ({ user: g.login, companies: g.empresas }));
    if (!entries.length) {
      toast.error("Selecione ao menos um usuário validado no Orbit.");
      return;
    }

    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("orbit-daily-companies", { body: { entries } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const results = ((data as any)?.results ?? []) as Array<{ username: string; resolved: boolean; added?: number }>;
      setResultados(results);
      const totalAdded = results.reduce((s, r) => s + (r.added ?? 0), 0);
      toast.success(`${totalAdded} empresa(s) criada(s) no Orbit`, {
        description: `Conectado com ${entries.length} usuário(s): ${entries.map((e) => e.user).join(", ")}.`,
      });
    } catch (err: any) {
      toast.error("Erro ao enviar para o Orbit", { description: err.message ?? String(err) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Enviar empresas para o Orbit</DialogTitle>
          <DialogDescription>
            {etapa === 1
              ? "Etapa 1 de 2 — selecione as empresas/contratos que deseja enviar."
              : "Etapa 2 de 2 — selecione os usuários validados no Orbit que receberão os projetos."}
          </DialogDescription>
        </DialogHeader>

        {etapa === 1 && (
          <>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar empresa, contrato ou responsável..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>

            {statusDisponiveis.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={statusSel.length === 0 ? "default" : "outline"} className="cursor-pointer" onClick={() => setStatusSel([])}>
                  Todos ({unicas.length})
                </Badge>
                {statusDisponiveis.map((s) => {
                  const n = unicas.filter((e) => e.status === s).length;
                  const ativo = statusSel.includes(s);
                  return (
                    <Badge
                      key={s}
                      variant={ativo ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setStatusSel((prev) => (ativo ? prev.filter((x) => x !== s) : [...prev, s]))}
                    >
                      {s} ({n})
                    </Badge>
                  );
                })}
              </div>
            )}

            {diasEmissaoDisponiveis.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-muted-foreground mr-1">Dia de emissão:</span>
                <Badge variant={diaEmissaoSel.length === 0 ? "default" : "outline"} className="cursor-pointer" onClick={() => setDiaEmissaoSel([])}>
                  Todos
                </Badge>
                {diasEmissaoDisponiveis.map((d) => {
                  const n = unicas.filter((e) => e.dia_emissao === d).length;
                  const ativo = diaEmissaoSel.includes(d);
                  return (
                    <Badge
                      key={d}
                      variant={ativo ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setDiaEmissaoSel((prev) => (ativo ? prev.filter((x) => x !== d) : [...prev, d]))}
                    >
                      {String(d).padStart(2, "0")} ({n})
                    </Badge>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={todasMarcadas}
                  onCheckedChange={(v) =>
                    setSel((prev) => {
                      const next = new Set(prev);
                      lista.forEach((e) => (v ? next.add(keyOf(e)) : next.delete(keyOf(e))));
                      return next;
                    })
                  }
                />
                <span className="text-muted-foreground">Selecionar todas ({lista.length})</span>
              </label>
              <Badge variant="secondary">{sel.size} selecionada(s)</Badge>
            </div>

            <ScrollArea className="h-[340px] rounded-md border">
              {lista.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {lista.map((e) => {
                    const k = keyOf(e);
                    const login = orbitUser(e.responsavel);
                    const marcada = sel.has(k);
                    return (
                      <li
                        key={k}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggle(k)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            toggle(k);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 cursor-pointer select-none hover:bg-muted/40",
                          marcada && "bg-primary/10"
                        )}
                      >
                        <Checkbox checked={marcada} onCheckedChange={() => toggle(k)} onClick={(ev) => ev.stopPropagation()} className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{e.nome}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            Contrato {e.contrato || "—"} · {e.responsavel || "Sem responsável"}
                            {login ? ` · @${login}` : " · sem login"}
                          </div>
                        </div>
                        {e.status && <Badge variant="outline" className="shrink-0 text-[10px]">{e.status}</Badge>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
              <Button onClick={irParaEtapa2} disabled={sel.size === 0} className="gap-1.5">
                Continuar ({sel.size}) <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {etapa === 2 && (
          <>
            {validando && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Validando usuários no Orbit...
              </div>
            )}

            {!validando && (
              <ScrollArea className="h-[400px] rounded-md border p-3">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Validados no Orbit ({gruposValidos.length})
                    </div>
                    {gruposValidos.length === 0 ? (
                      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        Nenhum responsável das empresas selecionadas existe no Orbit.
                      </div>
                    ) : (
                      gruposValidos.map((g) => {
                        const marcado = usuariosSel.has(g.login.toLowerCase());
                        const res = resultados.find((r) => r.username.toLowerCase() === g.login.toLowerCase());
                        return (
                          <div
                            key={g.login}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleUsuario(g.login)}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter" || ev.key === " ") {
                                ev.preventDefault();
                                toggleUsuario(g.login);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer select-none hover:bg-muted/40",
                              marcado && "border-primary bg-primary/10"
                            )}
                          >
                            <Checkbox checked={marcado} onCheckedChange={() => toggleUsuario(g.login)} onClick={(ev) => ev.stopPropagation()} />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{g.responsavel || g.login} · @{g.login}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {g.empresas.length} empresa(s) selecionada(s)
                                {res ? ` · ${res.added ?? 0} criada(s)` : ""}
                              </div>
                            </div>
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          </div>
                        );
                      })
                    )}
                  </div>

                  {(gruposInvalidos.length > 0 || grupos.semLogin.length > 0) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                        <XCircle className="h-3.5 w-3.5" /> Não enviáveis
                      </div>
                      {gruposInvalidos.map((g) => (
                        <div key={g.login} className="flex items-start gap-2 text-xs text-destructive px-1">
                          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <div>
                            {g.responsavel || g.login} → @{g.login} · {g.empresas.length} empresa(s) — não encontrado no Orbit
                          </div>
                        </div>
                      ))}
                      {grupos.semLogin.map((s) => (
                        <div key={s.empresa} className="flex items-start gap-2 text-xs text-amber-500 px-1">
                          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <div>{s.empresa} — {s.responsavel} sem login no SIGA</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEtapa(1)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={enviar} disabled={enviando || validando || usuariosSel.size === 0} className="gap-1.5">
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar {usuariosSel.size > 0 ? `(${usuariosSel.size} usuário(s))` : ""}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
