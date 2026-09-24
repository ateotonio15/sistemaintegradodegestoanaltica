import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatCentavosBRL } from "@/lib/reajuste-utils";
import {
  fetchReajustesOperadora, calcularFaixas, modalidadePlano, parseDataReajuste,
  type ReajusteContratoApi, type FaixaCalc,
} from "@/lib/reajustesOperadoraApi";

type Situacao = "novo" | "registrado" | "nao_encontrado";
interface Linha {
  api: ReajusteContratoApi;
  empresa?: { id: string; nome: string };
  ano: number; mes: number; data: string;
  enf: FaixaCalc[]; apt: FaixaCalc[];
  situacao: Situacao;
}

export function ImportarReajustesOperadoraDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true); setErro(null);
      try {
        // O servidor limita cada consulta a 1000 linhas: buscar em páginas até trazer tudo.
        const fetchAll = async (table: string, cols: string) => {
          const all: any[] = [];
          for (let from = 0; ; from += 1000) {
            const { data, error } = await (supabase.from(table as any) as any).select(cols).range(from, from + 999);
            if (error) throw error;
            all.push(...(data ?? []));
            if (!data || data.length < 1000) break;
          }
          return all;
        };
        const [api, empData, reaData] = await Promise.all([
          fetchReajustesOperadora(),
          fetchAll("empresas", "id,nome,codigo_contrato"),
          fetchAll("reajustes_anuais", "empresa_id,ano"),
        ]);
        const empRes = { data: empData }; const reaRes = { data: reaData };
        const porContrato = new Map<string, { id: string; nome: string }>();
        (empRes.data ?? []).forEach((e: any) => {
          const c = String(e.codigo_contrato ?? "").trim().replace(/^0+/, "");
          if (c) porContrato.set(c, { id: e.id, nome: e.nome });
        });
        const existentes = new Set((reaRes.data ?? []).map((r: any) => `${r.empresa_id}|${r.ano}`));
        const out: Linha[] = [];
        for (const a of api) {
          const d = parseDataReajuste(a.DT_REAJUSTE);
          if (!d) continue;
          const emp = porContrato.get(String(a.NR_CONTRATO).replace(/^0+/, ""));
          const enf: FaixaCalc[] = []; const apt: FaixaCalc[] = [];
          for (const p of a.PLANOS ?? []) {
            const m = modalidadePlano(p.NM_FANTASIA);
            if (m === "enfermaria") enf.push(...calcularFaixas(p, a.TX_REAJUSTE));
            else if (m === "apartamento") apt.push(...calcularFaixas(p, a.TX_REAJUSTE));
          }
          out.push({
            api: a, empresa: emp, ...d, enf, apt,
            situacao: !emp ? "nao_encontrado" : existentes.has(`${emp.id}|${d.ano}`) ? "registrado" : "novo",
          });
        }
        out.sort((x, y) => x.situacao.localeCompare(y.situacao) || x.data.localeCompare(y.data));
        setLinhas(out);
      } catch (e: any) {
        setErro(e?.message || "Erro ao consultar API");
      } finally { setLoading(false); }
    })();
  }, [open]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return linhas;
    return linhas.filter((l) => l.api.NM_CONTRATO.toLowerCase().includes(q) || String(l.api.NR_CONTRATO).includes(q));
  }, [linhas, busca]);
  const novos = linhas.filter((l) => l.situacao === "novo");

  const importar = async () => {
    setSaving(true);
    let ok = 0; const falhas: string[] = [];
    const { data: prof } = await supabase.from("profiles").select("display_name").eq("user_id", user?.id ?? "").maybeSingle();
    const nomeUsuario = (prof as any)?.display_name ?? user?.email ?? null;
    for (const l of novos) {
      try {
        const soma = (fs: FaixaCalc[], k: "antigo" | "reajustado") => (fs.length === 1 ? fs[0][k] : 0);
        const enfUnico = l.enf.length === 1; const aptUnico = l.apt.length === 1;
        const reajEnf = soma(l.enf, "reajustado"), reajApt = soma(l.apt, "reajustado");
        const { data: ins, error } = await supabase.from("reajustes_anuais").insert({
          empresa_id: l.empresa!.id,
          ano: l.ano,
          mes_reajuste: l.mes,
          data_aplicacao: l.data,
          competencia: `${String(l.mes).padStart(2, "0")}/${l.ano}`,
          percentual: l.api.TX_REAJUSTE,
          status: "reajustado",
          status_reajuste: "reajustado",
          possui_enfermaria: l.enf.length > 0,
          possui_apartamento: l.apt.length > 0,
          usa_faixa_etaria_enfermaria: l.enf.length > 1,
          usa_faixa_etaria_apartamento: l.apt.length > 1,
          percentual_unico_enfermaria: true,
          percentual_unico_apartamento: true,
          valor_antigo_enfermaria_centavos: enfUnico ? l.enf[0].antigo : null,
          valor_reajustado_enfermaria_centavos: enfUnico ? reajEnf : null,
          valor_final_enfermaria_centavos: reajEnf,
          valor_antigo_apartamento_centavos: aptUnico ? l.apt[0].antigo : null,
          valor_reajustado_apartamento_centavos: aptUnico ? reajApt : null,
          valor_final_apartamento_centavos: reajApt,
          meses_retroativos: 0,
          observacao: `Importado da API operadora (contrato ${l.api.NR_CONTRATO}, seq ${l.api.NR_SEQ_CONTRATO})`,
          usuario_id: user?.id ?? null,
          usuario_nome: nomeUsuario,
        } as any).select("id").single();
        if (error) throw error;
        const faixas = [
          ...(l.enf.length > 1 ? l.enf.map((f) => ({ ...f, modalidade: "enfermaria" })) : []),
          ...(l.apt.length > 1 ? l.apt.map((f) => ({ ...f, modalidade: "apartamento" })) : []),
        ].map((f) => ({
          reajuste_id: ins.id, modalidade: f.modalidade, idade_inicial: f.idade_inicial, idade_final: f.idade_final,
          percentual: l.api.TX_REAJUSTE, valor_atual_centavos: f.antigo, valor_reajustado_centavos: f.reajustado,
          valor_retroativo_centavos: 0, valor_final_centavos: f.reajustado,
        }));
        if (faixas.length) {
          const { error: fe } = await supabase.from("reajuste_faixas").insert(faixas as any);
          if (fe) throw fe;
        }
        await supabase.from("reajustes_historico").insert({
          reajuste_id: ins.id, empresa_id: l.empresa!.id, evento: "importado_api_operadora",
          observacao: `Reajuste ${l.api.TX_REAJUSTE}% em ${l.data.split("-").reverse().join("/")} importado da API da operadora`,
          dados: l.api as any, usuario_id: user?.id ?? null, usuario_nome: nomeUsuario,
        } as any);
        ok++;
      } catch (e: any) {
        falhas.push(`${l.api.NR_CONTRATO}: ${e?.message ?? e}`);
      }
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ["reajustes-anuais"] });
    toast({
      title: `${ok} reajuste(s) importado(s)`,
      description: falhas.length ? `${falhas.length} falha(s): ${falhas.slice(0, 3).join("; ")}` : undefined,
      variant: falhas.length ? "destructive" : undefined,
    });
    if (!falhas.length) onOpenChange(false);
  };

  const badge = (s: Situacao) =>
    s === "novo" ? <Badge className="bg-primary/15 text-primary border-primary/30">Novo</Badge>
    : s === "registrado" ? <Badge variant="secondary">Já registrado</Badge>
    : <Badge variant="destructive">Contrato não encontrado</Badge>;

  const faixasTxt = (fs: FaixaCalc[]) => fs.length === 0 ? "—" : fs.map((f) =>
    `${f.idade_final >= 999 && f.idade_inicial === 0 ? "" : `${f.idade_inicial}-${f.idade_final >= 999 ? "+" : f.idade_final}: `}${formatCentavosBRL(f.antigo)} → ${formatCentavosBRL(f.reajustado)}`).join(" | ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sincronizar reajustes da operadora</DialogTitle>
          <DialogDescription>
            Reajustes do ano atual e seguintes. Valores da API tratados como já reajustados; o valor anterior é calculado pelo percentual.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Consultando API...</div>
        ) : erro ? (
          <p className="text-destructive py-6">{erro}</p>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <Input placeholder="Buscar contrato ou empresa" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
              <span>Novos: <b>{novos.length}</b></span>
              <span>Já registrados: <b>{linhas.filter((l) => l.situacao === "registrado").length}</b></span>
              <span>Não encontrados: <b>{linhas.filter((l) => l.situacao === "nao_encontrado").length}</b></span>
            </div>
            <div className="flex-1 overflow-auto space-y-2 pr-1">
              {filtradas.map((l) => (
                <div key={`${l.api.NR_SEQ_CONTRATO}-${l.data}`} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-medium">{l.api.NR_CONTRATO} — {l.empresa?.nome ?? l.api.NM_CONTRATO}</div>
                    <div className="flex items-center gap-2">
                      <span className={l.api.TX_REAJUSTE < 0 ? "text-destructive" : "text-primary"}>{l.api.TX_REAJUSTE.toFixed(2)}%</span>
                      <span className="text-muted-foreground">{l.data.split("-").reverse().join("/")}</span>
                      {badge(l.situacao)}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground"><b>Enfermaria:</b> {faixasTxt(l.enf)}</div>
                  <div className="text-xs text-muted-foreground"><b>Apartamento:</b> {faixasTxt(l.apt)}</div>
                </div>
              ))}
              {!filtradas.length && <p className="text-muted-foreground py-6 text-center">Nenhum reajuste encontrado.</p>}
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button disabled={loading || saving || !novos.length} onClick={importar}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Importar {novos.length} novo(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
