import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, XCircle, FileText, Building2, Users, Calendar, Paperclip, Rocket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SelecionarResponsavelCadastroDialog } from "./SelecionarResponsavelCadastroDialog";
import { formatDateBR, formatDay } from "@/lib/date-utils";
import { formatCentavosBRL } from "@/lib/reajuste-utils";
import { useContratoProcessoPorImplantacao } from "@/hooks/useContratoProcessos";
import { useBloqueioValidacaoCruzada, useValidacaoCruzada } from "@/hooks/useValidacaoCruzada";
import { ValidacaoCruzadaSection } from "./ValidacaoCruzadaSection";
import { resumoValidacao } from "@/lib/validacao-cruzada";
import { cn } from "@/lib/utils";
import {
  setorLabel, statusGeralLabel, statusLabel,
  type ProcessoStatusGeral,
} from "@/lib/contrato-processo";

type Tom = "verde" | "amarelo" | "vermelho" | "cinza";
const TOM_DOT: Record<Tom, string> = {
  verde: "bg-emerald-500",
  amarelo: "bg-amber-500",
  vermelho: "bg-red-500",
  cinza: "bg-muted-foreground/40",
};
const TOM_TXT: Record<Tom, string> = {
  verde: "text-emerald-600",
  amarelo: "text-amber-600",
  vermelho: "text-red-600",
  cinza: "text-muted-foreground",
};

const TOM_SURFACE: Record<Tom, string> = {
  verde: "border-emerald-500/30 bg-emerald-500/10",
  amarelo: "border-amber-500/30 bg-amber-500/10",
  vermelho: "border-red-500/30 bg-red-500/10",
  cinza: "border-border bg-muted/30",
};

function BlocoResumo({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <div className="border-b border-border bg-muted/20 px-4 py-2.5">
        <h5 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{titulo}</h5>
      </div>
      <div className="flex-1 space-y-4 p-4">{children}</div>
    </div>
  );
}

function CampoPrimario({
  label,
  value,
  tom = "cinza",
}: {
  label: string;
  value: React.ReactNode;
  tom?: Tom;
}) {
  const vazio = value == null || value === "" || value === "—";
  const t = vazio ? "cinza" : tom;
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 break-words text-base font-semibold leading-snug", TOM_TXT[t])}>
        {vazio ? "—" : value}
      </p>
    </div>
  );
}

function CampoSecundario({ label, value }: { label: string; value: React.ReactNode }) {
  const vazio = value == null || value === "" || value === "—";
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">{label}</p>
      <p className="mt-0.5 break-words text-sm text-muted-foreground">{vazio ? "—" : value}</p>
    </div>
  );
}

function MetricaResumo({
  label,
  value,
  tom = "cinza",
}: {
  label: string;
  value: React.ReactNode;
  tom?: Tom;
}) {
  const vazio = value == null || value === "" || value === "—";
  const t = vazio ? "cinza" : tom;
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", TOM_DOT[t])} />
        <span className={cn("truncate text-sm font-bold", TOM_TXT[t])}>{vazio ? "—" : value}</span>
      </div>
    </div>
  );
}

function ResultadoExecutivo({
  label,
  tom,
  title = "Resultado da elegibilidade",
}: {
  label: string;
  tom: Tom;
  title?: string;
}) {
  const Icon = tom === "verde" ? CheckCircle2 : tom === "vermelho" ? XCircle : AlertTriangle;
  return (
    <div className={cn("flex min-h-24 items-center gap-3.5 border p-3.5 sm:gap-4 sm:p-4", TOM_SURFACE[tom])}>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card/70", TOM_TXT[tom])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{title}</p>
        <p className={cn("mt-1 text-base font-bold leading-tight sm:text-lg", TOM_TXT[tom])}>{label}</p>
      </div>
    </div>
  );
}

function tomResultado(r?: string | null): Tom {
  if (!r || r === "Em análise") return "cinza";
  if (r === "Aprovado" || r === "Implantado") return "verde";
  if (r === "Aprovado com ressalva") return "amarelo";
  return "vermelho";
}

function dataHoraCurta(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${formatDateBR(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}


interface Props {
  implantacaoId: string;
  open: boolean;
  onClose: () => void;
  readOnly?: boolean;
}

export function AnaliseImplantacaoDialog({ implantacaoId, open, onClose, readOnly = false }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [obs, setObs] = useState("");
  const [motivo, setMotivo] = useState("");
  const [mode, setMode] = useState<"view" | "correcao" | "rejeicao">("view");
  const [atribuirOpen, setAtribuirOpen] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; type: string } | null>(null);
  const [loadingAnexo, setLoadingAnexo] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  const { data: impl } = useQuery({
    queryKey: ["impl-analise", implantacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes_contratos" as any)
        .select("*")
        .eq("id", implantacaoId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: open && !!implantacaoId,
  });

  const { data: processo } = useContratoProcessoPorImplantacao(open ? implantacaoId : null);
  const { data: itensValidacao = [] } = useValidacaoCruzada(open ? processo?.id : null);
  const { bloqueado: bloqueioCritico } = useBloqueioValidacaoCruzada(open ? processo?.id : null);
  const resumoCruzado = resumoValidacao(itensValidacao);

  const { data: anexos = [] } = useQuery({
    queryKey: ["impl-anexos", implantacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_anexos" as any)
        .select("*")
        .eq("implantacao_id", implantacaoId);
      if (error) throw error;
      return data as any[];
    },
    enabled: open && !!implantacaoId,
  });

  const aprovar = useMutation({
    mutationFn: async (resp: { userId: string; userNome: string }) => {
      const { error } = await supabase.rpc("aprovar_implantacao" as any, {
        p_impl: implantacaoId,
        p_observacao: obs || null,
        p_responsavel: resp.userId,
        p_responsavel_nome: resp.userNome,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["impl-alertas"] });
      toast({ title: "Contrato aprovado e atribuído ao Cadastro!" });
      setAtribuirOpen(false);
      onClose();
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao aprovar", variant: "destructive" }),
  });

  const corrigir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("solicitar_correcao_implantacao" as any, { p_impl: implantacaoId, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["impl-alertas"] });
      toast({ title: "Correção solicitada à equipe de Vendas" });
      onClose();
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao solicitar correção", variant: "destructive" }),
  });

  const rejeitar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("rejeitar_implantacao" as any, { p_impl: implantacaoId, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["impl-alertas"] });
      toast({ title: "Implantação rejeitada" });
      onClose();
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao rejeitar", variant: "destructive" }),
  });

  const liberar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("finalizar_implantacao_cadastro" as any, { p_impl: implantacaoId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["implantacoes-andamento"] });
      qc.invalidateQueries({ queryKey: ["impl-alertas"] });
      toast({ title: "Contrato liberado! Empresa criada automaticamente." });
      onClose();
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao liberar contrato", variant: "destructive" }),
  });

  const handleDownload = async (path: string, name: string) => {
    if (!path) {
      toast({ title: "Anexo sem caminho de arquivo", variant: "destructive" });
      return;
    }
    setLoadingAnexo(path);
    const { data, error } = await supabase.storage
      .from("anexos-implantacao")
      .download(path);
    setLoadingAnexo(null);
    if (error || !data) {
      toast({ title: "Erro ao carregar anexo", description: error?.message, variant: "destructive" });
      return;
    }
    const type = data.type || "application/octet-stream";
    const url = URL.createObjectURL(data);
    setPreview({ url, name, type });
  };


  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Análise de Implantação
          </DialogTitle>
          <DialogDescription>Revise os dados, anexos e histórico antes de aprovar ou solicitar correção.</DialogDescription>
        </DialogHeader>

        {!impl ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-5">
            {/* Resumo da Análise */}
            {(() => {
              const validacao: any = impl.relatorio_validacao || null;
              const divergenciasRelatorio = validacao ? Number(validacao.erros ?? 0) : null;
              const divergencias =
                divergenciasRelatorio == null && itensValidacao.length === 0
                  ? null
                  : (divergenciasRelatorio ?? 0) + resumoCruzado.divergentes;
              const pendencias = processo?.pendencias_abertas ?? 0;
              const statusProc = processo?.status || "";
              let risco: { label: string; tom: Tom };
              if (
                processo?.resultado_final === "Reprovado" ||
                statusProc.startsWith("pendencia") ||
                (divergencias ?? 0) > 0
              ) {
                risco = { label: "Alto", tom: "vermelho" };
              } else if (
                pendencias > 0 ||
                statusProc === "aguardando_documento_empresa" ||
                statusProc === "aprovado_ressalva" ||
                (validacao && Number(validacao.alertas ?? 0) > 0)
              ) {
                risco = { label: "Médio", tom: "amarelo" };
              } else if (!processo) {
                risco = { label: "Não analisado", tom: "cinza" };
              } else {
                risco = { label: "Baixo", tom: "verde" };
              }
              const sg = (processo?.status_geral || null) as ProcessoStatusGeral | null;
              const statusExibido = processo?.status
                ? statusLabel(processo.status)
                : impl.status === "implantado"
                ? "Implantado"
                : impl.status === "rejeitado"
                ? "Reprovado"
                : "Em análise";
              const statusTom: Tom =
                impl.status === "implantado" || processo?.resultado_final === "Aprovado" || processo?.resultado_final === "Implantado"
                  ? "verde"
                  : impl.status === "rejeitado" || processo?.resultado_final === "Reprovado"
                  ? "vermelho"
                  : statusProc.startsWith("pendencia") || statusProc === "aguardando_documento_empresa"
                  ? "amarelo"
                  : processo
                  ? "amarelo"
                  : "cinza";
              const resultadoExecutivo: { label: string; tom: Tom } =
                processo?.resultado_final === "Reprovado" || impl.status === "rejeitado" || resumoCruzado.criticas > 0
                  ? { label: "Não recomendado para aprovação", tom: "vermelho" }
                  : processo?.resultado_final === "Aprovado" || processo?.resultado_final === "Implantado" || impl.status === "implantado"
                  ? { label: "Apto para aprovação", tom: "verde" }
                  : pendencias > 0 || (divergencias ?? 0) > 0 || risco.tom === "amarelo" || risco.tom === "vermelho"
                  ? { label: "Necessita correção", tom: "amarelo" }
                  : !processo
                  ? { label: "Ainda não analisado", tom: "cinza" }
                  : { label: "Apto para aprovação", tom: "verde" };
              return (
                <section aria-labelledby="resumo-executivo-title" className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
                    <h4 id="resumo-executivo-title" className="text-sm font-semibold">Resumo executivo</h4>
                  </div>

                  <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(17rem,0.85fr)]">
                    <div className="min-w-0 p-4 sm:p-5">
                      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.7fr)_minmax(10rem,0.8fr)]">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Empresa</p>
                          <p className="mt-1 break-words text-base font-bold leading-snug text-foreground sm:text-lg">
                            {impl.nome_empresa || "—"}
                          </p>
                        </div>
                        <div className="min-w-0 sm:border-l sm:border-border sm:pl-4">
                          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Contrato</p>
                          <p className="mt-1 break-words font-mono text-sm font-bold text-foreground sm:text-base">
                            {processo?.codigo || impl.codigo_contrato || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-border pt-4 sm:grid-cols-4">
                        <MetricaExecutiva label="Status" value={statusExibido} tom={statusTom} />
                        <MetricaExecutiva label="Risco" value={risco.label} tom={risco.tom} />
                        <MetricaExecutiva label="Pendências" value={processo ? String(pendencias) : "—"} tom={pendencias > 0 ? "amarelo" : processo ? "verde" : "cinza"} />
                        <MetricaExecutiva
                          label="Divergências críticas"
                          value={itensValidacao.length === 0 ? "—" : String(resumoCruzado.criticas)}
                          tom={itensValidacao.length === 0 ? "cinza" : resumoCruzado.criticas > 0 ? "vermelho" : "verde"}
                        />
                      </div>
                    </div>

                    <ResultadoExecutivo label={resultadoExecutivo.label} tom={resultadoExecutivo.tom} />
                  </div>

                  <div className="border-t border-border bg-muted/10 p-4 sm:p-5">
                    <p className="mb-3 text-[10px] font-semibold uppercase text-muted-foreground">Detalhes do processo</p>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <ItemResumo label="CNPJ" value={impl.cnpj} tom="verde" />
                      <ItemResumo label="Contratado" value={impl.nome_empresa} tom="verde" />
                      <ItemResumo label="Tipo de vínculo" value={impl.tipo_contrato} tom="verde" />
                      <ItemResumo
                        label="Status geral"
                        value={sg ? statusGeralLabel(sg) : (processo ? null : "—")}
                        tom={sg === "concluido" ? "verde" : sg === "aguardando_pendencia" ? "amarelo" : sg === "cancelado" ? "vermelho" : sg ? "amarelo" : "cinza"}
                      />
                      <ItemResumo label="Setor atual" value={processo ? setorLabel(processo.setor_atual) : null} tom={processo ? "amarelo" : "cinza"} />
                      <ItemResumo label="Responsável atual" value={processo?.responsavel_atual_nome} tom={processo?.responsavel_atual_nome ? "verde" : "cinza"} />
                      <ItemResumo
                        label="Resultado da elegibilidade"
                        value={processo?.resultado_final}
                        tom={tomResultado(processo?.resultado_final)}
                      />
                      <ItemResumo
                        label="Divergências"
                        value={divergencias != null ? String(divergencias) : null}
                        tom={divergencias == null ? "cinza" : divergencias > 0 ? "vermelho" : "verde"}
                      />
                      <ItemResumo
                        label="Validação cruzada"
                        value={
                          itensValidacao.length === 0
                            ? null
                            : `${resumoCruzado.compativeis}/${resumoCruzado.total} compatíveis`
                        }
                        tom={
                          itensValidacao.length === 0
                            ? "cinza"
                            : resumoCruzado.criticas > 0
                            ? "vermelho"
                            : resumoCruzado.divergentes > 0
                            ? "amarelo"
                            : "verde"
                        }
                      />
                      <ItemResumo label="Vigência" value={formatDateBR(impl.data_vigencia)} tom={impl.data_vigencia ? "verde" : "cinza"} />
                      <ItemResumo label="Previsão de implantação" value={formatDateBR(impl.inicio_atendimento)} tom={impl.inicio_atendimento ? "amarelo" : "cinza"} />
                      <ItemResumo label="Última atualização" value={dataHoraCurta(processo?.ultima_movimentacao_em || impl.updated_at)} tom="verde" />
                      <ItemResumo label="Próxima ação" value={processo?.proxima_acao} tom={processo?.proxima_acao ? "amarelo" : "cinza"} />
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* Cabeçalho */}
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {impl.nome_empresa || "Empresa sem nome"}
                    </h3>
                    <p className="text-xs text-muted-foreground">CNPJ: {impl.cnpj || "—"} · Contrato: {impl.codigo_contrato || "—"}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Enviado por {impl.enviado_diretoria_por_nome || impl.created_by_nome || "—"}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2">
                  <div><p className="text-muted-foreground">Vidas Ativas</p><p className="font-semibold text-sm flex items-center gap-1"><Users className="h-3 w-3" />{impl.total_vidas ?? "—"}</p></div>
                  <div><p className="text-muted-foreground">Vigência</p><p className="font-semibold text-sm flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateBR(impl.data_vigencia)}</p></div>
                  <div><p className="text-muted-foreground">Acomodação</p><p className="font-semibold text-sm">{impl.acomodacao || "—"}</p></div>
                  <div><p className="text-muted-foreground">Modalidade</p><p className="font-semibold text-sm">{impl.modalidade || "—"}</p></div>
                  <div><p className="text-muted-foreground">Tipo de Contrato</p><p className="font-semibold text-sm">{impl.tipo_contrato || "—"}</p></div>
                  <div><p className="text-muted-foreground">Período Movimentação</p><p className="font-semibold text-sm">{impl.periodo_movimentacao || "—"}</p></div>
                  <div><p className="text-muted-foreground">Dia Vencimento</p><p className="font-semibold text-sm flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDay(impl.data_vencimento)}</p></div>
                </div>

              </CardContent>
            </Card>

            {/* Anexos */}
            <div>
              {(() => {
                const isAnexoCadastro = (a: any) => {
                  const tipo = String(a.tipo || "").toLowerCase();
                  const nome = String(a.nome_arquivo || "").toLowerCase();
                  if (tipo === "anexo_1" || tipo === "relatorio_vidas") return true;
                  if (nome.includes("anexo") && nome.includes("1")) return true;
                  if (nome.includes("layout") && nome.includes("vida")) return true;
                  if ((nome.includes("relatorio") || nome.includes("relatório")) && nome.includes("vida")) return true;
                  return false;
                };
                const visiveis = readOnly ? anexos.filter(isAnexoCadastro) : anexos;
                return (
                  <>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      {readOnly ? "Documentos para importação" : "Documentos enviados pelo Vendas"} ({visiveis.length})
                    </h4>
                    {readOnly && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Você visualiza apenas o Anexo 1 e o Layout de Vidas necessários para a importação.
                      </p>
                    )}
                    {visiveis.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {readOnly ? "Sem Anexo 1 ou Layout de Vidas anexado." : "Sem anexos."}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {visiveis.map((a: any) => (
                          <button key={a.id} onClick={() => handleDownload(a.storage_path, a.nome_arquivo)} disabled={loadingAnexo === a.storage_path}
                            className="flex items-center gap-2 text-left text-sm p-2 rounded-lg border hover:bg-accent transition-colors">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <span className="truncate flex-1">{loadingAnexo === a.storage_path ? "Carregando anexo…" : a.nome_arquivo}</span>
                            {a.tipo && <Badge variant="secondary" className="text-[10px]">{a.tipo}</Badge>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Dados para Implantação (oriundos do Anexo 1) */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Dados para Implantação</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs p-3 rounded-lg border bg-muted/30">
                <div><p className="text-muted-foreground">Telefone</p><p className="font-semibold text-sm">{impl.telefone || "—"}</p></div>
                <div><p className="text-muted-foreground">Inscrição Municipal</p><p className="font-semibold text-sm">{impl.inscricao_municipal || "—"}</p></div>
                <div><p className="text-muted-foreground">Inscrição Estadual</p><p className="font-semibold text-sm">{impl.inscricao_estadual || "—"}</p></div>
                <div className="md:col-span-2"><p className="text-muted-foreground">Endereço</p><p className="font-semibold text-sm">{impl.endereco || "—"}</p></div>
                <div><p className="text-muted-foreground">CEP</p><p className="font-semibold text-sm">{impl.cep || "—"}</p></div>
                <div><p className="text-muted-foreground">Grupo Contrato</p><p className="font-semibold text-sm">{impl.grupo_contrato || "—"}</p></div>
                <div><p className="text-muted-foreground">Vidas Ativas Titulares</p><p className="font-semibold text-sm">{impl.vidas_titulares ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Vidas Ativas Dependentes</p><p className="font-semibold text-sm">{impl.vidas_dependentes ?? "—"}</p></div>
              </div>
            </div>

            {/* Dados Comerciais */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Dados Comerciais</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs p-3 rounded-lg border bg-muted/30">
                <div><p className="text-muted-foreground">Valor Enfermaria</p><p className="font-semibold text-sm">{impl.valor_enfermaria_centavos != null ? formatCentavosBRL(impl.valor_enfermaria_centavos) : "—"}</p></div>
                <div><p className="text-muted-foreground">Valor Apartamento</p><p className="font-semibold text-sm">{impl.valor_apartamento_centavos != null ? formatCentavosBRL(impl.valor_apartamento_centavos) : "—"}</p></div>
                <div><p className="text-muted-foreground">% Agenciamento</p><p className="font-semibold text-sm">{impl.percentual_agenciamento != null ? `${Number(impl.percentual_agenciamento).toFixed(2).replace(".", ",")}%` : "—"}</p></div>
                <div><p className="text-muted-foreground">% Vitalício</p><p className="font-semibold text-sm">{impl.percentual_vitalicio != null ? `${Number(impl.percentual_vitalicio).toFixed(2).replace(".", ",")}%` : "—"}</p></div>
                <div><p className="text-muted-foreground">Corretora</p><p className="font-semibold text-sm">{impl.corretora || "—"}</p></div>
                <div><p className="text-muted-foreground">Código do Contrato</p><p className="font-semibold text-sm">{impl.codigo_contrato || "—"}</p></div>
              </div>
            </div>

            {/* Validação Cruzada das análises do contrato */}
            {processo && (
              <div className="pt-2 border-t">
                <ValidacaoCruzadaSection processoId={processo.id} implantacaoId={implantacaoId} />
              </div>
            )}

            {bloqueioCritico && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Conclusão bloqueada: há divergência crítica na validação cruzada. Resolva a pendência gerada no setor
                  responsável para liberar a aprovação.
                </span>
              </div>
            )}

            {/* Ação Cadastro: Liberar contrato */}
            {readOnly && impl.status !== "implantado" && impl.status !== "rejeitado" && (
              <div className="pt-2 border-t">
                <Button
                  onClick={() => liberar.mutate()}
                  disabled={liberar.isPending || bloqueioCritico}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Rocket className="h-4 w-4" /> {liberar.isPending ? "Liberando…" : "Liberar contrato"}
                </Button>
              </div>
            )}

            {!readOnly && mode === "view" && (
              <div className="space-y-3 pt-2 border-t">
                <div>
                  <label className="text-sm font-medium">Observação (opcional)</label>
                  <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Comentário para o cadastro…" rows={2} />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={() => setAtribuirOpen(true)} disabled={aprovar.isPending || bloqueioCritico} className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Aprovar e enviar ao Cadastro
                  </Button>
                  <Button onClick={() => setMode("correcao")} variant="outline" className="gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4" /> Solicitar correção
                  </Button>
                  <Button onClick={() => setMode("rejeicao")} variant="outline" className="gap-2 border-red-500/50 text-red-600 hover:bg-red-500/10">
                    <XCircle className="h-4 w-4" /> Rejeitar
                  </Button>
                </div>
              </div>
            )}

            {!readOnly && mode !== "view" && (
              <div className="space-y-3 pt-2 border-t">
                <div>
                  <label className="text-sm font-medium">
                    {mode === "correcao" ? "Motivo da correção" : "Motivo da rejeição"} *
                  </label>
                  <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
                    placeholder={mode === "correcao" ? "Descreva o que precisa ser ajustado…" : "Descreva o motivo da rejeição…"} />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setMode("view"); setMotivo(""); }}>Cancelar</Button>
                  <Button
                    disabled={!motivo.trim() || corrigir.isPending || rejeitar.isPending}
                    onClick={() => mode === "correcao" ? corrigir.mutate() : rejeitar.mutate()}
                    className={mode === "correcao" ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"}
                  >
                    {mode === "correcao" ? "Enviar para correção" : "Confirmar rejeição"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
      <SelecionarResponsavelCadastroDialog
        open={atribuirOpen}
        onClose={() => setAtribuirOpen(false)}
        onConfirm={(userId, userNome) => aprovar.mutate({ userId, userNome })}
        loading={aprovar.isPending}
      />
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.name || "Anexo"}</DialogTitle>
            <DialogDescription>Visualização do anexo sem abrir o domínio do arquivo em outra aba.</DialogDescription>
          </DialogHeader>
          {preview && preview.type.startsWith("image/") ? (
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/30 p-3">
              <img src={preview.url} alt={preview.name} className="mx-auto max-h-full max-w-full object-contain" />
            </div>
          ) : preview && preview.type === "application/pdf" ? (
            <iframe title={preview.name} src={preview.url} className="min-h-0 flex-1 rounded-lg border" />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Este tipo de arquivo não tem pré-visualização no navegador. Use o botão abaixo para baixar.
            </div>
          )}
          {preview && (
            <div className="flex justify-end">
              <Button asChild variant="outline">
                <a href={preview.url} download={preview.name}>Baixar anexo</a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
