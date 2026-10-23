// Documentos FICTÍCIOS para testes da integração Central → SIGA.
import ExcelJS from "npm:exceljs@4.4.0";
import { jsPDF } from "npm:jspdf@2.5.2";

export const CNPJ_FICTICIO = "12345678000190";
const fmt = "12.345.678/0001-90";

export async function planilhaFicticia(total = 1000): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("RESUMO");
  ws.addRow(["Empresa/Módulo", "Qtd", "Mensalidade", "Valor"]);
  ws.addRow([`EMPRESA FICTICIA LTDA CNPJ: ${fmt}`]);
  ws.addRow(["M.Empresarial", 10, total / 10, total]);
  ws.addRow(["TOTAL", null, null, total]);
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer).buffer as ArrayBuffer;
}

export function pdfFicticio(total = "1.000,00", mensal = "100.00", cnpj = fmt): ArrayBuffer {
  const doc = new jsPDF();
  const linhas = [
    "NFS-e FICTICIA - TESTE",
    "TOMADOR DO SERVICO",
    "Nome / Nome Empresarial",
    "EMPRESA FICTICIA LTDA",
    `CNPJ ${cnpj}`,
    "TRIBUTACAO",
    "Descricao do Servico",
    `Enfermaria: 10x${mensal}= ${total}`,
  ];
  linhas.forEach((l, i) => doc.text(l, 10, 20 + i * 10));
  return doc.output("arraybuffer");
}

export const pdfIlegivel = (): ArrayBuffer => new TextEncoder().encode("%PDF-1.4\nlixo sem estrutura").buffer as ArrayBuffer;
