// Extração dos dados de uma NFS-e (PDF) para preenchimento automático da
// "Carta de Cancelamento" (declaração enviada à SEMEF / Prefeitura de Manaus).

import { extrairTextoPdf } from "./pdf-analysis-utils";

export interface DadosCartaNfse {
  numero: string | null;
  dataEmissao: string | null; // DD/MM/AAAA
  valor: string | null; // já formatado "13.177,56"
  tomadorNome: string | null;
  tomadorCnpj: string | null; // formatado XX.XXX.XXX/XXXX-XX
  tomadorInscricaoMunicipal: string | null;
  prestadorNome: string | null;
  prestadorCnpj: string | null;
  prestadorInscricaoMunicipal: string | null;
  prestadorEndereco: string | null;
  prestadorCep: string | null;
}

const PRESTADOR_PADRAO = {
  nome: "SAMEL PLANO DE SAÚDE LTDA",
  cnpj: "84.537.141/0001-38",
  inscricao: "6708301",
  endereco: "Av. Joaquim Nabuco, 1542, Centro",
  cep: "69.020-030",
};

function limpar(t: string): string {
  return t.replace(/\u00a0/g, " ").replace(/\s{2,}/g, "  ");
}

/** Pega o texto que vem imediatamente após um rótulo. */
function aposRotulo(texto: string, rotulo: RegExp): string {
  const m = texto.match(rotulo);
  if (!m) return "";
  return texto.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 260);
}

function trecho(texto: string, ini: RegExp, fim: RegExp): string {
  const m = texto.match(ini);
  if (!m) return "";
  const resto = texto.slice((m.index ?? 0) + m[0].length);
  const f = resto.match(fim);
  return f ? resto.slice(0, f.index) : resto.slice(0, 1200);
}

function primeiroCnpj(t: string): string | null {
  const m = t.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  return m ? m[1] : null;
}

function inscricaoMunicipal(t: string): string | null {
  // Aceita "Indicador Municipal (Inscrição)", "Inscrição Municipal", "Inscr. Municipal"
  const rotulos = [
    /indicador\s+municipal[^\d]{0,40}(\d{4,12})/i,
    /inscri[çc][aã]o\s+municipal[^\d]{0,40}(\d{4,12})/i,
    /inscr\.?\s*municipal[^\d]{0,40}(\d{4,12})/i,
  ];
  for (const r of rotulos) {
    const m = t.match(r);
    if (m) return m[1];
  }
  return null;
}

function nomeEmpresarial(t: string): string | null {
  const bruto =
    aposRotulo(t, /nome\s*\/\s*nome\s*empresarial\s*/i) ||
    aposRotulo(t, /(nome\s+empresarial|raz[aã]o\s+social|nome\s*\/\s*raz[aã]o\s+social)\s*:?\s*/i);
  if (!bruto) return null;
  const nome = bruto
    .split(
      /\s{2,}|munic[ií]pio|c[oó]digo\s+ibge|endere[çc]o|e-?mail|telefone|cnpj|inscri|indicador|regime/i,
    )[0]
    .replace(/[\s\-–]+$/, "")
    .trim();
  return nome && nome.length > 2 ? nome.toUpperCase() : null;
}

/**
 * Extração por linhas (DANFSe v2.0): os rótulos ficam em uma linha e os valores
 * na linha imediatamente abaixo, em colunas separadas apenas por espaços.
 */
function linhasNormalizadas(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Remove as colunas "Município / Sigla UF" e "Código IBGE / CEP" da linha do nome. */
function limparNomeLinha(linha: string): string | null {
  let nome = linha;
  const m = nome.match(/\s\/\s[A-Z]{2}\b/);
  if (m) {
    const antes = nome.slice(0, m.index).trim().split(" ");
    antes.pop(); // remove o nome do município
    nome = antes.join(" ");
  }
  nome = nome
    .replace(/\s+\d{2}\.\d{5}\s*\/.*$/, "")
    .replace(/[\s\-–/]+$/, "")
    .trim();
  return nome.length > 2 ? nome.toUpperCase() : null;
}

interface TomadorLinhas {
  cnpj: string | null;
  im: string | null;
  nome: string | null;
}

function tomadorPorLinhas(texto: string): TomadorLinhas {
  const ls = linhasNormalizadas(texto);
  const vazio: TomadorLinhas = { cnpj: null, im: null, nome: null };
  const i = ls.findIndex(
    (l) =>
      /tomador\s*\/\s*adquirente/i.test(l) ||
      /tomador\s+d[oa]\s+servi[çc]o/i.test(l) ||
      /^tomador\b/i.test(l),
  );
  if (i < 0) return vazio;

  const out: TomadorLinhas = { ...vazio };

  // Linha de valores logo abaixo do cabeçalho: CNPJ, Inscrição, Telefone
  const linhaValores = ls[i + 1] || "";
  out.cnpj = linhaValores.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/)?.[1] || null;
  if (/indicador\s+municipal|inscri/i.test(ls[i])) {
    const depoisCnpj = out.cnpj
      ? linhaValores.slice(linhaValores.indexOf(out.cnpj) + out.cnpj.length)
      : linhaValores;
    out.im = depoisCnpj.match(/\b(\d{4,12})\b/)?.[1] || null;
  }
  if (!out.im) out.im = inscricaoMunicipal(`${ls[i]} ${linhaValores}`);

  // Nome empresarial: rótulo nas linhas seguintes, valor na linha de baixo
  for (let j = i + 1; j < Math.min(i + 8, ls.length); j++) {
    if (/nome\s*\/\s*nome\s+empresarial|nome\s+empresarial|raz[aã]o\s+social/i.test(ls[j])) {
      out.nome = limparNomeLinha(ls[j + 1] || "");
      break;
    }
  }

  return out;
}


/** Extrai os dados usados na carta a partir do texto da NFS-e. */
export function extrairDadosCarta(textoOriginal: string): DadosCartaNfse {
  const texto = limpar(textoOriginal);

  // Número da NFS-e
  let numero: string | null = null;
  const mNum = aposRotulo(texto, /n[uú]mero\s+d[ao]\s+nfs[\s-]?e\s*/i).match(/\b(\d{3,10})\b/);
  if (mNum) numero = mNum[1];
  if (!numero) {
    const mAlt = texto.match(/nfs[\s-]?e\s*n?[º°]?\s*(\d{3,10})/i);
    if (mAlt) numero = mAlt[1];
  }

  // Data de emissão
  let dataEmissao: string | null = null;
  const mData = aposRotulo(texto, /data\s+e\s+hora\s+da\s+emiss[aã]o\s+da\s+nfs[\s-]?e\s*/i).match(
    /(\d{2}\/\d{2}\/\d{4})/,
  );
  if (mData) dataEmissao = mData[1];

  // Valor: prioriza Valor Líquido, depois Valor da Operação / Serviço
  const acharValor = (rotulo: RegExp): string | null => {
    const m = aposRotulo(texto, rotulo).match(/R\$\s*([\d.]+,\d{2})/);
    return m ? m[1] : null;
  };
  let valor =
    acharValor(/valor\s+l[ií]quido\s+da\s+nfs[\s-]?e\s*(?!\+)/i) ||
    acharValor(/valor\s+da\s+opera[çc][aã]o\s*\/\s*servi[çc]o\s*/i) ||
    acharValor(/valor\s+total\s+da\s+nfs[\s-]?e\s*/i);
  if (valor === "0,00") {
    valor = acharValor(/valor\s+da\s+opera[çc][aã]o\s*\/\s*servi[çc]o\s*/i) || valor;
  }

  const blocoPrestador = trecho(
    texto,
    /prestador\s*(\/\s*fornecedor)?/i,
    /(tomador|destinat[aá]rio|intermedi[aá]rio)/i,
  );
  // Bloco do TOMADOR: prioriza o cabeçalho "TOMADOR / ADQUIRENTE"
  const fimTomador = /(destinat[aá]rio\s+da\s+opera|intermedi[aá]rio\s+da\s+opera|servi[çc]o\s+prestado)/i;
  const blocoTomador =
    trecho(texto, /tomador\s*\/\s*adquirente\s*/i, fimTomador) ||
    trecho(texto, /tomador\s+d[oa]\s+servi[çc]o\s*/i, fimTomador) ||
    trecho(texto, /tomador\s*/i, fimTomador);

  const endereco = aposRotulo(blocoPrestador, /endere[çc]o\s*/i)
    .split(/\s{2,}|e-?mail/i)[0]
    ?.trim();
  const cep = blocoPrestador.match(/(\d{2}\.\d{3}-\d{3})/)?.[1] || null;

  const imPrestador = inscricaoMunicipal(blocoPrestador) || PRESTADOR_PADRAO.inscricao;

  // Leitura por linhas (formato DANFSe: rótulos acima, valores abaixo)
  const porLinhas = tomadorPorLinhas(textoOriginal);

  // Inscrição municipal do tomador: linhas → bloco → última do documento
  let imTomador = porLinhas.im || inscricaoMunicipal(blocoTomador);
  if (!imTomador) {
    const todas = [...texto.matchAll(/(?:indicador|inscri[çc][aã]o|inscr\.?)\s*municipal[^\d]{0,40}(\d{4,12})/gi)]
      .map((m) => m[1])
      .filter((v) => v !== imPrestador);
    imTomador = todas.length ? todas[todas.length - 1] : null;
  }

  // Nome do tomador (assinatura)
  let nomeTomador = porLinhas.nome || nomeEmpresarial(blocoTomador);
  if (!nomeTomador) {
    const idx = texto.toLowerCase().lastIndexOf("nome empresarial");
    if (idx > 0) nomeTomador = nomeEmpresarial(texto.slice(idx - 20));
  }

  return {
    numero,
    dataEmissao,
    valor,
    tomadorNome: nomeTomador,
    tomadorCnpj: porLinhas.cnpj || primeiroCnpj(blocoTomador),
    tomadorInscricaoMunicipal: imTomador,

    prestadorNome: nomeEmpresarial(blocoPrestador) || PRESTADOR_PADRAO.nome,
    prestadorCnpj: primeiroCnpj(blocoPrestador) || PRESTADOR_PADRAO.cnpj,
    prestadorInscricaoMunicipal: imPrestador,
    prestadorEndereco: endereco || PRESTADOR_PADRAO.endereco,
    prestadorCep: cep || PRESTADOR_PADRAO.cep,
  };
}

/** Lê o PDF da NFS-e e devolve os dados da carta. */
export async function extrairDadosCartaDoPdf(buffer: ArrayBuffer): Promise<DadosCartaNfse> {
  const texto = await extrairTextoPdf(buffer);
  return extrairDadosCarta(texto);
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function dataLongaPtBr(d = new Date()): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

export interface CartaCampos {
  dataCarta: string;
  numero: string;
  dataEmissao: string;
  valor: string;
  tomadorNome: string;
  tomadorCnpj: string;
  tomadorInscricaoMunicipal: string;
  prestadorNome: string;
  prestadorCnpj: string;
  prestadorInscricaoMunicipal: string;
  prestadorEndereco: string;
  prestadorCep: string;
  motivoComplemento: string;
}

export function camposIniciais(d: DadosCartaNfse): CartaCampos {
  return {
    dataCarta: dataLongaPtBr(),
    numero: d.numero || "",
    dataEmissao: d.dataEmissao || "",
    valor: d.valor || "",
    tomadorNome: d.tomadorNome || "",
    tomadorCnpj: d.tomadorCnpj || "",
    tomadorInscricaoMunicipal: d.tomadorInscricaoMunicipal || "",
    prestadorNome: d.prestadorNome || PRESTADOR_PADRAO.nome,
    prestadorCnpj: d.prestadorCnpj || PRESTADOR_PADRAO.cnpj,
    prestadorInscricaoMunicipal: d.prestadorInscricaoMunicipal || PRESTADOR_PADRAO.inscricao,
    prestadorEndereco: d.prestadorEndereco || PRESTADOR_PADRAO.endereco,
    prestadorCep: d.prestadorCep || PRESTADOR_PADRAO.cep,
    motivoComplemento: "Nota não utilizada. Sendo assim, afirmo a desistência total e definitiva.",
  };
}

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Monta o corpo da carta em HTML (usado no preview, na impressão e no .doc). */
export function montarCartaHtml(c: CartaCampos): string {
  return `
<div class="carta">
  <h1><u><b>DECLARAÇÃO</b></u></h1>
  <p class="dir">Manaus, ${esc(c.dataCarta)}</p>
  <p>
    À<br/>
    Prefeitura Municipal de Manaus<br/>
    Secretaria Municipal de Finanças, Planejamento e Tecnologia da Informação - SEMEF<br/>
    ILMO. Senhor Secretário Municipal, de Economia e Finanças.
  </p>
  <p class="just">
    A empresa <b>${esc(c.prestadorNome)}</b>, inscrita no <b>CNPJ ${esc(c.prestadorCnpj)}</b>,
    <b>cadastro municipal ${esc(c.prestadorInscricaoMunicipal)}</b>, situada na ${esc(c.prestadorEndereco)},
    Cep: ${esc(c.prestadorCep)}, vem através dessa, <b>REQUERER</b> o <b>cancelamento</b> da
    <b>NFS-e ${esc(c.numero)}</b>, emitida no dia ${esc(c.dataEmissao)}, valor R$ ${esc(c.valor)},
    inscrita no CNPJ nº ${esc(c.tomadorCnpj)} e Inscrição Municipal <u>${esc(c.tomadorInscricaoMunicipal)}</u>.
  </p>
  <p class="just">
    <b>Motivo de cancelamento:</b> A nota fiscal de serviço emitida indevidamente pelo prestador,
    foi faturada indevidamente para o C.N.P.J nº <u>${esc(c.tomadorCnpj)}</u>, através da NFSe nº
    <b>${esc(c.numero)}</b>. ${esc(c.motivoComplemento)}<br/>Nesses termos,
  </p>
  <p>Pede deferimento.</p>
  <p class="ass">__________________________________<br/>
    ${esc(c.tomadorNome)}<br/>
    <span class="small">Assinatura do responsável e reconhecimento de assinatura (via cartório ou via certificado digital).</span>
  </p>
</div>`.trim();
}

const ESTILO_CARTA = `
.carta { font-family: Arial, Helvetica, sans-serif; font-size: 12pt; color: #111; line-height: 1.6; }
.carta h1 { text-align: center; font-size: 14pt; margin: 0 0 24px; }
.carta p { margin: 0 0 16px; }
.carta .dir { text-align: right; }
.carta .just { text-align: justify; }
.carta .ass { margin-top: 48px; }
.carta .small { font-size: 10pt; }
`;

export function cartaEstilo(): string {
  return ESTILO_CARTA;
}

function escXml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nomeArquivoCarta(c: CartaCampos): string {
  const alvo = (c.tomadorNome || "TOMADOR").split(/\s+/).slice(0, 3).join(" ");
  return `CARTA CANCELAMENTO ${alvo} ${c.numero || ""}`.trim();
}

/**
 * Gera o Word (.docx) usando o modelo timbrado oficial, preenchendo os campos
 * e preservando o layout, fontes e o papel timbrado do documento original.
 */
export async function baixarCartaDoc(c: CartaCampos): Promise<void> {
  const [{ default: JSZip }, { CARTA_MODELO_DOCX_BASE64 }] = await Promise.all([
    import("jszip"),
    import("./carta-modelo-docx"),
  ]);

  const bin = atob(CARTA_MODELO_DOCX_BASE64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const zip = await JSZip.loadAsync(bytes);
  const doc = await zip.file("word/document.xml")!.async("string");

  const valores: Record<string, string> = {
    DATA_CARTA: c.dataCarta,
    PRESTADOR_NOME: c.prestadorNome,
    PRESTADOR_CNPJ: c.prestadorCnpj,
    PRESTADOR_IM: c.prestadorInscricaoMunicipal,
    PRESTADOR_ENDERECO: c.prestadorEndereco,
    PRESTADOR_CEP: c.prestadorCep,
    NUMERO: c.numero,
    DATA_EMISSAO: c.dataEmissao,
    VALOR: c.valor,
    TOMADOR_CNPJ: c.tomadorCnpj,
    TOMADOR_IM: c.tomadorInscricaoMunicipal,
    TOMADOR_NOME: c.tomadorNome,
    MOTIVO: c.motivoComplemento,
  };

  const preenchido = doc.replace(/\{\{([A-Z_]+)\}\}/g, (all, chave: string) =>
    chave in valores ? escXml(valores[chave]) : all,
  );

  zip.file("word/document.xml", preenchido);
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeArquivoCarta(c)}.docx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Abre a janela de impressão (para salvar em PDF) com a carta. */
export function imprimirCarta(c: CartaCampos): void {
  const w = window.open("", "_blank", "width=880,height=1000");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Carta de Cancelamento</title>
<style>@page { size: A4; margin: 2.5cm; } body { margin: 2.5cm; } ${ESTILO_CARTA}</style></head>
<body>${montarCartaHtml(c)}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
