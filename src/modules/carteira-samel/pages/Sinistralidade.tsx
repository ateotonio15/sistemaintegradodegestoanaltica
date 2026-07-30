import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, History, Trash2, Wand2 } from "lucide-react";
import { format } from "date-fns";
import { useEmpresasCarteira } from "../context/EmpresasContext";
import { SemaforoBadge } from "../components/SemaforoBadge";
import { TabelaPeriodo } from "../components/TabelaPeriodo";
import { classificarSinistralidade, classificarRenovacao, scoreCompleto } from "../lib/risco";
import { calcularResumo, compararPeriodos, gerarTextos, LinhaPeriodo } from "../lib/analiseContrato";
import { useHistoricoSinistralidade, useUpsertSinistralidade, useDeleteSinistralidade } from "../hooks/useRiscoData";
import { useAuth } from "@/hooks/useAuth";
import { EvolucaoMensalSection } from "../components/EvolucaoMensalSection";
import { toast } from "sonner";

const INDEXADORES = ["IPCA", "INPC", "IGPM", "IGP-DI", "IP-SAÚDE", "Contratual"];

export default function Sinistralidade() {
  return (
    <Tabs defaultValue="historico" className="space-y-4">
      <TabsList>
        <TabsTrigger value="historico">Histórico & Análise</TabsTrigger>
        <TabsTrigger value="evolucao">Evolução Mensal</TabsTrigger>
      </TabsList>
      <TabsContent value="historico">
        <SinistralidadeHistorico />
      </TabsContent>
      <TabsContent value="evolucao">
        <EvolucaoMensalSection />
      </TabsContent>
    </Tabs>
  );
}

function SinistralidadeHistorico() {
  const { ativas } = useEmpresasCarteira();
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const [filtroClass, setFiltroClass] = useState<string>("todas");
  const [filtroGrupo, setFiltroGrupo] = useState<string>("todos");
  const [empresaAberta, setEmpresaAberta] = useState<string | null>(null);

  const { data: todoHistorico = [] } = useHistoricoSinistralidade();

  const ultimaPor = useMemo(() => {
    const map: Record<string, any> = {};
    for (const h of todoHistorico) {
      const cur = map[h.empresa];
      if (!cur || (h.ano > cur.ano) || (h.ano === cur.ano && h.mes > cur.mes)) map[h.empresa] = h;
    }
    return map;
  }, [todoHistorico]);

  const dados = useMemo(() => {
    let arr = ativas.map((e) => {
      const u = ultimaPor[e.nome];
      const sinPct = u?.sinistralidade != null ? Number(u.sinistralidade) : null;
      const clf = classificarSinistralidade(sinPct ?? undefined);
      const ren = classificarRenovacao(e.vigenciaInicio);
      const score = scoreCompleto({ sinistralidade: clf, reclamacoes: "Verde", relacionamento: "Verde", satisfacao: "Verde", renovacao: ren });
      return { ...e, sinPct, clf, score };
    });
    if (busca) arr = arr.filter((e) => e.nome.toLowerCase().includes(busca.toLowerCase()) || e.contrato.includes(busca));
    if (filtroGrupo !== "todos") arr = arr.filter((e) => e.grupoTamanho === filtroGrupo);
    if (filtroClass !== "todas") arr = arr.filter((e) => e.clf === filtroClass);
    return arr;
  }, [ativas, ultimaPor, busca, filtroClass, filtroGrupo]);

  const empresaAtiva = ativas.find((e) => e.id === empresaAberta) || null;

  return (

    <div className="space-y-4">
      <Card className="p-3 flex flex-wrap gap-2 items-center">
        <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
        <Select value={filtroGrupo} onValueChange={setFiltroGrupo}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos grupos</SelectItem>
            <SelectItem value="≥500">≥500</SelectItem>
            <SelectItem value="100-499">100–499</SelectItem>
            <SelectItem value="30-99">30–99</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroClass} onValueChange={setFiltroClass}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas classificações</SelectItem>
            <SelectItem value="Verde">Verde</SelectItem>
            <SelectItem value="Amarelo">Amarelo</SelectItem>
            <SelectItem value="Vermelho">Vermelho</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Empresa</th>
              <th className="px-3 py-2 text-left">Contrato</th>
              <th className="px-3 py-2 text-left">Última sin %</th>
              <th className="px-3 py-2 text-left">Classificação</th>
              <th className="px-3 py-2 text-left">Score</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {dados.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="px-3 py-2 font-medium">{e.nome}</td>
                <td className="px-3 py-2">{e.contrato}</td>
                <td className="px-3 py-2">{e.sinPct != null ? `${e.sinPct.toFixed(1)}%` : "—"}</td>
                <td className="px-3 py-2"><SemaforoBadge semaforo={e.clf} /></td>
                <td className="px-3 py-2">{e.score.total} · {e.score.classificacao}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => setEmpresaAberta(e.id)}>
                    <History className="h-3.5 w-3.5 mr-1" /> Histórico
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <AnaliseContratoSection />

      <HistoricoDialog
        empresa={empresaAtiva}
        onClose={() => setEmpresaAberta(null)}
        userEmail={user?.email || "sistema"}
      />
    </div>
  );
}

function HistoricoDialog({ empresa, onClose, userEmail }: { empresa: any | null; onClose: () => void; userEmail: string }) {
  const { data: hist = [] } = useHistoricoSinistralidade(empresa?.nome);
  const upsert = useUpsertSinistralidade();
  const del = useDeleteSinistralidade();

  const [form, setForm] = useState({ id: "" as string | "", mes: "", ano: new Date().getFullYear(), sinistralidade: 0, percentual_reajuste: 0, indexador: "IPCA", observacao: "" });
  const reset = () => setForm({ id: "", mes: "", ano: new Date().getFullYear(), sinistralidade: 0, percentual_reajuste: 0, indexador: "IPCA", observacao: "" });

  const salvar = async () => {
    if (!empresa) return;
    if (!form.mes || !form.ano) { toast.error("Mês e ano obrigatórios"); return; }
    await upsert.mutateAsync({
      id: form.id || undefined,
      empresa: empresa.nome,
      contrato: empresa.contrato,
      mes: form.mes,
      ano: form.ano,
      sinistralidade: Number(form.sinistralidade),
      percentual_reajuste: Number(form.percentual_reajuste),
      indexador: form.indexador,
      observacao: form.observacao,
      created_by: userEmail,
    });
    toast.success("Salvo");
    reset();
  };

  return (
    <Dialog open={!!empresa} onOpenChange={(o) => !o && (onClose(), reset())}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{empresa?.nome}</DialogTitle>
          <p className="text-xs text-muted-foreground">Contrato {empresa?.contrato}</p>
        </DialogHeader>
        <Tabs defaultValue="historico">
          <TabsList><TabsTrigger value="historico">Histórico</TabsTrigger><TabsTrigger value="form">Inserir / Editar</TabsTrigger></TabsList>
          <TabsContent value="historico" className="max-h-[60vh] overflow-y-auto">
            {hist.length === 0 && <p className="text-sm text-muted-foreground p-4">Sem registros.</p>}
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr><th className="px-2 py-1.5 text-left">Período</th><th className="px-2 py-1.5 text-left">Sin %</th><th className="px-2 py-1.5 text-left">% Reaj.</th><th className="px-2 py-1.5 text-left">Indexador</th><th className="px-2 py-1.5 text-left">Obs.</th><th></th></tr>
              </thead>
              <tbody>
                {hist.map((h: any) => (
                  <tr key={h.id} className="border-t">
                    <td className="px-2 py-1.5">{h.mes}/{h.ano}</td>
                    <td className="px-2 py-1.5">{h.sinistralidade != null ? `${Number(h.sinistralidade).toFixed(1)}%` : "—"}</td>
                    <td className="px-2 py-1.5">{h.percentual_reajuste != null ? `${Number(h.percentual_reajuste).toFixed(2)}%` : "—"}</td>
                    <td className="px-2 py-1.5">{h.indexador || "—"}</td>
                    <td className="px-2 py-1.5">{h.observacao || ""}</td>
                    <td className="px-2 py-1.5 text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setForm({ id: h.id, mes: h.mes, ano: h.ano, sinistralidade: h.sinistralidade || 0, percentual_reajuste: h.percentual_reajuste || 0, indexador: h.indexador || "IPCA", observacao: h.observacao || "" })}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate(h.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>
          <TabsContent value="form" className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><label className="text-xs">Mês</label><Input value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })} placeholder="01 ou Jan" /></div>
              <div><label className="text-xs">Ano</label><Input type="number" value={form.ano} onChange={(e) => setForm({ ...form, ano: Number(e.target.value) || 0 })} /></div>
              <div><label className="text-xs">Sinistralidade %</label><Input type="number" value={form.sinistralidade} onChange={(e) => setForm({ ...form, sinistralidade: Number(e.target.value) })} /></div>
              <div><label className="text-xs">% Reajuste</label><Input type="number" value={form.percentual_reajuste} onChange={(e) => setForm({ ...form, percentual_reajuste: Number(e.target.value) })} /></div>
              <div>
                <label className="text-xs">Indexador</label>
                <Select value={form.indexador} onValueChange={(v) => setForm({ ...form, indexador: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INDEXADORES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Textarea placeholder="Observação..." value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
            <div className="flex gap-2 justify-end">
              {form.id && <Button variant="ghost" onClick={reset}>Cancelar edição</Button>}
              <Button onClick={salvar} disabled={upsert.isPending}>{form.id ? "Atualizar" : "Salvar"}</Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function AnaliseContratoSection() {
  const [breakEvenPadrao, setBreakEvenPadrao] = useState(75);
  const [anterior, setAnterior] = useState<LinhaPeriodo[]>([]);
  const [atual, setAtual] = useState<LinhaPeriodo[]>([]);
  const [textos, setTextos] = useState<{ anterior: string; atual: string; conclusao: string } | null>(null);

  const gerar = () => {
    const ra = calcularResumo(anterior);
    const ru = calcularResumo(atual);
    setTextos(gerarTextos(ra, ru));
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold">Análise de Contrato</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Break-even padrão (%)</label>
          <Input type="number" value={breakEvenPadrao} onChange={(e) => setBreakEvenPadrao(Number(e.target.value) || 75)} className="h-8 w-24" />
          <Button onClick={gerar} size="sm"><Wand2 className="h-3.5 w-3.5 mr-1" /> Gerar Análise</Button>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <TabelaPeriodo titulo="Período anterior" linhas={anterior} onChange={setAnterior} breakEvenPadrao={breakEvenPadrao} />
        <TabelaPeriodo titulo="Período atual" linhas={atual} onChange={setAtual} breakEvenPadrao={breakEvenPadrao} />
      </div>
      {textos && (
        <div className="grid gap-3 lg:grid-cols-3 text-sm">
          <div className="rounded-lg border p-3"><h4 className="font-semibold mb-1 text-xs uppercase text-muted-foreground">Período anterior</h4><p>{textos.anterior}</p></div>
          <div className="rounded-lg border p-3"><h4 className="font-semibold mb-1 text-xs uppercase text-muted-foreground">Período atual</h4><p>{textos.atual}</p></div>
          <div className="rounded-lg border p-3 bg-primary/5"><h4 className="font-semibold mb-1 text-xs uppercase text-muted-foreground">Conclusão</h4><p>{textos.conclusao}</p></div>
        </div>
      )}
    </Card>
  );
}
