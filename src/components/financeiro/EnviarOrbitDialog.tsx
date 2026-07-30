import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Search, CheckCircle2, XCircle, Link2 } from "lucide-react";
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
  const [busca, setBusca] = useState("");
  const [statusSel, setStatusSel] = useState<string[]>([]);
  const [diaEmissaoSel, setDiaEmissaoSel] = useState<number[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [perfis, setPerfis] = useState<Array<{ display_name: string | null; username: string | null }>>([]);
  const [resultados, setResultados] = useState<Array<{ username: string; resolved: boolean; added?: number }>>([]);
  const [validando, setValidando] = useState(false);
  const [loginsValidos, setLoginsValidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSel(new Set());
    setBusca("");
    setStatusSel([]);
    setDiaEmissaoSel([]);
    setResultados([]);
    setLoginsValidos(new Set());
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

  // Valida no Orbit quais logins existem (envio com companies vazio = apenas checagem)
  useEffect(() => {
    if (!open || perfis.length === 0 || unicas.length === 0) return;
    const logins = Array.from(
      new Set(unicas.map((e) => orbitUser(e.responsavel)).filter(Boolean))
    );
    if (!logins.length) return;
    let cancelado = false;
    setValidando(true);
    supabase.functions
      .invoke("orbit-daily-companies", {
        body: { entries: logins.map((user) => ({ user, companies: [] })) },
      })
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          toast.error("Não foi possível validar os usuários no Orbit");
          return;
        }
        const results = ((data as any)?.results ?? []) as Array<{ username: string; resolved: boolean }>;
        setLoginsValidos(
          new Set(results.filter((r) => r.resolved).map((r) => r.username.toLowerCase()))
        );
      })
      .finally(() => !cancelado && setValidando(false));
    return () => {
      cancelado = true;
    };
  }, [open, perfis, unicas]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return unicas.filter((e) => {
      const login = orbitUser(e.responsavel).toLowerCase();
      if (!login || !loginsValidos.has(login)) return false;
      if (statusSel.length && !statusSel.includes(e.status ?? "")) return false;
      if (diaEmissaoSel.length && !(typeof e.dia_emissao === "number" && diaEmissaoSel.includes(e.dia_emissao))) return false;
      if (!q) return true;
      return `${e.nome} ${e.contrato ?? ""} ${e.responsavel ?? ""}`.toLowerCase().includes(q);
    });
  }, [unicas, busca, statusSel, diaEmissaoSel, loginsValidos, perfis]);

  const toggle = (k: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const todasMarcadas = lista.length > 0 && lista.every((e) => sel.has(keyOf(e)));

  const usuariosValidados = useMemo(() => {
    const map = new Map<string, { username: string; responsavel: string; empresas: OrbitEmpresa[] }>();
    lista.forEach((empresa) => {
      const login = orbitUser(empresa.responsavel);
      if (!login) return;
      const cur = map.get(login.toLowerCase()) ?? {
        username: login,
        responsavel: (empresa.responsavel ?? "").trim(),
        empresas: [],
      };
      cur.empresas.push(empresa);
      map.set(login.toLowerCase(), cur);
    });
    return Array.from(map.values()).sort((a, b) => a.username.localeCompare(b.username));
  }, [lista, perfis]);


  const toggleUsuarioValidado = (username: string, marcar: boolean) => {
    const empresasDoUsuario = lista.filter(
      (empresa) => orbitUser(empresa.responsavel).toLowerCase() === username.toLowerCase()
    );
    setSel((prev) => {
      const next = new Set(prev);
      empresasDoUsuario.forEach((empresa) => {
        const key = keyOf(empresa);
        marcar ? next.add(key) : next.delete(key);
      });
      return next;
    });
  };

  // Vínculo SIGA -> Orbit das empresas selecionadas
  const conexoes = useMemo(() => {
    const map = new Map<string, { login: string; responsavel: string; empresas: string[] }>();
    const semLogin: Array<{ empresa: string; responsavel: string }> = [];
    unicas
      .filter((e) => sel.has(keyOf(e)))
      .forEach((e) => {
        const login = orbitUser(e.responsavel);
        if (!login) {
          semLogin.push({ empresa: e.nome, responsavel: (e.responsavel ?? "").trim() || "Sem responsável" });
          return;
        }
        const cur = map.get(login) ?? { login, responsavel: (e.responsavel ?? "").trim(), empresas: [] };
        if (!cur.empresas.includes(e.nome)) cur.empresas.push(e.nome);
        map.set(login, cur);
      });
    return { grupos: Array.from(map.values()).sort((a, b) => a.login.localeCompare(b.login)), semLogin };
  }, [unicas, sel, perfis]);

  async function enviar() {
    const entries = conexoes.grupos.map((g) => ({ user: g.login, companies: g.empresas }));
    if (!entries.length) {
      toast.error("Nenhum login do SIGA foi encontrado para as empresas selecionadas.");
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
      const naoEncontrados = results.filter((r) => !r.resolved).map((r) => r.username);

      if (naoEncontrados.length) {
        toast.warning(`${totalAdded} empresa(s) criada(s) no Orbit`, {
          description: `Usuários não encontrados no Orbit: ${naoEncontrados.join(", ")}.`,
        });
      } else {
        toast.success(`${totalAdded} empresa(s) criada(s) no Orbit`, {
          description: `Conectado com ${entries.length} usuário(s): ${entries.map((e) => e.user).join(", ")}.`,
        });
      }
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
            Filtre por status e dia de emissão, selecione empresas/contratos e envie. O vínculo com o Orbit usa o login (username) do SIGA do responsável.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar empresa, contrato ou responsável..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        {statusDisponiveis.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant={statusSel.length === 0 ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setStatusSel([])}
            >
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
            <Badge
              variant={diaEmissaoSel.length === 0 ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setDiaEmissaoSel([])}
            >
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
                  onClick={() =>
                    setDiaEmissaoSel((prev) => (ativo ? prev.filter((x) => x !== d) : [...prev, d]))
                  }
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

        {validando && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Validando usuários no Orbit...
          </div>
        )}

        {!validando && usuariosValidados.length === 0 && (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Nenhum usuário validado no Orbit para os filtros atuais.
          </div>
        )}

        {usuariosValidados.length > 0 && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase">
              <CheckCircle2 className="h-3.5 w-3.5" /> Usuários validados no SIGA e Orbit ({usuariosValidados.length})
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {usuariosValidados.map((usuario) => {
                const marcado = usuario.empresas.every((empresa) => sel.has(keyOf(empresa)));
                const parcialmenteMarcado = usuario.empresas.some((empresa) => sel.has(keyOf(empresa)));
                return (
                  <label
                    key={usuario.username}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer bg-background hover:bg-muted/50",
                      parcialmenteMarcado && "border-primary bg-primary/10"
                    )}
                  >
                    <Checkbox
                      checked={marcado ? true : parcialmenteMarcado ? "indeterminate" : false}
                      onCheckedChange={(value) => toggleUsuarioValidado(usuario.username, value === true)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">@{usuario.username}</div>
                      <div className="text-xs text-muted-foreground">
                        {usuario.empresas.length} empresa(s) disponível(is)
                      </div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <ScrollArea className="h-[300px] rounded-md border">
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
                    <Checkbox
                      checked={marcada}
                      onCheckedChange={() => toggle(k)}
                      onClick={(ev) => ev.stopPropagation()}
                      className="shrink-0"
                    />
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

        {(conexoes.grupos.length > 0 || conexoes.semLogin.length > 0) && (
          <div className="rounded-md border p-3 space-y-2 max-h-[160px] overflow-y-auto">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
              <Link2 className="h-3.5 w-3.5" /> Conexões SIGA → Orbit
            </div>
            {conexoes.grupos.map((g) => {
              const res = resultados.find((r) => r.username.toLowerCase() === g.login.toLowerCase());
              return (
                <div key={g.login} className="flex items-start gap-2 text-xs">
                  {res ? (
                    res.resolved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                  )}
                  <div className={cn("flex-1", res && !res.resolved && "text-destructive")}>
                    <span className="font-medium">{g.responsavel || g.login}</span>
                    <span className="text-muted-foreground"> → @{g.login}</span>
                    <span className="text-muted-foreground"> · {g.empresas.length} empresa(s)</span>
                    {res && <span className="text-muted-foreground">{res.resolved ? ` · ${res.added ?? 0} criada(s)` : " · não encontrado no Orbit"}</span>}
                  </div>
                </div>
              );
            })}
            {conexoes.semLogin.map((s) => (
              <div key={s.empresa} className="flex items-start gap-2 text-xs text-amber-500">
                <XCircle className="h-3.5 w-3.5 mt-0.5" />
                <div>{s.empresa} — {s.responsavel} sem login no SIGA (não será enviada)</div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={enviar} disabled={conexoes.grupos.length === 0 || enviando} className="gap-1.5">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar {sel.size > 0 ? `(${sel.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
