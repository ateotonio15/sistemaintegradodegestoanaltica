import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFeriadosGestao, type Feriado, type FeriadoTipo } from "@/hooks/useFeriados";
import { useSalvarUberAlertasConfig } from "@/hooks/useUberAlertasConfig";
import { ALERTAS_PADRAO, ALERTA_INFO, type AlertasConfig } from "@/lib/uber-alertas";

const ABRANG: FeriadoTipo[] = ["Nacional", "Estadual", "Municipal", "Facultativo"];
const br = (s: string) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };

export function ConfigAlertasDialog({ open, onOpenChange, config }: { open: boolean; onOpenChange: (o: boolean) => void; config: AlertasConfig }) {
  const { isAdmin } = useAuth();
  const [cfg, setCfg] = useState<AlertasConfig>(config);
  useEffect(() => { if (open) setCfg(config); }, [open, config]);
  const salvar = useSalvarUberAlertasConfig();
  const set = <K extends keyof AlertasConfig>(k: K, v: AlertasConfig[K]) => setCfg((p) => ({ ...p, [k]: v }));
  const num = (k: keyof AlertasConfig) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value.replace(",", ".")) as any);

  const onSave = async () => {
    try { await salvar.mutateAsync(cfg); toast.success("Configuração dos alertas salva"); onOpenChange(false); }
    catch (e: any) { toast.error("Não foi possível salvar: " + (e?.message ?? "")); }
  };

  const L = (k: keyof AlertasConfig, children?: React.ReactNode) => (
    <Linha label={ALERTA_INFO[TIPO_DE[k]].label} checked={cfg[k] as boolean} disabled={!isAdmin} onChange={(v) => set(k, v as any)}>{children}</Linha>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Configurar alertas</DialogTitle></DialogHeader>
        {!isAdmin && <div className="text-xs text-muted-foreground">Somente administradores podem alterar. Você está vendo a configuração atual.</div>}
        <Tabs defaultValue="limites">
          <TabsList><TabsTrigger value="limites">Limites</TabsTrigger><TabsTrigger value="feriados">Feriados</TabsTrigger></TabsList>
          <TabsContent value="limites" className="space-y-3">
            <fieldset disabled={!isAdmin} className="space-y-3">
              {L("custo_ativo", <><Campo label="Valor igual ou maior que (R$)"><Input type="number" step="0.01" value={cfg.custo_limite} onChange={num("custo_limite")} /></Campo></>)}
              {L("rota_preco_ativo", <>
                <Campo label="Acima da média da rota (%)"><Input type="number" value={cfg.rota_preco_pct} onChange={num("rota_preco_pct")} /></Campo>
                <Campo label="Mínimo de outras corridas na rota"><Input type="number" value={cfg.rota_preco_min} onChange={num("rota_preco_min")} /></Campo>
              </>)}
              {L("noturno_ativo", <>
                <Campo label="Início"><Input type="time" value={cfg.noturno_inicio} onChange={(e) => set("noturno_inicio", e.target.value)} /></Campo>
                <Campo label="Fim (não incluso)"><Input type="time" value={cfg.noturno_fim} onChange={(e) => set("noturno_fim", e.target.value)} /></Campo>
              </>)}
              {L("fds_ativo")}
              {L("repetida_ativo", <><Campo label="Mínimo de repetições no período"><Input type="number" value={cfg.repetida_min} onChange={num("repetida_min")} /></Campo></>)}
            </fieldset>
            <DialogFooter className="gap-2">
              <Button variant="outline" disabled={!isAdmin} onClick={() => setCfg(ALERTAS_PADRAO)}>Restaurar padrões</Button>
              <Button disabled={!isAdmin || salvar.isPending} onClick={onSave}>Salvar</Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="feriados"><Feriados podeEditar={isAdmin} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Feriados({ podeEditar }: { podeEditar: boolean }) {
  const qc = useQueryClient();
  const { data = [] } = useFeriadosGestao();
  const anos = useMemo(() => [...new Set(data.map((f) => f.ano))].sort(), [data]);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [edit, setEdit] = useState<Partial<Feriado> | null>(null);
  const lista = data.filter((f) => f.ano === ano);
  const refresh = () => qc.invalidateQueries({ queryKey: ["feriados"] });

  const toggle = async (f: Feriado, v: boolean) => {
    const { error } = await supabase.from("feriados").update({ ativo: v } as any).eq("id", f.id);
    if (error) toast.error(error.message); else refresh();
  };
  const salvar = async () => {
    if (!edit?.data || !edit.nome?.trim()) { toast.error("Informe data e nome"); return; }
    const ab = (edit.abrangencia ?? "Nacional") as FeriadoTipo;
    const row: any = { data: edit.data, nome: edit.nome.trim(), ano: Number(edit.data.slice(0, 4)), tipo: ab, abrangencia: ab, ativo: edit.ativo ?? true };
    const { error } = edit.id ? await supabase.from("feriados").update(row).eq("id", edit.id) : await supabase.from("feriados").insert(row);
    if (error) toast.error(error.message); else { toast.success("Feriado salvo"); setEdit(null); refresh(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{(anos.length ? anos : [ano]).map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
        </Select>
        {podeEditar && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEdit({ abrangencia: "Nacional", ativo: true, data: `${ano}-01-01` })}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>}
      </div>
      {edit && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end rounded-xl border border-border/60 p-3">
          <Input type="date" value={edit.data ?? ""} onChange={(e) => setEdit({ ...edit, data: e.target.value })} />
          <Input className="md:col-span-2" placeholder="Nome" value={edit.nome ?? ""} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
          <Select value={(edit.abrangencia as string) ?? "Nacional"} onValueChange={(v) => setEdit({ ...edit, abrangencia: v as FeriadoTipo })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ABRANG.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-1"><Button size="sm" onClick={salvar}>Salvar</Button><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button></div>
        </div>
      )}
      <Table>
        <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Nome</TableHead><TableHead>Abrangência</TableHead><TableHead>Ativo</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {lista.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum feriado cadastrado neste ano</TableCell></TableRow>}
          {lista.map((f) => (
            <TableRow key={f.id} className={f.ativo === false ? "opacity-60" : ""}>
              <TableCell className="tabular-nums">{br(f.data)}</TableCell>
              <TableCell>{f.nome}</TableCell>
              <TableCell className="text-xs">{f.abrangencia ?? f.tipo}</TableCell>
              <TableCell><Switch disabled={!podeEditar} checked={f.ativo !== false} onCheckedChange={(v) => toggle(f, v)} /></TableCell>
              <TableCell>{podeEditar && <Button size="icon" variant="ghost" aria-label="Editar feriado" onClick={() => setEdit({ ...f, abrangencia: (f.abrangencia ?? f.tipo) as FeriadoTipo })}><Pencil className="h-4 w-4" /></Button>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const TIPO_DE: Record<string, keyof typeof ALERTA_INFO> = { custo_ativo: "custo", rota_preco_ativo: "rota_preco", noturno_ativo: "noturno", fds_ativo: "fds", repetida_ativo: "repetida" };

function Linha({ label, checked, disabled, onChange, children }: { label: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{label}</div>
        <Switch disabled={disabled} checked={checked} onCheckedChange={onChange} />
      </div>
      {children && <div className="grid grid-cols-2 gap-2">{children}</div>}
    </div>
  );
}
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs text-muted-foreground space-y-1 block">{label}{children}</label>;
}
