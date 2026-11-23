import { useEffect, useMemo, useState } from "react";
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
import { periodoDaDataCorte } from "@/lib/movimentacao-utils";
import { useQueryClient } from "@tanstack/react-query";
import { agruparPorAdministradora, resumirVidasRelatorio, type ResumoVidasContrato } from "@/lib/administradora-fechamento";

type Emp = { id: string; nome: string; codigo_contrato: string | null; data_corte?: number | string | null };
type Linha = { empresaId: string; dataCorte?: number | string | null; arquivo?: { nome: string; blob: Blob }; codigo: string; nome: string; resumo?: ResumoVidasContrato; erro?: string };
const CHAVE_EMAILS = "siga-fechamento-adm-emails";
const lista = (s: string) => s.split(/[;,\s]+/).map((x) => x.trim()).filter(Boolean);

export function EnviarFechamentoFinanceiroDialog({ open, onOpenChange, empresas, mesRef, fechamentoInicial }: { open: boolean; onOpenChange: (o: boolean) => void; empresas: Emp[]; mesRef: string; fechamentoInicial?: string | number | null }) {
  const [fechamento, setFechamento] = useState<string>("");
  const fechamentos = useMemo(() => [...new Set(empresas.filter((e) => e.codigo_contrato && e.data_corte).map((e) => Number(e.data_corte)))].sort((a, b) => a - b), [empresas]);
  // Ao abrir, já vem marcado o fechamento que está filtrado na lista de contratos.
  useEffect(() => {
    if (!open) return;
    const alvo = fechamentoInicial == null ? "" : String(fechamentoInicial);
    setFechamento(alvo && fechamentos.includes(Number(alvo)) ? alvo : "");
    setGrupo("");
    setLinhas([]);
  }, [open, fechamentoInicial, fechamentos]);
  const grupos = useMemo(() => agruparPorAdministradora(empresas.filter((e) => e.codigo_contrato && fechamento && Number(e.data_corte) === Number(fechamento))), [empresas, fechamento]);
  const salvos = (() => { try { return JSON.parse(localStorage.getItem(CHAVE_EMAILS) ?? "{}"); } catch { return {}; } })();
  const [grupo, setGrupo] = useState<string>("");
  const [vigencia, setVigencia] = useState("");
  const [para, setPara] = useState<string>(salvos.para ?? "");
  const [cc, setCc] = useState<string>(salvos.cc ?? "");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const qc = useQueryClient();
  // Depois do envio: anexa o Excel atualizado na movimentação do mês de cada contrato e marca "Enviado Financ." com hoje.
  const registrarNosContratos = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const d = new Date();
    const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const falhas: string[] = [];
    const anexoIds: string[] = [];
    for (const l of linhas) {
      try {
        const { data: movs } = await supabase.from("movimentacoes").select("id").eq("empresa_id", l.empresaId).eq("mes_referencia", mesRef).limit(1);
        let movId = movs?.[0]?.id as string | undefined;
        if (!movId) {
          const { data, error } = await supabase.from("movimentacoes").upsert({ empresa_id: l.empresaId, mes_referencia: mesRef, periodo: l.dataCorte ? periodoDaDataCorte(Number(l.dataCorte)) : "01-05", data_envio_financeiro: hoje }, { onConflict: "empresa_id,mes_referencia,periodo" }).select("id").single();
          if (error) throw error;
          movId = data.id;
        } else {
          const { error } = await supabase.from("movimentacoes").update({ data_envio_financeiro: hoje }).eq("id", movId);
          if (error) throw error;
        }
        if (l.arquivo) {
          const path = `${l.empresaId}/${movId}/${crypto.randomUUID()}.xlsx`;
          const { error: upErr } = await supabase.storage.from("anexos-movimentacoes").upload(path, l.arquivo.blob);
          if (upErr) throw upErr;
          const { data: anexo, error: insErr } = await supabase.from("anexos_movimentacao").insert({ movimentacao_id: movId!, empresa_id: l.empresaId, nome_arquivo: l.arquivo.nome, storage_path: path, mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", tamanho_bytes: l.arquivo.blob.size, uploaded_by: user?.id ?? null }).select("id").single();
          if (insErr) throw insErr;
          if (anexo?.id) anexoIds.push(anexo.id);
        }
      } catch (e: any) { falhas.push(`${l.codigo}: ${e?.message ?? e}`); }
    }
    // Guarda também no Repositório de Envios (Utilitários), como nos envios às empresas.
    if (anexoIds.length) {
      const { data: arq, error: arqErr } = await supabase.functions.invoke("arquivar-envio-administradora", { body: { anexo_ids: anexoIds } });
      if (arqErr || (arq as any)?.error || (arq as any)?.arquivados < anexoIds.length) falhas.push("Repositório de Envios: nem todos os relatórios foram guardados");
    }
    qc.invalidateQueries();
    if (falhas.length) toast.error("E-mail enviado, mas não foi possível registrar em: " + falhas.join("; "));
  };
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
        const base = { empresaId: e.id, dataCorte: e.data_corte, codigo: e.codigo_contrato!, nome: e.nome };
        out.push(resumo ? { ...base, resumo, arquivo: { nome: r.nome_arquivo, blob: r.blob } } : { ...base, erro: "Relatório sem lista de beneficiários" });
      } catch (err: any) { out.push({ empresaId: e.id, codigo: e.codigo_contrato!, nome: e.nome, erro: err?.message ?? String(err) }); }
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
      await registrarNosContratos();
      toast.success("Fechamento enviado ao Financeiro. Relatórios anexados e data de envio preenchida.");
      onOpenChange(false);
    } catch (e: any) { toast.error("Não foi possível enviar: " + (e?.message ?? String(e))); }
    finally { setEnviando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Enviar fechamento ao Financeiro</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Fechamento</Label>
            <Select value={fechamento} onValueChange={(v) => { setFechamento(v); setGrupo(""); setLinhas([]); }}>
              <SelectTrigger><SelectValue placeholder="Escolha o fechamento" /></SelectTrigger>
              <SelectContent>{fechamentos.map((d) => <SelectItem key={d} value={String(d)}>Fechamento dia {String(d).padStart(2, "0")} ({empresas.filter((e) => Number(e.data_corte) === d && e.codigo_contrato).map((e) => e.codigo_contrato).join(", ")})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Administradora</Label>
            <Select value={grupo} onValueChange={escolher} disabled={!fechamento}>
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
