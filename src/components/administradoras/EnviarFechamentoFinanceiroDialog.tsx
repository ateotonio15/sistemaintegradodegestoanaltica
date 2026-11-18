import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { gerarRelatorioPortal } from "@/services/portalEmpresaRelatorios";
import { agruparPorAdministradora, resumirVidasRelatorio, type ResumoVidasContrato } from "@/lib/administradora-fechamento";

type Emp = { id: string; nome: string; codigo_contrato: string | null; data_corte?: number | string | null };
type Linha = { codigo: string; nome: string; resumo?: ResumoVidasContrato; erro?: string };
const CHAVE_EMAILS = "siga-fechamento-adm-emails";
const lista = (s: string) => s.split(/[;,\s]+/).map((x) => x.trim()).filter(Boolean);

export function EnviarFechamentoFinanceiroDialog({ open, onOpenChange, empresas, mesRef }: { open: boolean; onOpenChange: (o: boolean) => void; empresas: Emp[]; mesRef: string }) {
  const grupos = useMemo(() => agruparPorAdministradora(empresas.filter((e) => e.codigo_contrato)), [empresas]);
  const salvos = (() => { try { return JSON.parse(localStorage.getItem(CHAVE_EMAILS) ?? "{}"); } catch { return {}; } })();
  const [grupo, setGrupo] = useState<string>("");
  const [vigencia, setVigencia] = useState("");
  const [para, setPara] = useState<string>(salvos.para ?? "");
  const [cc, setCc] = useState<string>(salvos.cc ?? "");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const g = grupos.find((x) => x.nome === grupo);

  const escolher = (nome: string) => {
    setGrupo(nome); setLinhas([]);
    const e = grupos.find((x) => x.nome === nome)?.itens[0];
    const [y, m] = mesRef.split("-");
    setVigencia(`${String(e?.data_corte ?? 1).padStart(2, "0")}/${m}/${y}`);
  };

  const gerar = async () => {
    if (!g) return;
    setCarregando(true);
    const out: Linha[] = [];
    for (const e of g.itens) {
      try {
        const r = await gerarRelatorioPortal(e.codigo_contrato!, "xlsx", new AbortController().signal);
        const resumo = resumirVidasRelatorio(await r.blob.arrayBuffer());
        out.push(resumo ? { codigo: e.codigo_contrato!, nome: e.nome, resumo } : { codigo: e.codigo_contrato!, nome: e.nome, erro: "Relatório sem lista de beneficiários" });
      } catch (err: any) { out.push({ codigo: e.codigo_contrato!, nome: e.nome, erro: err?.message ?? String(err) }); }
      setLinhas([...out]);
    }
    setCarregando(false);
  };

  const enviar = async () => {
    const p = lista(para), c = lista(cc);
    if (!p.length) return toast.error("Informe o e-mail do Financeiro.");
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(vigencia)) return toast.error("Vigência no formato DD/MM/AAAA.");
    if (!linhas.length || linhas.some((l) => !l.resumo)) return toast.error("Gere o quadro de todos os contratos antes de enviar.");
    setEnviando(true);
    try {
      localStorage.setItem(CHAVE_EMAILS, JSON.stringify({ para, cc }));
      const { data, error } = await supabase.functions.invoke("enviar-fechamento-administradora", { body: {
        administradora: g!.nome, vigencia, para: p, cc: c,
        contratos: linhas.map((l) => ({ codigo: l.codigo, nome: l.nome, ...l.resumo! })),
      } });
      if (error) throw new Error(error instanceof FunctionsHttpError ? (await error.context.json().catch(() => ({})))?.error ?? error.message : error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Fechamento enviado ao Financeiro.");
      onOpenChange(false);
    } catch (e: any) { toast.error("Não foi possível enviar: " + (e?.message ?? String(e))); }
    finally { setEnviando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Enviar fechamento ao Financeiro</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Administradora</Label>
            <Select value={grupo} onValueChange={escolher}>
              <SelectTrigger><SelectValue placeholder="Escolha a Administradora" /></SelectTrigger>
              <SelectContent>{grupos.map((x) => <SelectItem key={x.nome} value={x.nome}>{x.nome} ({x.itens.map((i) => i.codigo_contrato).join(", ")})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Vigência</Label><Input value={vigencia} onChange={(e) => setVigencia(e.target.value)} placeholder="DD/MM/AAAA" /></div>
          <div className="flex items-end"><Button variant="outline" disabled={!g || carregando} onClick={gerar} className="w-full"><RefreshCw className={`mr-2 h-4 w-4 ${carregando ? "animate-spin" : ""}`} />{carregando ? "Buscando relatórios..." : "Gerar quadro"}</Button></div>
          <div><Label>Para (Financeiro)</Label><Input value={para} onChange={(e) => setPara(e.target.value)} placeholder="email@samel.com.br; outro@..." /></div>
          <div><Label>Cópia (opcional)</Label><Input value={cc} onChange={(e) => setCc(e.target.value)} /></div>
        </div>
        {linhas.length > 0 && (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {linhas.map((l) => (
              <div key={l.codigo} className="rounded-lg border-2 border-foreground/70 p-3 text-sm">
                <p className="font-bold">{l.codigo} {l.nome}</p>
                {l.erro ? <p className="text-destructive text-xs mt-1">{l.erro}</p> : (
                  <>
                    <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-4">
                      <span>Total de Dependentes:</span><span className="tabular-nums">{l.resumo!.dependentes}</span>
                      <span>Total de Beneficiário Titular:</span><span className="tabular-nums">{l.resumo!.titulares}</span>
                      <span className="font-semibold">Total:</span><span className="tabular-nums font-semibold">{l.resumo!.total}</span>
                    </div>
                    {l.resumo!.modulos.length > 0 && <div className="mt-2"><p className="text-xs text-muted-foreground">Módulos:</p>
                      {l.resumo!.modulos.map((m) => <div key={m.nome} className="flex justify-between italic font-semibold"><span>{m.nome}</span><span className="tabular-nums not-italic font-normal">{m.qtd}</span></div>)}</div>}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end border-t pt-3">
          <Button onClick={enviar} disabled={enviando || carregando || !linhas.length}><Send className="mr-2 h-4 w-4" />{enviando ? "Enviando..." : "Enviar ao Financeiro"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
