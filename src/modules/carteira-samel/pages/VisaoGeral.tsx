import { useMemo, useState } from "react";
import { Building2, Users, Activity, ShieldAlert, Search, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { StatCard } from "../components/StatCard";
import { SemaforoBadge } from "../components/SemaforoBadge";
import { useEmpresasCarteira } from "../context/EmpresasContext";
import { diasAteReajuste, proximosAniversarios, classificarProximidadeReajuste, classificarSinistralidade, scoreCompleto } from "../lib/risco";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GrupoTamanho } from "../data/mockData";

type GrupoFiltro = "todos" | GrupoTamanho;

function bucketVidas(v: number): GrupoTamanho {
  if (v >= 500) return "≥500";
  if (v >= 100) return "100-499";
  return "30-99";
}

const GRUPOS: { key: GrupoFiltro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "≥500", label: "≥ 500" },
  { key: "100-499", label: "100–499" },
  { key: "30-99", label: "30–99" },
];

export default function VisaoGeral() {
  const { ativas } = useEmpresasCarteira();
  const [faixaAberta, setFaixaAberta] = useState<"critico" | "atencao" | "estavel" | null>(null);
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState<GrupoFiltro>("todos");

  const empresasFiltradas = useMemo(
    () => (grupo === "todos" ? ativas : ativas.filter((e) => bucketVidas(e.vidas) === grupo)),
    [ativas, grupo],
  );

  // "Alerta de Reajustes Próximos" sempre mostra todas as empresas, ignorando o filtro de grupo.
  const enriquecidas = useMemo(
    () => ativas.map((e) => ({ ...e, dias: diasAteReajuste(e.vigenciaInicio) })),
    [ativas],
  );

  const totalEmpresas = empresasFiltradas.length;
  const totalVidas = empresasFiltradas.reduce((s, e) => s + e.vidas, 0);
  const sinistralidadeMedia = empresasFiltradas.length
    ? empresasFiltradas.reduce((s, e) => s + e.reajusteValor * 6, 0) / empresasFiltradas.length
    : 0;
  const scoreMedio = empresasFiltradas.length
    ? empresasFiltradas.reduce((s, e) => s + scoreCompleto({ sinistralidade: classificarSinistralidade(sinistralidadeMedia), reclamacoes: "Verde", relacionamento: "Verde", satisfacao: "Verde", renovacao: classificarProximidadeReajuste(diasAteReajuste(e.vigenciaInicio)) }).total, 0) / empresasFiltradas.length
    : 0;

  const faixas = {
    critico: enriquecidas.filter((e) => e.dias <= 30),
    atencao: enriquecidas.filter((e) => e.dias > 30 && e.dias <= 60),
    estavel: enriquecidas.filter((e) => e.dias > 60),
  };

  const listaExibida = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = termo
      ? empresasFiltradas.filter((e) => e.nome.toLowerCase().includes(termo) || e.contrato.includes(termo))
      : empresasFiltradas;
    return [...base].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [empresasFiltradas, busca]);


  return (
    <div className="space-y-6">



      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Empresas ativas" value={totalEmpresas} />
        <StatCard icon={Users} label="Total de vidas" value={totalVidas.toLocaleString("pt-BR")} />
        <StatCard icon={Activity} label="Sinistralidade média (proxy)" value={`${sinistralidadeMedia.toFixed(1)}%`} hint="Estimativa visual" />
        <StatCard icon={ShieldAlert} label="Score médio" value={scoreMedio.toFixed(1)} hint="5–15 (menor é melhor)" />
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Alerta de Reajustes Próximos</h2>
        <div className="grid gap-2 md:grid-cols-3">
          {([
            ["critico", "Crítico (≤30 dias)", "Vermelho" as const],
            ["atencao", "Atenção (31–60 dias)", "Amarelo" as const],
            ["estavel", "Estável (61+ dias)", "Verde" as const],
          ] as const).map(([key, label, sem]) => {
            const aberta = faixaAberta === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFaixaAberta(aberta ? null : key)}
                className={cn("text-left rounded-lg border p-3 hover:bg-accent/40 transition-colors", aberta && "ring-2 ring-primary/40")}
              >
                <div className="flex items-center justify-between">
                  <SemaforoBadge semaforo={sem} label={label} />
                  <span className="text-2xl font-bold">{faixas[key].length}</span>
                </div>
                <ChevronDown className={cn("h-4 w-4 mt-2 text-muted-foreground transition-transform", aberta && "rotate-180")} />
              </button>
            );
          })}
        </div>
        {faixaAberta && (
          <div className="mt-3 rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Empresa</th>
                  <th className="px-3 py-2 text-left">Contrato</th>
                  <th className="px-3 py-2 text-left">Vidas</th>
                  <th className="px-3 py-2 text-left">Próx. reajuste</th>
                  <th className="px-3 py-2 text-left">Dias</th>
                </tr>
              </thead>
              <tbody>
                {faixas[faixaAberta].map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{e.nome}</td>
                    <td className="px-3 py-2">{e.contrato}</td>
                    <td className="px-3 py-2">{e.vidas}</td>
                    <td className="px-3 py-2">{format(proximosAniversarios(e.vigenciaInicio, 1)[0], "dd/MM/yyyy")}</td>
                    <td className="px-3 py-2">{e.dias}</td>
                  </tr>
                ))}
                {faixas[faixaAberta].length === 0 && (
                  <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Nenhuma empresa nesta faixa.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground mr-1">Grupo de vidas:</span>
          {GRUPOS.map((g) => {
            const active = grupo === g.key;
            return (
              <Button
                key={g.key}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setGrupo(g.key)}
                className={cn(active && "bg-[image:var(--gradient-hero)] text-white border-transparent hover:opacity-90")}
              >
                {g.label}
              </Button>
            );
          })}
        </div>

        <div>
          <h2 className="font-semibold mb-3">Busca individual</h2>
          <div className="relative max-w-md">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Nome ou contrato..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {busca && (
            <div className="mt-3 space-y-3">
              {buscaFiltrada.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma empresa encontrada.</p>}
              {buscaFiltrada.slice(0, 5).map((e) => {
                const dias = diasAteReajuste(e.vigenciaInicio);
                const sem = classificarProximidadeReajuste(dias);
                const score = scoreCompleto({ sinistralidade: "Verde", reclamacoes: "Verde", relacionamento: "Verde", satisfacao: "Verde", renovacao: sem });
                return (
                  <div key={e.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="font-semibold">{e.nome}</h3>
                        <p className="text-xs text-muted-foreground">Contrato {e.contrato} · {e.vidas} vidas · vigência {format(new Date(e.vigenciaInicio + "T00:00:00"), "dd/MM/yyyy")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <SemaforoBadge semaforo={sem} label={`${dias}d para reajuste`} />
                        <span className="text-sm">Score: <strong>{score.total}</strong> · {score.classificacao}</span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Próximos 4 aniversários: {proximosAniversarios(e.vigenciaInicio, 4).map((d) => format(d, "dd/MM/yyyy")).join(" · ")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {grupo !== "todos" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Empresas no grupo {GRUPOS.find((g) => g.key === grupo)?.label}</h2>
              <span className="text-sm text-muted-foreground">{empresasFiltradas.length} empresa(s)</span>
            </div>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Empresa</th>
                    <th className="px-3 py-2 text-left">Contrato</th>
                    <th className="px-3 py-2 text-left">Vidas</th>
                    <th className="px-3 py-2 text-left">Vigência</th>
                    <th className="px-3 py-2 text-left">Próx. reajuste</th>
                  </tr>
                </thead>
                <tbody>
                  {empresasFiltradas.map((e) => {
                    const dias = diasAteReajuste(e.vigenciaInicio);
                    const sem = classificarProximidadeReajuste(dias);
                    return (
                      <tr key={e.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{e.nome}</td>
                        <td className="px-3 py-2">{e.contrato}</td>
                        <td className="px-3 py-2">{e.vidas.toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2">{format(new Date(e.vigenciaInicio + "T00:00:00"), "dd/MM/yyyy")}</td>
                        <td className="px-3 py-2">
                          <SemaforoBadge semaforo={sem} label={`${dias}d`} />
                        </td>
                      </tr>
                    );
                  })}
                  {empresasFiltradas.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Nenhuma empresa neste grupo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

