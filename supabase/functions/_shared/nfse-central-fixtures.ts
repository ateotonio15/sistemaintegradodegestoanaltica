// Documentos FICTÍCIOS para testes da integração Central → SIGA.
import ExcelJS from "npm:exceljs@4.4.0";
import { jsPDF } from "npm:jspdf@2.5.2";

export const CNPJ_FICTICIO = "12345678000190";
const fmt = "12.345.678/0001-90";

export async function planilhaFicticia(total = 1000, extras: [string, number | null, number][] = [], mensal = true, abaExtra = false): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("RESUMO");
  ws.addRow(["Empresa/Módulo", "Qtd", "Mensalidade", "Valor"]);
  ws.addRow([`EMPRESA FICTICIA LTDA CNPJ: ${fmt}`]);
  if (mensal) ws.addRow(["M.Empresarial", 10, total / 10, total]);
  for (const [rot, q, v] of extras) ws.addRow(q == null ? [rot] : [rot, q, null, v]);
  if (abaExtra) wb.addWorksheet("OBS").addRow(["Arquivo reemitido"]);
  ws.addRow(["TOTAL", null, null, (mensal ? total : 0) + extras.reduce((a, e) => a + e[2], 0)]);
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer).buffer as ArrayBuffer;
}

export const CHAVE_FICTICIA = "13025322123456780001900000000000000012326100000001";
export const PRESTADOR_FICTICIO = "11222333000181";
export interface IdentFicticia { chave?: string | null; numero?: string | null; prestador?: string | null; emissao?: string | null }
const identLinhas = (i: IdentFicticia = {}) => {
  const v = <K extends keyof IdentFicticia>(k: K, d: string) => (i[k] === undefined ? d : i[k]);
  const chave = v("chave", CHAVE_FICTICIA), numero = v("numero", "123"), prest = v("prestador", "11.222.333/0001-81"), emi = v("emissao", "22/10/2026 09:00:00");
  return [
    ...(chave ? ["Chave de Acesso da NFS-e", chave] : []),
    ...(numero ? [`Numero da NFS-e ${numero}`] : []),
    "Competencia da NFS-e 01/10/2026",
    ...(emi ? [`Data e Hora da emissao da NFS-e ${emi}`] : []),
    "EMITENTE DA NFS-e", "PRESTADOR FICTICIO SA", ...(prest ? [`CNPJ ${prest}`] : []),
  ];
};
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
const moeda = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** `valorServico` = valor fiscal bruto; padrão = descritivo completo; `null` = ausente. */
export function pdfFicticio(total = "1.000,00", mensal = "100.00", cnpj = fmt, inclusao: string | null = null, valorServico?: string | null, ident?: IdentFicticia): ArrayBuffer {
  const vs = valorServico === undefined ? moeda(num(total) + (inclusao ? num(inclusao) : 0)) : valorServico;
  const doc = new jsPDF();
  const linhas = [
    "NFS-e FICTICIA - TESTE",
    ...identLinhas(ident),
    "TOMADOR DO SERVICO",
    "Nome / Nome Empresarial",
    "EMPRESA FICTICIA LTDA",
    `CNPJ ${cnpj}`,
    "TRIBUTACAO",
    "Descricao do Servico",
    `Enfermaria: 10x${mensal}= ${total}${inclusao ? ` Inclusão:${inclusao}` : ""}`,
    ...(vs ? ["VALORES", `Valor do Servico R$ ${vs}`] : []),
  ];
  doc.setFontSize(10);
  linhas.forEach((l, i) => doc.text(l, 10, 15 + i * 7));
  return doc.output("arraybuffer");
}

export const pdfIlegivel = (): ArrayBuffer => new TextEncoder().encode("%PDF-1.4\nlixo sem estrutura").buffer as ArrayBuffer;

/** NFS-e fictícia só com inclusões (faturamento sem mensalidade). */
export function pdfSoInclusaoFicticio(inclusao = "200,00", cnpj = fmt): ArrayBuffer {
  const doc = new jsPDF();
  doc.setFontSize(10);
  ["NFS-e FICTICIA - TESTE", ...identLinhas(), "TOMADOR DO SERVICO", "Nome / Nome Empresarial", "EMPRESA FICTICIA LTDA", `CNPJ ${cnpj}`, "TRIBUTACAO", "Descricao do Servico", `Inclusão:${inclusao}`, "VALORES", `Valor do Servico R$ ${inclusao}`]
    .forEach((l, i) => doc.text(l, 10, 15 + i * 7));
  return doc.output("arraybuffer");
}
