import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useContratosPanorama, PANORAMA_VAZIO, type PanoramaProcesso } from "@/hooks/useContratosPanorama";
import {
  SETOR_LABEL,
  STATUS_LABEL,
  type ContratoProcesso,
  type ProcessoSetor,
  type ProcessoStatus,
} from "@/lib/contrato-processo";
import {
  RISCOS,
  RISCO_LABEL,
  calcularRisco,
  setorDoPerfil,
  type NivelRisco,
} from "@/lib/contrato-risco";

type QuickFilter =
  | "meus"
  | "meu_setor"
  | "criticos"
  | "aguardando_analise"
  | "aguardando_documento"
  | "prontos_aprovacao"
  | "com_pendencias"
  | "com_divergencias"
  | "aprovados"
  | "reprovados"
  | "implantados";

const RAPIDOS: { key: QuickFilter; label: string }[] = [
  { key: "meus", label: "Somente meus contratos" },
  { key: "meu_setor", label: "Pendências do meu setor" },
  { key: "criticos", label: "Contratos críticos" },
  { key: "aguardando_analise", label: "Aguardando análise" },
  { key: "aguardando_documento", label: "Aguardando documento" },
  { key: "prontos_aprovacao", label: "Prontos para aprovação" },
  { key: "com_pendencias", label: "Com pendências" },
  { key: "com_divergencias", label: "Com divergências" },
  { key: "aprovados", label: "Aprovados" },
  { key: "reprovados", label: "Reprovados" },
  { key: "implantados", label: "Implantados" },
];

const AGUARDANDO_ANALISE: ProcessoStatus[] = [
  "recebido",
  "em_extracao",
  "analise_automatica",
  "aguardando_juridico",
  "aguardando_cadastro",
  "aguardando_financeiro",
];

export interface LinhaContrato {
  implantacao: any;
  processo: ContratoProcesso | null;
  panorama: PanoramaProcesso;
  codigo: string;
  empresa: string;
  cnpj: string;
  contratado: string;
  tipoVinculo: string;
  status: ProcessoStatus | null;
  setor: ProcessoSetor | null;
  responsavel: string;
  vigencia: string | null;
  dataImplantacao: string | null;
  ultimaMovimentacao: string | null;
  risco: NivelRisco;
  faltando: string[];
}

interface UseFiltrosArgs {
  items: any[];
  processoPorImplantacao: Map<string, ContratoProcesso>;
  anexosPorImplantacao: Set<string>;
}

export interface FiltrosBarProps {
  busca: string;
  setBusca: (v: string) => void;
  cnpjFiltro: string;
  setCnpjFiltro: (v: string) => void;
  statusFiltro: string;
  setStatusFiltro: (v: string) => void;
  setorFiltro: string;
  setSetorFiltro: (v: string) => void;
  responsavelFiltro: string;
  setResponsavelFiltro: (v: string) => void;
  riscoFiltro: string;
  setRiscoFiltro: (v: string) => void;
  vinculoFiltro: string;
  setVinculoFiltro: (v: string) => void;
  de: string;
  setDe: (v: string) => void;
  ate: string;
  setAte: (v: string) => void;
  rapidos: QuickFilter[];
  toggleRapido: (k: QuickFilter) => void;
  responsaveis: string[];
  vinculos: string[];
  temFiltro: boolean;
  limpar: () => void;
  filtradasCount: number;
  totalCount: number;
}

export function useContratosFiltros({ items, processoPorImplantacao, anexosPorImplantacao }: UseFiltrosArgs) {
  const { user, role } = useAuth();
  const { data: panoramaMap } = useContratosPanorama();
  const meuSetor = setorDoPerfil(role);

  const [busca, setBusca] = useState("");
  const [cnpjFiltro, setCnpjFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [setorFiltro, setSetorFiltro] = useState("todos");
  const [responsavelFiltro, setResponsavelFiltro] = useState("todos");
  const [riscoFiltro, setRiscoFiltro] = useState("todos");
  const [vinculoFiltro, setVinculoFiltro] = useState("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [rapidos, setRapidos] = useState<QuickFilter[]>([]);

  const linhas = useMemo<LinhaContrato[]>(() => {
    return items.map((i) => {
      const processo = processoPorImplantacao.get(i.id) || null;
      const panorama = (processo && panoramaMap?.get(processo.id)) || PANORAMA_VAZIO;
      const analise = (i.analise_contrato || {}) as any;
      const faltando: string[] = [];
      if (i.status !== "implantado") {
        if (!i.nome_empresa) faltando.push("nome");
        if (!i.cnpj) faltando.push("CNPJ");
        if (!i.codigo_contrato) faltando.push("código");
        if (!i.data_vigencia) faltando.push("vigência");
        if (!i.data_vencimento) faltando.push("vencimento");
        if (!i.total_vidas) faltando.push("vidas");
        if (!anexosPorImplantacao.has(i.id)) faltando.push("documentos");
      }
      const analisado = !!i.analise_contrato_em || panorama.validado || i.status === "implantado";
      const status = (processo?.status || null) as ProcessoStatus | null;
      const statusEfetivo: ProcessoStatus | null =
        faltando.length > 0 && status && status !== "implantado" ? "aguardando_documento_empresa" : status;
      return {
        implantacao: i,
        processo,
        panorama,
        codigo: processo?.codigo || i.codigo_contrato || "—",
        empresa: i.nome_empresa || "Sem nome",
        cnpj: i.cnpj || "—",
        contratado: analise?.contratado?.nome || "—",
        tipoVinculo: analise?.tipo_vinculo || "—",
        status: statusEfetivo,
        setor: (processo?.setor_atual || null) as ProcessoSetor | null,
        responsavel: processo?.responsavel_atual_nome || i.created_by_nome || "—",
        vigencia: i.data_vigencia || null,
        dataImplantacao: i.inicio_atendimento || i.empresa?.data_implantacao || null,
        ultimaMovimentacao: processo?.ultima_movimentacao_em || i.updated_at || null,
        risco: calcularRisco({
          status: statusEfetivo,
          analisado,
          pendenciasAbertas: panorama.pendenciasAbertas,
          pendenciasCriticas: panorama.pendenciasCriticas,
          divergencias: panorama.divergencias,
          divergenciasCriticas: panorama.divergenciasCriticas,
          camposFaltando: faltando.length,
        }),
        faltando,
      };
    });
  }, [items, processoPorImplantacao, panoramaMap, anexosPorImplantacao]);

  const responsaveis = useMemo(
    () => [...new Set(linhas.map((l) => l.responsavel).filter((r) => r && r !== "—"))].sort(),
    [linhas],
  );
  const vinculos = useMemo(
    () => [...new Set(linhas.map((l) => l.tipoVinculo).filter((v) => v && v !== "—"))].sort(),
    [linhas],
  );

  const toggleRapido = (key: QuickFilter) =>
    setRapidos((atual) => (atual.includes(key) ? atual.filter((k) => k !== key) : [...atual, key]));

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const cnpjTermo = cnpjFiltro.replace(/\D/g, "");
    return linhas.filter((l) => {
      if (termo && !`${l.empresa} ${l.codigo} ${l.contratado}`.toLowerCase().includes(termo)) return false;
      if (cnpjTermo && !l.cnpj.replace(/\D/g, "").includes(cnpjTermo)) return false;
      if (statusFiltro !== "todos" && l.status !== statusFiltro) return false;
      if (setorFiltro !== "todos" && l.setor !== setorFiltro) return false;
      if (responsavelFiltro !== "todos" && l.responsavel !== responsavelFiltro) return false;
      if (riscoFiltro !== "todos" && l.risco !== riscoFiltro) return false;
      if (vinculoFiltro !== "todos" && l.tipoVinculo !== vinculoFiltro) return false;
      if (de && (!l.ultimaMovimentacao || l.ultimaMovimentacao.slice(0, 10) < de)) return false;
      if (ate && (!l.ultimaMovimentacao || l.ultimaMovimentacao.slice(0, 10) > ate)) return false;

      for (const r of rapidos) {
        switch (r) {
          case "meus":
            if (
              l.implantacao.created_by !== user?.id &&
              l.processo?.responsavel_atual_id !== user?.id
            ) return false;
            break;
          case "meu_setor":
            if (!meuSetor || !l.panorama.setoresPendencia.includes(meuSetor)) return false;
            break;
          case "criticos":
            if (l.risco !== "alto") return false;
            break;
          case "aguardando_analise":
            if (!l.status || !AGUARDANDO_ANALISE.includes(l.status)) return false;
            break;
          case "aguardando_documento":
            if (l.status !== "aguardando_documento_empresa" && l.faltando.length === 0) return false;
            break;
          case "prontos_aprovacao":
            if (
              l.faltando.length > 0 ||
              l.panorama.pendenciasAbertas > 0 ||
              l.panorama.divergenciasCriticas > 0 ||
              !l.status ||
              ["aprovado", "aprovado_ressalva", "reprovado", "implantado"].includes(l.status)
            ) return false;
            break;
          case "com_pendencias":
            if (l.panorama.pendenciasAbertas === 0) return false;
            break;
          case "com_divergencias":
            if (l.panorama.divergencias === 0) return false;
            break;
          case "aprovados":
            if (!["Aprovado", "Aprovado com ressalva"].includes(l.processo?.resultado_final || "")) return false;
            break;
          case "reprovados":
            if (l.processo?.resultado_final !== "Reprovado") return false;
            break;
          case "implantados":
            if (l.implantacao.status !== "implantado") return false;
            break;
        }
      }
      return true;
    });
  }, [linhas, busca, cnpjFiltro, statusFiltro, setorFiltro, responsavelFiltro, riscoFiltro, vinculoFiltro, de, ate, rapidos, user?.id, meuSetor]);

  const limpar = () => {
    setBusca("");
    setCnpjFiltro("");
    setStatusFiltro("todos");
    setSetorFiltro("todos");
    setResponsavelFiltro("todos");
    setRiscoFiltro("todos");
    setVinculoFiltro("todos");
    setDe("");
    setAte("");
    setRapidos([]);
  };

  const temFiltro =
    !!busca || !!cnpjFiltro || !!de || !!ate || rapidos.length > 0 ||
    [statusFiltro, setorFiltro, responsavelFiltro, riscoFiltro, vinculoFiltro].some((v) => v !== "todos");

  const barProps: FiltrosBarProps = {
    busca, setBusca,
    cnpjFiltro, setCnpjFiltro,
    statusFiltro, setStatusFiltro,
    setorFiltro, setSetorFiltro,
    responsavelFiltro, setResponsavelFiltro,
    riscoFiltro, setRiscoFiltro,
    vinculoFiltro, setVinculoFiltro,
    de, setDe,
    ate, setAte,
    rapidos, toggleRapido,
    responsaveis, vinculos,
    temFiltro, limpar,
    filtradasCount: filtradas.length,
    totalCount: linhas.length,
  };

  return { linhas, filtradas, barProps };
}

export function ContratosFiltrosBar(p: FiltrosBarProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Linha principal: busca + status */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-8">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa, contratado, CNPJ ou ID do contrato..."
              value={p.busca}
              onChange={(e) => p.setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="md:col-span-4">
            <Select value={p.statusFiltro} onValueChange={p.setStatusFiltro}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {(Object.keys(STATUS_LABEL) as ProcessoStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Linha avançada */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Input placeholder="CNPJ" value={p.cnpjFiltro} onChange={(e) => p.setCnpjFiltro(e.target.value)} />
          <Select value={p.setorFiltro} onValueChange={p.setSetorFiltro}>
            <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os setores</SelectItem>
              {(Object.keys(SETOR_LABEL) as ProcessoSetor[]).map((s) => (
                <SelectItem key={s} value={s}>{SETOR_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={p.responsavelFiltro} onValueChange={p.setResponsavelFiltro}>
            <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              {p.responsaveis.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={p.riscoFiltro} onValueChange={p.setRiscoFiltro}>
            <SelectTrigger><SelectValue placeholder="Risco" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os riscos</SelectItem>
              {RISCOS.map((r) => (
                <SelectItem key={r} value={r}>Risco {RISCO_LABEL[r].toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={p.vinculoFiltro} onValueChange={p.setVinculoFiltro}>
            <SelectTrigger><SelectValue placeholder="Tipo de vínculo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os vínculos</SelectItem>
              {p.vinculos.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 col-span-2 md:col-span-1">
            <Input type="date" value={p.de} onChange={(e) => p.setDe(e.target.value)} aria-label="Movimentação de" />
            <span className="text-muted-foreground text-sm">a</span>
            <Input type="date" value={p.ate} onChange={(e) => p.setAte(e.target.value)} aria-label="Movimentação até" />
          </div>
        </div>

        {/* Atalhos */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1">Atalhos:</span>
          {RAPIDOS.map((r) => {
            const ativo = p.rapidos.includes(r.key);
            return (
              <Button
                key={r.key}
                size="sm"
                variant={ativo ? "default" : "outline"}
                className="h-7 rounded-full text-xs"
                onClick={() => p.toggleRapido(r.key)}
              >
                {r.label}
              </Button>
            );
          })}
          {p.temFiltro && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={p.limpar}>
              <X className="h-3 w-3" /> Limpar
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Mostrando <span className="font-semibold text-foreground">{p.filtradasCount} de {p.totalCount}</span> contrato(s)
        </p>
      </CardContent>
    </Card>
  );
}
