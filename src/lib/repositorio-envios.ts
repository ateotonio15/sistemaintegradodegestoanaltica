/**
 * Repositório de Envios — apresentação dos arquivos já enviados às empresas.
 * Só organiza e formata o que veio do banco: nada aqui inventa empresa, mês ou período.
 */

export type ArquivoEnvio = {
  id: string;
  envio_id: string;
  movimentacao_id: string;
  empresa_id: string;
  contrato: string;
  competencia: string;
  periodo: string | null;
  nome_arquivo: string;
  bucket: string;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  tipo_relatorio: string;
  enviado_por: string | null;
  enviado_nome: string | null;
  enviado_em: string;
  origem: string;
  versao: number;
  status: string;
};

export type GrupoPeriodo = { periodo: string | null; arquivos: ArquivoEnvio[] };
export type GrupoCompetencia = { competencia: string; periodos: GrupoPeriodo[] };

/** Extensão do arquivo a partir do nome (o banco não guarda essa coluna). */
export function extensaoDe(nome: string | null | undefined): string | null {
  const base = (nome ?? "").split(/[\\/]/).pop() ?? "";
  const i = base.lastIndexOf(".");
  if (i <= 0 || i === base.length - 1) return null;
  return base.slice(i + 1).toLowerCase();
}

/**
 * Agrupa por competência (mais recente primeiro) e, dentro dela, pelo período
 * da movimentação. Sem período não inventa um: o grupo aparece por último e
 * sem cabeçalho de período.
 */
export function agruparEnvios(arquivos: ArquivoEnvio[]): GrupoCompetencia[] {
  const porComp = new Map<string, Map<string | null, ArquivoEnvio[]>>();
  for (const a of arquivos) {
    const comp = a.competencia || "—";
    const porPeriodo = porComp.get(comp) ?? new Map<string | null, ArquivoEnvio[]>();
    const chave = a.periodo && a.periodo.trim() ? a.periodo.trim() : null;
    const lista = porPeriodo.get(chave) ?? [];
    lista.push(a);
    porPeriodo.set(chave, lista);
    porComp.set(comp, porPeriodo);
  }
  return Array.from(porComp.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([competencia, porPeriodo]) => ({
      competencia,
      periodos: Array.from(porPeriodo.entries())
        .sort((a, b) => {
          if (a[0] === null) return 1;
          if (b[0] === null) return -1;
          return a[0].localeCompare(b[0]);
        })
        .map(([periodo, lista]) => ({
          periodo,
          arquivos: [...lista].sort((x, y) => y.enviado_em.localeCompare(x.enviado_em)),
        })),
    }));
}

/**
 * Identidade do documento: mesma empresa, contrato, competência, período e
 * categoria. O nome do arquivo não entra — nomes diferentes podem ser o mesmo
 * documento (ex.: "Relatorio_Vidas_2487.pdf" e "Vidas_Ativas_Contrato_2487.pdf").
 */
export function chaveDocumento(a: ArquivoEnvio): string {
  return [a.empresa_id, a.contrato, a.competencia, a.periodo ?? "", a.tipo_relatorio].join("|");
}

/** A listagem principal mostra somente a versão atual de cada documento. */
export function apenasAtuais(arquivos: ArquivoEnvio[]): ArquivoEnvio[] {
  return arquivos.filter((a) => a.status.toLowerCase() === "atual");
}

export function ehImportacaoFechamento(a: ArquivoEnvio): boolean {
  return a.origem === "Importação para fechamento";
}

/** Todas as versões do mesmo documento, da mais nova para a mais antiga. */
export function versoesDoDocumento(arquivos: ArquivoEnvio[], referencia: ArquivoEnvio): ArquivoEnvio[] {
  const chave = chaveDocumento(referencia);
  return arquivos
    .filter((a) => chaveDocumento(a) === chave)
    .sort((x, y) => y.versao - x.versao || y.enviado_em.localeCompare(x.enviado_em));
}

/** Data e hora do envio no formato brasileiro, no fuso de Manaus. */
export function formatarDataHoraEnvio(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const pegar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${pegar("day")}/${pegar("month")}/${pegar("year")} ${pegar("hour")}:${pegar("minute")}`;
}

/** Frase curta com quantos arquivos e em quantos envios uma empresa aparece. */
export function resumoEnviosEmpresa(totalArquivos: number, totalEnvios: number): string {
  const arquivos = `${totalArquivos} arquivo${totalArquivos === 1 ? "" : "s"}`;
  if (totalEnvios <= 1) return arquivos;
  return `${arquivos} · ${totalEnvios} envios`;
}

/** Filtros do topo da tela. `null` = sem filtro naquele campo. */
export type FiltrosEnvios = {
  competencia: string | null;
  periodo: string | null;
  categoria: string | null;
  responsavel: string | null;
  tipoArquivo: string | null; // PDF | Excel | Imagem | Outros
};

export const FILTROS_VAZIOS: FiltrosEnvios = {
  competencia: null,
  periodo: null,
  categoria: null,
  responsavel: null,
  tipoArquivo: null,
};

/** Rótulo do tipo de arquivo pela extensão (mesma regra do ícone da lista). */
export function tipoArquivoEnvio(a: ArquivoEnvio): string {
  const ext = extensaoDe(a.nome_arquivo);
  if (ext === "pdf") return "PDF";
  if (ext && ["xls", "xlsx", "csv"].includes(ext)) return "Excel";
  if (ext && ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "Imagem";
  return "Outros";
}

/** Aplica os filtros do topo; campos vazios não restringem nada. */
export function filtrarArquivos(arquivos: ArquivoEnvio[], f: FiltrosEnvios): ArquivoEnvio[] {
  return arquivos.filter((a) => {
    if (f.competencia && a.competencia !== f.competencia) return false;
    if (f.periodo && (a.periodo ?? "") !== f.periodo) return false;
    if (f.categoria && a.tipo_relatorio !== f.categoria) return false;
    if (f.responsavel && (a.enviado_nome ?? "") !== f.responsavel) return false;
    if (f.tipoArquivo && tipoArquivoEnvio(a) !== f.tipoArquivo) return false;
    return true;
  });
}

export type EnvioResumo = {
  envio_id: string;
  enviado_em: string;
  enviado_nome: string | null;
  competencia: string;
  periodo: string | null;
  total: number;
  tipos: string[];
};

/**
 * Histórico de envios de uma empresa: uma linha por e-mail enviado, do mais
 * recente para o mais antigo, com os arquivos que saíram naquele envio.
 */
export function agruparHistoricoEnvios(arquivos: ArquivoEnvio[]): EnvioResumo[] {
  const porEnvio = new Map<string, ArquivoEnvio[]>();
  for (const a of arquivos) {
    if (ehImportacaoFechamento(a)) continue;
    const lista = porEnvio.get(a.envio_id) ?? [];
    lista.push(a);
    porEnvio.set(a.envio_id, lista);
  }
  return Array.from(porEnvio.entries())
    .map(([envio_id, lista]) => {
      const ordenada = [...lista].sort((x, y) => y.enviado_em.localeCompare(x.enviado_em));
      const primeiro = ordenada[0];
      return {
        envio_id,
        enviado_em: primeiro.enviado_em,
        enviado_nome: primeiro.enviado_nome,
        competencia: primeiro.competencia,
        periodo: primeiro.periodo,
        total: ordenada.length,
        tipos: [...new Set(ordenada.map((a) => a.tipo_relatorio))],
      };
    })
    .sort((a, b) => b.enviado_em.localeCompare(a.enviado_em));
}
