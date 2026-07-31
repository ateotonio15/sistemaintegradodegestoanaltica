import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Search, CheckCircle2, ArrowLeft, ArrowRight, SlidersHorizontal, ChevronDown, X } from "lucide-react";

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
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const filtrosAtivos = statusSel.length + diaEmissaoSel.length;
  const limparFiltros = () => {
    setStatusSel([]);
    setDiaEmissaoSel([]);
  };

  useEffect(() => {
    if (!open) return;
    setEtapa(1);
    setSel(new Set());
    setUsuariosSel(new Set());
    setBusca("");
    setStatusSel([]);
    setDiaEmissaoSel([]);
    setFiltrosAbertos(false);

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
  // Envia nome + contrato da empresa
  const empresasSelecionadasNomes = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    selecionadas.forEach((e) => {
      const contrato = (e.contrato ?? "").trim();
      const label = contrato ? `${e.nome} - Contrato ${contrato}` : e.nome;
      if (seen.has(label)) return;
      seen.add(label);
      out.push(label);
    });
    return out;
  }, [selecionadas]);

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
    const entries = usuariosOrbit
      .filter((u) => usuariosSel.has(u.login.toLowerCase()))
      .map((u) => ({ user: u.login, companies: empresasSelecionadasNomes }));

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
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col gap-4 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 text-primary p-2.5 shrink-0">
              <Send className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg">Enviar empresas para o Orbit</DialogTitle>
              <DialogDescription>
                {etapa === 1
                  ? "Selecione as empresas/contratos que deseja enviar."
                  : "Selecione os usuários validados no Orbit que receberão os projetos."}
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-4">
            {[1, 2].map((n) => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div
                  className={cn(
                    "h-6 w-6 rounded-full grid place-items-center text-[11px] font-semibold shrink-0 transition-colors",
                    etapa >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {n}
                </div>
                <span className={cn("text-xs", etapa === n ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {n === 1 ? "Empresas" : "Usuários"}
                </span>
                {n === 1 && <div className={cn("h-px flex-1 transition-colors", etapa > 1 ? "bg-primary" : "bg-border")} />}
              </div>
            ))}
          </div>
        </DialogHeader>

        {etapa === 1 && (
          <>
            <div className="px-6 space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 h-10 rounded-xl bg-muted/40 border-transparent focus-visible:bg-background focus-visible:border-input"
                    placeholder="Buscar empresa, contrato ou responsável..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant={filtrosAtivos > 0 ? "default" : "outline"}
                  className="h-10 rounded-xl gap-2"
                  onClick={() => setFiltrosAbertos((v) => !v)}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros
                  {filtrosAtivos > 0 && (
                    <span className="ml-0.5 rounded-full bg-background/25 px-1.5 text-[11px] font-semibold tabular-nums">
                      {filtrosAtivos}
                    </span>
                  )}
                  <ChevronDown className={cn("h-4 w-4 transition-transform", filtrosAbertos && "rotate-180")} />
                </Button>
              </div>

              {filtrosAtivos > 0 && !filtrosAbertos && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {statusSel.map((s) => (
                    <Badge key={s} variant="secondary" className="rounded-full gap-1 font-normal">
                      {s}
                      <X className="h-3 w-3 cursor-pointer opacity-70 hover:opacity-100" onClick={() => setStatusSel((p) => p.filter((x) => x !== s))} />
                    </Badge>
                  ))}
                  {diaEmissaoSel.map((d) => (
                    <Badge key={d} variant="secondary" className="rounded-full gap-1 font-normal tabular-nums">
                      Dia {String(d).padStart(2, "0")}
                      <X className="h-3 w-3 cursor-pointer opacity-70 hover:opacity-100" onClick={() => setDiaEmissaoSel((p) => p.filter((x) => x !== d))} />
                    </Badge>
                  ))}
                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline" onClick={limparFiltros}>
                    Limpar
                  </button>
                </div>
              )}

              <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
                <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
                  <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
                    {statusDisponiveis.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</span>
                          {statusSel.length > 0 && (
                            <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setStatusSel([])}>
                              limpar
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {statusDisponiveis.map((s) => {
                            const n = unicas.filter((e) => e.status === s).length;
                            const ativo = statusSel.includes(s);
                            return (
                              <Badge
                                key={s}
                                variant={ativo ? "default" : "outline"}
                                className="cursor-pointer rounded-full font-normal transition-colors"
                                onClick={() => setStatusSel((prev) => (ativo ? prev.filter((x) => x !== s) : [...prev, s]))}
                              >
                                {s} ({n})
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {diasEmissaoDisponiveis.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Dia de emissão</span>
                          {diaEmissaoSel.length > 0 && (
                            <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setDiaEmissaoSel([])}>
                              limpar
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {diasEmissaoDisponiveis.map((d) => {
                            const n = unicas.filter((e) => e.dia_emissao === d).length;
                            const ativo = diaEmissaoSel.includes(d);
                            return (
                              <Badge
                                key={d}
                                variant={ativo ? "default" : "outline"}
                                className="cursor-pointer rounded-full font-normal tabular-nums transition-colors"
                                onClick={() => setDiaEmissaoSel((prev) => (ativo ? prev.filter((x) => x !== d) : [...prev, d]))}
                              >
                                {String(d).padStart(2, "0")} ({n})
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t">
                      <span className="text-xs text-muted-foreground">{lista.length} resultado(s)</span>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={limparFiltros} disabled={filtrosAtivos === 0}>
                        Limpar filtros
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2 text-sm">
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
                <Badge variant={sel.size ? "default" : "secondary"} className="rounded-full">{sel.size} selecionada(s)</Badge>
              </div>
            </div>


            <div className="px-6 flex-1 min-h-0">
              <ScrollArea className="h-[330px] rounded-lg border">
                {lista.length === 0 ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</div>
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
                            "group flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none transition-colors hover:bg-muted/50 border-l-2 border-l-transparent",
                            marcada && "bg-primary/5 border-l-primary"
                          )}
                        >
                          <Checkbox checked={marcada} onCheckedChange={() => toggle(k)} onClick={(ev) => ev.stopPropagation()} className="shrink-0" />
                          <div className="h-8 w-8 shrink-0 rounded-md bg-muted grid place-items-center text-[11px] font-semibold text-muted-foreground">
                            {e.nome.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{e.nome}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              Contrato {e.contrato || "—"} · {e.responsavel || "Sem responsável"}
                              {login ? ` · @${login}` : " · sem login"}
                            </div>
                          </div>
                          {e.status && <Badge variant="outline" className="shrink-0 text-[10px] rounded-full font-normal">{e.status}</Badge>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-muted/30">
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-6 py-10 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Validando usuários no Orbit...
              </div>
            )}

            {!validando && (
              <>
                <div className="px-6 space-y-3">
                  <div className="rounded-lg border bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{empresasSelecionadasNomes.length} empresa(s)</span> serão enviadas para cada usuário marcado.
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={usuariosOrbit.length > 0 && usuariosOrbit.every((u) => usuariosSel.has(u.login.toLowerCase()))}
                        onCheckedChange={(v) =>
                          setUsuariosSel(v ? new Set(usuariosOrbit.map((u) => u.login.toLowerCase())) : new Set())
                        }
                      />
                      <span className="text-muted-foreground">Selecionar todos ({usuariosOrbit.length})</span>
                    </label>
                    <Badge variant={usuariosSel.size ? "default" : "secondary"} className="rounded-full">{usuariosSel.size} usuário(s)</Badge>
                  </div>
                </div>

                <div className="px-6 flex-1 min-h-0">
                  <ScrollArea className="h-[330px] rounded-lg border p-3">
                    <div className="space-y-2">
                      {usuariosOrbit.length === 0 ? (
                        <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                          Nenhum usuário ativo no Orbit foi encontrado.
                        </div>
                      ) : (
                        usuariosOrbit.map((u) => {
                          const marcado = usuariosSel.has(u.login.toLowerCase());
                          const res = resultados.find((r) => r.username.toLowerCase() === u.login.toLowerCase());
                          return (
                            <div
                              key={u.login}
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleUsuario(u.login)}
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter" || ev.key === " ") {
                                  ev.preventDefault();
                                  toggleUsuario(u.login);
                                }
                              }}
                              className={cn(
                                "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer select-none transition-colors hover:bg-muted/40",
                                marcado && "border-primary bg-primary/10"
                              )}
                            >
                              <Checkbox checked={marcado} onCheckedChange={() => toggleUsuario(u.login)} onClick={(ev) => ev.stopPropagation()} />
                              <div className="h-8 w-8 shrink-0 rounded-full bg-muted grid place-items-center text-[11px] font-semibold text-muted-foreground">
                                {(u.nome || u.login).slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">@{u.login}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {u.nome || "Usuário do Orbit"}
                                  {res ? ` · ${res.added ?? 0} criada(s)` : ""}
                                </div>
                              </div>
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}

            <DialogFooter className="px-6 py-4 border-t bg-muted/30">
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
