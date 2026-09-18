import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGrupoFinanceiro } from "@/hooks/useGrupoFinanceiro";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paperclip, Download, Trash2, Upload, FileText, AlertCircle, CheckCircle2, Users, CalendarClock, Receipt, CalendarIcon, X, Info } from "lucide-react";
import { useSessionState } from "@/hooks/useSessionState";
import { Checkbox } from "@/components/ui/checkbox";

import { cn } from "@/lib/utils";
import { DayGridPicker } from "@/components/ui/day-grid-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import { formatDateBR } from "@/lib/date-utils";
import {
  type FinanceiroMovimentacao,
  ACCEPTED_FILE_TYPES,
  buildStoragePath,
  formatBytes,
  TIPOS_FINANCEIRO,
  calcularDiaEmissaoPadrao,
} from "@/lib/financeiro-utils";
import { aplicarOffsetCompetencia } from "@/lib/historico-utils";
import { todayLocalISO } from "@/lib/date-utils";
import { validarRelatorioVidas } from "@/lib/relatorio-vidas-validator";
import {
  extrairMetadadosNfse,
  montarNomeArquivoNfse,
  gerarNomeUnico,
  deveRenomearPdf,
} from "@/lib/nfse-rename";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getPagadoresDoContrato,
  replicarFinanceiroParaPagadores,
  replicarAnexosParaPagadores,
  type Pagador,
} from "@/lib/pagadores-utils";

type FinanceiroMovimentacaoExt = FinanceiroMovimentacao & {
  data_vencimento?: string | null;
  dia_emissao?: number | null;
  tipo_analise?: string | null;
  possui_prorrogacao?: boolean | null;
  data_prorrogacao?: string | null;
  motivo_prorrogacao?: string | null;
  observacao_prorrogacao?: string | null;
  boleto_dda?: boolean | null;
  boleto_confirmado_por?: string | null;
  boleto_confirmado_em?: string | null;
};

const MOTIVOS_PRORROGACAO = [
  "Solicitado pela empresa",
  "Atraso Financeiro",
  "Atraso Cadastro",
  "Outros",
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimentacao: FinanceiroMovimentacaoExt | null;
  empresaNome?: string;
}

const TIPOS_ANALISE = [
  { value: "normal", label: "Análise normal" },
  { value: "faixa_etaria", label: "Análise faixa etária" },
  { value: "moto_honda", label: "Análise Moto Honda" },
] as const;

export function EditarMovimentacaoDialog({ open, onOpenChange, movimentacao, empresaNome }: Props) {
  const queryClient = useQueryClient();
  const { user, canEditFinanceiro, isAdmin } = useAuth();
  const [tipoCobranca, setTipoCobranca] = useState("");
  const [dataEnvioNota, setDataEnvioNota] = useState("");
  const [dataEnvioOpen, setDataEnvioOpen] = useState(false);
  const [diaVencimento, setDiaVencimento] = useState<string>("__none__");
  const [diaEmissao, setDiaEmissao] = useState<string>("__none__");
  const [tipoAnalise, setTipoAnalise] = useState<string>("normal");
  const [dentroPrazo, setDentroPrazo] = useState(true);
  const [possuiProrrogacao, setPossuiProrrogacao] = useState(false);
  const [dataProrrogacao, setDataProrrogacao] = useState("");
  const [motivoProrrogacao, setMotivoProrrogacao] = useState<string>("");
  const [observacaoProrrogacao, setObservacaoProrrogacao] = useState("");
  const [boletoDda, setBoletoDda] = useState(false);
  const [boletoConfirmadoPor, setBoletoConfirmadoPor] = useState<string | null>(null);
  const [boletoConfirmadoEm, setBoletoConfirmadoEm] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [baixandoZip, setBaixandoZip] = useState(false);
  const [replicaConfirm, setReplicaConfirm] = useState<{
    title: string;
    description: string;
    onTodos: () => void | Promise<void>;
    onApenas: () => void | Promise<void>;
    pagadores: Pagador[];
  } | null>(null);
  const [aplicarEnvioATodos, setAplicarEnvioATodos] = useState<boolean>(true);
  const [grupoConfirm, setGrupoConfirm] = useState<{
    grupoNome: string;
    acoes: { envio?: string | null; vencimento?: string | null; dda?: boolean | null };
    onTodos: () => Promise<void>;
    onApenas: () => void;
  } | null>(null);

  useEffect(() => {
    if (movimentacao) {
      setTipoCobranca(movimentacao.tipo_cobranca || "");
      setDataEnvioNota(movimentacao.data_envio_nota || "");
      // extrai apenas o dia da data_vencimento (YYYY-MM-DD)
      const v = movimentacao.data_vencimento;
      if (v) {
        const m = v.match(/^\d{4}-\d{2}-(\d{2})$/);
        setDiaVencimento(m ? String(parseInt(m[1], 10)) : "__none__");
      } else {
        setDiaVencimento("__none__");
      }
      if (movimentacao.dia_emissao) {
        setDiaEmissao(String(movimentacao.dia_emissao));
      } else {
        const padrao = calcularDiaEmissaoPadrao(movimentacao.periodo);
        setDiaEmissao(padrao ? String(padrao) : "__none__");
      }
      setTipoAnalise((movimentacao.tipo_analise as string) || "normal");
      setDentroPrazo(movimentacao.dentro_prazo);
      setPossuiProrrogacao(!!movimentacao.possui_prorrogacao);
      setDataProrrogacao(movimentacao.data_prorrogacao || "");
      setMotivoProrrogacao(movimentacao.motivo_prorrogacao || "");
      setObservacaoProrrogacao(movimentacao.observacao_prorrogacao || "");
      setBoletoDda(!!movimentacao.boleto_dda);
      setBoletoConfirmadoPor(movimentacao.boleto_confirmado_por ?? null);
      setBoletoConfirmadoEm(movimentacao.boleto_confirmado_em ?? null);
    }
    setSelecionados(new Set());
  }, [movimentacao?.id]);

  useEffect(() => {
    if (!open) setSelecionados(new Set());
  }, [open]);

  // Validações campo-a-campo (avisos discretos, não bloqueiam edição manual)
  const tipoTrimmed = tipoCobranca.trim();

  const hoje = todayLocalISO();
  const envioNoFuturo = dataEnvioNota && dataEnvioNota > hoje;

  const prorrogacaoFaltaData = possuiProrrogacao && !dataProrrogacao;
  const prorrogacaoFaltaMotivo = possuiProrrogacao && !motivoProrrogacao;
  const prorrogacaoFaltaObs =
    possuiProrrogacao && motivoProrrogacao === "Outros" && !observacaoProrrogacao.trim();

  const hasErrors =
    !!envioNoFuturo || prorrogacaoFaltaData || prorrogacaoFaltaMotivo || prorrogacaoFaltaObs;

  const { data: anexos = [] } = useQuery({
    queryKey: ["financeiro-anexos", movimentacao?.id, movimentacao?.mes_referencia, movimentacao?.periodo],
    queryFn: async () => {
      if (!movimentacao) return [];
      // 1) Anexos próprios desta movimentação
      const { data: own, error } = await supabase
        .from("anexos_financeiro")
        .select("*")
        .eq("financeiro_movimentacao_id", movimentacao.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ownList = (own ?? []) as any[];

      // 2) Anexos compartilhados pelo grupo (outros contratos do mesmo grupo, mesmo período)
      const { data: vinc } = await supabase
        .from("grupos_financeiros_contratos" as any)
        .select("grupo_id")
        .eq("empresa_id", movimentacao.empresa_id)
        .eq("ativo", true)
        .maybeSingle();
      const grupoId = (vinc as any)?.grupo_id as string | undefined;
      if (!grupoId) return ownList;

      // Empresas irmãs do grupo
      const { data: irmaos } = await supabase
        .from("grupos_financeiros_contratos" as any)
        .select("empresa_id")
        .eq("grupo_id", grupoId)
        .eq("ativo", true);
      const empresasIrmas = ((irmaos as any[]) ?? [])
        .map((r) => r.empresa_id)
        .filter((id) => id && id !== movimentacao.empresa_id);
      if (!empresasIrmas.length) return ownList;

      // Movimentações irmãs no mesmo período
      const { data: movsIrmas } = await supabase
        .from("financeiro_movimentacoes")
        .select("id, empresa_id")
        .in("empresa_id", empresasIrmas)
        .eq("mes_referencia", movimentacao.mes_referencia)
        .eq("periodo", movimentacao.periodo);
      const movIrmasIds = ((movsIrmas as any[]) ?? []).map((m) => m.id);
      if (!movIrmasIds.length) return ownList;

      const { data: grupoRaw } = await supabase
        .from("anexos_financeiro")
        .select("*")
        .in("financeiro_movimentacao_id", movIrmasIds)
        .order("created_at", { ascending: false });
      const grupoList = (grupoRaw ?? []) as any[];
      const existingPaths = new Set(ownList.map((a) => a.storage_path));
      const extras = grupoList
        .filter((a) => !existingPaths.has(a.storage_path))
        .map((a) => ({ ...a, _compartilhado_grupo: true }));

      return [...ownList, ...extras];
    },
    enabled: !!movimentacao && open,
  });

  // Pagadores do mesmo contrato (para sincronização)
  const { data: empresaCfg } = useQuery({
    queryKey: ["financeiro-empresa-cfg", movimentacao?.empresa_id],
    queryFn: async () => {
      if (!movimentacao) return null;
      const { data } = await supabase
        .from("empresas")
        .select("codigo_contrato, pagamento_via_deposito, exige_po_pc, envio_boleto_com_nota, tem_coparticipacao, observacao_padrao_financeiro, vencimento_competencia")
        .eq("id", movimentacao.empresa_id)
        .maybeSingle();
      return data;

    },
    enabled: !!movimentacao && open,
  });

  const { data: pagadores = [] } = useQuery({
    queryKey: ["financeiro-pagadores", movimentacao?.empresa_id, empresaCfg?.codigo_contrato],
    queryFn: async () => {
      if (!movimentacao) return [] as Pagador[];
      return getPagadoresDoContrato(movimentacao.empresa_id, empresaCfg?.codigo_contrato);
    },
    enabled: !!movimentacao && open && empresaCfg !== undefined,
  });

  const { data: grupoData } = useGrupoFinanceiro(movimentacao?.empresa_id);
  const grupoAtivo = grupoData?.grupo ?? null;

  const pagamentoViaDeposito = !!(empresaCfg as any)?.pagamento_via_deposito;
  const exigePoPc = !!(empresaCfg as any)?.exige_po_pc;
  const envioBoletoComNota = !!(empresaCfg as any)?.envio_boleto_com_nota;
  const temCoparticipacao = !!(empresaCfg as any)?.tem_coparticipacao;
  const observacaoEmpresa =
    ((empresaCfg as any)?.observacao_padrao_financeiro || "").toString().trim() || null;

  const irmaos = pagadores.filter((p) => p.id !== movimentacao?.empresa_id);
  const temIrmaos = irmaos.length > 0;

  // Aviso de observações da empresa (boleto, coparticipação, PO/PC, observação livre).
  // Some quando há algum item e a nota ainda não foi enviada. Pode ser dispensado.
  const [avisoDismissed, setAvisoDismissed] = useSessionState<boolean>(
    `financeiro:aviso-obs:${movimentacao?.id ?? "none"}`,
    false,
  );
  const temAvisos = exigePoPc || envioBoletoComNota || temCoparticipacao || !!observacaoEmpresa;


  // Nome de quem confirmou o boleto DDA
  const { data: confirmadorNome } = useQuery({
    queryKey: ["profile-name", boletoConfirmadoPor],
    queryFn: async () => {
      if (!boletoConfirmadoPor) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", boletoConfirmadoPor)
        .maybeSingle();
      return data?.display_name ?? null;
    },
    enabled: !!boletoConfirmadoPor,
  });

  // Nome de quem enviou a nota
  const enviadoPorId = (movimentacao as any)?.enviado_por_user_id as string | null | undefined;
  const { data: enviadoPorNome } = useQuery({
    queryKey: ["profile-name", enviadoPorId],
    queryFn: async () => {
      if (!enviadoPorId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", enviadoPorId)
        .maybeSingle();
      return data?.display_name ?? null;
    },
    enabled: !!enviadoPorId,
  });

  // Nota emitida = existe anexo PDF de faturamento OU data_envio_nota preenchida.
  // Anexos de Reajuste/Cobrança Retroativa não contam.
  // Espelha a lógica de calcularStatusFinanceiro em src/lib/financeiro-utils.ts.
  const notaEmitida =
    !!dataEnvioNota ||
    anexos.some((a: any) => {
      const origem = (a.origem || "normal").toLowerCase();
      if (origem === "retroativo" || origem === "reajuste") return false;
      const mime = (a.mime_type || "").toLowerCase();
      const nome = (a.nome_arquivo || "").toLowerCase();
      return mime.includes("pdf") || nome.endsWith(".pdf");
    });

  const podeAlterarBoletoDda = isAdmin || (canEditFinanceiro && notaEmitida);

  const handleToggleBoletoDda = (checked: boolean) => {
    if (!podeAlterarBoletoDda) return;
    setBoletoDda(checked);
    if (checked) {
      setBoletoConfirmadoPor(user?.id ?? null);
      setBoletoConfirmadoEm(new Date().toISOString());
    } else {
      setBoletoConfirmadoPor(null);
      setBoletoConfirmadoEm(null);
    }
  };

  const buildPayload = () => {
    if (!movimentacao) return null;
    const envioAlterado =
      !!dataEnvioNota && dataEnvioNota !== (movimentacao.data_envio_nota || "");
    let dataVencimentoIso: string | null = null;
    if (diaVencimento !== "__none__") {
      const dia = parseInt(diaVencimento, 10);
      const mes = movimentacao.mes_referencia;
      if (mes && /^\d{4}-\d{2}$/.test(mes) && dia >= 1 && dia <= 31) {
        // Regra da empresa: vencimento no mês anterior / atual / posterior à competência
        const base = aplicarOffsetCompetencia(
          Number(mes.slice(5, 7)) - 1,
          Number(mes.slice(0, 4)),
          (empresaCfg as any)?.vencimento_competencia,
        );
        const ultimoDia = new Date(base.ano, base.mes0 + 1, 0).getDate();
        const diaFinal = Math.min(dia, ultimoDia);
        dataVencimentoIso = `${base.ano}-${String(base.mes0 + 1).padStart(2, "0")}-${String(diaFinal).padStart(2, "0")}`;
      }
    }
    const payload: Record<string, unknown> = {
      tipo_cobranca: tipoTrimmed || null,
      data_envio_nota: dataEnvioNota || null,
      data_vencimento: dataVencimentoIso,
      dia_emissao: diaEmissao === "__none__" ? null : Number(diaEmissao),
      tipo_analise: tipoAnalise || "normal",
      dentro_prazo: dentroPrazo,
      possui_prorrogacao: possuiProrrogacao,
      data_prorrogacao: possuiProrrogacao ? dataProrrogacao || null : null,
      motivo_prorrogacao: possuiProrrogacao ? motivoProrrogacao || null : null,
      observacao_prorrogacao:
        possuiProrrogacao && motivoProrrogacao === "Outros"
          ? observacaoProrrogacao.trim() || null
          : null,
      boleto_dda: boletoDda,
      boleto_confirmado_por: boletoDda ? boletoConfirmadoPor : null,
      boleto_confirmado_em: boletoDda ? boletoConfirmadoEm : null,
    };
    if (envioAlterado && user?.id) {
      payload.enviado_por_user_id = user.id;
    } else if (!dataEnvioNota) {
      payload.enviado_por_user_id = null;
    }
    const vencimentoAlterado = (dataVencimentoIso || null) !== (movimentacao.data_vencimento || null);
    const ddaAlterado = !!boletoDda !== !!movimentacao.boleto_dda;
    const novoDiaEmissao = diaEmissao === "__none__" ? null : Number(diaEmissao);
    const diaEmissaoAlterado = (novoDiaEmissao ?? null) !== (movimentacao.dia_emissao ?? null);
    return { payload, envioAlterado, vencimentoAlterado, ddaAlterado, diaEmissaoAlterado, novoDiaEmissao, dataVencimentoIso };
  };

  const TIPOS_FIN_VALIDOS = new Set([
    "NÃO-PRORATA",
    "INCLUSÃO",
    "INCLUSÃO/EXCLUSÃO",
    "INCLUSÃO/EXCLUSÃO/COPAR",
    "TAXA ADESÃO",
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!movimentacao) return null;
      const built = buildPayload();
      if (!built) return null;
      const { error } = await supabase
        .from("financeiro_movimentacoes")
        .update(built.payload as any)
        .eq("id", movimentacao.id);
      if (error) throw error;

      // Sincroniza o Tipo (Financeiro) na empresa quando alterado aqui.
      // O trigger trg_sync_tipo_cobranca_from_empresa propaga para todas as competências.
      const novoTipo = tipoTrimmed || null;
      if (
        novoTipo &&
        TIPOS_FIN_VALIDOS.has(novoTipo) &&
        novoTipo !== (movimentacao.tipo_cobranca || null)
      ) {
        await supabase
          .from("empresas")
          .update({ tipo_financeiro: novoTipo, updated_at: new Date().toISOString() } as any)
          .eq("id", movimentacao.empresa_id);
      }

      // Persiste o Tipo de Análise para TODAS as competências/pagadores da empresa,
      // para que a escolha do usuário seja lembrada nas próximas análises.
      const novoTipoAnalise = tipoAnalise || "normal";
      if (novoTipoAnalise !== ((movimentacao.tipo_analise as string) || "normal")) {
        await supabase
          .from("financeiro_movimentacoes")
          .update({ tipo_analise: novoTipoAnalise } as any)
          .eq("empresa_id", movimentacao.empresa_id);
      }

      return built;
    },
    onSuccess: async (built) => {
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dia-emissao-financeiro"] });
      toast.success("Movimentação atualizada");

      // Replicação Grupo Financeiro (vencimento + dia de emissão) — sempre ocorre
      // quando há grupo ativo, INDEPENDENTE de a empresa ter pagadores irmãos.
      const b = built as any;
      if (b && grupoAtivo && movimentacao) {
        try {
          if (b.vencimentoAlterado) {
            await supabase.rpc("aplicar_vencimento_grupo" as any, {
              p_mov_id: movimentacao.id,
              p_data_vencimento: b.dataVencimentoIso || null,
            });
          }
          if (b.diaEmissaoAlterado) {
            await supabase.rpc("aplicar_dia_emissao_grupo" as any, {
              p_mov_id: movimentacao.id,
              p_dia_emissao: b.novoDiaEmissao,
            });
          }
          if (b.vencimentoAlterado || b.diaEmissaoAlterado) {
            toast.success(`Vencimento/Dia de emissão replicados ao grupo ${grupoAtivo.nome_grupo}`);
            queryClient.invalidateQueries({ queryKey: ["financeiro"] });
          }
        } catch (e: any) {
          toast.error("Erro ao replicar ao grupo: " + e.message);
        }
      }

      // Se contrato tem múltiplos pagadores, pergunta se replica
      if (built && temIrmaos && movimentacao) {
        // Atalho: usuário marcou "aplicar a todos" — replica direto sem perguntar
        if (aplicarEnvioATodos) {
          try {
            const r = await replicarFinanceiroParaPagadores({
              empresaIdOrigem: movimentacao.empresa_id,
              codigoContrato: pagadores[0]?.codigo_contrato,
              mesReferencia: movimentacao.mes_referencia,
              periodo: movimentacao.periodo,
              payload: built.payload,
            });
            toast.success(
              `Replicado para pagadores: ${r.atualizados} atualizado(s), ${r.criados} criado(s)`,
            );
            queryClient.invalidateQueries({ queryKey: ["financeiro"] });
          } catch (e: any) {
            toast.error("Erro ao replicar: " + e.message);
          } finally {
            onOpenChange(false);
          }
          return;
        }
        setReplicaConfirm({
          title: "Aplicar a todos os pagadores?",
          description: `O contrato tem ${pagadores.length} pagadores: ${pagadores.map((p) => p.nome).join(", ")}. Deseja aplicar esta alteração para todos os pagadores do contrato?`,
          pagadores,
          onTodos: async () => {
            try {
              const r = await replicarFinanceiroParaPagadores({
                empresaIdOrigem: movimentacao.empresa_id,
                codigoContrato: pagadores[0]?.codigo_contrato,
                mesReferencia: movimentacao.mes_referencia,
                periodo: movimentacao.periodo,
                payload: built.payload,
              });
              toast.success(
                `Replicado: ${r.atualizados} atualizado(s), ${r.criados} criado(s)`,
              );
              queryClient.invalidateQueries({ queryKey: ["financeiro"] });
            } catch (e: any) {
              toast.error("Erro ao replicar: " + e.message);
            } finally {
              setReplicaConfirm(null);
              onOpenChange(false);
            }
          },
          onApenas: () => {
            setReplicaConfirm(null);
            onOpenChange(false);
          },
        });
      } else {
        // Checagem de Grupo Financeiro (envio de nota e DDA — exigem confirmação).
        if (grupoAtivo && movimentacao) {
          if (b?.envioAlterado || b?.ddaAlterado) {
            setGrupoConfirm({
              grupoNome: grupoAtivo.nome_grupo,
              acoes: {
                envio: b?.envioAlterado ? dataEnvioNota : null,
                vencimento: null,
                dda: b?.ddaAlterado ? boletoDda : null,
              },
              onTodos: async () => {
                try {
                  if (b?.envioAlterado) {
                    await supabase.rpc("aplicar_envio_nota_grupo" as any, {
                      p_mov_id: movimentacao.id,
                      p_data_envio: dataEnvioNota || null,
                    });
                  }
                  if (b?.ddaAlterado) {
                    await supabase.rpc("aplicar_dda_grupo" as any, {
                      p_mov_id: movimentacao.id,
                      p_boleto_dda: !!boletoDda,
                      p_pagamento_deposito: !!pagamentoViaDeposito,
                    });
                  }
                  toast.success(`Alterações aplicadas ao grupo ${grupoAtivo.nome_grupo}`);
                  queryClient.invalidateQueries({ queryKey: ["financeiro"] });
                } catch (e: any) {
                  toast.error("Erro ao aplicar no grupo: " + e.message);
                } finally {
                  setGrupoConfirm(null);
                  onOpenChange(false);
                }
              },
              onApenas: () => {
                setGrupoConfirm(null);
                onOpenChange(false);
              },
            });
          } else {
            onOpenChange(false);
          }
        } else {
          onOpenChange(false);
        }
      }
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0 || !movimentacao) return;
    setUploading(true);
    let sucessos = 0;
    const erros: string[] = [];
    // Cache local dos nomes já usados nesta movimentação (para dedupe imediato
    // entre múltiplos uploads do mesmo lote, antes do refetch).
    const nomesExistentes: string[] = (anexos ?? []).map((a: any) => a.nome_arquivo);
    try {
      for (const file of files) {
        try {
          const ext = (file.name.split(".").pop() || "").toLowerCase();
          const isPdf = ext === "pdf" || file.type === "application/pdf";
          let nomeFinal = file.name;
          let bufferCache: ArrayBuffer | null = null;

          // Auto-renomeio do PDF (NFS-e) → "NF <TOMADOR> <NUMERO>.pdf"
          // Só renomeia quando o nome original é uma chave numérica/UUID.
          // Se o usuário já enviou no padrão correto, preserva.
          if (isPdf && deveRenomearPdf(file.name)) {
            try {
              bufferCache = await file.arrayBuffer();
              const meta = await extrairMetadadosNfse(bufferCache.slice(0));
              if (!meta.leituraOk) {
                toast.warning(
                  "Não foi possível ler automaticamente este PDF. O arquivo será salvo com o nome original ou poderá ser renomeado manualmente.",
                );
              } else {
                if (!meta.nfNumero) {
                  toast.warning(
                    "Não foi possível identificar automaticamente o número da NFS-e. Informe manualmente.",
                  );
                }
                if (!meta.tomadorNome) {
                  toast.warning(
                    "Não foi possível identificar automaticamente o tomador da NFS-e. Informe manualmente.",
                  );
                }
                const proposto = montarNomeArquivoNfse(meta.tomadorNome, meta.nfNumero);
                if (proposto) {
                  nomeFinal = gerarNomeUnico(proposto, nomesExistentes);
                  toast.success(
                    `PDF identificado e renomeado com sucesso.\nTomador: ${meta.tomadorNome}\nNº NFS-e: ${meta.nfNumero}\nArquivo: ${nomeFinal}`,
                  );
                }
              }
            } catch (errRename) {
              console.warn("Falha ao renomear PDF da NFS-e:", errRename);
              toast.warning(
                "Não foi possível ler automaticamente este PDF. O arquivo será salvo com o nome original ou poderá ser renomeado manualmente.",
              );
            }
          }

          const path = buildStoragePath(movimentacao.empresa_id, movimentacao.id, nomeFinal);
          const { error: upErr } = await supabase.storage
            .from("anexos-financeiro")
            .upload(path, file);
          if (upErr) throw upErr;

          const { error: insErr } = await supabase.from("anexos_financeiro").insert({
            financeiro_movimentacao_id: movimentacao.id,
            nome_arquivo: nomeFinal,
            storage_path: path,
            mime_type: file.type,
            tamanho_bytes: file.size,
            uploaded_by: user?.id ?? null,
            // Vincula ao grupo financeiro (se houver) para compartilhar com outros contratos
            ...(grupoAtivo
              ? {
                  grupo_id: grupoAtivo.id,
                  compartilhado_grupo: true,
                  contrato_origem_id: movimentacao.id,
                }
              : {}),
          } as any);
          if (insErr) throw insErr;

          nomesExistentes.push(nomeFinal);

          if (["xlsx", "xlsm", "xls"].includes(ext)) {
            const buffer = bufferCache ?? (await file.arrayBuffer());
            const sig = new Uint8Array(buffer.slice(0, 4));
            if (sig[0] === 0x50 && sig[1] === 0x4b) {
              const result = await validarRelatorioVidas(buffer);
              const vidas = result?.total_vidas ?? 0;
              if (vidas > 0) {
                const { error: updErr } = await supabase
                  .from("empresas")
                  .update({ vidas, updated_at: new Date().toISOString() })
                  .eq("id", movimentacao.empresa_id);
                if (updErr) throw updErr;
                queryClient.invalidateQueries({ queryKey: ["empresas"] });
                queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
                queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
                toast.success(`Vidas Ativas atualizadas pelo layout: ${vidas}`);
              }
            }
          }
          sucessos += 1;
        } catch (err: any) {
          erros.push(`${file.name}: ${err.message}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["financeiro-anexos", movimentacao.id] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-anexos-list"] });

      if (sucessos > 0) {
        toast.success(
          sucessos === 1 ? "Arquivo enviado" : `${sucessos} arquivos enviados`,
        );
        // Pergunta se replica anexos para os outros pagadores do contrato
        if (temIrmaos && movimentacao) {
          setReplicaConfirm({
            title: "Replicar anexos para todos os pagadores?",
            description: `O contrato tem ${pagadores.length} pagadores. Deseja copiar os arquivos enviados para os outros pagadores do contrato?`,
            pagadores,
            onTodos: async () => {
              try {
                const n = await replicarAnexosParaPagadores({
                  movimentacaoOrigemId: movimentacao.id,
                  empresaIdOrigem: movimentacao.empresa_id,
                  codigoContrato: pagadores[0]?.codigo_contrato,
                  mesReferencia: movimentacao.mes_referencia,
                  periodo: movimentacao.periodo,
                });
                toast.success(`${n} anexo(s) replicado(s)`);
                queryClient.invalidateQueries({ queryKey: ["financeiro-anexos-list"] });
                queryClient.invalidateQueries({ queryKey: ["financeiro"] });
              } catch (e: any) {
                toast.error("Erro ao replicar anexos: " + e.message);
              } finally {
                setReplicaConfirm(null);
              }
            },
            onApenas: () => setReplicaConfirm(null),
          });
        }
      }
      if (erros.length > 0) {
        toast.error(`Falha em ${erros.length} arquivo(s): ${erros.join(" | ")}`);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (path: string, nome: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("anexos-financeiro")
        .download(path);
      if (error || !data) throw error ?? new Error("Falha ao baixar arquivo");
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e: any) {
      toast.error("Erro ao baixar: " + (e?.message ?? "desconhecido"));
    }
  };

  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelecionarTodos = () => {
    if (selecionados.size === anexos.length && anexos.length > 0) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(anexos.map((a: any) => a.id)));
    }
  };

  const handleDownloadSelecionados = async () => {
    if (selecionados.size === 0) return;
    const items = (anexos as any[]).filter((a) => selecionados.has(a.id));
    if (items.length <= 10) {
      for (const a of items) {
        await handleDownload(a.storage_path, a.nome_arquivo);
        await new Promise((r) => setTimeout(r, 250));
      }
      if (items.length > 1) toast.success(`${items.length} arquivos baixados`);
      return;
    }
    setBaixandoZip(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const usados = new Set<string>();
      for (const a of items) {
        const { data, error } = await supabase.storage
          .from("anexos-financeiro")
          .download(a.storage_path);
        if (error || !data) throw error ?? new Error("Falha ao baixar " + a.nome_arquivo);
        let nome = a.nome_arquivo as string;
        if (usados.has(nome.toLowerCase())) {
          const m = nome.match(/^(.*?)(\.[^.]+)?$/);
          const base = m?.[1] ?? nome;
          const ext = m?.[2] ?? "";
          let i = 2;
          while (usados.has(`${base} (${i})${ext}`.toLowerCase())) i++;
          nome = `${base} (${i})${ext}`;
        }
        usados.add(nome.toLowerCase());
        zip.file(nome, data);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `anexos-${items.length}-arquivos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${items.length} arquivos baixados em ZIP`);
    } catch (e: any) {
      toast.error("Erro ao gerar ZIP: " + (e?.message ?? "desconhecido"));
    } finally {
      setBaixandoZip(false);
    }
  };

  const handleDelete = async (anexoId: string, path: string) => {
    if (!confirm("Excluir este anexo?")) return;
    try {
      await supabase.storage.from("anexos-financeiro").remove([path]);
      const { error } = await supabase.from("anexos_financeiro").delete().eq("id", anexoId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["financeiro-anexos", movimentacao?.id] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-anexos-list"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Anexo excluído");
    } catch (e: any) {
      toast.error("Erro ao excluir: " + e.message);
    }
  };

  const handleExtrairVidas = async (path: string, nome: string) => {
    if (!movimentacao) return;
    try {
      const { data, error } = await supabase.storage.from("anexos-financeiro").download(path);
      if (error) throw error;
      const buffer = await data.arrayBuffer();
      const sig = new Uint8Array(buffer.slice(0, 4));
      if (!(sig[0] === 0x50 && sig[1] === 0x4b)) {
        toast.error("Arquivo não é um Excel válido (.xlsx)");
        return;
      }
      const result = await validarRelatorioVidas(buffer);
      const vidas = result?.total_vidas ?? 0;
      if (vidas <= 0) {
        toast.warning(`Nenhuma vida identificada em ${nome}`);
        return;
      }
      const { error: updErr } = await supabase
        .from("empresas")
        .update({ vidas, updated_at: new Date().toISOString() })
        .eq("id", movimentacao.empresa_id);
      if (updErr) throw updErr;
      toast.success(`Número de vidas atualizado: ${vidas}`);
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
    } catch (e: any) {
      toast.error("Erro ao extrair vidas: " + e.message);
    }
  };

  if (!movimentacao) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[92vh] overflow-y-auto overflow-x-hidden text-[15px] [&_label]:text-[15px] [&_input]:text-[15px] [&_button]:text-[15px] [&_p]:text-[14px]">
        <DialogHeader>
          <DialogTitle>Editar movimentação</DialogTitle>
          <DialogDescription className="max-w-full break-words">
            {empresaNome} · {movimentacao.mes_referencia} · período {movimentacao.periodo}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          {temAvisos && !dataEnvioNota && !(isAdmin && avisoDismissed) && (
            <div className="relative flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 pr-9 text-xs">
              <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <p className="font-semibold text-foreground">Observações desta empresa</p>
                <ul className="space-y-0.5 text-foreground/90 list-disc pl-4">
                  {envioBoletoComNota && (
                    <li>Enviar <strong>boleto junto com a nota fiscal</strong>.</li>
                  )}
                  {temCoparticipacao && (
                    <li>Empresa possui <strong>coparticipação</strong> — verifique antes de enviar.</li>
                  )}
                  {exigePoPc && (
                    <li>Exige <strong>PO/PC</strong> para emissão da nota.</li>
                  )}
                  {observacaoEmpresa && (
                    <li className="whitespace-pre-wrap break-words">{observacaoEmpresa}</li>
                  )}
                </ul>
                <p className="text-muted-foreground">
                  Este aviso some automaticamente quando o status for alterado para <strong>Enviada</strong>.
                  {!isAdmin && " Apenas administradores podem dispensar manualmente."}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setAvisoDismissed(true)}
                  className="absolute top-1.5 right-1.5 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Dispensar aviso"
                  title="Dispensar (admin)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {temIrmaos && (
            <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 px-3 py-2 text-xs">
              <Users className="h-4 w-4 text-info shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">
                  Contrato com {pagadores.length} pagadores
                </p>
                <p className="text-muted-foreground">
                  Pagadores: {pagadores.map((p) => p.nome).join(", ")}. Ao salvar ou anexar, será perguntado se replica para todos.
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo de cobrança</Label>
              <Select
                value={tipoCobranca || "__none__"}
                onValueChange={(v) => setTipoCobranca(v === "__none__" ? "" : v)}
              >
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Não definido —</SelectItem>
                  {TIPOS_FINANCEIRO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Tipos exclusivos do setor Financeiro.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data_nota">Data de envio da nota</Label>
              <Popover open={dataEnvioOpen} onOpenChange={setDataEnvioOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="data_nota"
                    type="button"
                    variant="outline"
                    aria-invalid={!!envioNoFuturo || undefined}
                    className={cn(
                      "w-full justify-start font-normal",
                      !dataEnvioNota && "text-muted-foreground",
                      envioNoFuturo && "border-warning focus-visible:ring-warning",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataEnvioNota ? formatDateBR(dataEnvioNota) : "— Não definida —"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    locale={ptBR}
                    selected={
                      dataEnvioNota
                        ? (() => {
                            const [y, m, d] = dataEnvioNota.split("-").map(Number);
                            return new Date(y, (m || 1) - 1, d || 1);
                          })()
                        : undefined
                    }
                    onSelect={(date) => {
                      if (!date) {
                        setDataEnvioNota("");
                        setDataEnvioOpen(false);
                        return;
                      }
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, "0");
                      const d = String(date.getDate()).padStart(2, "0");
                      setDataEnvioNota(`${y}-${m}-${d}`);
                      setDataEnvioOpen(false);
                    }}
                    disabled={{ after: new Date() }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                  <div className="flex items-center justify-between border-t p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDataEnvioNota("")}
                    >
                      Limpar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDataEnvioNota(todayLocalISO())}
                    >
                      Hoje
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              {envioNoFuturo ? (
                <p className="text-[11px] text-warning flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Data de envio não pode ser futura.
                </p>
              ) : dataEnvioNota ? (
                <p className="text-[11px] text-success flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Nota marcada como enviada{enviadoPorNome ? ` por ${enviadoPorNome}` : ""}.
                </p>
              ) : null}
              {temIrmaos && (
                <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[11px] cursor-pointer">
                  <Checkbox
                    checked={aplicarEnvioATodos}
                    onCheckedChange={(v) => setAplicarEnvioATodos(v === true)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">Aplicar a todos os {pagadores.length} pagadores</span>
                    <span className="block text-muted-foreground">
                      Replica esta data (e demais alterações) para todos os pagadores do contrato ao salvar — sem precisar editar um por um.
                    </span>
                  </span>
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dia_emissao">Dia de emissão</Label>
              <DayGridPicker
                value={diaEmissao && diaEmissao !== "__none__" ? Number(diaEmissao) : null}
                onChange={(d) => setDiaEmissao(d == null ? "__none__" : String(d))}
                placeholder="— Não definido —"
              />
              <p className="text-[11px] text-muted-foreground">
                Períodos 20-25 e 25-30 começam com "Emissão dia 01" automaticamente.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tipo_analise">Tipo de análise</Label>
              <Select value={tipoAnalise} onValueChange={setTipoAnalise}>
                <SelectTrigger id="tipo_analise">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_ANALISE.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Controla o parser usado na análise dos anexos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dia_venc">Data de vencimento (dia)</Label>
              <DayGridPicker
                value={diaVencimento && diaVencimento !== "__none__" ? Number(diaVencimento) : null}
                onChange={(d) => setDiaVencimento(d == null ? "__none__" : String(d))}
                placeholder="Selecione o dia (01–31)"
              />
              <p className="text-[11px] text-muted-foreground">
                Apenas o dia (01–31) do vencimento no Financeiro.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Dentro do prazo</p>
                <p className="text-xs text-muted-foreground">
                  Desmarque se a nota foi emitida fora do prazo.
                </p>
              </div>
              <Switch checked={dentroPrazo} onCheckedChange={setDentroPrazo} />
            </div>
          </div>

          {/* Boleto DDA — oculto quando empresa usa pagamento via depósito */}
          {!pagamentoViaDeposito && (
          <div
            className={cn(
              "rounded-lg border p-3 space-y-2 transition-colors",
              boletoDda
                ? "border-success/40 bg-success/5"
                : "border-warning/30 bg-warning/5",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Receipt className={cn("h-4 w-4", boletoDda ? "text-success" : "text-warning")} />
                <div>
                  <p className="text-sm font-medium">
                    Boleto DDA · {boletoDda ? "Boleto disponível" : "Boleto pendente"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {!notaEmitida
                      ? "Disponível após emissão da nota fiscal."
                      : canEditFinanceiro
                      ? "Marque quando o boleto estiver gerado/disponível no banco."
                      : "Somente o Financeiro pode alterar este status."}
                  </p>
                </div>
              </div>
              <Switch
                checked={boletoDda}
                onCheckedChange={handleToggleBoletoDda}
                disabled={!podeAlterarBoletoDda}
              />
            </div>
            {boletoDda && boletoConfirmadoEm && (
              <p className="text-[11px] text-success flex items-center gap-1 pl-6">
                <CheckCircle2 className="h-3 w-3" />
                Confirmado{confirmadorNome ? ` por ${confirmadorNome}` : ""} em{" "}
                {new Date(boletoConfirmadoEm).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
          )}

          {/* Prorrogação */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-info" />
                <div>
                  <p className="text-sm font-medium">Prorrogação</p>
                  <p className="text-xs text-muted-foreground">
                    Controle complementar — não altera o vencimento original.
                  </p>
                </div>
              </div>
              <Switch checked={possuiProrrogacao} onCheckedChange={setPossuiProrrogacao} />
            </div>

            {possuiProrrogacao && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="data_prorrog">Data da prorrogação</Label>
                    <Input
                      id="data_prorrog"
                      type="date"
                      value={dataProrrogacao}
                      onChange={(e) => setDataProrrogacao(e.target.value)}
                      aria-invalid={prorrogacaoFaltaData || undefined}
                      className={cn(
                        prorrogacaoFaltaData && "border-warning focus-visible:ring-warning",
                      )}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Nova previsão operacional. O vencimento original permanece preservado.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="motivo_prorrog">Motivo da prorrogação</Label>
                    <Select
                      value={motivoProrrogacao || undefined}
                      onValueChange={(v) => setMotivoProrrogacao(v)}
                    >
                      <SelectTrigger
                        id="motivo_prorrog"
                        aria-invalid={prorrogacaoFaltaMotivo || undefined}
                        className={cn(
                          prorrogacaoFaltaMotivo && "border-warning focus-visible:ring-warning",
                        )}
                      >
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOTIVOS_PRORROGACAO.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {motivoProrrogacao === "Outros" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="obs_prorrog">Observação</Label>
                    <Textarea
                      id="obs_prorrog"
                      value={observacaoProrrogacao}
                      onChange={(e) => setObservacaoProrrogacao(e.target.value)}
                      placeholder="Descreva o motivo da prorrogação"
                      rows={3}
                      aria-invalid={prorrogacaoFaltaObs || undefined}
                      className={cn(
                        prorrogacaoFaltaObs && "border-warning focus-visible:ring-warning",
                      )}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Paperclip className="h-4 w-4 text-info" />
                Anexos ({anexos.length})
                {selecionados.size > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    · {selecionados.size} selecionado{selecionados.size > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selecionados.size > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={handleDownloadSelecionados}
                    disabled={baixandoZip}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    {baixandoZip ? "Compactando..." : `Baixar (${selecionados.size})`}
                  </Button>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept={ACCEPTED_FILE_TYPES}
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? "Enviando..." : "Adicionar"}
                  </span>
                </label>
              </div>
            </div>

            {anexos.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum anexo. Aceita PDF, Excel e CSV.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                  <Checkbox
                    id="anexos-select-all"
                    checked={selecionados.size === anexos.length && anexos.length > 0}
                    onCheckedChange={toggleSelecionarTodos}
                  />
                  <label htmlFor="anexos-select-all" className="cursor-pointer select-none">
                    Selecionar todos
                  </label>
                </div>
                <ul className="min-w-0 space-y-1.5">
                  {anexos.map((a: any) => {
                    const ext = (a.nome_arquivo.split(".").pop() || "").toLowerCase();
                    const isExcel = ["xlsx", "xlsm", "xls"].includes(ext);
                    const isChecked = selecionados.has(a.id);
                    const isShared = !!a._compartilhado_grupo;
                    return (
                    <li
                      key={a.id}
                      className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleSelecionado(a.id)}
                      />
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate" title={a.nome_arquivo}>
                          {a.nome_arquivo}
                        </div>
                        {isShared && (
                          <div className="text-[10px] text-info">Compartilhado pelo grupo</div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatBytes(a.tamanho_bytes)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleDownload(a.storage_path, a.nome_arquivo)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive disabled:opacity-30"
                        onClick={() => handleDelete(a.id, a.storage_path)}
                        disabled={isShared}
                        title={isShared ? "Anexo do grupo — exclua no contrato de origem" : "Excluir"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <p className="text-[11px] text-muted-foreground">
              {hasErrors ? "Corrija os campos destacados para salvar." : "Campos validados."}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || hasErrors}
              >
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
      </Dialog>

      <AlertDialog open={!!replicaConfirm} onOpenChange={(v) => !v && setReplicaConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{replicaConfirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{replicaConfirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setReplicaConfirm(null)}>
              Cancelar
            </AlertDialogCancel>
            <Button variant="outline" onClick={() => replicaConfirm?.onApenas()}>
              Apenas neste pagador
            </Button>
            <AlertDialogAction onClick={() => replicaConfirm?.onTodos()}>
              Aplicar a todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!grupoConfirm} onOpenChange={(v) => !v && setGrupoConfirm(null)}>
        <AlertDialogContent className="max-w-xl w-[calc(100%-2rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar ao grupo {grupoConfirm?.grupoNome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta empresa pertence ao grupo financeiro <strong>{grupoConfirm?.grupoNome}</strong>.
              Deseja replicar
              {grupoConfirm?.acoes.envio ? " o envio da nota," : ""}
              {grupoConfirm?.acoes.vencimento ? " o vencimento," : ""}
              {grupoConfirm?.acoes.dda != null ? " a confirmação de DDA/Depósito," : ""}
              {" "}para todos os contratos do grupo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex-col sm:flex-row sm:justify-end flex-wrap">
            <AlertDialogCancel className="mt-0" onClick={() => setGrupoConfirm(null)}>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => grupoConfirm?.onApenas()}>
              Somente este contrato
            </Button>
            <AlertDialogAction onClick={() => grupoConfirm?.onTodos()}>
              Aplicar a todos do grupo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
