import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, FileText, ClipboardList, Activity, Send, Receipt, Paperclip, RefreshCw, CalendarDays, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import samelIcon from "@/assets/samel-icon.png.asset.json";
import { MultiSelectFiltro } from "./MultiSelectFiltro";
import {
  calcularStatusFinanceiro,
  labelStatusFinanceiro,
  statusFinanceiroColor,
  formatMesReferencia,
  type StatusFinanceiro,
  expandirAnexosPorGrupo,
  fetchEmpresaGrupoMap,
} from "@/lib/financeiro-utils";
import { formatCentavosBRL, nomeMes, labelStatusReajusteFluxo } from "@/lib/reajuste-utils";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function formatCompetencia(c?: string | null) {
  if (!c) return "—";
  const m = c.match(/^(\d{4})-(\d{2})$/);
  return m ? `${MESES[Number(m[2]) - 1]}/${m[1]}` : c;
}

const TODOS_STATUS: StatusFinanceiro[] = [
  "Enviada",
  "Nota emitida",
  "Aguardando validação",
  "Faturado",
  "Em faturamento",
  "Aguardando nota",
  "Fora do prazo",
  "Pendente",
];

function isoHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoInicioMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function fmtDia(iso: string | null | undefined) {
  if (!iso) return "—";
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Converte competência + período (ex.: 2026-08 / 01-05) em datas de início e fim */
function periodoDatas(mes: string | null, periodo: string | null): { inicio: string; fim: string } {
  if (!mes || !periodo) return { inicio: "—", fim: "—" };
  const mm = mes.match(/^(\d{4})-(\d{2})$/);
  const pp = periodo.match(/^(\d{2})-(\d{2})$/);
  if (!mm || !pp) return { inicio: "—", fim: "—" };
  const ano = Number(mm[1]);
  const m = Number(mm[2]);
  const ultimoDia = new Date(ano, m, 0).getDate();
  const d1 = Math.min(Number(pp[1]), ultimoDia);
  const d2 = Math.min(Number(pp[2]), ultimoDia);
  const f = (d: number) => `${String(d).padStart(2, "0")}/${mm[2]}/${mm[1]}`;
  return { inicio: f(d1), fim: f(d2) };
}

/** Determina se a cobrança é pró-rata a partir do tipo de cobrança */
function ehProRata(tipo: string | null): boolean | null {
  if (!tipo) return null;
  return !tipo.toUpperCase().includes("NÃO-PRORATA");
}



interface LinhaRelatorio {
  id: string;
  empresa_id: string;
  empresa_nome: string;
  codigo_contrato: string;
  mes_referencia: string | null;
  periodo: string | null;
  tipo_cobranca: string | null;
  tipo_analise: string | null;
  status: StatusFinanceiro;
  statusLabel: string;
  data_envio_nota: string | null;
  data_vencimento: string | null;
  dia_emissao: number | null;
  aguardando_nota_em: string | null;
  faturamento_iniciado_em: string | null;
  dentro_prazo: boolean | null;
  usuario_envio: string;
  usuario_faturamento: string;
  atualizado_em: string | null;
  qtd_anexos: number;
  ultimo_anexo_em: string | null;
  ultimo_anexo_por: string;
  /** Todos os anexos do movimento com quem anexou e quando (YYYY-MM-DD) */
  anexos_usuarios: { nome: string; dia: string }[];
}

export function RelatorioStatusFinanceiro() {
  const [dataIni, setDataIni] = useState(isoInicioMes());
  const [dataFim, setDataFim] = useState(isoHoje());
  const [statusSel, setStatusSel] = useState<string[]>([]);
  const [statusDialog, setStatusDialog] = useState<StatusFinanceiro | null>(null);
  const [usuarioDialog, setUsuarioDialog] = useState<string | null>(null);
  const [kpiDialog, setKpiDialog] = useState<"movimentacoes" | "notas" | "faturamentos" | "anexos" | null>(null);
  const [diaDialog, setDiaDialog] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryKey: ["fin-relatorio-status", dataIni, dataFim],
    queryFn: async (): Promise<LinhaRelatorio[]> => {
      // Paginação: o backend limita 1000 linhas por requisição
      const COLS =
        "id, empresa_id, mes_referencia, periodo, tipo_cobranca, tipo_analise, data_envio_nota, data_vencimento, dia_emissao, aguardando_nota_em, faturamento_iniciado_em, faturamento_iniciado_por, faturamento_iniciado_por_nome, enviado_por_user_id, dentro_prazo, updated_at";
      const rows: any[] = [];
      const PAGE = 1000;
      for (let offset = 0; ; offset += PAGE) {
        const { data: page, error } = await supabase
          .from("financeiro_movimentacoes")
          .select(COLS)
          .order("id", { ascending: true })
          .range(offset, offset + PAGE - 1);
        if (error) throw error;
        rows.push(...(page ?? []));
        if (!page || page.length < PAGE || offset > 50_000) break;
      }


      const ids = rows.map((r: any) => r.id);
      const anexosAll: any[] = [];
      for (let i = 0; i < ids.length; i += 500) {
        const { data: anx } = await supabase
          .from("anexos_financeiro")
          .select("financeiro_movimentacao_id, mime_type, nome_arquivo, origem, created_at, uploaded_by")
          .in("financeiro_movimentacao_id", ids.slice(i, i + 500));
        (anx ?? []).forEach((a: any) => anexosAll.push(a));
      }
      // Anexos compartilhados no Grupo Financeiro valem para todos os contratos do grupo
      const empresaGrupo = await fetchEmpresaGrupoMap(supabase as any);
      const anexosPorMov = expandirAnexosPorGrupo(rows as any, anexosAll, empresaGrupo) as Map<
        string,
        { mime_type: string | null; nome_arquivo: string | null; origem: string | null; created_at: string; uploaded_by: string | null }[]
      >;


      const { data: emps } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, exige_po_pc");
      const empMap = new Map((emps ?? []).map((e: any) => [e.id, e]));

      const { data: ops } = await supabase
        .from("movimentacoes")
        .select("empresa_id, periodo, mes_referencia, data_envio_financeiro")
        .not("data_envio_financeiro", "is", null)
        .limit(20000);
      const envioSet = new Set(
        (ops ?? []).map((m: any) => `${m.empresa_id}|${m.mes_referencia}|${m.periodo}`),
      );

      const userIds = Array.from(
        new Set(
          [
            ...rows.map((r: any) => r.enviado_por_user_id),
            ...rows.map((r: any) => r.faturamento_iniciado_por),
            ...Array.from(anexosPorMov.values()).flat().map((a) => a.uploaded_by),
          ].filter(Boolean),
        ),
      ) as string[];
      const nomeMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: nomes } = await supabase.rpc("get_user_display_names", { _ids: userIds });
        (nomes ?? []).forEach((n: any) => nomeMap.set(n.user_id, n.display_name));
      }

      return rows.map((r: any) => {
        const emp: any = empMap.get(r.empresa_id);
        const anexos = anexosPorMov.get(r.id) ?? [];
        const status = calcularStatusFinanceiro(
          r,
          envioSet.has(`${r.empresa_id}|${r.mes_referencia}|${r.periodo}`),
          anexos,
          !!emp?.exige_po_pc,
        );
        const ultimo = anexos
          .slice()
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
        return {
          id: r.id,
          empresa_id: r.empresa_id,
          empresa_nome: emp?.nome ?? "—",
          codigo_contrato: emp?.codigo_contrato ?? "",
          mes_referencia: r.mes_referencia,
          periodo: r.periodo,
          tipo_cobranca: r.tipo_cobranca,
          tipo_analise: r.tipo_analise,
          status,
          statusLabel: labelStatusFinanceiro(status),
          data_envio_nota: r.data_envio_nota,
          data_vencimento: r.data_vencimento,
          dia_emissao: r.dia_emissao,
          aguardando_nota_em: r.aguardando_nota_em,
          faturamento_iniciado_em: r.faturamento_iniciado_em,
          dentro_prazo: r.dentro_prazo,
          usuario_envio: nomeMap.get(r.enviado_por_user_id) ?? "",
          usuario_faturamento:
            r.faturamento_iniciado_por_nome ?? nomeMap.get(r.faturamento_iniciado_por) ?? "",
          atualizado_em: r.updated_at,
          qtd_anexos: anexos.length,
          ultimo_anexo_em: ultimo?.created_at ?? null,
          ultimo_anexo_por: ultimo?.uploaded_by ? nomeMap.get(ultimo.uploaded_by) ?? "" : "",
          anexos_usuarios: anexos
            .filter((a) => a.uploaded_by && a.created_at)
            .map((a) => ({
              nome: nomeMap.get(a.uploaded_by as string) ?? "Não identificado",
              dia: a.created_at.slice(0, 10),
            })),
        };
      });
    },
  });

  const linhas = data ?? [];

  /** Data de referência do movimento no relatório: envio da nota → anexo → faturamento → atualização */
  function dataRef(l: LinhaRelatorio) {
    return (
      l.data_envio_nota ??
      l.ultimo_anexo_em?.slice(0, 10) ??
      l.faturamento_iniciado_em?.slice(0, 10) ??
      l.aguardando_nota_em?.slice(0, 10) ??
      l.atualizado_em?.slice(0, 10) ??
      null
    );
  }

  /** Datas de todos os eventos do movimento (envio da nota, anexos, início do faturamento...) */
  function datasEventos(l: LinhaRelatorio) {
    return [
      l.data_envio_nota,
      l.ultimo_anexo_em?.slice(0, 10) ?? null,
      ...l.anexos_usuarios.map((a) => a.dia),
      l.faturamento_iniciado_em?.slice(0, 10) ?? null,
      l.aguardando_nota_em?.slice(0, 10) ?? null,
      l.atualizado_em?.slice(0, 10) ?? null,
    ].filter(Boolean) as string[];
  }

  const noPeriodo = (d?: string | null) =>
    !!d && (!dataIni || d >= dataIni) && (!dataFim || d <= dataFim);

  const filtradas = useMemo(
    () =>
      linhas
        .filter((l) => {
          // Qualquer evento dentro do intervalo mantém o contrato no relatório
          if (!datasEventos(l).some((d) => noPeriodo(d))) return false;
          if (statusSel.length > 0 && !statusSel.includes(l.status)) return false;
          return true;
        })
        .sort((a, b) => (dataRef(b) ?? "").localeCompare(dataRef(a) ?? "")),
    [linhas, dataIni, dataFim, statusSel],
  );


  const resumoStatus = useMemo(() => {
    const m = new Map<StatusFinanceiro, number>();
    filtradas.forEach((l) => m.set(l.status, (m.get(l.status) ?? 0) + 1));
    return TODOS_STATUS.filter((s) => (m.get(s) ?? 0) > 0).map((s) => ({ status: s, total: m.get(s)! }));
  }, [filtradas]);

  /** Notas efetivamente enviadas no período, por dia e por usuário */
  const porDia = useMemo(() => {
    const m = new Map<string, { total: number; enviadas: number }>();
    filtradas.forEach((l) => {
      const d = dataRef(l)!;
      const cur = m.get(d) ?? { total: 0, enviadas: 0 };
      cur.total += 1;
      if (l.data_envio_nota && l.data_envio_nota >= dataIni && l.data_envio_nota <= dataFim) cur.enviadas += 1;
      m.set(d, cur);
    });
    return Array.from(m.entries())
      .map(([dia, v]) => ({ dia, ...v }))
      .sort((a, b) => b.dia.localeCompare(a.dia));
  }, [filtradas, dataIni, dataFim]);

  /** Empresas adicionadas (movimentadas) e concluídas (nota enviada) em cada dia */
  const empresasPorDia = useMemo(() => {
    const m = new Map<string, { adicionadas: LinhaRelatorio[]; concluidas: LinhaRelatorio[] }>();
    filtradas.forEach((l) => {
      const d = dataRef(l)!;
      const cur = m.get(d) ?? { adicionadas: [], concluidas: [] };
      cur.adicionadas.push(l);
      if (l.data_envio_nota && l.data_envio_nota >= dataIni && l.data_envio_nota <= dataFim) {
        cur.concluidas.push(l);
      }
      m.set(d, cur);
    });
    return m;
  }, [filtradas, dataIni, dataFim]);



  /** Nomes distintos de quem anexou algum arquivo no movimento */
  const anexadores = (l: LinhaRelatorio) =>
    Array.from(new Set(l.anexos_usuarios.map((a) => a.nome).filter(Boolean)));

  const porUsuario = useMemo(() => {
    const m = new Map<string, { enviadas: number; faturamentos: number; anexos: number }>();
    const get = (k: string) => {
      const v = m.get(k) ?? { enviadas: 0, faturamentos: 0, anexos: 0 };
      m.set(k, v);
      return v;
    };
    filtradas.forEach((l) => {
      // Produção = notas emitidas no período pelo usuário
      if (noPeriodo(l.data_envio_nota)) get(l.usuario_envio || "Não identificado").enviadas += 1;
      if (noPeriodo(l.faturamento_iniciado_em?.slice(0, 10)))
        get(l.usuario_faturamento || "Não identificado").faturamentos += 1;
      // Todos que anexaram no período contam, não apenas o último
      Array.from(
        new Set(l.anexos_usuarios.filter((a) => noPeriodo(a.dia)).map((a) => a.nome).filter(Boolean)),
      ).forEach((nome) => (get(nome).anexos += 1));
    });
    return Array.from(m.entries())
      .map(([usuario, v]) => ({ usuario, ...v }))
      .filter((u) => u.enviadas > 0 || u.faturamentos > 0 || u.anexos > 0)
      .sort((a, b) => b.enviadas - a.enviadas || a.usuario.localeCompare(b.usuario));
  }, [filtradas, dataIni, dataFim]);

  const empresasPorUsuario = useMemo(() => {
    const m = new Map<string, { faturamentos: LinhaRelatorio[]; anexos: LinhaRelatorio[]; envios: LinhaRelatorio[] }>();
    const get = (k: string) => {
      const v = m.get(k) ?? { faturamentos: [], anexos: [], envios: [] };
      m.set(k, v);
      return v;
    };
    filtradas.forEach((l) => {
      if (noPeriodo(l.data_envio_nota)) get(l.usuario_envio || "Não identificado").envios.push(l);
      if (noPeriodo(l.faturamento_iniciado_em?.slice(0, 10)))
        get(l.usuario_faturamento || "Não identificado").faturamentos.push(l);
      Array.from(
        new Set(l.anexos_usuarios.filter((a) => noPeriodo(a.dia)).map((a) => a.nome).filter(Boolean)),
      ).forEach((nome) => get(nome).anexos.push(l));
    });
    return m;
  }, [filtradas, dataIni, dataFim]);



  /** Movimentações únicas (nota enviada + faturamento + anexo) do usuário selecionado */
  const movsDoUsuario = useMemo(() => {
    if (!usuarioDialog) return [] as LinhaRelatorio[];
    const v = empresasPorUsuario.get(usuarioDialog);
    if (!v) return [] as LinhaRelatorio[];
    const m = new Map<string, LinhaRelatorio>();
    [...v.envios, ...v.faturamentos, ...v.anexos].forEach((l) => m.set(l.id, l));
    return Array.from(m.values()).sort((a, b) => a.empresa_nome.localeCompare(b.empresa_nome));
  }, [usuarioDialog, empresasPorUsuario]);


  const empresaIdsUsuario = useMemo(
    () => Array.from(new Set(movsDoUsuario.map((l) => l.empresa_id))).filter(Boolean),
    [movsDoUsuario],
  );

  /** Retroativos e reajustes das empresas exibidas no modal do usuário */
  const { data: processoEmpresa } = useQuery({
    enabled: empresaIdsUsuario.length > 0,
    staleTime: 30_000,
    queryKey: ["fin-processo-empresas", empresaIdsUsuario],
    queryFn: async () => {
      const [{ data: retro }, { data: reaj }] = await Promise.all([
        supabase
          .from("cobrancas_retroativas")
          .select(
            "id, empresa_id, competencia, valor_centavos, valor_total_calculado_centavos, valor_total_manual_centavos, tipo_ajuste, motivo, descricao, created_at, financeiro_movimentacao_id",
          )
          .in("empresa_id", empresaIdsUsuario),
        supabase
          .from("reajustes_anuais")
          .select(
            "id, empresa_id, ano, percentual, mes_reajuste, meses_retroativos, valor_retroativo_centavos, competencia, status_reajuste, data_aplicacao",
          )
          .in("empresa_id", empresaIdsUsuario),
      ]);
      const mapRetro = new Map<string, any[]>();
      (retro ?? []).forEach((r: any) => {
        mapRetro.set(r.empresa_id, [...(mapRetro.get(r.empresa_id) ?? []), r]);
      });
      const mapReaj = new Map<string, any[]>();
      (reaj ?? []).forEach((r: any) => {
        mapReaj.set(r.empresa_id, [...(mapReaj.get(r.empresa_id) ?? []), r]);
      });
      return { retro: mapRetro, reaj: mapReaj };
    },
  });



  const kpiLinhas = useMemo(() => {
    return {
      movimentacoes: filtradas,
      notas: filtradas.filter((l) => !!l.data_envio_nota),
      faturamentos: filtradas.filter((l) => !!l.faturamento_iniciado_em),
      anexos: filtradas.filter((l) => l.qtd_anexos > 0),
    };
  }, [filtradas]);

  const totalEnviadas = kpiLinhas.notas.length;

  const cabecalho = [
    "Empresa",
    "Contrato",
    "Competência",
    "Período",
    "Status",
    "Tipo de cobrança",
    "Tipo de análise",
    "Data da nota",
    "Vencimento",
    "Dia de emissão",
    "Aguardando emissão desde",
    "Faturamento iniciado em",
    "Dentro do prazo",
    "Usuário do envio",
    "Usuário do faturamento",
    "Anexos",
    "Último anexo em",
    "Último anexo por",
    "Data de referência",
  ];

  function linhaValores(l: LinhaRelatorio): (string | number)[] {
    return [
      l.empresa_nome,
      l.codigo_contrato,
      l.mes_referencia ? formatMesReferencia(l.mes_referencia) : "",
      l.periodo ?? "",
      l.statusLabel,
      l.tipo_cobranca ?? "",
      l.tipo_analise ?? "",
      fmtDia(l.data_envio_nota),
      fmtDia(l.data_vencimento),
      l.dia_emissao ?? "",
      fmtDia(l.aguardando_nota_em),
      fmtDia(l.faturamento_iniciado_em),
      l.dentro_prazo === false ? "Não" : l.dentro_prazo === true ? "Sim" : "",
      l.usuario_envio,
      l.usuario_faturamento,
      l.qtd_anexos,
      fmtDia(l.ultimo_anexo_em),
      l.ultimo_anexo_por,
      fmtDia(dataRef(l)),
    ];
  }

  async function exportarExcel() {
    if (filtradas.length === 0) return;
    const ExcelJS = (await import("exceljs")).default;
    const VERDE = "FF32A976";
    const VERDE_CLARO = "FFEAF6F0";
    const CINZA = "FF6B7280";

    const wb = new ExcelJS.Workbook();
    wb.creator = "SIGA";

    // Worksheet 1: Relatório diário em blocos por dia (mesmo estilo dos pendentes)
    const ws = wb.addWorksheet("Relatório diário", {
      views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws.columns = [
      { width: 42 },
      { width: 16 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 28 },
    ];

    ws.mergeCells(1, 1, 1, 6);
    const t = ws.getCell("A1");
    t.value = "Relatório diário por status";
    t.font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
    t.alignment = { vertical: "middle", indent: 1 };
    t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    ws.getRow(1).height = 34;
    for (let c = 2; c <= 6; c++) {
      ws.getCell(1, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    }

    ws.mergeCells(2, 1, 2, 6);
    const s = ws.getCell("A2");
    s.value = `Período: ${fmtDia(dataIni)} a ${fmtDia(dataFim)}   ·   Movimentações: ${filtradas.length}   ·   Notas enviadas: ${totalEnviadas}   ·   Faturamentos: ${totalFaturamentos}   ·   Anexos: ${totalAnexos}   ·   Emitido em ${new Date().toLocaleString("pt-BR")}`;
    s.font = { size: 10, color: { argb: CINZA } };
    s.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(2).height = 20;
    ws.getRow(3).height = 8;

    // Blocos por dia
    porDia.forEach((d) => {
      const itens = filtradas.filter((l) => dataRef(l) === d.dia);
      const secao = ws.addRow([`${fmtDia(d.dia)}  ·  ${d.total} movimentação(ões)  ·  ${d.enviadas} nota(s) enviada(s)`]);
      ws.mergeCells(secao.number, 1, secao.number, 6);
      secao.height = 24;
      const cel = ws.getCell(secao.number, 1);
      cel.font = { bold: true, size: 12, color: { argb: VERDE } };
      cel.alignment = { vertical: "middle", indent: 1 };
      for (let c = 1; c <= 6; c++) {
        ws.getCell(secao.number, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE_CLARO } };
      }

      const rotulos = ws.addRow(["Empresa", "Contrato", "Competência", "Período", "Status", "Responsável"]);
      rotulos.height = 16;
      rotulos.eachCell((cell) => {
        cell.font = { size: 9, bold: true, color: { argb: CINZA } };
        cell.alignment = { vertical: "middle", indent: 1 };
      });

      itens.forEach((l) => {
        const responsavel =
          l.data_envio_nota
            ? l.usuario_envio
            : l.faturamento_iniciado_em
              ? l.usuario_faturamento
              : l.ultimo_anexo_por || "—";
        const row = ws.addRow([
          l.empresa_nome,
          l.codigo_contrato || "—",
          l.mes_referencia ? formatMesReferencia(l.mes_referencia) : "—",
          l.periodo ?? "—",
          l.statusLabel,
          responsavel || "—",
        ]);
        row.height = 20;
        row.eachCell((cell, col) => {
          cell.font = { size: 10, bold: col === 1, color: { argb: "FF111827" } };
          cell.alignment = {
            vertical: "middle",
            indent: 1,
            horizontal: col === 4 ? "center" : "left",
            wrapText: col === 1 || col === 6,
          };
          cell.border = { bottom: { style: "hair", color: { argb: "FFD6EAE0" } } };
        });
      });

      ws.addRow([]).height = 10;
    });

    // Worksheet 2: Resumo por status
    const wsStatus = wb.addWorksheet("Resumo por status", {
      views: [{ showGridLines: false }],
      pageSetup: { orientation: "landscape" },
    });
    wsStatus.columns = [{ width: 38 }, { width: 16 }];
    wsStatus.mergeCells(1, 1, 1, 2);
    const st = wsStatus.getCell("A1");
    st.value = "Resumo por status";
    st.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    st.alignment = { vertical: "middle", indent: 1 };
    st.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    wsStatus.getRow(1).height = 30;
    wsStatus.getCell("B1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    wsStatus.addRow([]).height = 8;

    const hdrStatus = wsStatus.addRow(["Status", "Quantidade"]);
    hdrStatus.height = 18;
    hdrStatus.eachCell((cell) => {
      cell.font = { size: 10, bold: true, color: { argb: CINZA } };
      cell.alignment = { vertical: "middle", indent: 1 };
    });
    resumoStatus.forEach((r) => {
      const row = wsStatus.addRow([labelStatusFinanceiro(r.status), r.total]);
      row.height = 20;
      row.eachCell((cell, col) => {
        cell.font = { size: 10, bold: col === 1, color: { argb: "FF111827" } };
        cell.alignment = { vertical: "middle", indent: 1, horizontal: col === 2 ? "center" : "left" };
        cell.border = { bottom: { style: "hair", color: { argb: "FFD6EAE0" } } };
      });
    });

    // Worksheet 3: Produção por usuário
    const wsUser = wb.addWorksheet("Produção por usuário", {
      views: [{ showGridLines: false }],
      pageSetup: { orientation: "landscape" },
    });
    wsUser.columns = [{ width: 38 }, { width: 20 }, { width: 16 }];
    wsUser.mergeCells(1, 1, 1, 3);
    const ut = wsUser.getCell("A1");
    ut.value = "Produção por usuário";
    ut.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    ut.alignment = { vertical: "middle", indent: 1 };
    ut.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    wsUser.getRow(1).height = 30;
    wsUser.getCell("B1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    wsUser.getCell("C1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    wsUser.addRow([]).height = 8;

    const hdrUser = wsUser.addRow(["Usuário", "Notas emitidas", "Faturamentos", "Anexos"]);
    hdrUser.height = 18;
    hdrUser.eachCell((cell) => {
      cell.font = { size: 10, bold: true, color: { argb: CINZA } };
      cell.alignment = { vertical: "middle", indent: 1 };
    });
    porUsuario.forEach((u) => {
      const row = wsUser.addRow([u.usuario, u.enviadas, u.faturamentos, u.anexos]);
      row.height = 20;
      row.eachCell((cell, col) => {
        cell.font = { size: 10, bold: col === 1, color: { argb: "FF111827" } };
        cell.alignment = { vertical: "middle", indent: 1, horizontal: col === 1 ? "left" : "center" };
        cell.border = { bottom: { style: "hair", color: { argb: "FFD6EAE0" } } };
      });
    });

    // Worksheet 4: Detalhado (estilo limpo)
    const wsDet = wb.addWorksheet("Detalhado", {
      views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
      pageSetup: { orientation: "landscape" },
    });
    const hdrDet = wsDet.addRow(cabecalho);
    hdrDet.height = 18;
    hdrDet.eachCell((cell) => {
      cell.font = { size: 9, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
      cell.alignment = { vertical: "middle", indent: 1, wrapText: true };
    });
    filtradas.forEach((l) => {
      const row = wsDet.addRow(linhaValores(l));
      row.height = 18;
      row.eachCell((cell) => {
        cell.font = { size: 9, color: { argb: "FF111827" } };
        cell.alignment = { vertical: "middle" };
      });
    });
    wsDet.columns.forEach((c, i) => (c.width = i === 0 ? 42 : 18));

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-financeiro-${dataIni}_a_${dataFim}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportarPDF() {
    if (filtradas.length === 0) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const hoje = new Date().toLocaleString("pt-BR");

    // Logo Samel (somente o símbolo, monocromático)
    let logoData: string | null = null;
    try {
      const resp = await fetch(samelIcon.url);
      const blob = await resp.blob();
      logoData = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    } catch {
      logoData = null;
    }

    function drawHeader() {
      doc.setFillColor(50, 169, 118);
      doc.rect(0, 0, pageW, 64, "F");

      const textX = logoData ? 108 : 40;
      if (logoData) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(32, 12, 56, 40, 6, 6, "F");
        doc.addImage(logoData, "PNG", 44, 17, 32, 30, undefined, "FAST");
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório diário por status", textX, 30);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(226, 244, 236);
      doc.text(`Faturamento · SIGA · Emitido em ${hoje}`, textX, 48);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(String(filtradas.length), pageW - 40, 32, { align: "right" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("movimentações", pageW - 40, 46, { align: "right" });
    }

    drawHeader();

    // Filtros aplicados
    doc.setTextColor(75, 85, 99);
    doc.setFontSize(9);
    doc.text(`Período: ${fmtDia(dataIni)} a ${fmtDia(dataFim)}`, 40, 84);
    doc.text(`Notas enviadas: ${totalEnviadas} · Faturamentos: ${totalFaturamentos} · Anexos: ${totalAnexos}`, 40, 97);

    let y = 112;

    // Resumo por status
    autoTable(doc, {
      startY: y,
      head: [["Status", "Quantidade"]],
      body: resumoStatus.map((r) => [labelStatusFinanceiro(r.status), String(r.total)]),
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: 6, valign: "middle", textColor: [17, 24, 39] },
      headStyles: { fillColor: [50, 169, 118], textColor: 255, fontStyle: "bold", fontSize: 9 },
      alternateRowStyles: { fillColor: [234, 246, 240] },
      columnStyles: { 0: { cellWidth: 180, fontStyle: "bold" }, 1: { cellWidth: 80, halign: "center" } },
      margin: { left: 40, right: 40, top: 40, bottom: 40 },
      tableWidth: 260,
    });

    y = (doc as any).lastAutoTable.finalY + 16;

    // Por dia
    autoTable(doc, {
      startY: y,
      head: [["Dia", "Movimentações", "Notas enviadas", "Conversão"]],
      body: porDia.map((d) => [
        fmtDia(d.dia),
        String(d.total),
        String(d.enviadas),
        d.total > 0 ? `${Math.round((d.enviadas / d.total) * 100)}%` : "—",
      ]),
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: 6, valign: "middle", textColor: [17, 24, 39] },
      headStyles: { fillColor: [50, 169, 118], textColor: 255, fontStyle: "bold", fontSize: 9 },
      alternateRowStyles: { fillColor: [234, 246, 240] },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 90, halign: "center" },
        2: { cellWidth: 90, halign: "center" },
        3: { cellWidth: 70, halign: "center" },
      },
      margin: { left: 40, right: 40, top: 40, bottom: 40 },
      tableWidth: 340,
    });

    y = (doc as any).lastAutoTable.finalY + 16;

    // Por usuário
    autoTable(doc, {
      startY: y,
      head: [["Usuário", "Notas emitidas", "Faturamentos", "Anexos"]],
      body: porUsuario.map((u) => [u.usuario, String(u.enviadas), String(u.faturamentos), String(u.anexos)]),
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: 6, valign: "middle", textColor: [17, 24, 39] },
      headStyles: { fillColor: [50, 169, 118], textColor: 255, fontStyle: "bold", fontSize: 9 },
      alternateRowStyles: { fillColor: [234, 246, 240] },
      columnStyles: {
        0: { cellWidth: 180, fontStyle: "bold" },
        1: { cellWidth: 90, halign: "center" },
        2: { cellWidth: 70, halign: "center" },
      },
      margin: { left: 40, right: 40, top: 40, bottom: 40 },
      tableWidth: 340,
    });

    // Página detalhada
    doc.addPage("a4", "landscape");
    drawHeader();

    autoTable(doc, {
      startY: 80,
      head: [
        [
          "Empresa",
          "Contrato",
          "Competência",
          "Período",
          "Status",
          "Data da nota",
          "Vencimento",
          "Responsável",
          "Data de referência",
        ],
      ],
      body: filtradas.map((l) => {
        const responsavel =
          l.data_envio_nota
            ? l.usuario_envio
            : l.faturamento_iniciado_em
              ? l.usuario_faturamento
              : l.ultimo_anexo_por || "—";
        return [
          l.empresa_nome,
          l.codigo_contrato || "—",
          l.mes_referencia ? formatMesReferencia(l.mes_referencia) : "—",
          l.periodo ?? "—",
          l.statusLabel,
          fmtDia(l.data_envio_nota),
          fmtDia(l.data_vencimento),
          responsavel || "—",
          fmtDia(dataRef(l)),
        ];
      }),
      theme: "plain",
      styles: { fontSize: 7.5, cellPadding: 5, valign: "middle", textColor: [17, 24, 39] },
      headStyles: { fillColor: [50, 169, 118], textColor: 255, fontStyle: "bold", fontSize: 8.5 },
      alternateRowStyles: { fillColor: [234, 246, 240] },
      columnStyles: {
        0: { cellWidth: 180, fontStyle: "bold" },
        1: { cellWidth: 70 },
        2: { cellWidth: 70 },
        3: { cellWidth: 60, halign: "center" },
        4: { cellWidth: 80 },
        5: { cellWidth: 70 },
        6: { cellWidth: 70 },
        7: { cellWidth: 90 },
        8: { cellWidth: 70 },
      },
      margin: { left: 40, right: 40, top: 40, bottom: 40 },
      didDrawPage: () => {
        const page = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Emitido em ${hoje}`, 40, pageH - 20);
        doc.text(`Página ${page}`, pageW - 40, pageH - 20, { align: "right" });
      },
    });

    doc.save(`relatorio-financeiro-${dataIni}_a_${dataFim}.pdf`);
  }

  const totalFaturamentos = kpiLinhas.faturamentos.length;
  const totalAnexos = filtradas.reduce((s, l) => s + l.qtd_anexos, 0);

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Relatório diário por status
              <Badge variant="outline" className="ml-1">{filtradas.length}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Acompanhe, dia a dia, o que o Financeiro movimentou: quantos contratos tiveram alguma
              atualização e quantas notas fiscais foram efetivamente enviadas — por período e por usuário.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input
                type="date"
                value={dataIni}
                onChange={(e) => setDataIni(e.target.value)}
                className="h-9 w-[160px] text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-9 w-[160px] text-sm"
              />
            </div>
            <MultiSelectFiltro
              label="Status"
              width="w-[200px]"
              options={TODOS_STATUS.map((s) => ({ value: s, label: labelStatusFinanceiro(s) }))}
              selected={statusSel}
              onChange={setStatusSel}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1.5", isFetching && "animate-spin")} />
              Atualizar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-sm"
              onClick={exportarExcel}
              disabled={filtradas.length === 0}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Exportar Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-sm"
              onClick={exportarPDF}
              disabled={filtradas.length === 0}
            >
              <FileText className="h-4 w-4 mr-1.5" />
              Exportar PDF
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              key: "movimentacoes" as const,
              icon: Activity,
              label: "Movimentações",
              value: filtradas.length,
              hint: "Contratos com alguma atualização do Financeiro no período (envio, anexo, início de faturamento ou mudança de status).",
            },
            {
              key: "notas" as const,
              icon: Send,
              label: "Notas enviadas",
              value: totalEnviadas,
              hint: "Notas fiscais efetivamente enviadas ao cliente — contratos com data da nota preenchida.",
            },
            {
              key: "faturamentos" as const,
              icon: Receipt,
              label: "Faturamentos iniciados",
              value: totalFaturamentos,
              hint: "Contratos em que o Financeiro deu início ao faturamento (antes da emissão da nota).",
            },
            {
              key: "anexos" as const,
              icon: Paperclip,
              label: "Anexos enviados",
              value: totalAnexos,
              hint: "Arquivos anexados às movimentações no período (relatórios, notas, comprovantes).",
            },
          ].map((k) => (
            <button
              key={k.label}
              type="button"
              onClick={() => setKpiDialog(k.key)}
              className="text-left rounded-lg border bg-muted/30 p-4 hover:bg-accent/50 hover:border-primary/40 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <k.icon className="h-4 w-4" />
                {k.label}
              </div>
              <div className="text-2xl font-semibold mt-1">{k.value}</div>
              <p className="text-xs leading-snug text-muted-foreground mt-1.5">{k.hint}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {resumoStatus.map((r) => (
            <button
              key={r.status}
              type="button"
              onClick={() => setStatusDialog(r.status)}
              className="focus:outline-none focus:ring-2 focus:ring-ring rounded-full"
            >
              <Badge className={cn("text-xs font-medium cursor-pointer px-2.5 py-0.5", statusFinanceiroColor(r.status))}>
                {labelStatusFinanceiro(r.status)}: {r.total}
              </Badge>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
        ) : filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma movimentação financeira no período selecionado.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-muted/50 border-b">
                <p className="text-sm font-semibold">Notas por dia</p>
                <p className="text-sm text-muted-foreground leading-snug">
                  <strong>Movimentações</strong> = contratos tocados pelo Financeiro naquele dia.{" "}
                  <strong>Notas enviadas</strong> = quantas dessas viraram nota fiscal emitida no mesmo dia.
                </p>
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground sticky top-0 bg-card">
                    <tr className="border-b">
                      <th className="text-left px-4 py-2 font-medium">Dia</th>
                      <th className="text-right px-4 py-2 font-medium">Movimentações</th>
                      <th className="text-right px-4 py-2 font-medium">Notas enviadas</th>
                      <th className="text-right px-4 py-2 font-medium">Conversão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porDia.map((d) => (
                      <tr
                        key={d.dia}
                        onClick={() => setDiaDialog(d.dia)}
                        title="Clique para ver as empresas do dia"
                        className="border-b last:border-0 hover:bg-primary/5 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2 font-medium">{fmtDia(d.dia)}</td>
                        <td className="px-4 py-2 text-right">{d.total}</td>
                        <td className="px-4 py-2 text-right font-medium">{d.enviadas}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {d.total > 0 ? `${Math.round((d.enviadas / d.total) * 100)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-muted/50 border-b">
                <p className="text-sm font-semibold">Produção por usuário</p>
                <p className="text-sm text-muted-foreground leading-snug">
                  <strong>Notas emitidas</strong> = notas que ele emitiu no período ·{" "}
                  <strong>Faturamentos</strong> = faturamentos que ele iniciou · <strong>Anexos</strong> = arquivos
                  que ele subiu.
                </p>
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground sticky top-0 bg-card">
                    <tr className="border-b">
                      <th className="text-left px-4 py-2 font-medium">Usuário</th>
                      <th className="text-right px-4 py-2 font-medium">Notas emitidas</th>
                      <th className="text-right px-4 py-2 font-medium">Faturamentos</th>
                      <th className="text-right px-4 py-2 font-medium">Anexos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porUsuario.map((u) => (
                      <tr
                        key={u.usuario}
                        className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                        onClick={() => setUsuarioDialog(u.usuario)}
                      >
                        <td className="px-4 py-2 truncate max-w-[200px]">{u.usuario}</td>
                        <td className="px-4 py-2 text-right font-semibold text-foreground">{u.enviadas}</td>
                        <td className="px-4 py-2 text-right">{u.faturamentos}</td>
                        <td className="px-4 py-2 text-right">{u.anexos}</td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={!!statusDialog} onOpenChange={(open) => !open && setStatusDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden rounded-xl">
          <DialogHeader className="px-6 py-5 border-b bg-muted/40 space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              {statusDialog && (
                <>
                  <Badge className={cn("text-xs font-medium px-2.5 py-0.5", statusFinanceiroColor(statusDialog))}>
                    {labelStatusFinanceiro(statusDialog)}
                  </Badge>
                  <span>Empresas</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {statusDialog && `${filtradas.filter((l) => l.status === statusDialog).length} contrato(s) com status "${labelStatusFinanceiro(statusDialog)}".`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 py-5">
            <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground sticky top-0 bg-muted/60 backdrop-blur z-10">
                <tr className="border-b">
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Empresa</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Contrato</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Competência</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Período</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Responsável</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Data da nota</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {statusDialog &&
                  filtradas
                    .filter((l) => l.status === statusDialog)
                    .map((l) => {
                      const responsavel =
                        ["Enviada", "Nota emitida"].includes(statusDialog)
                          ? l.usuario_envio
                          : ["Faturado", "Em faturamento"].includes(statusDialog)
                            ? l.usuario_faturamento
                            : l.usuario_faturamento || l.usuario_envio || l.ultimo_anexo_por || "—";
                      return (
                        <tr key={l.id} className="border-b last:border-0 even:bg-muted/20 hover:bg-primary/5 transition-colors">
                          <td className="px-4 py-2.5 font-medium">{l.empresa_nome}</td>
                          <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{l.codigo_contrato || "—"}</td>
                          <td className="px-4 py-2.5">{l.mes_referencia ? formatMesReferencia(l.mes_referencia) : "—"}</td>
                          <td className="px-4 py-2.5 tabular-nums">{l.periodo ?? "—"}</td>
                          <td className="px-4 py-2.5">{responsavel || "—"}</td>
                          <td className="px-4 py-2.5 tabular-nums">{fmtDia(l.data_envio_nota)}</td>
                          <td className="px-4 py-2.5 tabular-nums">{fmtDia(l.data_vencimento)}</td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={!!diaDialog} onOpenChange={(open) => !open && setDiaDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden rounded-xl">
          <DialogHeader className="px-6 py-5 border-b bg-muted/40 space-y-1.5">
            <DialogTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Empresas de {diaDialog ? fmtDia(diaDialog) : ""}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {diaDialog && (
                <>
                  {empresasPorDia.get(diaDialog)?.adicionadas.length ?? 0} adicionada(s) e{" "}
                  {empresasPorDia.get(diaDialog)?.concluidas.length ?? 0} concluída(s) neste dia.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
            {diaDialog && (
              <>
                {[
                  {
                    key: "adicionadas" as const,
                    titulo: "Adicionadas (movimentações do dia)",
                    icone: <Activity className="h-4 w-4 text-primary" />,
                    vazio: "Nenhuma empresa movimentada neste dia.",
                  },
                  {
                    key: "concluidas" as const,
                    titulo: "Concluídas (nota enviada)",
                    icone: <CheckCircle2 className="h-4 w-4 text-primary" />,
                    vazio: "Nenhuma nota enviada neste dia.",
                  },
                ].map((sec) => {
                  const itens = empresasPorDia.get(diaDialog)?.[sec.key] ?? [];
                  return (
                    <div key={sec.key}>
                      <div className="flex items-center gap-2 mb-2.5">
                        {sec.icone}
                        <p className="text-sm font-semibold">{sec.titulo}</p>
                        <Badge variant="outline" className="text-xs">{itens.length}</Badge>
                      </div>
                      {itens.length === 0 ? (
                        <p className="text-sm text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center">
                          {sec.vazio}
                        </p>
                      ) : (
                        <div className="rounded-lg border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="text-muted-foreground sticky top-0 bg-muted/60 backdrop-blur z-10">
                              <tr className="border-b">
                                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Empresa</th>
                                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Contrato</th>
                                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Competência</th>
                                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Período</th>
                                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Status</th>
                                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Responsável</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itens.map((l) => (
                                <tr key={`${sec.key}-${l.id}`} className="border-b last:border-0 even:bg-muted/20 hover:bg-primary/5 transition-colors">
                                  <td className="px-4 py-2.5 font-medium">{l.empresa_nome}</td>
                                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{l.codigo_contrato || "—"}</td>
                                  <td className="px-4 py-2.5">{l.mes_referencia ? formatMesReferencia(l.mes_referencia) : "—"}</td>
                                  <td className="px-4 py-2.5 tabular-nums">{l.periodo ?? "—"}</td>
                                  <td className="px-4 py-2.5">
                                    <Badge className={cn("text-xs font-medium px-2 py-0.5", statusFinanceiroColor(l.status))}>
                                      {l.statusLabel}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2.5 text-muted-foreground">
                                    {(sec.key === "concluidas"
                                      ? l.usuario_envio
                                      : l.usuario_faturamento || l.ultimo_anexo_por || l.usuario_envio) || "Não identificado"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!usuarioDialog} onOpenChange={(open) => !open && setUsuarioDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden rounded-xl border-border/60">
          <DialogHeader className="px-6 py-5 border-b border-border/60 bg-muted/30 space-y-1">
            <DialogDescription className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              Sistema SIGA · Detalhamento do processo
            </DialogDescription>
            <DialogTitle className="text-xl font-bold tracking-tight">
              Empresas de {usuarioDialog}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
            {movsDoUsuario.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {(() => {
                  const total = movsDoUsuario.length;
                  const enviadas = movsDoUsuario.filter((l) => l.status === "Enviada").length;
                  const emFaturamento = movsDoUsuario.filter(
                    (l) =>
                      l.status === "Faturado" ||
                      l.status === "Em faturamento" ||
                      l.status === "Aguardando validação",
                  ).length;
                  const cards = [
                    { label: "Total de empresas", valor: total, cls: "text-foreground" },
                    { label: "Notas enviadas", valor: enviadas, cls: "text-success" },
                    { label: "Faturadas / em faturamento", valor: emFaturamento, cls: "text-info" },
                  ];
                  return cards.map((c) => (
                    <div
                      key={c.label}
                      className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                    >
                      <p className="text-[11px] uppercase tracking-tight font-semibold text-muted-foreground mb-1">
                        {c.label}
                      </p>
                      <p className={cn("text-2xl font-bold tabular-nums", c.cls)}>{c.valor}</p>
                    </div>
                  ));
                })()}
              </div>
            )}
            {movsDoUsuario.length > 0 && (() => {
              const porTipo = new Map<string, { total: number; enviadas: number }>();
              movsDoUsuario.forEach((l) => {
                const k = (l.tipo_cobranca || "Sem tipo").toUpperCase();
                const cur = porTipo.get(k) ?? { total: 0, enviadas: 0 };
                cur.total += 1;
                if (l.status === "Enviada") cur.enviadas += 1;
                porTipo.set(k, cur);
              });
              const linhas = [...porTipo.entries()].sort((a, b) => b[1].total - a[1].total);
              return (
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <div className="px-4 py-2.5 bg-muted/40 border-b border-border/60">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Cobranças por tipo
                    </p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="text-left font-semibold px-4 py-2">Tipo de cobrança</th>
                        <th className="text-right font-semibold px-4 py-2">Qtd.</th>
                        <th className="text-right font-semibold px-4 py-2">Notas enviadas</th>
                        <th className="text-right font-semibold px-4 py-2">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map(([tipo, v]) => (
                        <tr key={tipo} className="border-t border-border/40 hover:bg-muted/20">
                          <td className="px-4 py-2 font-medium">{tipo}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-semibold">{v.total}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-success font-semibold">
                            {v.enviadas}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                            {Math.round((v.total / movsDoUsuario.length) * 100)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
            {movsDoUsuario.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border/60 px-4 py-8 text-center">
                Nenhuma empresa no período.
              </p>
            ) : (

              movsDoUsuario.map((l) => {
                const dts = periodoDatas(l.mes_referencia, l.periodo);
                const prorata = ehProRata(l.tipo_cobranca);
                const retros = (processoEmpresa?.retro.get(l.empresa_id) ?? []).filter(
                  (r: any) => !l.mes_referencia || !r.competencia || r.competencia === l.mes_referencia,
                );
                const reajs = processoEmpresa?.reaj.get(l.empresa_id) ?? [];
                const reajComp = reajs.filter(
                  (r: any) => !l.mes_referencia || !r.competencia || r.competencia === l.mes_referencia,
                );
                return (
                  <div
                    key={l.id}
                    className="rounded-xl border border-border/60 bg-card/40 hover:bg-card/70 hover:border-primary/40 transition-all duration-200 overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-border/50 bg-muted/20">
                      <div className="min-w-0">
                        <h4 className="text-base font-semibold text-foreground truncate">{l.empresa_nome}</h4>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          Contrato {l.codigo_contrato || "—"} ·{" "}
                          {l.mes_referencia ? formatMesReferencia(l.mes_referencia) : "—"}
                        </p>
                      </div>
                      <Badge className={statusFinanceiroColor(l.status)}>{l.statusLabel}</Badge>
                    </div>

                    <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-muted-foreground text-[11px] mb-1 uppercase font-medium">Início do período</p>
                        <p className="text-sm font-medium tabular-nums">{dts.inicio}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[11px] mb-1 uppercase font-medium">Fim do período</p>
                        <p className="text-sm font-medium tabular-nums">{dts.fim}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[11px] mb-1 uppercase font-medium">Pró-rata</p>
                        <p className="text-sm font-medium">
                          {prorata === null ? "—" : prorata ? "Sim" : "Não (NÃO-PRORATA)"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[11px] mb-1 uppercase font-medium">Tipo de cobrança</p>
                        <p className="text-sm font-medium">{l.tipo_cobranca || "—"}</p>
                      </div>
                    </div>

                    <div className="px-5 pb-4">
                      <p className="text-[11px] uppercase font-semibold text-muted-foreground mb-2">
                        Processo de envio
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-muted-foreground text-[11px] mb-1">Aguardando emissão desde</p>
                          <p className="text-sm font-medium tabular-nums">{fmtDia(l.aguardando_nota_em)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[11px] mb-1">Faturamento iniciado</p>
                          <p className="text-sm font-medium tabular-nums">{fmtDia(l.faturamento_iniciado_em)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[11px] mb-1">Nota enviada</p>
                          <p className="text-sm font-medium tabular-nums">{fmtDia(l.data_envio_nota)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[11px] mb-1">Vencimento</p>
                          <p className="text-sm font-medium tabular-nums">{fmtDia(l.data_vencimento)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 pb-5">
                      <p className="text-[11px] uppercase font-semibold text-muted-foreground mb-2">
                        Cobrança retroativa / reajuste
                      </p>
                      {retros.length === 0 && reajComp.length === 0 ? (
                        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border/60 px-3 py-3">
                          Sem cobrança retroativa nesta competência.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {reajComp.map((r: any) => (
                            <div
                              key={`reaj-${r.id}`}
                              className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[10px] uppercase">
                                  Reajuste {r.ano}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {labelStatusReajusteFluxo(r.status_reajuste)}
                                </span>
                              </div>
                              <p className="text-foreground">
                                Percentual {Number(r.percentual ?? 0).toFixed(2)}% · Retroativo de{" "}
                                <strong>{r.meses_retroativos ?? 0}</strong>{" "}
                                {(r.meses_retroativos ?? 0) === 1 ? "mês" : "meses"} ·{" "}
                                {formatCentavosBRL(r.valor_retroativo_centavos)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                                Mês de reajuste {nomeMes(r.mes_reajuste)} · Aplicação {fmtDia(r.data_aplicacao)}
                              </p>
                            </div>
                          ))}
                          {retros.map((r: any) => (
                            <div
                              key={`retro-${r.id}`}
                              className="rounded-lg border border-info/25 bg-info/5 px-3 py-2.5 text-sm"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[10px] uppercase">
                                  Cobrança retroativa
                                </Badge>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {r.competencia ? formatMesReferencia(r.competencia) : "—"}
                                </span>
                              </div>
                              <p className="text-foreground">
                                {formatCentavosBRL(
                                  r.valor_total_manual_centavos ??
                                    r.valor_total_calculado_centavos ??
                                    r.valor_centavos,
                                )}
                                {r.motivo ? ` · ${r.motivo}` : ""}
                              </p>
                              {r.descricao && (
                                <p className="text-xs text-muted-foreground mt-0.5">{r.descricao}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                                Registrada em {fmtDia(r.created_at)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </DialogContent>
      </Dialog>


      <Dialog open={!!kpiDialog} onOpenChange={(open) => !open && setKpiDialog(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden rounded-xl">
          <DialogHeader className="px-6 py-5 border-b bg-muted/40 space-y-1.5">
            <DialogTitle className="text-lg flex items-center gap-2.5">
              {kpiDialog === "movimentacoes" && (<><Activity className="h-5 w-5 text-primary" />Movimentações</>)}
              {kpiDialog === "notas" && (<><Send className="h-5 w-5 text-primary" />Notas enviadas</>)}
              {kpiDialog === "faturamentos" && (<><Receipt className="h-5 w-5 text-primary" />Faturamentos iniciados</>)}
              {kpiDialog === "anexos" && (<><Paperclip className="h-5 w-5 text-primary" />Anexos enviados</>)}
              {kpiDialog && (
                <Badge variant="outline" className="text-xs">{kpiLinhas[kpiDialog].length}</Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {kpiDialog && `${kpiLinhas[kpiDialog].length} contrato(s) no período selecionado.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 py-5">
            <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground sticky top-0 bg-muted/60 backdrop-blur z-10">
                <tr className="border-b">
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Empresa</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Contrato</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Competência</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Período</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Status</th>
                  {kpiDialog === "notas" && <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Data da nota</th>}
                  {kpiDialog === "faturamentos" && <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Iniciado em</th>}
                  {kpiDialog === "anexos" && (
                    <>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Anexos</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Último anexo em</th>
                    </>
                  )}
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {kpiDialog &&
                  kpiLinhas[kpiDialog].map((l) => {
                    const responsavel =
                      kpiDialog === "notas"
                        ? l.usuario_envio
                        : kpiDialog === "faturamentos"
                          ? l.usuario_faturamento
                          : l.ultimo_anexo_por || l.usuario_faturamento || l.usuario_envio || "—";
                    return (
                      <tr key={l.id} className="border-b last:border-0 even:bg-muted/20 hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-2.5 font-medium">{l.empresa_nome}</td>
                        <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{l.codigo_contrato || "—"}</td>
                        <td className="px-4 py-2.5">{l.mes_referencia ? formatMesReferencia(l.mes_referencia) : "—"}</td>
                        <td className="px-4 py-2.5 tabular-nums">{l.periodo ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={cn("text-xs font-medium", statusFinanceiroColor(l.status))}>{l.statusLabel}</Badge>
                        </td>
                        {kpiDialog === "notas" && <td className="px-4 py-2.5 tabular-nums">{fmtDia(l.data_envio_nota)}</td>}
                        {kpiDialog === "faturamentos" && <td className="px-4 py-2.5 tabular-nums">{fmtDia(l.faturamento_iniciado_em)}</td>}
                        {kpiDialog === "anexos" && (
                          <>
                            <td className="px-4 py-2.5 tabular-nums">{l.qtd_anexos}</td>
                            <td className="px-4 py-2.5 tabular-nums">{fmtDia(l.ultimo_anexo_em)}</td>
                          </>
                        )}
                        <td className="px-4 py-2.5">{responsavel || "—"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

