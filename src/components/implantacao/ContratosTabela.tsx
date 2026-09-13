import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GitBranch, Search, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useContratosPanorama, PANORAMA_VAZIO, type PanoramaProcesso } from "@/hooks/useContratosPanorama";
import {
  SETOR_LABEL,
  STATUS_LABEL,
  setorLabel,
  statusBadge,
  statusLabel,
  type ContratoProcesso,
  type ProcessoSetor,
  type ProcessoStatus,
} from "@/lib/contrato-processo";
import {
  RISCOS,
  RISCO_BADGE,
  RISCO_DOT,
  RISCO_LABEL,
  calcularRisco,
  setorDoPerfil,
  type NivelRisco,
} from "@/lib/contrato-risco";
import { formatDateBR, formatDay } from "@/lib/date-utils";

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

interface Props {
  items: any[];
  processoPorImplantacao: Map<string, ContratoProcesso>;
  anexosPorImplantacao: Set<string>;
  onOpen: (id: string) => void;
  onFluxo: (item: any) => void;
}

export function ContratosTabela({ items, processoPorImplantacao, anexosPorImplantacao, onOpen, onFluxo }: Props) {
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

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Empresa, contratado ou ID do contrato..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input placeholder="CNPJ" value={cnpjFiltro} onChange={(e) => setCnpjFiltro(e.target.value)} />
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {(Object.keys(STATUS_LABEL) as ProcessoStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={setorFiltro} onValueChange={setSetorFiltro}>
              <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {(Object.keys(SETOR_LABEL) as ProcessoSetor[]).map((s) => (
                  <SelectItem key={s} value={s}>{SETOR_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={responsavelFiltro} onValueChange={setResponsavelFiltro}>
              <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os responsáveis</SelectItem>
                {responsaveis.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={riscoFiltro} onValueChange={setRiscoFiltro}>
              <SelectTrigger><SelectValue placeholder="Risco" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os riscos</SelectItem>
                {RISCOS.map((r) => (
                  <SelectItem key={r} value={r}>Risco {RISCO_LABEL[r].toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={vinculoFiltro} onValueChange={setVinculoFiltro}>
              <SelectTrigger><SelectValue placeholder="Tipo de vínculo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os vínculos</SelectItem>
                {vinculos.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} aria-label="Movimentação de" />
              <span className="text-muted-foreground text-sm">a</span>
              <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} aria-label="Movimentação até" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {RAPIDOS.map((r) => {
              const ativo = rapidos.includes(r.key);
              return (
                <Button
                  key={r.key}
                  size="sm"
                  variant={ativo ? "default" : "outline"}
                  className="h-7 rounded-full text-xs"
                  onClick={() => toggleRapido(r.key)}
                >
                  {r.label}
                </Button>
              );
            })}
            {temFiltro && (
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={limpar}>
                <X className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {filtradas.length} de {linhas.length} contrato(s)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">ID</th>
                <th className="text-left font-medium px-3 py-2">Empresa</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">CNPJ</th>
                <th className="text-left font-medium px-3 py-2">Contratado</th>
                <th className="text-left font-medium px-3 py-2">Vínculo</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
                <th className="text-left font-medium px-3 py-2">Setor</th>
                <th className="text-left font-medium px-3 py-2">Responsável</th>
                <th className="text-center font-medium px-3 py-2">Pend.</th>
                <th className="text-center font-medium px-3 py-2">Diverg.</th>
                <th className="text-left font-medium px-3 py-2">Risco</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Vigência</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Implantação</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Últ. mov.</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-3 py-10 text-center text-muted-foreground">
                    Nenhum contrato encontrado com esses filtros.
                  </td>
                </tr>
              ) : (
                filtradas.map((l) => (
                  <tr
                    key={l.implantacao.id}
                    className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                    onClick={() => onOpen(l.implantacao.id)}
                  >
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{l.codigo}</td>
                    <td className="px-3 py-2 font-medium max-w-[15rem] truncate" title={l.empresa}>
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${RISCO_DOT[l.risco]}`} />
                        {l.empresa}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{l.cnpj}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[12rem] truncate" title={l.contratado}>
                      {l.contratado}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[10rem] truncate" title={l.tipoVinculo}>
                      {l.tipoVinculo}
                    </td>
                    <td className="px-3 py-2">
                      {l.status ? (
                        <Badge variant="outline" className={`${statusBadge(l.status)} whitespace-nowrap`}>
                          {statusLabel(l.status)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {l.setor ? setorLabel(l.setor) : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[10rem] truncate" title={l.responsavel}>
                      {l.responsavel}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {l.panorama.pendenciasAbertas > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30">
                                {l.panorama.pendenciasAbertas}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">
                                {l.panorama.titulosPendencia.join(" · ") || "Pendências em aberto"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {l.panorama.divergencias > 0 ? (
                        <Badge
                          variant="outline"
                          className={
                            l.panorama.divergenciasCriticas > 0
                              ? "bg-red-500/15 text-red-600 border-red-500/30"
                              : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                          }
                        >
                          {l.panorama.divergencias}
                          {l.panorama.divergenciasCriticas > 0 ? " crít." : ""}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`${RISCO_BADGE[l.risco]} whitespace-nowrap`}>
                        {RISCO_LABEL[l.risco]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {l.vigencia ? formatDateBR(l.vigencia) : "—"}
                      {l.implantacao.data_vencimento ? (
                        <span className="text-xs"> · venc. {formatDay(l.implantacao.data_vencimento)}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {l.dataImplantacao ? formatDateBR(l.dataImplantacao) : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {l.ultimaMovimentacao ? formatDateBR(l.ultimaMovimentacao) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={(e) => { e.stopPropagation(); onFluxo(l.implantacao); }}
                        title="Fluxo entre setores"
                      >
                        <GitBranch className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Regular / aprovado</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Pendência / revisar</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Divergência crítica / reprovado</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> Aguardando análise</span>
      </div>
    </div>
  );
}
