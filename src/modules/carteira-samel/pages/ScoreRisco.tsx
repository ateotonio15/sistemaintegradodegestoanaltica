import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Grid3x3, List, ArrowRight } from "lucide-react";
import { useEmpresasCarteira } from "../context/EmpresasContext";
import { scoreSimplificado, acoesRecomendadas } from "../lib/risco";
import { SemaforoBadge } from "../components/SemaforoBadge";
import { EmpresaDetailsDrawer } from "../components/EmpresaDetailsDrawer";
import { EmpresaCarteira } from "../data/mockData";
import { cn } from "@/lib/utils";

export default function ScoreRisco() {
  const { ativas } = useEmpresasCarteira();
  const [view, setView] = useState<"grid" | "lista">("grid");
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState<string>("todos");
  const [filtroClass, setFiltroClass] = useState<string>("todas");
  const [selecionada, setSelecionada] = useState<EmpresaCarteira | null>(null);

  // mock de reclamações por empresa
  const reclamacoesPorEmpresa = useMemo(() => {
    const map: Record<string, number> = {};
    ativas.forEach((e, i) => { map[e.id] = (i * 3) % 6; });
    return map;
  }, [ativas]);

  const dados = useMemo(() => {
    let arr = ativas.map((e) => {
      const rec = reclamacoesPorEmpresa[e.id] ?? 0;
      const s = scoreSimplificado(rec, e.vigenciaInicio);
      return { empresa: e, rec, ...s };
    });
    if (busca) arr = arr.filter((d) => d.empresa.nome.toLowerCase().includes(busca.toLowerCase()) || d.empresa.contrato.includes(busca));
    if (grupo !== "todos") arr = arr.filter((d) => d.empresa.grupoTamanho === grupo);
    if (filtroClass !== "todas") arr = arr.filter((d) => d.semaforo === filtroClass);
    arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [ativas, busca, grupo, filtroClass, reclamacoesPorEmpresa]);

  return (
    <div className="space-y-4">
      <Card className="p-3 flex flex-wrap gap-2 items-center">
        <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
        <Select value={grupo} onValueChange={setGrupo}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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
        <div className="ml-auto flex gap-1">
          <Button size="icon" variant={view === "grid" ? "default" : "outline"} onClick={() => setView("grid")}><Grid3x3 className="h-4 w-4" /></Button>
          <Button size="icon" variant={view === "lista" ? "default" : "outline"} onClick={() => setView("lista")}><List className="h-4 w-4" /></Button>
        </div>
      </Card>

      {view === "grid" ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {dados.map((d) => {
            const acoes = acoesRecomendadas(d.semaforo);
            return (
              <Card key={d.empresa.id} className={cn("p-4 space-y-2 border-l-4", d.semaforo === "Verde" ? "border-l-emerald-500" : d.semaforo === "Amarelo" ? "border-l-amber-500" : "border-l-red-500")}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold truncate">{d.empresa.nome}</h3>
                    <p className="text-xs text-muted-foreground">Contrato {d.empresa.contrato}</p>
                  </div>
                  <SemaforoBadge semaforo={d.semaforo} label={`Score ${d.total}`} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-muted/40 p-2"><div className="text-muted-foreground">Reclamações 30d</div><div className="font-semibold">{d.rec}</div></div>
                  <div className="rounded bg-muted/40 p-2"><div className="text-muted-foreground">Dias p/ reajuste</div><div className="font-semibold">{d.diasReajuste}</div></div>
                </div>
                <div>
                  <p className="text-[11px] uppercase font-semibold text-muted-foreground mb-1">Ações recomendadas</p>
                  <ul className="text-xs space-y-0.5 list-disc list-inside">
                    {acoes.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={() => setSelecionada(d.empresa)}>Ver detalhes <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Score</th>
                <th className="px-3 py-2 text-left">Reclam. 30d</th>
                <th className="px-3 py-2 text-left">Dias reajuste</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {dados.map((d) => (
                <tr key={d.empresa.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{d.empresa.nome}</td>
                  <td className="px-3 py-2"><SemaforoBadge semaforo={d.semaforo} label={`${d.total}`} /></td>
                  <td className="px-3 py-2">{d.rec}</td>
                  <td className="px-3 py-2">{d.diasReajuste}</td>
                  <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" onClick={() => setSelecionada(d.empresa)}>Detalhes</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <EmpresaDetailsDrawer empresa={selecionada} open={!!selecionada} onOpenChange={(o) => !o && setSelecionada(null)} />
    </div>
  );
}
