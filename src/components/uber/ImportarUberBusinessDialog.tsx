import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Upload, Download, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUberPassageiros } from "@/hooks/useUberPassageiros";
import { UBER_MOTIVOS } from "@/lib/uber-passageiros";
import { UBER_FORMAS_PAGAMENTO } from "@/lib/uber-corrida-opcoes";
import { agruparUber, conferirUber, lerUberCsv, pendenciasUber, RESPONSAVEIS_UBER, type LinhaUber, type ViagemUber } from "@/lib/uber-business-csv";
import { backupUber, lerTodasCorridasUber } from "@/lib/uber-business-service";
import { SeletorImportacaoUber } from "./SeletorImportacaoUber";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

type Arquivo = { nome: string; viagens: number };
type Historico = { id: string; usuario_nome: string; created_at: string; arquivos: { nome: string; importadas: number; ignoradas: number }[]; importadas: number; ignoradas: number; desfeita_em: string | null };
type LoteCampo = "empresa" | "motivo" | "tipo" | "forma_pagamento";
const dinheiro = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const opcoes = (values: readonly string[]) => values.map(v => ({ value: v, label: v }));

export function ImportarUberBusinessDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: passageiros = [] } = useUberPassageiros();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<LinhaUber[]>([]);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [linhasLidas, setLinhasLidas] = useState(0);
  const [payments, setPayments] = useState(0);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("conferencia");
  const [pagina, setPagina] = useState(0);
  const [loteId, setLoteId] = useState("");
  const [resultado, setResultado] = useState<{ importadas: number; ignoradas: number } | null>(null);
  const [desfazer, setDesfazer] = useState<Historico | null>(null);
  const [lote, setLote] = useState<Record<LoteCampo, string>>({ empresa: "", motivo: "", tipo: "", forma_pagamento: "" });
  const ciclo = useRef(0);
  const referencias = useQuery({
    queryKey: ["uber-importacao-referencias", user?.id], enabled: open && !!user,
    queryFn: async () => {
      const corridas = await lerTodasCorridasUber();
      const empresas: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("empresas").select("nome").order("id").range(offset, offset + 999);
        if (error) throw error;
        empresas.push(...(data ?? []).map(e => e.nome));
        if (!data || data.length < 1000) break;
      }
      const { data: perfis, error } = await supabase.rpc("uber_responsaveis_importacao");
      if (error) throw error;
      void perfis;
      const responsaveis = [...RESPONSAVEIS_UBER];
      return { corridas, empresas: [...new Set(empresas)].sort(), responsaveis };
    },
  });
  const historico = useQuery({
    queryKey: ["uber-importacoes", user?.id], enabled: open && !!user,
    queryFn: async () => {
      const registros: Historico[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("uber_importacoes").select("*").order("created_at", { ascending: false }).order("id").range(offset, offset + 999);
        if (error) throw error;
        registros.push(...(data ?? []) as unknown as Historico[]);
        if (!data || data.length < 1000) return registros;
      }
    },
  });
  useEffect(() => {
    if (!open) { ciclo.current++; setRows([]); setArquivos([]); setErro(""); setResultado(null); setPagina(0); }
  }, [open]);
  const ativos = passageiros.filter(p => p.ativo);
  const colaboradores = ativos.map(p => ({ value: p.id, label: `${p.nome} — ${p.setor}` }));
  const selecionadas = rows.filter(r => r.selecionada && !r.jaExiste);
  const jaExistem = rows.filter(r => r.jaExiste).length;
  const pendentes = selecionadas.filter(r => pendenciasUber(r).length > 0).length;
  const patchRow = (id: string, patch: Partial<LinhaUber>) => setRows(atual => atual.map(r => r.uber_trip_id === id ? { ...r, ...patch } : r));
  const invalidaCaches = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["uber_corridas"] }), qc.invalidateQueries({ queryKey: ["uber-importacoes"] }), qc.invalidateQueries({ queryKey: ["uber-importacao-referencias"] }), qc.invalidateQueries({ queryKey: ["uber-enderecos-usados"] })]);
  };
  const lerArquivos = async (files: FileList | null) => {
    if (!files?.length) return;
    const versao = ++ciclo.current;
    setBusy(true); setErro(""); setRows([]); setArquivos([]); setResultado(null); setPagina(0);
    try {
      const lista = Array.from(files);
      if (lista.length > 20 || lista.reduce((s, f) => s + f.size, 0) > 20 * 1024 * 1024) throw new Error("Selecione até 20 arquivos, com no máximo 20 MB no total.");
      if (lista.some(f => !f.name.toLowerCase().endsWith(".csv"))) throw new Error("Selecione somente arquivos CSV.");
      if (new Set(lista.map(f => `${f.name}|${f.size}|${f.lastModified}`)).size !== lista.length) throw new Error("O mesmo arquivo foi selecionado mais de uma vez.");
      const todas: ViagemUber[] = []; const metas: Arquivo[] = []; let n = 0; let p = 0;
      // All files must parse successfully before a preview can be confirmed.
      for (const file of lista) {
        const r = lerUberCsv(await file.text(), file.name);
        n += r.linhasLidas; p += r.payments;
        if (n > 10000) throw new Error("Limite de 10.000 linhas por conferência. Divida os arquivos.");
        todas.push(...r.viagens); metas.push({ nome: file.name, viagens: agruparUber(r.viagens).length });
      }
      const ref = await referencias.refetch();
      if (!ref.data || ref.error) throw ref.error ?? new Error("Não foi possível conferir as corridas existentes.");
      if (versao !== ciclo.current) return;
      setRows(conferirUber(agruparUber(todas), ref.data.corridas, ref.data.responsaveis));
      setArquivos(metas); setLinhasLidas(n); setPayments(p); setLoteId(crypto.randomUUID()); setAba("conferencia");
    } catch (e) { if (versao === ciclo.current) setErro(e instanceof Error ? e.message : "Não foi possível ler o CSV."); }
    finally { if (versao === ciclo.current) setBusy(false); if (input.current) input.current.value = ""; }
  };
  const confirmar = async () => {
    if (!selecionadas.length || !loteId || busy) return;
    setBusy(true); setErro("");
    try {
      const atuais = await lerTodasCorridasUber();
      const novasDuplicatas = conferirUber(selecionadas, atuais, referencias.data?.responsaveis ?? []).filter(r => r.possivelDuplicata && !rows.find(x => x.uber_trip_id === r.uber_trip_id)?.possivelDuplicata);
      if (novasDuplicatas.length) {
        const ids = new Set(novasDuplicatas.map(r => r.uber_trip_id));
        setRows(atual => atual.map(r => ids.has(r.uber_trip_id) ? { ...r, possivelDuplicata: true, selecionada: false } : r));
        throw new Error("Novas possíveis duplicatas foram encontradas. Confira as linhas desmarcadas antes de confirmar novamente.");
      }
      const payload = selecionadas.map(r => ({ uber_trip_id: r.uber_trip_id, data: r.data, horario: r.horario, colaborador: r.colaborador, passageiro_id: r.passageiro_id, origem: r.origem, destino: r.destino, motivo: r.envio ? "Envio de Material" : r.motivo, tipo: r.tipo, empresa: r.empresa, forma_pagamento: r.forma_pagamento, responsavel: r.responsavel, setor_solicitante: r.setor_solicitante, valor: r.valor, cancelada: r.cancelada, arquivos: r.arquivos }));
      const { data, error } = await supabase.rpc("uber_confirmar_importacao", { p_lote: loteId, p_arquivos: arquivos as unknown as Json, p_linhas: payload as unknown as Json });
      if (error) throw error;
      const result = data as unknown as { importadas: number; ignoradas: number };
      if (!result) throw new Error("Não foi possível confirmar este lote.");
      setResultado(result); setRows([]); toast.success(`${result.importadas} corridas importadas`); await invalidaCaches();
    } catch (e) { setErro(e instanceof Error ? e.message : (e as { message?: string }).message ?? "Erro ao importar."); }
    finally { setBusy(false); }
  };
  const executarDesfazer = async () => {
    if (!desfazer || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("uber_desfazer_importacao", { p_lote: desfazer.id });
      if (error) throw error;
      toast.success(`${data} corridas do lote removidas`); setDesfazer(null); await invalidaCaches();
    } catch (e) { toast.error((e as { message?: string }).message ?? "Não foi possível desfazer."); }
    finally { setBusy(false); }
  };
  const loteOpcoes: Record<LoteCampo, { value: string; label: string }[]> = { empresa: opcoes(referencias.data?.empresas ?? []), motivo: opcoes(UBER_MOTIVOS), tipo: opcoes(["Ida", "Volta"]), forma_pagamento: opcoes(UBER_FORMAS_PAGAMENTO) };
  const labels: Record<LoteCampo, string> = { empresa: "Empresa", motivo: "Motivo", tipo: "Tipo", forma_pagamento: "Forma de pagamento" };
  return <>
    <Dialog open={open} onOpenChange={v => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-[96vw] w-[1500px] max-h-[92dvh] flex flex-col overflow-hidden" onInteractOutside={e => { if (busy) e.preventDefault(); }}>
        <DialogHeader><DialogTitle>Importar da Uber</DialogTitle><DialogDescription>Uber Business · CSV</DialogDescription></DialogHeader>
        <Tabs value={aba} onValueChange={setAba} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="self-start"><TabsTrigger value="conferencia">Conferência</TabsTrigger><TabsTrigger value="historico">Histórico de importações</TabsTrigger></TabsList>
          <TabsContent value="conferencia" className="min-h-0 overflow-auto flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input ref={input} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={e => void lerArquivos(e.target.files)} aria-label="Arquivos CSV da Uber" />
              <Button variant="outline" disabled={busy || referencias.isLoading || historico.isLoading || historico.isError} onClick={() => input.current?.click()}><Upload className="mr-2 h-4 w-4" />Selecionar CSVs</Button>
              <Button variant="outline" disabled={busy} onClick={() => { setBusy(true); void backupUber().catch(e => toast.error(e.message)).finally(() => setBusy(false)); }}><Download className="mr-2 h-4 w-4" />Exportar backup completo</Button>
              {historico.data?.length === 0 && <span className="text-sm text-muted-foreground">Primeira importação: deseja salvar um backup das corridas atuais?</span>}
              {busy && <span role="status">Processando…</span>}
            </div>
            {(erro || referencias.isError || historico.isError) && <p role="alert" className="text-destructive">{erro || "Não foi possível carregar os dados para conferência. Feche e tente novamente."}</p>}
            {resultado && <p role="status" className="font-medium">{resultado.importadas} importadas · {resultado.ignoradas} IDs já existentes ignorados. Consulte o histórico para ver as demais linhas ignoradas.</p>}
            {rows.length > 0 && <>
              <div className="flex flex-wrap gap-x-6 gap-y-2 border-y py-3 text-sm" role="status">
                <span><strong>{linhasLidas}</strong> linhas lidas</span><span><strong>{rows.length}</strong> viagens</span><span><strong>{jaExistem}</strong> já existem</span><span><strong>{rows.length - jaExistem}</strong> novas</span>
                <span><strong>{rows.filter(r => r.envio).length}</strong> envios</span><span className="font-semibold">{dinheiro(rows.reduce((s, r) => s + Math.round(r.valor * 100), 0) / 100)}</span>
                {payments > 0 && <span>{payments} linhas Payment ignoradas</span>}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Checkbox id="incluir-envios-uber" checked={rows.filter(r => r.envio && !r.jaExiste).length > 0 && rows.filter(r => r.envio && !r.jaExiste).every(r => r.selecionada)} onCheckedChange={v => setRows(atual => atual.map(r => r.envio && !r.jaExiste ? { ...r, selecionada: v === true && !r.possivelDuplicata, motivo: "Envio de Material" } : r))} />
                <label htmlFor="incluir-envios-uber" className="text-sm">Incluir envios · Envio de Material</label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
                {(Object.keys(labels) as LoteCampo[]).map(k => <SeletorImportacaoUber key={k} label={labels[k]} value={lote[k]} opcoes={loteOpcoes[k]} onChange={v => setLote(prev => ({ ...prev, [k]: v }))} />)}
                <Button variant="secondary" disabled={!selecionadas.length || !Object.values(lote).some(Boolean)} onClick={() => setRows(atual => atual.map(r => r.selecionada && !r.jaExiste ? { ...r, ...Object.fromEntries(Object.entries(lote).filter(([, v]) => !!v)), motivo: r.envio ? "Envio de Material" : lote.motivo || r.motivo } : r))}>Aplicar às selecionadas</Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead><Checkbox aria-label="Selecionar todas as novas corridas" checked={rows.some(r => r.selecionada) && rows.filter(r => !r.jaExiste && !r.possivelDuplicata && !r.envio).every(r => r.selecionada)} onCheckedChange={v => setRows(atual => atual.map(r => ({ ...r, selecionada: v === true && !r.jaExiste && !r.possivelDuplicata && !r.envio })))} /></TableHead>
                  {["Data", "Horário", "Responsável", "Origem", "Destino", "Valor", "Colaborador *", "Motivo", "Tipo", "Empresa", "Pagamento", "Situação"].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{rows.slice(pagina * 25, (pagina + 1) * 25).map(r => <TableRow key={r.uber_trip_id} className={r.jaExiste ? "opacity-60" : ""}>
                  <TableCell><Checkbox aria-label={`Importar viagem ${r.uber_trip_id}`} disabled={r.jaExiste} checked={r.selecionada} onCheckedChange={v => patchRow(r.uber_trip_id, { selecionada: v === true })} /></TableCell>
                  <TableCell><Input type="date" className="min-w-36" aria-label={`Data ${r.uber_trip_id}`} value={r.data} disabled={r.jaExiste} onChange={e => patchRow(r.uber_trip_id, { data: e.target.value })} /></TableCell>
                  <TableCell><Input type="time" className="min-w-28" aria-label={`Horário ${r.uber_trip_id}`} value={r.horario} disabled={r.jaExiste} onChange={e => patchRow(r.uber_trip_id, { horario: e.target.value })} /></TableCell>
                  <TableCell><SeletorImportacaoUber label="Responsável" obrigatorio value={r.responsavel} disabled={r.jaExiste} opcoes={opcoes(referencias.data?.responsaveis ?? [])} onChange={v => patchRow(r.uber_trip_id, { responsavel: v })} /></TableCell>
                  <TableCell><Input className="min-w-56" aria-label={`Origem ${r.uber_trip_id}`} value={r.origem} disabled={r.jaExiste} onChange={e => patchRow(r.uber_trip_id, { origem: e.target.value })} /></TableCell>
                  <TableCell><Input className="min-w-56" aria-label={`Destino ${r.uber_trip_id}`} value={r.destino} disabled={r.jaExiste} onChange={e => patchRow(r.uber_trip_id, { destino: e.target.value })} /></TableCell>
                  <TableCell><Input className="min-w-28" type="number" step="0.01" aria-label={`Valor ${r.uber_trip_id}`} value={r.valor} disabled={r.jaExiste} onChange={e => patchRow(r.uber_trip_id, { valor: Number(e.target.value) })} /></TableCell>
                  <TableCell><SeletorImportacaoUber label="Colaborador" value={r.passageiro_id ?? ""} obrigatorio disabled={r.jaExiste} opcoes={colaboradores} onChange={id => { const p = ativos.find(x => x.id === id); patchRow(r.uber_trip_id, { passageiro_id: p?.id ?? null, colaborador: p?.nome ?? "" }); }} /></TableCell>
                  <TableCell><SeletorImportacaoUber label="Motivo" value={r.motivo} disabled={r.jaExiste || r.envio} opcoes={opcoes(UBER_MOTIVOS)} onChange={v => patchRow(r.uber_trip_id, { motivo: v })} /></TableCell>
                  <TableCell><SeletorImportacaoUber label="Tipo" value={r.tipo} disabled={r.jaExiste} opcoes={loteOpcoes.tipo} onChange={v => patchRow(r.uber_trip_id, { tipo: v })} /></TableCell>
                  <TableCell><SeletorImportacaoUber label="Empresa" value={r.empresa} disabled={r.jaExiste} opcoes={loteOpcoes.empresa} onChange={v => patchRow(r.uber_trip_id, { empresa: v })} /></TableCell>
                  <TableCell><SeletorImportacaoUber label="Forma de pagamento" value={r.forma_pagamento} disabled={r.jaExiste} opcoes={loteOpcoes.forma_pagamento} onChange={v => patchRow(r.uber_trip_id, { forma_pagamento: v })} /></TableCell>
                  <TableCell className="space-y-1 min-w-40">{r.envio && <Badge variant="secondary">Envio</Badge>}{r.cancelada && <Badge variant="destructive">Cancelada</Badge>}
                    {r.jaExiste ? <Badge variant="secondary">Já importada</Badge> : <>{r.possivelDuplicata && <Badge variant="outline">Possível duplicata</Badge>}{pendenciasUber(r).length > 0 && <Badge variant="outline">Pendente · Colaborador</Badge>}</>}
                  </TableCell>
                </TableRow>)}</TableBody>
              </Table>
              <div className="flex justify-between items-center gap-2 text-sm"><span>{pagina * 25 + 1}–{Math.min((pagina + 1) * 25, rows.length)} de {rows.length}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={(pagina + 1) * 25 >= rows.length} onClick={() => setPagina(p => p + 1)}>Próxima</Button></div></div>
            </>}
          </TabsContent>
          <TabsContent value="historico" className="min-h-0 flex-1 overflow-auto">
            {historico.isLoading ? <p>Carregando…</p> : historico.isError ? <p role="alert" className="text-destructive">Não foi possível carregar o histórico.</p> : !historico.data?.length ? <p className="py-8 text-muted-foreground">Nenhuma importação registrada.</p> : <Table>
              <TableHeader><TableRow>{["Data", "Usuário", "Arquivos", "Importadas", "Ignoradas", "Situação", ""].map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{historico.data.map(h => <TableRow key={h.id}><TableCell>{new Date(h.created_at).toLocaleString("pt-BR")}</TableCell><TableCell>{h.usuario_nome}</TableCell>
                <TableCell>{h.arquivos.map((a, i) => <p key={i}>{a.nome} · {a.importadas} importadas / {a.ignoradas} ignoradas</p>)}</TableCell>
                <TableCell>{h.importadas}</TableCell><TableCell>{h.ignoradas}</TableCell><TableCell>{h.desfeita_em ? "Desfeita" : "Concluída"}</TableCell>
                <TableCell><Button variant="outline" size="sm" disabled={busy || !!h.desfeita_em} onClick={() => setDesfazer(h)}><Undo2 className="mr-2 h-4 w-4" />Desfazer importação</Button></TableCell>
              </TableRow>)}</TableBody>
            </Table>}
          </TabsContent>
        </Tabs>
        <DialogFooter className="border-t pt-3 flex-wrap gap-2">
          {aba === "conferencia" && rows.length > 0 && <span className="mr-auto text-sm self-center">{selecionadas.length} selecionadas · {pendentes} pendentes</span>}
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Fechar</Button>
          {aba === "conferencia" && <Button disabled={busy || !selecionadas.length || selecionadas.some(r => !r.data || !r.horario || !Number.isFinite(r.valor))} onClick={() => void confirmar()}>Confirmar importação ({selecionadas.length})</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!desfazer} onOpenChange={v => { if (!v && !busy) setDesfazer(null); }}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Desfazer esta importação?</AlertDialogTitle><AlertDialogDescription>Serão removidas somente as corridas deste lote, inclusive as editadas após a importação. As demais corridas permanecerão intactas.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e => { e.preventDefault(); void executarDesfazer(); }}>Desfazer importação</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </>;
}