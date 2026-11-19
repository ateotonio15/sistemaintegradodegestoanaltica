/**
 * Localização automática da assinatura a partir do texto da carta.
 * Coordenadas finais sempre em frações da página, origem no canto superior esquerdo.
 */
export type Confianca = "alta" | "media" | "baixa";

export interface LinhaTexto {
  texto: string;
  pagina: number; // 1-based
  x: number; y: number; w: number; h: number; // frações, topo-esquerda (y = topo da linha)
}
export interface PaginaTexto { linhas: LinhaTexto[] }

export interface ModeloPosicao {
  id?: string;
  nome: string;
  impressao: string;
  referencia: string | null;
  pagina: string; // "ultima" ou número
  desloc_x: number; desloc_y: number; // deslocamento do centro em relação à referência
  pos_x: number; pos_y: number; // posição absoluta (usada quando não há referência)
  largura: number;
  margem_superior: number;
  margem_inferior: number;
}

export interface Localizacao {
  pagina: number;
  x: number; y: number; largura: number;
  referencia: string | null;
  confianca: Confianca;
  origem: "modelo" | "referencia" | "padrao" | "manual";
  margem_superior: number;
  margem_inferior: number;
  modeloId?: string;
}

export const REFERENCIAS: { termo: string; confianca: Confianca }[] = [
  { termo: "assinatura", confianca: "alta" },
  { termo: "responsavel", confianca: "alta" },
  { termo: "setor de cadastro samel", confianca: "media" },
  { termo: "atenciosamente", confianca: "media" },
];

export const MARGEM_SUPERIOR_PADRAO = 0.06;
export const MARGEM_INFERIOR_PADRAO = 0.03;
export const LARGURA_PADRAO = 0.3;

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Impressão digital do modelo: nº de páginas + primeiras linhas sem números (ignora nomes/datas variáveis). */
export function impressaoDigital(paginas: PaginaTexto[]): string {
  const linhas = paginas.flatMap((p) => p.linhas)
    .map((l) => normalizar(l.texto).replace(/[\d.,/\-:]+/g, "").replace(/\s+/g, " ").trim())
    .filter((t) => t.length >= 4).slice(0, 4);
  return `${paginas.length}|${linhas.join("|")}`;
}

const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function acharLinha(paginas: PaginaTexto[], termo: string, preferirUltima: boolean): LinhaTexto | null {
  const alvo = normalizar(termo);
  const ordem = preferirUltima ? [...paginas].reverse() : paginas;
  for (const p of ordem) {
    // Última ocorrência na página: o bloco de assinatura fica no fim.
    const achadas = p.linhas.filter((l) => normalizar(l.texto).includes(alvo));
    if (achadas.length) return achadas[achadas.length - 1];
  }
  return null;
}

function acimaDe(l: LinhaTexto, largura: number, mSup: number, mInf: number, dx = 0, dy = 0) {
  const x = limitar(l.x + l.w / 2 + dx, largura / 2, 1 - largura / 2);
  const y = limitar(l.y - mSup + dy, 0.02, 1 - mInf);
  return { x, y };
}

export function localizarAssinatura(paginas: PaginaTexto[], modelos: ModeloPosicao[] = []): Localizacao {
  const total = Math.max(1, paginas.length);
  const imp = impressaoDigital(paginas);
  const modelo = modelos.find((m) => m.impressao === imp);
  if (modelo) {
    const mSup = Number(modelo.margem_superior), mInf = Number(modelo.margem_inferior), larg = Number(modelo.largura);
    const linha = modelo.referencia ? acharLinha(paginas, modelo.referencia, true) : null;
    if (linha) {
      const { x, y } = acimaDe(linha, larg, mSup, mInf, Number(modelo.desloc_x), Number(modelo.desloc_y));
      return { pagina: linha.pagina, x, y, largura: larg, referencia: modelo.referencia, confianca: "alta", origem: "modelo", margem_superior: mSup, margem_inferior: mInf, modeloId: modelo.id };
    }
    const pag = modelo.pagina === "ultima" ? total : limitar(Number(modelo.pagina) || total, 1, total);
    return { pagina: pag, x: Number(modelo.pos_x), y: Number(modelo.pos_y), largura: larg, referencia: modelo.referencia, confianca: modelo.referencia ? "media" : "alta", origem: "modelo", margem_superior: mSup, margem_inferior: mInf, modeloId: modelo.id };
  }
  for (const ref of REFERENCIAS) {
    const linha = acharLinha(paginas, ref.termo, true);
    if (linha) {
      // "Atenciosamente" fica acima do espaço da assinatura: assina logo abaixo dele.
      const abaixo = ref.termo === "atenciosamente";
      const pos = abaixo
        ? { x: limitar(linha.x + LARGURA_PADRAO / 2, LARGURA_PADRAO / 2, 1 - LARGURA_PADRAO / 2), y: limitar(linha.y + linha.h + 0.05, 0.02, 1 - MARGEM_INFERIOR_PADRAO) }
        : acimaDe(linha, LARGURA_PADRAO, MARGEM_SUPERIOR_PADRAO, MARGEM_INFERIOR_PADRAO);
      return { pagina: linha.pagina, ...pos, largura: LARGURA_PADRAO, referencia: linha.texto.trim(), confianca: ref.confianca, origem: "referencia", margem_superior: MARGEM_SUPERIOR_PADRAO, margem_inferior: MARGEM_INFERIOR_PADRAO };
    }
  }
  return { pagina: total, x: 0.5, y: 0.8, largura: LARGURA_PADRAO, referencia: null, confianca: "baixa", origem: "padrao", margem_superior: MARGEM_SUPERIOR_PADRAO, margem_inferior: MARGEM_INFERIOR_PADRAO };
}

/** Converte uma posição final (ajustada na prévia) em modelo reutilizável. */
export function criarModelo(nome: string, paginas: PaginaTexto[], loc: Localizacao): ModeloPosicao {
  const linha = loc.referencia ? acharLinha(paginas, loc.referencia, true) : null;
  const base = linha ? acimaDe(linha, loc.largura, loc.margem_superior, loc.margem_inferior) : null;
  return {
    nome, impressao: impressaoDigital(paginas), referencia: linha ? loc.referencia : null,
    pagina: loc.pagina === paginas.length ? "ultima" : String(loc.pagina),
    desloc_x: base ? loc.x - base.x : 0, desloc_y: base ? loc.y - base.y : 0,
    pos_x: loc.x, pos_y: loc.y, largura: loc.largura,
    margem_superior: loc.margem_superior, margem_inferior: loc.margem_inferior,
  };
}

export const ROTULO_CONFIANCA: Record<Confianca, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
