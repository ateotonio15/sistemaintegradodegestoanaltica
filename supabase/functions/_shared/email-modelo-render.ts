/**
 * Preenche um Modelo de E-mail com os dados reais da movimentação.
 * Arquivo puro: a tela mostra a prévia e o servidor refaz o mesmo cálculo antes de enviar.
 * Nenhum código {{variavel}} chega ao e-mail: variável sem dado fica vazia e é listada em "faltando".
 */
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export interface FonteVariaveis {
  empresa?: string | null; razaoSocial?: string | null; contrato?: string | number | null;
  mesReferencia?: string | null; periodo?: string | null; corte?: string | null;
  responsavelContrato?: string | null; responsavelMovimentacao?: string | null; vidas?: number | string | null;
  hojeISO: string; usuario?: string | null; justificativa?: string | null;
}

const br = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

export function montarVariaveis(f: FonteVariaveis): Record<string, string> {
  const mes = /^(\d{4})-(\d{2})$/.exec(txt(f.mesReferencia));
  const competencia = mes ? `${MESES[Number(mes[2]) - 1]}/${mes[1]}` : "";
  const per = /^\s*(\d{1,2})\s*-\s*(\d{1,2})\s*$/.exec(txt(f.periodo));
  const dia = (d: string) => (mes ? `${d.padStart(2, "0")}/${mes[2]}/${mes[1]}` : "");
  return {
    empresa: txt(f.empresa).toUpperCase(),
    razao_social: txt(f.razaoSocial),
    contrato: txt(f.contrato),
    competencia,
    periodo: txt(f.periodo),
    data_inicio_periodo: per ? dia(per[1]) : "",
    data_fim_periodo: per ? dia(per[2]) : "",
    data_corte: txt(f.corte),
    responsavel_contrato: txt(f.responsavelContrato),
    responsavel_movimentacao: txt(f.responsavelMovimentacao),
    quantidade_vidas: txt(f.vidas),
    data_envio: br(f.hojeISO),
    usuario: txt(f.usuario),
    justificativa_envio: txt(f.justificativa),
  };
}

const RE = /\{\{\s*([^{}]*?)\s*\}\}/g;

export function renderizarModelo(modelo: { assunto: string; corpo: string }, dados: Record<string, string>) {
  const faltando = new Set<string>();
  const trocar = (s: string) => (s ?? "").replace(RE, (_o, k: string) => {
    const v = dados[k];
    if (!v) faltando.add(k);
    return v ?? "";
  });
  return { assunto: trocar(modelo.assunto).replace(/\s+/g, " ").trim(), corpo: trocar(modelo.corpo), faltando: [...faltando] };
}

export const temVariavel = (s: string) => /\{\{[^{}]*\}\}/.test(s ?? "");

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
/** Formatação simples: **negrito**, *itálico*, listas com "- ", [texto](https://link) e quebras de linha. */
export function corpoParaHtml(texto: string): string {
  const out: string[] = [];
  let lista = false;
  for (const l of (texto ?? "").split("\n")) {
    const item = /^\s*[-•]\s+(.*)$/.exec(l);
    if (item) { if (!lista) { out.push("<ul>"); lista = true; } out.push(`<li>${inline(item[1])}</li>`); continue; }
    if (lista) { out.push("</ul>"); lista = false; }
    out.push(l.trim() ? `<p style="margin:0 0 12px">${inline(l)}</p>` : "");
  }
  if (lista) out.push("</ul>");
  return out.join("");
}

/** Texto simples (sem marcações) para a versão em texto do e-mail. */
export const corpoParaTexto = (texto: string) => (texto ?? "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)");
