import ExcelJS from 'exceljs';
import fs from 'fs';

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('Administradoras');

const FAIXAS = ["0-18","19-23","24-28","29-33","34-38","39-43","44-48","49-53","54-58","59+"];
const baseCols = [
  "Nome*","CNPJ","Código Contrato","Operadora","Vidas","Dia Corte (1/5/10/20)",
  "Dia Movimentação","Dia Emissão Fatura","Dia Vencimento Fatura",
  "Email","Telefone","Contato","Endereço","Data Implantação (DD/MM/AAAA)",
  "Status (Ativa/Inativa)","% Reajuste","Observações"
];
const enfCols = FAIXAS.map(f => `Enf ${f} (R$)`);
const aptCols = FAIXAS.map(f => `Apt ${f} (R$)`);
const header = [...baseCols, ...enfCols, ...aptCols];
ws.addRow(header);
ws.getRow(1).font = { bold: true };
ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
ws.columns = header.map(h => ({ width: Math.max(14, h.length + 2) }));

// Exemplo
ws.addRow([
  "Administradora Exemplo LTDA","12.345.678/0001-99","ADM-001","Unimed",120,5,
  10,1,15,
  "contato@exemplo.com.br","(92) 99999-9999","João Silva","Rua Exemplo, 123","01/01/2026",
  "Ativa",10,"Contrato exemplo",
  ...Array(10).fill(""), ...Array(10).fill("")
]);

// Instruções
const ins = wb.addWorksheet('Instruções');
ins.columns = [{ width: 100 }];
const lines = [
  "TEMPLATE DE IMPORTAÇÃO — ADMINISTRADORAS",
  "",
  "• Campos com * são obrigatórios.",
  "• Nome é obrigatório. CNPJ e Código ajudam a evitar duplicidades.",
  "• Dia Corte aceita apenas 1, 5, 10 ou 20.",
  "• Dia Emissão/Vencimento Fatura: número de 1 a 31.",
  "• Status: Ativa ou Inativa (padrão: Ativa).",
  "• Data Implantação no formato DD/MM/AAAA.",
  "• % Reajuste: opcional. Se preenchido, será aplicado sobre os valores informados (Valor Atual → Valor Reajustado) no ano vigente.",
  "",
  "VALORES POR FAIXA ETÁRIA (10 faixas):",
  "0-18, 19-23, 24-28, 29-33, 34-38, 39-43, 44-48, 49-53, 54-58, 59+",
  "• Preencha em REAIS (ex.: 245,90).",
  "• Deixe em branco as faixas que não se aplicam.",
  "• Se preencher faixas Enf/Apt, o contrato será marcado como FAIXA ETÁRIA automaticamente.",
  "",
  "DUPLICIDADE:",
  "• Empresas existentes (pelo Código Contrato ou CNPJ) terão os dados atualizados.",
  "• Caso não exista, será criada com tipo_contrato = ADMINISTRADORA.",
];
lines.forEach(l => ins.addRow([l]));
ins.getRow(1).font = { bold: true, size: 14 };

await wb.xlsx.writeFile('public/template_administradoras.xlsx');
console.log('OK');
