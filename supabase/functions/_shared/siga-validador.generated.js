// ARQUIVO GERADO por scripts/build-nfse-validador.mjs a partir de src/lib — não editar.
// deno-lint-ignore-file

// src/lib/excel-analysis-utils.ts
import ExcelJS from "npm:exceljs@4.4.0";

// src/lib/regras-empresariais.ts
var STORAGE_KEY = "financeiro:regras_empresariais:v1";
var BUILTIN_REGRAS = [
  {
    id: "builtin:pioneiro_combustiveis",
    padrao: "pioneiro combustiveis",
    empresa: "Pioneiro Combust\xEDveis LTD",
    tipo: "agrupar_por_nome",
    origem: "builtin",
    descricao: 'Todos os benefici\xE1rios cujo subestipulante (coluna Pagador) contenha "PIONEIRO COMBUSTIVEIS LTD" s\xE3o consolidados em um \xFAnico bloco de an\xE1lise, independente do CNPJ. Isso significa que matriz + filiais (CNPJs diferentes) s\xE3o tratadas como uma s\xF3 empresa: vidas de enfermaria/apartamento, inclus\xF5es, exclus\xF5es, devolu\xE7\xF5es, retroativas, taxa de ades\xE3o e faixas et\xE1rias s\xE3o somados antes da compara\xE7\xE3o com o PDF. O aviso do bloco lista todos os CNPJs agrupados.'
  },
  {
    id: "builtin:jabil_industrial",
    padrao: "jabil industrial do brasil",
    empresa: "Jabil Industrial do Brasil LTDA",
    tipo: "agrupar_por_nome",
    origem: "builtin",
    descricao: 'Benefici\xE1rios cujo subestipulante contenha "JABIL INDUSTRIAL DO BRASIL" s\xE3o agrupados pelo NOME completo do pagador (ignorando CNPJ). Como matriz e filial t\xEAm nomes distintos ("JABIL INDUSTRIAL DO BRASIL LTDA" vs. "JABIL INDUSTRIAL DO BRASIL LTDA - FILIAL"), cada uma continua em seu pr\xF3prio bloco de an\xE1lise \u2014 tratadas como empresas independentes \u2014 mas eventuais CNPJs distintos dentro do mesmo nome s\xE3o consolidados.'
  }
];
function loadCustom() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (r) => r && typeof r.id === "string" && typeof r.padrao === "string" && typeof r.empresa === "string" && typeof r.descricao === "string"
    ).map((r) => ({ ...r, origem: "custom" }));
  } catch {
    return [];
  }
}
function listarRegras() {
  return [...BUILTIN_REGRAS, ...loadCustom()];
}
function getForceGroupByNamePatterns() {
  return listarRegras().filter((r) => r.tipo === "agrupar_por_nome").map((r) => normalize(r.padrao)).filter(Boolean);
}
function normalize(s) {
  return (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// src/lib/excel-analysis-utils.ts
function reclassificarRetroComoReajuste(b) {
  if (!b.retroativas) return;
  b.retroativasReajuste = { ...b.retroativas };
  b.retroativasBeneficiarios = void 0;
}
function cellToText(v) {
  if (v === null || v === void 0) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : v.toISOString();
  if (Array.isArray(v)) return v.map(cellToText).join(" ");
  if (typeof v === "object") {
    const any = v;
    if (Array.isArray(any.richText)) return any.richText.map((p) => cellToText(p?.text)).join("");
    if ("result" in any && any.result !== void 0 && any.result !== null) return cellToText(any.result);
    if ("text" in any) return cellToText(any.text);
    if ("formula" in any) return cellToText(any.formula);
  }
  return String(v ?? "");
}
function norm(s) {
  return cellToText(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}
function toNumber(v) {
  if (v === null || v === void 0 || v === "") return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "result" in v) {
    return toNumber(v.result);
  }
  let s = cellToText(v).trim();
  s = s.replace(/[R$\s]/g, "");
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}
var COL_PLANO = ["plano", "planos", "tipo plano", "tipo de plano", "nome do plano"];
var COL_TIPO_COBRANCA = [
  "tipo cobranca",
  "tipo de cobranca",
  "tipo cobran\xE7a",
  "cobranca",
  "movimento",
  "tipo movimento"
];
var COL_VALOR = ["valor", "mensalidade", "valor mensalidade", "vlr", "preco", "valor total"];
var COL_CNPJ = ["cnpj", "cnpj pagador", "cnpj do pagador", "cnpj empresa"];
var COL_PAGADOR = ["subestipulante", "sub estipulante", "sub-estipulante", "pagador", "nome pagador", "nome do pagador", "razao social", "raz\xE3o social", "empresa", "contratante", "nome empresa", "nome da empresa"];
var COL_FAIXA_ETARIA = ["fx etaria", "fx et\xE1ria", "faixa etaria", "faixa et\xE1ria", "grupo faixa etaria", "grupo faixa et\xE1ria"];
function normMatch(s) {
  return norm(s).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function normalizarCnpj(s) {
  const d = String(s ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.length < 14) return d.padStart(14, "0");
  return d;
}
function formatCnpjSufixo(cnpj) {
  const d = normalizarCnpj(cnpj);
  if (d.length < 14) return "";
  return `${d.slice(8, 12)}-${d.slice(12, 14)}`;
}
function formatNomeComCnpj(nome, cnpj) {
  const sufixo = formatCnpjSufixo(cnpj);
  const n = String(nome ?? "").trim() || "Sem nome";
  return sufixo ? `${n} \u2014 ${sufixo}` : n;
}
function extrairCnpjsDoWorkbook(wb) {
  const porNome = /* @__PURE__ */ new Map();
  const todos = /* @__PURE__ */ new Set();
  const reCnpj = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/g;
  const sheets = [...wb.worksheets].sort((a, b) => {
    const ra = norm(a.name).includes("resumo") ? 0 : 1;
    const rb = norm(b.name).includes("resumo") ? 0 : 1;
    return ra - rb;
  });
  for (const ws of sheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values.slice(1);
      values.forEach((cell, i) => {
        const s = cellToText(cell);
        if (!s) return;
        let m;
        reCnpj.lastIndex = 0;
        while ((m = reCnpj.exec(s)) !== null) {
          const cnpj = normalizarCnpj(m[1]);
          if (cnpj.length !== 14) continue;
          todos.add(cnpj);
          let nome = s.slice(0, m.index).trim();
          nome = nome.replace(/^(empresa|pagador|razao social|razão social)\s*[:\-]\s*/i, "").trim();
          if (!nome && i > 0) nome = cellToText(values[i - 1]).trim();
          if (!nome) continue;
          const key = normMatch(nome);
          if (key && !porNome.has(key)) porNome.set(key, cnpj);
        }
      });
    });
  }
  return { porNome, todos };
}
function findColumnIndex(header, aliases) {
  for (let i = 0; i < header.length; i++) {
    const h = norm(header[i]);
    if (!h) continue;
    for (const alias of aliases) {
      const aliasNorm = norm(alias);
      const hMatch = normMatch(h);
      const aliasMatch = normMatch(aliasNorm);
      if (h === aliasNorm || h.includes(aliasNorm) || hMatch === aliasMatch || hMatch.includes(aliasMatch)) return i;
    }
  }
  return -1;
}
function findPagadorColumnIndex(header) {
  for (const alias of COL_PAGADOR) {
    const idx = findColumnIndex(header, [alias]);
    if (idx >= 0) return idx;
  }
  return -1;
}
function classificarPlano(plano) {
  const p = norm(plano);
  if (!p) return null;
  if (p.includes("master executivo") || p.includes("coletivo executivo master") || p.includes("apartamento") || // Variações abreviadas de "M. Executivo" / "M Executivo" / "M.Executivo"
  /\bm[\s.\-_]*executivo\b/.test(p) || /\bexecutivo\b/.test(p)) {
    return "apartamento";
  }
  if (p.includes("coletivo empresarial master") || p.includes("master empresarial") || p.includes("enfermaria") || // Variações abreviadas: "Enf CE", "Enf. CE", "ENF-CE"
  /\benf(\b|[\s.\-_])/i.test(p) || // Variações abreviadas de "M. Empresarial" / "M Empresarial" / "M.Empresarial"
  /\bm[\s.\-_]*empresarial\b/.test(p) || /\bempresarial\b/.test(p)) {
    return "enfermaria";
  }
  if (/\b(gold|class|classic)\s*\+|\b(gold|class|classic)[\s.\-_]*plus\b/.test(p)) {
    return "apartamento";
  }
  if (/\b(gold|class|classic)\b/.test(p)) {
    return "enfermaria";
  }
  return null;
}
function parseFaixaEtariaLabel(raw) {
  const original = cellToText(raw).trim();
  if (!original) return null;
  const s = norm(original).replace(/anos?/g, "").replace(/idade/g, "").replace(/\s+/g, " ").trim();
  const faixa = s.match(/(\d{1,3})\s*(?:[àa]|-|–|—|ate|até)\s*(\d{1,3})/i);
  if (faixa) {
    const ini = parseInt(faixa[1], 10);
    const fim = parseInt(faixa[2], 10);
    return { label: `${ini} \xE0 ${fim}`, idadeInicial: ini, idadeFinal: fim, quantidade: 0, total: 0 };
  }
  const mais = s.match(/(\d{1,3})\s*(?:\+|mais|acima)/i);
  if (mais) {
    const ini = parseInt(mais[1], 10);
    return { label: `${ini}+`, idadeInicial: ini, idadeFinal: null, quantidade: 0, total: 0 };
  }
  return null;
}
function isInclusao(tipo) {
  const t = norm(tipo);
  return t.includes("inclus") || t.includes("retroativ");
}
function isRetroativa(tipo) {
  return norm(tipo).includes("retroativ");
}
function isExclusao(tipo) {
  const t = norm(tipo);
  return t.includes("exclus") || t.includes("excluid");
}
function isDevolucao(tipo) {
  const t = norm(tipo);
  return t.includes("devolu") || t.includes("devolvid");
}
function isPermuta(tipo) {
  return norm(tipo).includes("permuta");
}
function isTaxaAdesao(tipo) {
  const t = norm(tipo);
  return /\bades[aã]o\b/.test(t) || t.includes("taxa de adesao") || t.includes("taxa adesao");
}
function rowHasTaxaAdesao(row, idxTipo) {
  if (idxTipo >= 0 && isTaxaAdesao(String(row[idxTipo] ?? ""))) return true;
  return row.some((cell) => isTaxaAdesao(String(cell ?? "")));
}
var brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function formatBRL(n) {
  if (!isFinite(n)) return "R$ 0,00";
  return brl.format(n);
}
var eqMoney = (a, b) => Math.abs(a - b) < 0.01;
var eqInt = (a, b) => Math.round(a) === Math.round(b);
function campo(excel, pdf, kind) {
  if (pdf === null || pdf === void 0 || isNaN(pdf)) {
    return { excel, pdf: null, ok: false };
  }
  const ok = kind === "money" ? eqMoney(excel, pdf) : eqInt(excel, pdf);
  return { excel, pdf, ok };
}
function obterDivergenciasNotaFiscal(dados) {
  const tributos = dados?.tributos;
  if (!tributos) return [];
  const divergencias = [];
  const aprox = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
  const valorServico = tributos.valorServico;
  const valorLiquido = dados?.valorLiquido ?? null;
  const issqnDev = tributos.issqn;
  let issqnRet = tributos.issqnRetido;
  if (tributos.retencaoIssqn === "retido" && issqnRet == null && valorServico != null && valorLiquido != null) {
    const calculado = Number((valorServico - valorLiquido).toFixed(2));
    if (calculado > 0.01) issqnRet = calculado;
  }
  if (tributos.retencaoIssqn === "retido" && issqnRet == null && issqnDev != null) {
    issqnRet = issqnDev;
  }
  if (tributos.retencaoIssqn === "retido" && issqnRet != null && issqnDev != null && !aprox(issqnRet, issqnDev)) {
    divergencias.push(
      `ISSQN Retido (${formatBRL(issqnRet)}) deveria ser igual ao ISSQN Apurado (${formatBRL(issqnDev)}).`
    );
  }
  if (valorLiquido != null && valorServico != null) {
    if (tributos.retencaoIssqn === "retido" && issqnRet != null) {
      const esperado = Number((valorServico - issqnRet).toFixed(2));
      if (!aprox(esperado, valorLiquido)) {
        divergencias.push(
          `Valor L\xEDquido (${formatBRL(valorLiquido)}) deveria ser Valor do Servi\xE7o \u2212 ISSQN Retido = ${formatBRL(esperado)}.`
        );
      }
    } else if (tributos.retencaoIssqn === "nao_retido" && !aprox(valorServico, valorLiquido)) {
      divergencias.push(
        `ISSQN n\xE3o retido: Valor L\xEDquido (${formatBRL(valorLiquido)}) deveria ser igual ao Valor do Servi\xE7o (${formatBRL(valorServico)}).`
      );
    }
  }
  return divergencias;
}
function compararExcelComPdf(excel, pdf, tipoAnalise) {
  const divergencias = [];
  const isFaixaEtaria = String(tipoAnalise ?? "").toLowerCase().replace(/[\s-]+/g, "_") === "faixa_etaria";
  const tem = (c2) => c2.beneficiarios > 0 || c2.total > 0;
  let enfermaria = null;
  if (tem(excel.enfermaria)) {
    const e = excel.enfermaria;
    const p = pdf?.enfermaria;
    const pdfEnc = p && (p.beneficiarios !== null || p.total > 0);
    enfermaria = {
      beneficiarios: campo(e.beneficiarios, pdfEnc ? p.beneficiarios : null, "int"),
      mensalidade: campo(e.mensalidade, pdfEnc ? p.mensalidade : null, "money"),
      total: campo(e.total, pdfEnc ? p.total : null, "money")
    };
    if (isFaixaEtaria) enfermaria.mensalidade.ok = true;
    if (pdf && !pdfEnc) divergencias.push("Categoria Enfermaria n\xE3o encontrada no PDF.");
    else if (pdfEnc) {
      if (!enfermaria.beneficiarios.ok)
        divergencias.push(
          `Diverg\xEAncia nos benefici\xE1rios da enfermaria (Excel ${e.beneficiarios} \xD7 PDF ${p.beneficiarios ?? "\u2014"}).`
        );
      if (!isFaixaEtaria && !enfermaria.mensalidade.ok)
        divergencias.push(
          `Diverg\xEAncia na mensalidade da enfermaria (Excel ${formatBRL(e.mensalidade)} \xD7 PDF ${p.mensalidade !== null ? formatBRL(p.mensalidade) : "\u2014"}).`
        );
      if (!enfermaria.total.ok)
        divergencias.push(
          `Total da enfermaria n\xE3o confere com o PDF (Excel ${formatBRL(e.total)} \xD7 PDF ${formatBRL(p.total)}).`
        );
    }
  }
  let apartamento = null;
  if (tem(excel.apartamento)) {
    const e = excel.apartamento;
    const p = pdf?.apartamento;
    const pdfEnc = p && (p.beneficiarios !== null || p.total > 0);
    apartamento = {
      beneficiarios: campo(e.beneficiarios, pdfEnc ? p.beneficiarios : null, "int"),
      mensalidade: campo(e.mensalidade, pdfEnc ? p.mensalidade : null, "money"),
      total: campo(e.total, pdfEnc ? p.total : null, "money")
    };
    if (isFaixaEtaria) apartamento.mensalidade.ok = true;
    if (pdf && !pdfEnc) divergencias.push("Categoria Apartamento n\xE3o encontrada no PDF.");
    else if (pdfEnc) {
      if (!apartamento.beneficiarios.ok)
        divergencias.push(
          `Diverg\xEAncia nos benefici\xE1rios do apartamento (Excel ${e.beneficiarios} \xD7 PDF ${p.beneficiarios ?? "\u2014"}).`
        );
      if (!isFaixaEtaria && !apartamento.mensalidade.ok)
        divergencias.push(
          `Diverg\xEAncia na mensalidade do apartamento (Excel ${formatBRL(e.mensalidade)} \xD7 PDF ${p.mensalidade !== null ? formatBRL(p.mensalidade) : "\u2014"}).`
        );
      if (!apartamento.total.ok)
        divergencias.push(
          `Total do apartamento n\xE3o confere com o PDF (Excel ${formatBRL(e.total)} \xD7 PDF ${formatBRL(p.total)}).`
        );
    }
  }
  let inclusoes = null;
  const pdfIncTotal = pdf ? pdf.inclusoes.total : null;
  if (excel.inclusoes.quantidade > 0 || excel.inclusoes.total !== 0 || (pdfIncTotal ?? 0) > 0) {
    const c2 = campo(excel.inclusoes.total, pdfIncTotal && pdfIncTotal > 0 ? pdfIncTotal : null, "money");
    inclusoes = { total: c2 };
    if (pdf && (!pdfIncTotal || pdfIncTotal <= 0) && excel.inclusoes.total !== 0) {
      const retroTotal = excel.retroativas?.total ?? 0;
      const soRetro = retroTotal > 0 && Math.abs(excel.inclusoes.total - retroTotal) < 0.01;
      divergencias.push(
        soRetro ? "Valor de cobran\xE7a retroativa n\xE3o encontrado no PDF." : "Valor de inclus\xF5es n\xE3o encontrado no PDF."
      );
    } else if (pdf && !c2.ok)
      divergencias.push(
        `Valor de inclus\xF5es divergente (Excel ${formatBRL(excel.inclusoes.total)} \xD7 PDF ${formatBRL(pdfIncTotal)}).`
      );
  }
  let exclusoes = null;
  if (excel.exclusoes && (excel.exclusoes.quantidade > 0 || excel.exclusoes.total !== 0)) {
    const pdfTotal = pdf && pdf.exclusoes.total !== null ? pdf.exclusoes.total : null;
    const c2 = campo(excel.exclusoes.total, pdfTotal, "money");
    exclusoes = { total: c2 };
    if (pdf && pdfTotal === null)
      divergencias.push("Valor de exclus\xF5es n\xE3o encontrado no PDF.");
    else if (pdf && !c2.ok)
      divergencias.push(
        `Valor de exclus\xF5es divergente (Excel ${formatBRL(excel.exclusoes.total)} \xD7 PDF ${formatBRL(pdfTotal)}).`
      );
  }
  let devolucoes = null;
  const excelTemDevolucao = !!excel.devolucoes && (excel.devolucoes.quantidade > 0 || excel.devolucoes.total !== 0);
  const pdfDevolucaoTotal = pdf && pdf.devolucoes?.total !== null && pdf.devolucoes?.total !== void 0 ? pdf.devolucoes.total : null;
  if (excelTemDevolucao || pdfDevolucaoTotal !== null) {
    const excelTotal = excel.devolucoes?.total ?? 0;
    const c2 = campo(excelTotal, pdfDevolucaoTotal, "money");
    devolucoes = { total: c2 };
    if (pdf && excelTemDevolucao && pdfDevolucaoTotal === null)
      divergencias.push("Valor de devolu\xE7\xE3o n\xE3o encontrado no PDF.");
    else if (pdf && !excelTemDevolucao && pdfDevolucaoTotal !== null)
      divergencias.push(`Devolu\xE7\xE3o encontrada no PDF (${formatBRL(pdfDevolucaoTotal)}), mas n\xE3o encontrada no Excel.`);
    else if (pdf && !c2.ok)
      divergencias.push(
        `Valor de devolu\xE7\xE3o divergente (Excel ${formatBRL(excelTotal)} \xD7 PDF ${formatBRL(pdfDevolucaoTotal)}).`
      );
  }
  let taxaAdesao = null;
  const adesaoExcel = excel.taxaAdesao?.total ?? 0;
  const adesaoPdf = pdf?.taxaAdesao?.total ?? null;
  if (adesaoExcel !== 0 || (excel.taxaAdesao?.quantidade ?? 0) > 0 || adesaoPdf !== null) {
    const total = { excel: adesaoExcel, pdf: adesaoPdf, ok: adesaoPdf !== null && Math.round(adesaoExcel * 100) === Math.round(adesaoPdf * 100) };
    taxaAdesao = { total, quantidade: { excel: excel.taxaAdesao?.quantidade ?? 0, pdf: pdf?.taxaAdesao?.quantidade ?? null, conferida: false } };
    if (pdf && adesaoPdf === null) divergencias.push("Taxa de ades\xE3o n\xE3o encontrada explicitamente ou com linhas amb\xEDguas no PDF.");
    else if (pdf && !total.ok) divergencias.push("Total da taxa de ades\xE3o divergente entre Excel e PDF.");
  }
  divergencias.push(...obterDivergenciasNotaFiscal(pdf));
  return {
    pagador: excel.pagador,
    arquivoPdf: pdf?.arquivo ?? null,
    enfermaria,
    apartamento,
    inclusoes,
    exclusoes,
    devolucoes,
    taxaAdesao,
    divergencias,
    avisosPdf: pdf?.avisos ?? [],
    valorLiquido: pdf?.valorLiquido ?? null,
    tributos: pdf?.tributos ?? null
  };
}
function parseCoparticipacaoRows(rows) {
  const items = [];
  let anchorRow = -1;
  let anchorCol = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    for (let c2 = 0; c2 < r.length; c2++) {
      const t = norm(r[c2]);
      if (t && t.includes("copartic") && t.includes("empresarial")) {
        anchorRow = i;
        anchorCol = c2;
        break;
      }
    }
    if (anchorRow >= 0) break;
  }
  if (anchorRow < 0) return items;
  let qtdCol = -1;
  let valCol = -1;
  const scanCols = (rr, minCol) => {
    for (let c2 = minCol; c2 < rr.length; c2++) {
      const t = norm(rr[c2]);
      if (!t) continue;
      if (qtdCol < 0 && (t === "qtd" || t.includes("soma de qtd") || t.includes("quantidade"))) qtdCol = c2;
      if (valCol < 0 && (t === "valor" || t.includes("soma de valor") || t.includes("valor total"))) valCol = c2;
    }
  };
  for (let i = anchorRow; i >= 0 && i >= anchorRow - 10; i--) {
    scanCols(rows[i] || [], anchorCol + 1);
    if (valCol >= 0 || qtdCol >= 0) break;
  }
  if (qtdCol < 0 && valCol < 0) {
    for (const r of rows) scanCols(r || [], 0);
  }
  const semQtd = qtdCol < 0 && valCol >= 0;
  if (qtdCol < 0 && !semQtd) qtdCol = anchorCol + 1;
  if (valCol < 0) valCol = qtdCol >= 0 ? qtdCol + 1 : anchorCol + 2;
  if (qtdCol === valCol) qtdCol = -1;
  const readQtd = (rr) => qtdCol < 0 ? 0 : Math.round(toNumber(rr[qtdCol]));
  const anchorQtd = readQtd(rows[anchorRow] || []);
  const anchorVal = toNumber((rows[anchorRow] || [])[valCol]);
  const anchorEhLeaf = !isNaN(anchorQtd) && anchorQtd !== 0 || !isNaN(anchorVal) && anchorVal !== 0;
  const pushItem = (label, qtd, val) => {
    const nomeLimpo = label.replace(/^\s*pj\s*[-–—:]?\s*/i, "").trim();
    if (!nomeLimpo) return;
    const qtdOk = !isNaN(qtd) && qtd !== 0;
    const valOk = !isNaN(val) && val !== 0;
    if (!qtdOk && !valOk) return;
    items.push({
      nome: nomeLimpo,
      quantidade: isNaN(qtd) ? 0 : qtd,
      total: isNaN(val) ? 0 : val
    });
  };
  let temPjAposAncora = false;
  for (let j = anchorRow + 1; j < rows.length; j++) {
    const rr = rows[j] || [];
    const label = cellToText(rr[anchorCol]).trim();
    const norml = norm(label);
    if (!label) continue;
    if (norml.startsWith("total geral") || norml.startsWith("total ")) break;
    if (norml.includes("copartic")) continue;
    if (/^\s*pj\s*[-–—:]/i.test(label)) {
      temPjAposAncora = true;
      break;
    }
  }
  if (temPjAposAncora) {
    for (let j = anchorRow + 1; j < rows.length; j++) {
      const rr = rows[j] || [];
      const label = cellToText(rr[anchorCol]).trim();
      const norml = norm(label);
      if (!label) continue;
      if (norml.startsWith("total geral") || norml.startsWith("total ")) break;
      if (norml.includes("copartic")) continue;
      const qtd = readQtd(rr);
      const val = toNumber(rr[valCol]);
      pushItem(label, qtd, val);
    }
  } else if (anchorEhLeaf) {
    for (let i = 0; i < rows.length; i++) {
      const rr = rows[i] || [];
      const label = cellToText(rr[anchorCol]).trim();
      if (!/^\s*pj\s*[-–—:]/i.test(label)) continue;
      let j = i + 1;
      while (j < rows.length) {
        const nx = cellToText((rows[j] || [])[anchorCol]).trim();
        if (nx) break;
        j++;
      }
      const proxLabel = norm((rows[j] || [])[anchorCol]);
      if (!(proxLabel && proxLabel.includes("copartic") && proxLabel.includes("empresarial"))) continue;
      const qtd = readQtd(rr);
      const val = toNumber(rr[valCol]);
      pushItem(label, qtd, val);
    }
    if (items.length === 0) {
      pushItem("Coparticipa\xE7\xE3o", anchorQtd, anchorVal);
    }
  } else {
    for (let j = anchorRow + 1; j < rows.length; j++) {
      const rr = rows[j] || [];
      const label = cellToText(rr[anchorCol]).trim();
      const norml = norm(label);
      if (!label) continue;
      if (norml.startsWith("total geral") || norml.startsWith("total ")) break;
      if (norml.includes("copartic")) continue;
      const qtd = readQtd(rr);
      const val = toNumber(rr[valCol]);
      pushItem(label, qtd, val);
    }
  }
  return items;
}
function parseCoparticipacaoResumoPorCnpj(rows, idxLabel, idxValor, idxQtd = -1) {
  const items = [];
  if (idxLabel < 0 || idxValor < 0) return items;
  const reCnpj = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const lbl = cellToText(r[idxLabel]).trim();
    const lblNorm = norm(lbl);
    if (!lblNorm) continue;
    const lblSemSep = lblNorm.replace(/[^a-z0-9]/g, "");
    const isAnchor = lblSemSep.includes("coparticipacao") && !lblNorm.includes("empresarial") && !/^\s*pj\s*[-–—:]/i.test(lbl);
    if (!isAnchor) continue;
    const reCnpjEstrito = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/;
    let empresaNome = "";
    const cleanupNome = (s) => s.replace(/\b(cnpj|c\.n\.p\.j\.?)\b\s*[:\-]?\s*/gi, "").trim().replace(/^[-–—:]\s*/, "").replace(/[-–—:]\s*$/, "").trim();
    for (let k = i - 1; k >= 0 && !empresaNome; k--) {
      const rk = rows[k] || [];
      const txt = cellToText(rk[idxLabel]);
      const m = txt.match(reCnpjEstrito);
      if (m) {
        let n = cleanupNome(txt.slice(0, m.index));
        if (!n) n = cleanupNome(txt.slice((m.index ?? 0) + m[1].length));
        empresaNome = n;
      }
    }
    if (!empresaNome) continue;
    const valorNaAncora = toNumber(r[idxValor]);
    if (!isNaN(valorNaAncora) && valorNaAncora !== 0) {
      const qtdNaAncora = idxQtd >= 0 ? Math.round(toNumber(r[idxQtd])) : NaN;
      items.push({
        nome: empresaNome,
        quantidade: isNaN(qtdNaAncora) ? 0 : qtdNaAncora,
        total: valorNaAncora
      });
      continue;
    }
    let somaPlanos = 0;
    let totalDaLinha = NaN;
    for (let j = i + 1; j < Math.min(rows.length, i + 25); j++) {
      const rr = rows[j] || [];
      const lblJ = cellToText(rr[idxLabel]).trim();
      const lblJNorm = norm(lblJ);
      const lblJSemSep = lblJNorm.replace(/[^a-z0-9]/g, "");
      if (lblJSemSep.includes("coparticipacao") && j > i + 1) break;
      if (reCnpj.test(lblJ)) break;
      let temTotal = false;
      let temTotalGeral = false;
      for (const c2 of rr) {
        const t = norm(c2);
        if (!t) continue;
        if (t.startsWith("total geral")) {
          temTotalGeral = true;
          break;
        }
        if (t === "total" || t === "totais") temTotal = true;
      }
      if (temTotalGeral) break;
      const val = toNumber(rr[idxValor]);
      if (temTotal) {
        if (!isNaN(val) && val !== 0) totalDaLinha = val;
        break;
      }
      if (lblJNorm && !isNaN(val) && val !== 0) {
        somaPlanos += val;
      }
    }
    const total = !isNaN(totalDaLinha) ? totalDaLinha : somaPlanos;
    if (total !== 0) {
      items.push({ nome: empresaNome, quantidade: 0, total });
    }
  }
  return items;
}
function parseCoparticipacaoPivotTipoCobranca(rows) {
  const items = [];
  let headerRow = -1;
  let qtdCol = -1;
  let valCol = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    let q = -1;
    let v = -1;
    for (let c2 = 0; c2 < r.length; c2++) {
      const t = norm(r[c2]);
      if (!t) continue;
      if (q < 0 && (t.includes("soma de qtd") || t === "qtd")) q = c2;
      if (v < 0 && (t.includes("soma de valor") || t === "valor")) v = c2;
    }
    if (q >= 0 && v >= 0) {
      headerRow = i;
      qtdCol = q;
      valCol = v;
      break;
    }
  }
  if (headerRow < 0) return items;
  let empresaAtual = "";
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    let label = "";
    for (const c2 of r) {
      const t = cellToText(c2).trim();
      if (t) {
        label = t;
        break;
      }
    }
    if (!label) continue;
    const lblNorm = norm(label);
    if (lblNorm.startsWith("total geral")) break;
    const lblSemSep = lblNorm.replace(/[^a-z0-9]/g, "");
    if (lblNorm.includes("soma de")) continue;
    if (lblSemSep.includes("coparticipacao")) {
      if (!empresaAtual) continue;
      const qtdN = Math.round(toNumber(r[qtdCol]));
      const valN = toNumber(r[valCol]);
      const qtdOk = !isNaN(qtdN) && qtdN !== 0;
      const valOk = !isNaN(valN) && valN !== 0;
      if (qtdOk || valOk) {
        items.push({
          nome: empresaAtual,
          quantidade: isNaN(qtdN) ? 0 : qtdN,
          total: isNaN(valN) ? 0 : valN
        });
      }
      continue;
    }
    if (lblSemSep.includes("mensalidade")) continue;
    empresaAtual = label;
  }
  return items;
}
function lerRowsAbaResumo(wb) {
  const ws = wb.worksheets.find((s) => norm(s.name).includes("resumo"));
  if (!ws) return null;
  const rows = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    rows.push(row.values.slice(1));
  });
  return rows;
}
function analisarResumoSheet(wb) {
  const ws = wb.worksheets.find((s) => norm(s.name).includes("resumo"));
  if (!ws) return null;
  const rows = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    rows.push(row.values.slice(1));
  });
  let headerIdx = -1;
  let idxLabel = -1;
  let idxQtd = -1;
  let idxMens = -1;
  let idxValor = -1;
  let idxFaixa = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const r = rows[i] || [];
    let lbl = -1, qtd = -1, mens = -1, val = -1;
    for (let c2 = 0; c2 < r.length; c2++) {
      const h = norm(r[c2]);
      if (!h) continue;
      if (lbl < 0 && (h.includes("empresa/modulo") || h.includes("empresa / modulo") || h.includes("modulo") || h === "empresa"))
        lbl = c2;
      else if (qtd < 0 && (h === "qtd" || h.includes("quantidade") || h.includes("usuario")))
        qtd = c2;
      else if (mens < 0 && (h.includes("mensalidade") || h.includes("valor unit") || h.includes("valor unitario")))
        mens = c2;
      else if (val < 0 && (h === "valor" || h === "total" || h.includes("valor total"))) val = c2;
    }
    if (lbl >= 0 && val >= 0) {
      headerIdx = i;
      idxLabel = lbl;
      idxQtd = qtd;
      idxMens = mens;
      idxValor = val;
      idxFaixa = findColumnIndex(r, COL_FAIXA_ETARIA);
      break;
    }
  }
  if (headerIdx < 0) return null;
  const reCnpj = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;
  const reFaixa = /^\s*(\d{1,3})\s*(?:[àa]|-|–|—|até|ate)\s*(\d{1,3})\s*$/i;
  const reFaixaMais = /^\s*(\d{1,3})\s*\+\s*$/;
  const blocos = [];
  let cur = null;
  let breakIdx = rows.length;
  let inCoparticBlock = false;
  const reCompHdr = /^compet[eê]ncia\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*[\/_-]?\s*(\d{4}|\d{2})(?!\d)/i;
  const compHdrs = rows.filter((row) => (row || []).some((c2) => reCompHdr.test(cellToText(c2).trim())));
  const multiCompetencia = compHdrs.length >= 2;
  const mesDeCompHdr = (row) => {
    for (const c2 of row || []) {
      const m = reCompHdr.exec(cellToText(c2).trim());
      if (m) return `${m[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3).toUpperCase()}/${m[2].slice(-2)}`;
    }
    return null;
  };
  let pendingRetroMes = multiCompetencia ? mesDeCompHdr(rows[headerIdx] || []) : null;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    if (multiCompetencia) {
      const mesHdr = mesDeCompHdr(r);
      if (mesHdr) {
        if (cur) cur.retroMesAtual = mesHdr;
        else pendingRetroMes = mesHdr;
        continue;
      }
    }
    const labelRaw = cellToText(r[idxLabel]).trim();
    if (!labelRaw) continue;
    const labelNorm = norm(labelRaw);
    const rowNorms = r.map((cell) => norm(cell)).filter(Boolean);
    if (multiCompetencia) {
      if (labelNorm.startsWith("total geral") || labelNorm.startsWith("valor total")) continue;
      if (cur && pendingRetroMes) {
        cur.retroMesAtual = pendingRetroMes;
        pendingRetroMes = null;
      }
    }
    if (labelNorm.startsWith("total geral") || rowNorms.some((cell) => cell.startsWith("total geral")) || labelNorm.startsWith("contrato:") || labelNorm.startsWith("contrato ")) {
      breakIdx = i;
      break;
    }
    const labelSemSep = labelNorm.replace(/[^a-z0-9]/g, "");
    if (labelSemSep.includes("coparticipacao") && !labelNorm.includes("empresarial") && !/^\s*pj\s*[-–—:]/i.test(labelRaw)) {
      inCoparticBlock = true;
      continue;
    }
    if (/^sub[\s-]*total\b/.test(labelNorm) || /^total\b/.test(labelNorm) && !labelNorm.startsWith("total geral")) {
      if (cur && /^total\b/.test(labelNorm) && !/^sub/.test(labelNorm)) {
        const vTot = idxValor >= 0 ? toNumber(r[idxValor]) : NaN;
        if (!isNaN(vTot) && vTot !== 0) cur.totalDecl = vTot;
      }
      inCoparticBlock = false;
      continue;
    }
    const m = labelRaw.match(reCnpj);
    if (m) inCoparticBlock = false;
    if (inCoparticBlock) continue;
    if (m) {
      const cnpj = normalizarCnpj(m[1]);
      const cleanupNome = (s) => s.replace(/\b(cnpj|c\.n\.p\.j\.?)\b\s*[:\-]?\s*/gi, "").trim().replace(/^[-–—:]\s*/, "").replace(/[-–—:]\s*$/, "").trim();
      let nome = cleanupNome(labelRaw.slice(0, m.index));
      if (!nome) {
        nome = cleanupNome(labelRaw.slice((m.index ?? 0) + m[1].length));
      }
      cur = {
        cnpj,
        nome: nome || "Sem nome",
        enfValores: [],
        enfQtd: 0,
        enfMens: 0,
        aptValores: [],
        aptQtd: 0,
        aptMens: 0,
        incQtd: 0,
        incTotal: 0,
        retroQtd: 0,
        retroTotal: 0,
        excQtd: 0,
        excTotal: 0,
        devQtd: 0,
        devTotal: 0,
        permQtd: 0,
        permTotal: 0,
        adesaoQtd: 0,
        adesaoTotal: 0,
        compQtd: 0,
        compTotal: 0,
        compLabel: null,
        compItens: [],
        totalDecl: null,
        faixas: /* @__PURE__ */ new Map()
      };
      blocos.push(cur);
      if (pendingRetroMes) {
        cur.retroMesAtual = pendingRetroMes;
        pendingRetroMes = null;
      }
      inCoparticBlock = false;
      continue;
    }
    if (!cur) continue;
    {
      const mHdr = /^(retroa[cç][aã]o|retroativ[oa]s?)\b.*?(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*[\/_-]?\s*(\d{4}|\d{2})(?!\d)/i.exec(labelRaw.trim());
      const temNumeros = r.some((c2, ci) => ci !== idxLabel && !isNaN(toNumber(c2)) && toNumber(c2) !== 0);
      if (mHdr && !temNumeros) {
        const mesAbrev = mHdr[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3).toUpperCase();
        cur.retroMesAtual = `${mesAbrev}/${mHdr[3].slice(-2)}`;
        continue;
      }
    }
    const qtdN = idxQtd >= 0 ? Math.round(toNumber(r[idxQtd])) : NaN;
    const mensN = idxMens >= 0 ? toNumber(r[idxMens]) : NaN;
    const val = toNumber(r[idxValor]);
    const valNum = isNaN(val) ? 0 : val;
    const qtdNum = isNaN(qtdN) ? 0 : qtdN;
    const mensNum = isNaN(mensN) ? 0 : mensN;
    const hasValor = !isNaN(val) && val !== 0;
    const hasMensalidade = !isNaN(mensN) && mensN !== 0;
    if (labelNorm.includes("complemento")) {
      cur.compQtd += qtdNum;
      cur.compTotal += valNum;
      cur.compItens.push({ nome: labelRaw, quantidade: qtdNum, total: valNum });
      const mMes = /(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*[\/_-]?\s*(\d{4}|\d{2})(?!\d)/i.exec(labelRaw);
      if (mMes && !cur.compLabel) {
        const nomeMes = mMes[1].charAt(0).toUpperCase() + mMes[1].slice(1).toLowerCase();
        const anoRaw = parseInt(mMes[2], 10);
        const ano = mMes[2].length === 2 ? 2e3 + anoRaw : anoRaw;
        cur.compLabel = `${nomeMes}/${ano}`;
      }
      continue;
    }
    if (labelNorm.includes("adesao") || labelNorm.includes("ades\xE3o")) {
      cur.adesaoQtd += qtdNum;
      cur.adesaoTotal += valNum;
      continue;
    }
    if (labelNorm.includes("inclus") || labelNorm.includes("inlus") || labelNorm.includes("retroativ")) {
      cur.incQtd += qtdNum;
      cur.incTotal += valNum;
      if (labelNorm.includes("retroativ")) {
        cur.retroQtd += qtdNum;
        cur.retroTotal += valNum;
      }
      continue;
    }
    if (labelNorm.includes("permuta")) {
      cur.permQtd += qtdNum;
      cur.permTotal += valNum;
      continue;
    }
    if (labelNorm.includes("devolu")) {
      cur.devQtd += qtdNum;
      cur.devTotal += valNum;
      continue;
    }
    if (labelNorm.includes("exclus")) {
      cur.excQtd += qtdNum;
      cur.excTotal += valNum;
      continue;
    }
    const faixaInfo = (idxFaixa >= 0 ? parseFaixaEtariaLabel(r[idxFaixa]) : null) ?? parseFaixaEtariaLabel(labelRaw);
    if (faixaInfo) {
      const ini = faixaInfo.idadeInicial;
      const fim = faixaInfo.idadeFinal;
      const label = faixaInfo.label;
      const key = `${ini}-${fim ?? "+"}`;
      const prev = cur.faixas.get(key) || { label, idadeInicial: ini, idadeFinal: fim, quantidade: 0, total: 0 };
      prev.quantidade += qtdNum;
      prev.total += valNum;
      cur.faixas.set(key, prev);
      cur.enfQtd += qtdNum;
      cur.enfValores.push(valNum);
      continue;
    }
    const cat = classificarPlano(labelRaw);
    if (cat && qtdNum > 0 && !hasMensalidade && !hasValor) continue;
    if (cat && cur.retroMesAtual) {
      cur.incQtd += qtdNum;
      cur.incTotal += valNum;
      cur.retroQtd += qtdNum;
      cur.retroTotal += valNum;
      if (!cur.retroMeses) cur.retroMeses = /* @__PURE__ */ new Map();
      const prev = cur.retroMeses.get(cur.retroMesAtual) || { quantidade: 0, total: 0 };
      prev.quantidade += qtdNum;
      prev.total += valNum;
      cur.retroMeses.set(cur.retroMesAtual, prev);
      continue;
    }
    if (cat === "enfermaria") {
      cur.enfQtd += qtdNum;
      cur.enfMens = mensNum || cur.enfMens;
      cur.enfValores.push(valNum);
    } else if (cat === "apartamento") {
      cur.aptQtd += qtdNum;
      cur.aptMens = mensNum || cur.aptMens;
      cur.aptValores.push(valNum);
    }
  }
  const comCnpj = blocos.filter((b) => b.cnpj.length === 14);
  if (comCnpj.length === 0) return null;
  let tailRetroQtd = 0;
  let tailRetroTotal = 0;
  const tailRetroValoresVistos = /* @__PURE__ */ new Set();
  let pvQtdIdx = -1;
  let pvValIdx = -1;
  for (let i = breakIdx; i < rows.length; i++) {
    const r = rows[i] || [];
    const hQtd = r.findIndex((c2) => {
      const t = norm(c2);
      return t.includes("qtd") || t.includes("quantidade");
    });
    const hVal = r.findIndex((c2) => {
      const t = norm(c2);
      return t.includes("valor");
    });
    if (hVal >= 0 || hQtd >= 0) {
      pvQtdIdx = hQtd;
      pvValIdx = hVal;
      continue;
    }
    const anyTotalGeral = r.some((c2) => norm(c2).startsWith("total geral"));
    if (anyTotalGeral) continue;
    let hitIdx = -1;
    let hitLabel = "";
    for (let c2 = 0; c2 < r.length; c2++) {
      const t = norm(r[c2]);
      if (t.includes("cobranca retroativa") || t.includes("retroativ") && !t.startsWith("total")) {
        hitIdx = c2;
        hitLabel = String(r[c2] ?? "");
        break;
      }
    }
    if (hitIdx < 0) continue;
    let qtd = 0;
    let total = NaN;
    if (pvValIdx > hitIdx) {
      const v = toNumber(r[pvValIdx]);
      if (!isNaN(v)) total = v;
      if (pvQtdIdx > hitIdx) {
        const q = toNumber(r[pvQtdIdx]);
        if (!isNaN(q)) qtd = Math.round(q);
      }
    }
    if (isNaN(total)) {
      const nums = [];
      for (let c2 = hitIdx + 1; c2 < r.length && nums.length < 2; c2++) {
        const n = toNumber(r[c2]);
        if (!isNaN(n)) nums.push(n);
      }
      if (nums.length >= 2) {
        qtd = Math.round(nums[0]);
        total = nums[1];
      } else if (nums.length === 1) {
        const n = nums[0];
        const ehQtd = Number.isFinite(n) && n >= 0 && n < 1e5 && Math.abs(n - Math.round(n)) < 1e-3;
        if (ehQtd) continue;
        total = n;
      } else {
        continue;
      }
    }
    if (isNaN(total)) continue;
    const chaveValor = `${norm(hitLabel)}|${total.toFixed(2)}`;
    if (tailRetroValoresVistos.has(chaveValor)) continue;
    tailRetroValoresVistos.add(chaveValor);
    tailRetroQtd += qtd;
    tailRetroTotal += total;
  }
  const resumoJaTemRetroativa = comCnpj.some(
    (b) => b.retroQtd !== 0 || Math.abs(b.retroTotal) > 1e-3
  );
  if (!resumoJaTemRetroativa && (tailRetroQtd !== 0 || tailRetroTotal !== 0)) {
    if (comCnpj.length === 1) {
      comCnpj[0].retroQtd += tailRetroQtd;
      comCnpj[0].retroTotal += tailRetroTotal;
      comCnpj[0].incQtd += tailRetroQtd;
      comCnpj[0].incTotal += tailRetroTotal;
    } else {
      const base = comCnpj.map((b) => Math.abs(b.incTotal) || 0);
      const soma = base.reduce((s, v) => s + v, 0);
      comCnpj.forEach((b, idx) => {
        const w = soma > 0 ? base[idx] / soma : 1 / comCnpj.length;
        const q = Math.round(tailRetroQtd * w);
        const v = tailRetroTotal * w;
        b.retroQtd += q;
        b.retroTotal += v;
        b.incQtd += q;
        b.incTotal += v;
      });
    }
  }
  let coparticipItems = parseCoparticipacaoRows(rows);
  if (coparticipItems.length === 0) {
    coparticipItems = parseCoparticipacaoResumoPorCnpj(rows, idxLabel, idxValor, idxQtd);
  }
  if (coparticipItems.length === 0) {
    coparticipItems = parseCoparticipacaoPivotTipoCobranca(rows);
  }
  const coparticPorBloco = /* @__PURE__ */ new Map();
  for (const item of coparticipItems) {
    const alvoKey = normMatch(item.nome);
    let match = null;
    if (comCnpj.length === 1) {
      match = comCnpj[0];
    } else {
      match = comCnpj.find((b) => normMatch(b.nome) === alvoKey) || comCnpj.find((b) => {
        const bk = normMatch(b.nome);
        return bk && (alvoKey.includes(bk) || bk.includes(alvoKey));
      }) || null;
    }
    if (!match) continue;
    const key = match.cnpj || match.nome;
    const acc = coparticPorBloco.get(key) || { substipulantes: [], quantidade: 0, total: 0 };
    acc.substipulantes.push(item);
    acc.quantidade += item.quantidade;
    acc.total += item.total;
    coparticPorBloco.set(key, acc);
  }
  return comCnpj.map((g) => {
    const buildFromResumo = (qtd, mens, vals) => {
      const total = vals.reduce((s, v) => s + v, 0);
      const beneficiarios = qtd || 0;
      const mensalidade = mens || (beneficiarios > 0 ? total / beneficiarios : 0);
      return { beneficiarios, mensalidade, total };
    };
    const bloco = {
      cnpj: g.cnpj,
      nome: g.nome,
      nomeExibicao: formatNomeComCnpj(g.nome, g.cnpj),
      enfermaria: buildFromResumo(g.enfQtd, g.enfMens, g.enfValores),
      apartamento: buildFromResumo(g.aptQtd, g.aptMens, g.aptValores),
      inclusoes: { quantidade: g.incQtd, total: g.incTotal },
      avisos: ["Dados consolidados extra\xEDdos da aba RESUMO."]
    };
    if (g.totalDecl !== null) bloco.totalDeclaradoExcel = g.totalDecl;
    if (g.retroQtd > 0 || g.retroTotal !== 0) {
      bloco.retroativas = { quantidade: g.retroQtd, total: g.retroTotal };
      if (g.retroMeses && g.retroMeses.size > 0) {
        const det = Array.from(g.retroMeses.entries()).map(([mes, v]) => ({ mes, quantidade: v.quantidade, total: v.total }));
        bloco.retroativas.meses = det.map((d) => d.mes);
        bloco.retroativas.mesesDetalhe = det;
      }
    }
    if (g.excQtd > 0 || g.excTotal !== 0) {
      bloco.exclusoes = { quantidade: g.excQtd, total: g.excTotal };
    }
    if (g.devQtd > 0 || g.devTotal !== 0) {
      bloco.devolucoes = { quantidade: g.devQtd, total: g.devTotal };
    }
    if (g.permQtd > 0 || g.permTotal !== 0) {
      bloco.permuta = { quantidade: g.permQtd, total: g.permTotal };
    }
    if (g.adesaoQtd > 0 || g.adesaoTotal !== 0) {
      bloco.taxaAdesao = { quantidade: g.adesaoQtd, total: g.adesaoTotal };
    }
    if (g.faixas.size > 0) {
      bloco.faixasEtarias = Array.from(g.faixas.values()).sort(
        (a, b) => a.idadeInicial - b.idadeInicial
      );
    }
    if (g.compQtd !== 0 || g.compTotal !== 0) {
      bloco.complemento = {
        quantidade: g.compQtd,
        total: g.compTotal,
        periodoLabel: g.compLabel,
        itens: g.compItens
      };
    }
    const coparticAcc = coparticPorBloco.get(g.cnpj || g.nome);
    if (coparticAcc && (coparticAcc.quantidade !== 0 || coparticAcc.total !== 0)) {
      bloco.coparticipacao = {
        quantidade: coparticAcc.quantidade,
        total: coparticAcc.total,
        substipulantes: coparticAcc.substipulantes
      };
    }
    return bloco;
  });
}
function completarInclusoesDoDetalhe(wb, blocos) {
  if (blocos.length === 0 || blocos.every((b) => b.inclusoes.quantidade > 0 || b.inclusoes.total !== 0)) {
    return blocos;
  }
  const encontrados = /* @__PURE__ */ new Map();
  const adicionar = (chave, valor) => {
    if (!chave) return;
    const atual = encontrados.get(chave) || { quantidade: 0, total: 0 };
    atual.quantidade += 1;
    atual.total += valor;
    encontrados.set(chave, atual);
  };
  wb.worksheets.forEach((ws) => {
    if (norm(ws.name).includes("resumo")) return;
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      rows.push(row.values.slice(1));
    });
    let headerIdx = -1;
    let idxTipo = -1;
    let idxValor = -1;
    let idxCnpj = -1;
    let idxPagador = -1;
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const tipo = findColumnIndex(rows[i], COL_TIPO_COBRANCA);
      const valor = findColumnIndex(rows[i], COL_VALOR);
      if (tipo >= 0 && valor >= 0) {
        headerIdx = i;
        idxTipo = tipo;
        idxValor = valor;
        idxCnpj = findColumnIndex(rows[i], COL_CNPJ);
        idxPagador = findPagadorColumnIndex(rows[i]);
        break;
      }
    }
    if (headerIdx < 0) return;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!isInclusao(String(row[idxTipo] ?? "")) || isRetroativa(String(row[idxTipo] ?? ""))) continue;
      const valor = toNumber(row[idxValor]);
      if (!Number.isFinite(valor) || valor < 0) continue;
      const cnpj = idxCnpj >= 0 ? normalizarCnpj(row[idxCnpj]) : "";
      const nome = idxPagador >= 0 ? normMatch(String(row[idxPagador] ?? "")) : "";
      adicionar(cnpj.length === 14 ? `cnpj:${cnpj}` : `nome:${nome}`, valor);
    }
  });
  return blocos.map((bloco) => {
    if (bloco.inclusoes.quantidade > 0 || bloco.inclusoes.total !== 0) return bloco;
    const porCnpj = bloco.cnpj ? encontrados.get(`cnpj:${bloco.cnpj}`) : void 0;
    const nomeBloco = normMatch(bloco.nome);
    const candidatosNome = encontrados.has(`nome:${nomeBloco}`) ? [[`nome:${nomeBloco}`, encontrados.get(`nome:${nomeBloco}`)]] : Array.from(encontrados.entries()).filter(
      ([chave]) => chave.startsWith("nome:") && nomeBloco && (chave.slice(5).includes(nomeBloco) || nomeBloco.includes(chave.slice(5)))
    );
    const porNome = candidatosNome.length === 1 ? candidatosNome[0][1] : void 0;
    const inclusoes = porCnpj || porNome;
    if (!inclusoes) {
      if (!porCnpj && candidatosNome.length > 1) {
        return {
          ...bloco,
          avisos: [...bloco.avisos, "Inclus\xF5es da rela\xE7\xE3o detalhada n\xE3o atribu\xEDdas: mais de um pagador com nome parecido (ambiguidade matriz/filial)."]
        };
      }
      return bloco;
    }
    return {
      ...bloco,
      inclusoes: { ...inclusoes },
      avisos: [...bloco.avisos, "Inclus\xF5es complementadas pela rela\xE7\xE3o detalhada de benefici\xE1rios."]
    };
  });
}
function analisarResumoRetroativoPorCompetencia(wb) {
  const ws = wb.worksheets.find((w) => /^resumo(?:[\s_-]*automatic[oa])?$/.test(norm(w.name).replace(/\s+/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) ?? wb.worksheets.find((w) => norm(w.name).replace(/\s+/g, "") === "resumo");
  if (!ws) return null;
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row) => rows.push(row.values.slice(1).map((c2) => cellToText(c2).trim())));
  const reComp = /^(?:compet[eê]ncia|cobran[cç]a\s+retroativ[ao])\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*[\/_-]?\s*(\d{4}|\d{2})(?!\d)/i;
  const reCnpj = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;
  if (rows.filter((r) => r.some((c2) => reComp.test(c2))).length < 2) return null;
  let cnpj = "";
  let nome = "";
  const meses = [];
  let atual = null;
  let semCabecalho = false;
  for (const r of rows) {
    const txt = r.find((c2) => c2) ?? "";
    const hdr = r.map((c2) => reComp.exec(c2)).find(Boolean);
    if (hdr) {
      atual = `${hdr[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3).toUpperCase()}/${hdr[2].slice(-2)}`;
      continue;
    }
    if (!cnpj) {
      const m = r.filter((c2) => c2 && isNaN(Number(c2))).map((c2) => reCnpj.exec(c2)).find(Boolean);
      if (m) {
        cnpj = m[1].replace(/\D/g, "");
        nome = txt.split(/\n|cnpj/i)[0].trim();
        continue;
      }
    }
    if (!atual && norm(txt).startsWith("total geral")) {
      semCabecalho = true;
      continue;
    }
    if (atual && norm(txt).startsWith("total geral")) {
      const nums = r.map((c2) => toNumber(c2)).filter((n) => !isNaN(n));
      if (nums.length >= 2) meses.push({ mes: atual, quantidade: Math.round(nums[0]), total: nums[nums.length - 1] });
      atual = null;
    }
  }
  if (semCabecalho) return null;
  if (!nome) nome = (rows.find((r) => r.some(Boolean))?.find(Boolean) ?? "").split(/\n|\s-\s*contrato|cnpj/i)[0].trim();
  if (!cnpj) {
    const achados = /* @__PURE__ */ new Set();
    wb.worksheets.filter((w) => w !== ws).forEach((w) => {
      const hdr = w.getRow(1).values.slice(1).map((c2) => norm(cellToText(c2)));
      const ci = hdr.findIndex((h) => h === "cnpj");
      if (ci < 0) return;
      w.eachRow({ includeEmpty: false }, (row, n) => {
        if (n === 1) return;
        const d = cellToText(row.values[ci + 1]).replace(/\D/g, "");
        if (d.length === 14) achados.add(d);
      });
    });
    if (achados.size === 1) cnpj = [...achados][0];
  }
  if (!cnpj || meses.length < 2) return null;
  const quantidade = meses.reduce((s, m) => s + m.quantidade, 0);
  const total = Math.round(meses.reduce((s, m) => s + m.total, 0) * 100) / 100;
  const retro2 = { quantidade, total, meses: meses.map((m) => m.mes), mesesDetalhe: meses };
  return [{
    cnpj,
    nome,
    nomeExibicao: nome,
    enfermaria: { beneficiarios: 0, mensalidade: 0, total: 0 },
    apartamento: { beneficiarios: 0, mensalidade: 0, total: 0 },
    inclusoes: { quantidade, total },
    retroativas: retro2,
    retroativasReajuste: retro2,
    avisos: []
  }];
}
async function analisarExcelFinanceiroPorCnpj(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const viaCompetencias = analisarResumoRetroativoPorCompetencia(wb);
  if (viaCompetencias) return viaCompetencias;
  const viaResumo = analisarResumoSheet(wb);
  if (viaResumo && viaResumo.length > 0) {
    return dividirBlocosPorSubBlocosDeclarados(
      wb,
      mesclarBlocosPorNomeForcado(completarInclusoesDoDetalhe(wb, viaResumo))
    );
  }
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const allRows = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    if (allRows.length >= 2e5) return;
    const values = row.values.slice(1);
    allRows.push(values);
  });
  let headerIdx = -1;
  let idxPlano = -1;
  let idxTipo = -1;
  let idxValor = -1;
  let idxCnpj = -1;
  let idxPagador = -1;
  let idxFaixa = -1;
  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const r = allRows[i];
    const p = findColumnIndex(r, COL_PLANO);
    const t = findColumnIndex(r, COL_TIPO_COBRANCA);
    const v = findColumnIndex(r, COL_VALOR);
    if (p >= 0 || t >= 0) {
      headerIdx = i;
      idxPlano = p;
      idxTipo = t;
      idxValor = v;
      idxCnpj = findColumnIndex(r, COL_CNPJ);
      idxPagador = findPagadorColumnIndex(r);
      idxFaixa = findColumnIndex(r, COL_FAIXA_ETARIA);
      break;
    }
  }
  if (headerIdx < 0) {
    return [
      {
        cnpj: "",
        nome: "Planilha",
        nomeExibicao: "Planilha",
        enfermaria: { beneficiarios: 0, mensalidade: 0, total: 0 },
        apartamento: { beneficiarios: 0, mensalidade: 0, total: 0 },
        inclusoes: { quantidade: 0, total: 0 },
        avisos: [
          "N\xE3o foi poss\xEDvel identificar a linha de cabe\xE7alho (esperado: 'Plano' e 'Tipo Cobran\xE7a')."
        ]
      }
    ];
  }
  const grupos = /* @__PURE__ */ new Map();
  const ehCnpjPlaceholder = (c2) => !c2 || c2.length !== 14 || /0{6,}$/.test(c2);
  const FORCE_GROUP_BY_NAME = getForceGroupByNamePatterns();
  const forceByName = (nome) => {
    const n = norm(nome);
    return FORCE_GROUP_BY_NAME.some((p) => n.includes(p));
  };
  const getGrupo = (cnpj, nome) => {
    const nomeKey = norm(nome);
    const cnpjValido = !ehCnpjPlaceholder(cnpj);
    const usarNome = forceByName(nome);
    const key = usarNome && nomeKey ? `__nome::${nomeKey}` : cnpjValido ? `__cnpj::${cnpj}` : nomeKey ? `__nome::${nomeKey}` : "__sem_id__";
    let g = grupos.get(key);
    if (!g) {
      g = {
        cnpj,
        nome,
        enfValores: [],
        aptValores: [],
        incQtd: 0,
        incTotal: 0,
        retroQtd: 0,
        retroTotal: 0,
        excQtd: 0,
        excTotal: 0,
        devQtd: 0,
        devTotal: 0,
        permQtd: 0,
        permTotal: 0,
        adesaoQtd: 0,
        adesaoTotal: 0,
        faixas: /* @__PURE__ */ new Map()
      };
      grupos.set(key, g);
    } else {
      if (!g.nome && nome) g.nome = nome;
      if (ehCnpjPlaceholder(g.cnpj) && !ehCnpjPlaceholder(cnpj)) {
        g.cnpj = cnpj;
      }
    }
    return g;
  };
  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const r = allRows[i];
    if (!r || r.length === 0) continue;
    const cnpjLinha = idxCnpj >= 0 ? normalizarCnpj(r[idxCnpj]) : "";
    const nomeLinha = idxPagador >= 0 ? String(r[idxPagador] ?? "").trim() : "";
    if (idxCnpj >= 0 && cnpjLinha.length !== 14 && !nomeLinha) continue;
    const grp = getGrupo(cnpjLinha, nomeLinha);
    const planoCell = idxPlano >= 0 ? r[idxPlano] : "";
    const tipoCell = idxTipo >= 0 ? r[idxTipo] : "";
    const valorCell = idxValor >= 0 ? r[idxValor] : 0;
    const valor = toNumber(valorCell);
    const valorNum = isNaN(valor) ? 0 : valor;
    const valorValido = !isNaN(valor) && valor >= 0;
    if (idxFaixa >= 0) {
      const faixa = parseFaixaEtariaLabel(r[idxFaixa]);
      if (faixa && !(idxTipo >= 0 && (isInclusao(String(tipoCell)) || isExclusao(String(tipoCell)) || isDevolucao(String(tipoCell)))) && !rowHasTaxaAdesao(r, idxTipo)) {
        const key = `${faixa.idadeInicial}-${faixa.idadeFinal ?? "+"}`;
        const prev = grp.faixas.get(key) || faixa;
        prev.quantidade += 1;
        if (valorValido) prev.total += valor;
        grp.faixas.set(key, prev);
      }
    }
    if (rowHasTaxaAdesao(r, idxTipo)) {
      grp.adesaoQtd += 1;
      if (valorValido) grp.adesaoTotal += valor;
      continue;
    }
    if (idxTipo >= 0 && isPermuta(String(tipoCell))) {
      grp.permQtd += 1;
      grp.permTotal += valorNum > 0 ? -valorNum : valorNum;
      continue;
    }
    if (idxTipo >= 0 && isDevolucao(String(tipoCell))) {
      grp.devQtd += 1;
      grp.devTotal += valorNum > 0 ? -valorNum : valorNum;
      continue;
    }
    if (idxTipo >= 0 && isExclusao(String(tipoCell))) {
      grp.excQtd += 1;
      grp.excTotal += valorNum > 0 ? -valorNum : valorNum;
      continue;
    }
    if (idxTipo >= 0 && isInclusao(String(tipoCell))) {
      grp.incQtd += 1;
      if (valorValido) grp.incTotal += valor;
      if (isRetroativa(String(tipoCell))) {
        grp.retroQtd += 1;
        if (valorValido) grp.retroTotal += valor;
      }
      continue;
    }
    if (idxPlano < 0) continue;
    const cat = classificarPlano(String(planoCell));
    if (!cat) continue;
    if (cat === "enfermaria") grp.enfValores.push(valorValido ? valor : 0);
    else grp.aptValores.push(valorValido ? valor : 0);
  }
  for (const [key, g] of Array.from(grupos.entries())) {
    if (!key.startsWith("__nome::")) continue;
    const nomeKey = key.slice("__nome::".length);
    const candidatos = Array.from(grupos.values()).filter(
      (x) => x !== g && !ehCnpjPlaceholder(x.cnpj) && norm(x.nome) === nomeKey
    );
    if (candidatos.length === 1) {
      const dest = candidatos[0];
      dest.enfValores.push(...g.enfValores);
      dest.aptValores.push(...g.aptValores);
      dest.incQtd += g.incQtd;
      dest.incTotal += g.incTotal;
      dest.retroQtd += g.retroQtd;
      dest.retroTotal += g.retroTotal;
      dest.excQtd += g.excQtd;
      dest.excTotal += g.excTotal;
      dest.devQtd += g.devQtd;
      dest.devTotal += g.devTotal;
      dest.permQtd += g.permQtd;
      dest.permTotal += g.permTotal;
      dest.adesaoQtd += g.adesaoQtd;
      dest.adesaoTotal += g.adesaoTotal;
      g.faixas.forEach((f, key2) => {
        const prev = dest.faixas.get(key2) || { ...f, quantidade: 0, total: 0 };
        prev.quantidade += f.quantidade;
        prev.total += f.total;
        dest.faixas.set(key2, prev);
      });
      grupos.delete(key);
    } else if (candidatos.length > 1) {
      g.avisoAmbiguidade = true;
    }
  }
  const buildCategoria = (vals) => {
    const total = vals.reduce((s, v) => s + v, 0);
    const beneficiarios = vals.length;
    const mensalidade = beneficiarios > 0 ? total / beneficiarios : 0;
    return { beneficiarios, mensalidade, total };
  };
  const blocos = Array.from(grupos.values()).map((g) => {
    const avisos = [];
    if (!g.cnpj) avisos.push("CNPJ n\xE3o identificado nesta linha \u2014 usando apenas o nome.");
    if (g.avisoAmbiguidade) {
      avisos.push(
        "Ambiguidade: mais de um pagador com CNPJ v\xE1lido tem este nome. Linhas sem CNPJ ficaram separadas para n\xE3o misturar matriz/filial \u2014 confira manualmente."
      );
    }
    const bloco = {
      cnpj: g.cnpj,
      nome: g.nome || "Sem nome",
      nomeExibicao: formatNomeComCnpj(g.nome || "Sem nome", g.cnpj),
      enfermaria: buildCategoria(g.enfValores),
      apartamento: buildCategoria(g.aptValores),
      inclusoes: { quantidade: g.incQtd, total: g.incTotal },
      avisos
    };
    if (g.retroQtd > 0 || g.retroTotal !== 0) {
      bloco.retroativas = { quantidade: g.retroQtd, total: g.retroTotal };
      bloco.retroativasBeneficiarios = { quantidade: g.retroQtd, total: g.retroTotal };
    }
    if (g.excQtd > 0 || g.excTotal !== 0) {
      bloco.exclusoes = { quantidade: g.excQtd, total: g.excTotal };
    }
    if (g.devQtd > 0 || g.devTotal !== 0) {
      bloco.devolucoes = { quantidade: g.devQtd, total: g.devTotal };
    }
    if (g.permQtd > 0 || g.permTotal !== 0) {
      bloco.permuta = { quantidade: g.permQtd, total: g.permTotal };
    }
    if (g.adesaoQtd > 0 || g.adesaoTotal !== 0) {
      bloco.taxaAdesao = { quantidade: g.adesaoQtd, total: g.adesaoTotal };
    }
    if (g.faixas.size > 0) {
      bloco.faixasEtarias = Array.from(g.faixas.values()).sort(
        (a, b) => a.idadeInicial - b.idadeInicial
      );
    }
    return bloco;
  }).filter(
    (b) => b.enfermaria.beneficiarios > 0 || b.apartamento.beneficiarios > 0 || b.inclusoes.quantidade > 0 || b.exclusoes && b.exclusoes.quantidade > 0 || b.devolucoes && b.devolucoes.quantidade > 0 || b.permuta && (b.permuta.quantidade > 0 || b.permuta.total !== 0) || b.taxaAdesao && b.taxaAdesao.quantidade > 0
  ).sort((a, b) => {
    const ta = a.enfermaria.total + a.apartamento.total + a.inclusoes.total;
    const tb = b.enfermaria.total + b.apartamento.total + b.inclusoes.total;
    return tb - ta;
  });
  const { porNome: cnpjsPorNome, todos: cnpjsUnicos } = extrairCnpjsDoWorkbook(wb);
  const cnpjUnicoFallback = cnpjsUnicos.size === 1 ? Array.from(cnpjsUnicos)[0] ?? "" : "";
  if (cnpjsPorNome.size > 0 || cnpjUnicoFallback) {
    for (const bloco of blocos) {
      if (bloco.cnpj) continue;
      const alvo = normMatch(bloco.nome);
      let achado = "";
      if (alvo) {
        if (cnpjsPorNome.has(alvo)) achado = cnpjsPorNome.get(alvo);
        if (!achado) {
          for (const [k, v] of cnpjsPorNome) {
            if (k.includes(alvo) || alvo.includes(k)) {
              achado = v;
              break;
            }
          }
        }
      }
      if (!achado && cnpjUnicoFallback) achado = cnpjUnicoFallback;
      if (achado) {
        bloco.cnpj = achado;
        bloco.nomeExibicao = formatNomeComCnpj(bloco.nome, achado);
        bloco.avisos = bloco.avisos.filter(
          (a) => !a.startsWith("CNPJ n\xE3o identificado nesta linha")
        );
      }
    }
  }
  let extraRetroQtd = 0;
  let extraRetroTotal = 0;
  let pivotEncontrado = false;
  const mesesRetro = /* @__PURE__ */ new Set();
  const detalhePorMes = /* @__PURE__ */ new Map();
  const addDetalhe = (mes, qtd, total) => {
    if (!mes) return;
    const cur = detalhePorMes.get(mes) || { quantidade: 0, total: 0 };
    cur.quantidade += qtd;
    cur.total += total;
    detalhePorMes.set(mes, cur);
  };
  const extrairMes = (raw) => {
    if (!raw) return null;
    const s = String(raw).toUpperCase().replace(/[^A-ZÇÃÕÁÉÍÓÚÂÊÔ0-9]/g, " ").replace(/\s+/g, " ").trim();
    const meses = {
      JAN: "JAN",
      JANEIRO: "JAN",
      FEV: "FEV",
      FEVEREIRO: "FEV",
      MAR: "MAR",
      MARCO: "MAR",
      MAR\u00C7O: "MAR",
      ABR: "ABR",
      ABRIL: "ABR",
      MAI: "MAI",
      MAIO: "MAI",
      JUN: "JUN",
      JUNHO: "JUN",
      JUL: "JUL",
      JULHO: "JUL",
      AGO: "AGO",
      AGOSTO: "AGO",
      SET: "SET",
      SETEMBRO: "SET",
      OUT: "OUT",
      OUTUBRO: "OUT",
      NOV: "NOV",
      NOVEMBRO: "NOV",
      DEZ: "DEZ",
      DEZEMBRO: "DEZ"
    };
    const m = s.match(/(JAN(?:EIRO)?|FEV(?:EREIRO)?|MAR(?:CO|ÇO)?|ABR(?:IL)?|MAI(?:O)?|JUN(?:HO)?|JUL(?:HO)?|AGO(?:STO)?|SET(?:EMBRO)?|OUT(?:UBRO)?|NOV(?:EMBRO)?|DEZ(?:EMBRO)?)\s*\/?\s*(\d{2,4})/);
    if (!m) return null;
    const mes = meses[m[1]] || m[1].slice(0, 3);
    const ano = m[2].length === 4 ? m[2].slice(-2) : m[2];
    return `${mes}/${ano}`;
  };
  const pivotsVistos = /* @__PURE__ */ new Set();
  const errosDigitacaoRetro = /* @__PURE__ */ new Set();
  const distanciaEdicao = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[a.length][b.length];
  };
  const retroPorPagador = /* @__PURE__ */ new Map();
  const valoresGenericos = /* @__PURE__ */ new Map();
  const ehQtdPlausivel = (raw, n) => {
    const digitos = String(raw ?? "").replace(/\D/g, "");
    if (digitos.length >= 11) return false;
    return Number.isFinite(n) && n >= 0 && n < 1e5 && Math.abs(n - Math.round(n)) < 1e-3;
  };
  wb.worksheets.forEach((sheet) => {
    const nomeAba = norm(sheet.name || "");
    const abaEhRetro = nomeAba.includes("retroativ");
    if (abaEhRetro) return;
    const rowsSheet = [];
    sheet.eachRow({ includeEmpty: false }, (row) => rowsSheet.push(row.values.slice(1)));
    let pvQtdIdx = -1;
    let pvValIdx = -1;
    for (let i = 0; i < rowsSheet.length; i++) {
      const r = rowsSheet[i] || [];
      const hQtd = r.findIndex((c2) => {
        const t = norm(c2);
        return t.includes("qtd") || t.includes("quantidade");
      });
      const hVal = r.findIndex((c2) => {
        const t = norm(c2);
        return t.includes("valor") || t.startsWith("soma de") && t.includes("mensalidade");
      });
      if (hVal >= 0 || hQtd >= 0) {
        pvQtdIdx = hQtd;
        pvValIdx = hVal;
        continue;
      }
      if (r.some((c2) => norm(c2).startsWith("total"))) continue;
      let hitIdx = -1;
      let hitLabel = "";
      for (let c2 = 0; c2 < r.length; c2++) {
        const t = norm(r[c2]);
        const ehRetroMes = /^retroativ[oa]s?/.test(t) && !t.includes("total") && extrairMes(String(r[c2] ?? "")) !== null;
        if (t.includes("cobranca retroativa") || ehRetroMes) {
          hitIdx = c2;
          hitLabel = String(r[c2] ?? "");
          break;
        }
        if (!t.includes("total") && extrairMes(String(r[c2] ?? "")) !== null) {
          const palavra = t.split(/[^a-z]+/)[0] || "";
          if (palavra.length >= 7 && palavra !== "retroativo" && palavra !== "retroativa" && palavra !== "retroativos" && palavra !== "retroativas") {
            const dist = Math.min(distanciaEdicao(palavra, "retroativo"), distanciaEdicao(palavra, "retroativa"));
            if (dist <= 2) errosDigitacaoRetro.add(String(r[c2] ?? "").replace(/\s+/g, " ").trim());
          }
        }
      }
      if (hitIdx < 0) continue;
      let total = NaN;
      let qtd = 0;
      if (pvValIdx > hitIdx) {
        const v = toNumber(r[pvValIdx]);
        if (!isNaN(v)) total = v;
        if (pvQtdIdx > hitIdx) {
          const q = toNumber(r[pvQtdIdx]);
          if (!isNaN(q)) qtd = Math.round(q);
        }
      }
      if (isNaN(total)) {
        const nums = [];
        let qtdCand = null;
        for (let c2 = hitIdx + 1; c2 < r.length; c2++) {
          const raw = r[c2];
          const n = toNumber(raw);
          if (isNaN(n)) continue;
          const digitos = String(raw ?? "").replace(/\D/g, "");
          if (digitos.length >= 11) continue;
          if (qtdCand === null && nums.length === 0 && ehQtdPlausivel(raw, n)) {
            qtdCand = n;
            continue;
          }
          nums.push(n);
          if (nums.length >= 1) break;
        }
        if (nums.length === 0) continue;
        total = nums[0];
        qtd = qtdCand !== null ? Math.round(qtdCand) : 0;
      }
      if (isNaN(total)) continue;
      const mes = extrairMes(hitLabel);
      const chaveValor = total.toFixed(2);
      const chave = `${mes || norm(hitLabel)}|${chaveValor}`;
      if (pivotsVistos.has(chave)) continue;
      const anterior = valoresGenericos.get(chaveValor);
      if (anterior !== void 0) {
        if (!mes || anterior.mes === null) {
          if (mes && anterior.mes === null) {
            valoresGenericos.set(chaveValor, { mes, qtd: anterior.qtd });
            mesesRetro.add(mes);
            addDetalhe(mes, Math.max(qtd, anterior.qtd) - anterior.qtd, 0);
          }
          pivotsVistos.add(chave);
          continue;
        }
      }
      pivotsVistos.add(chave);
      valoresGenericos.set(chaveValor, { mes: mes || null, qtd });
      pivotEncontrado = true;
      extraRetroQtd += qtd;
      extraRetroTotal += total;
      if (mes) {
        mesesRetro.add(mes);
        addDetalhe(mes, qtd, total);
      }
      if (mes && pvValIdx > hitIdx) {
        for (let j = i + 1; j < rowsSheet.length; j++) {
          const rr = rowsSheet[j] || [];
          if (rr.some((c2) => {
            const t = norm(c2);
            return t.startsWith("total") || t.includes("cobranca retroativa") || t.includes("rotulos");
          })) break;
          const nomeCel = rr.slice(0, pvValIdx).find((c2) => typeof c2 === "string" && /[a-z]/i.test(c2));
          const v = toNumber(rr[pvValIdx]);
          if (!nomeCel || isNaN(v)) break;
          const q = pvQtdIdx >= 0 ? toNumber(rr[pvQtdIdx]) : NaN;
          const k = norm(nomeCel);
          const porMes = retroPorPagador.get(k) || /* @__PURE__ */ new Map();
          const cur = porMes.get(mes) || { quantidade: 0, total: 0 };
          cur.quantidade += isNaN(q) ? 0 : Math.round(q);
          cur.total += v;
          porMes.set(mes, cur);
          retroPorPagador.set(k, porMes);
        }
      }
    }
  });
  if (!pivotEncontrado) {
    wb.worksheets.forEach((sheet) => {
      const nomeAba = norm(sheet.name || "");
      if (!nomeAba.includes("retroativ")) return;
      const mes = extrairMes(sheet.name || "");
      if (mes) mesesRetro.add(mes);
      const rowsSheet = [];
      sheet.eachRow({ includeEmpty: false }, (row) => rowsSheet.push(row.values.slice(1)));
      let hIdx = -1, iVal = -1, iQtd = -1, iTipo = -1;
      for (let i = 0; i < Math.min(5, rowsSheet.length); i++) {
        const r = rowsSheet[i];
        const v = findColumnIndex(r, COL_VALOR);
        const t = findColumnIndex(r, COL_TIPO_COBRANCA);
        const q = r.findIndex((c2) => norm(c2) === "qtd");
        if (v >= 0 || t >= 0) {
          hIdx = i;
          iVal = v;
          iQtd = q;
          iTipo = t;
          break;
        }
      }
      if (hIdx < 0) return;
      let abaQtd = 0;
      let abaTotal = 0;
      for (let i = hIdx + 1; i < rowsSheet.length; i++) {
        const r = rowsSheet[i];
        if (!r || r.length === 0) continue;
        const tipoCell = iTipo >= 0 ? String(r[iTipo] ?? "") : "";
        if (iTipo >= 0 && (isExclusao(tipoCell) || isDevolucao(tipoCell))) continue;
        const primeira = norm(r[0]);
        if (primeira.startsWith("total")) continue;
        const val = toNumber(r[iVal]);
        if (isNaN(val)) continue;
        const qtd = iQtd >= 0 ? toNumber(r[iQtd]) : 1;
        const qNum = isNaN(qtd) ? 1 : qtd;
        const vNum = val;
        extraRetroTotal += vNum;
        extraRetroQtd += qNum;
        abaTotal += vNum;
        abaQtd += qNum;
      }
      if (mes) addDetalhe(mes, abaQtd, abaTotal);
    });
  } else {
    wb.worksheets.forEach((sheet) => {
      const nomeAba = norm(sheet.name || "");
      if (!nomeAba.includes("retroativ")) return;
      const mes = extrairMes(sheet.name || "");
      if (mes) mesesRetro.add(mes);
    });
  }
  if (!Number.isFinite(extraRetroQtd) || extraRetroQtd >= 1e5) extraRetroQtd = 0;
  detalhePorMes.forEach((v, k) => {
    if (!Number.isFinite(v.quantidade) || v.quantidade >= 1e5) detalhePorMes.set(k, { ...v, quantidade: 0 });
  });
  const mesesArr = Array.from(mesesRetro);
  const detalheArr = Array.from(detalhePorMes.entries()).map(([mes, v]) => ({ mes, quantidade: v.quantidade, total: v.total }));
  {
    const porPag = /* @__PURE__ */ new Map();
    wb.worksheets.forEach((sheet) => {
      const nomeAba = norm(sheet.name || "");
      if (!nomeAba.includes("retroativ")) return;
      const mes = extrairMes(sheet.name || "");
      if (!mes) return;
      const rowsSheet = [];
      sheet.eachRow({ includeEmpty: false }, (row) => rowsSheet.push(row.values.slice(1)));
      let hIdx = -1, iVal = -1, iQtd = -1, iTipo = -1, iPag = -1;
      for (let i = 0; i < Math.min(5, rowsSheet.length); i++) {
        const r = rowsSheet[i];
        const v = findColumnIndex(r, COL_VALOR);
        const p = findColumnIndex(r, COL_PAGADOR);
        if (v >= 0 && p >= 0) {
          hIdx = i;
          iVal = v;
          iPag = p;
          iQtd = r.findIndex((c2) => norm(c2) === "qtd");
          iTipo = findColumnIndex(r, COL_TIPO_COBRANCA);
          break;
        }
      }
      if (hIdx < 0) return;
      for (let i = hIdx + 1; i < rowsSheet.length; i++) {
        const r = rowsSheet[i];
        if (!r || r.length === 0) continue;
        const tipoCell = iTipo >= 0 ? String(r[iTipo] ?? "") : "";
        if (iTipo >= 0 && (isExclusao(tipoCell) || isDevolucao(tipoCell))) continue;
        const pag = norm(r[iPag]);
        const val = toNumber(r[iVal]);
        if (!pag || isNaN(val)) continue;
        const q = iQtd >= 0 ? toNumber(r[iQtd]) : 1;
        const m = porPag.get(pag) || /* @__PURE__ */ new Map();
        const cur = m.get(mes) || { quantidade: 0, total: 0 };
        cur.quantidade += isNaN(q) ? 1 : Math.round(q);
        cur.total += val;
        m.set(mes, cur);
        porPag.set(pag, m);
      }
    });
    if (porPag.size > 1) {
      retroPorPagador.clear();
      porPag.forEach((v, k) => retroPorPagador.set(k, v));
    }
  }
  const achaPagadorRetro = (nome) => {
    const n = norm(nome || "");
    if (!n) return null;
    if (retroPorPagador.has(n)) return retroPorPagador.get(n);
    for (const [k, v] of retroPorPagador) if (k.startsWith(n) || n.startsWith(k)) return v;
    return null;
  };
  const scaleDetalhe = (w) => detalheArr.length ? detalheArr.map((d) => ({ mes: d.mes, quantidade: Math.round(d.quantidade * w), total: d.total * w })) : void 0;
  if ((extraRetroQtd !== 0 || Math.abs(extraRetroTotal) > 1e-3) && blocos.length > 0) {
    const jaRetroTotal = blocos.reduce((s, b) => s + (b.retroativas?.total ?? 0), 0);
    const jaRetroQtd = blocos.reduce((s, b) => s + (b.retroativas?.quantidade ?? 0), 0);
    const deltaQ = extraRetroQtd - jaRetroQtd;
    const deltaT = extraRetroTotal - jaRetroTotal;
    const linhasPrincipaisTemRetroativa = jaRetroQtd !== 0 || Math.abs(jaRetroTotal) > 1e-3;
    if (!linhasPrincipaisTemRetroativa && (deltaQ > 0 || Math.abs(deltaT) > 1e-3)) {
      if (blocos.length === 1) {
        const b = blocos[0];
        b.retroativas = {
          quantidade: (b.retroativas?.quantidade ?? 0) + deltaQ,
          total: (b.retroativas?.total ?? 0) + deltaT,
          meses: mesesArr.length ? mesesArr : b.retroativas?.meses,
          mesesDetalhe: scaleDetalhe(1) ?? b.retroativas?.mesesDetalhe
        };
        b.retroativasReajuste = {
          quantidade: (b.retroativasReajuste?.quantidade ?? 0) + deltaQ,
          total: (b.retroativasReajuste?.total ?? 0) + deltaT,
          ...mesesArr.length ? { meses: mesesArr } : {},
          ...detalheArr.length ? { mesesDetalhe: scaleDetalhe(1) } : {}
        };
        b.inclusoes = { quantidade: b.inclusoes.quantidade + deltaQ, total: b.inclusoes.total + deltaT };
      } else if (retroPorPagador.size > 0 && blocos.every((b) => achaPagadorRetro(b.nome) !== null)) {
        blocos.forEach((b) => {
          const porMes = achaPagadorRetro(b.nome);
          const det = Array.from(porMes.entries()).map(([mes, d]) => ({ mes, quantidade: d.quantidade, total: d.total }));
          const q = det.reduce((s, d) => s + d.quantidade, 0);
          const v = det.reduce((s, d) => s + d.total, 0);
          b.retroativas = { quantidade: (b.retroativas?.quantidade ?? 0) + q, total: (b.retroativas?.total ?? 0) + v, meses: det.map((d) => d.mes), mesesDetalhe: det };
          b.retroativasReajuste = { quantidade: (b.retroativasReajuste?.quantidade ?? 0) + q, total: (b.retroativasReajuste?.total ?? 0) + v, meses: det.map((d) => d.mes), mesesDetalhe: det };
          b.inclusoes = { quantidade: b.inclusoes.quantidade + q, total: b.inclusoes.total + v };
        });
      } else {
        const base = blocos.map((b) => Math.abs(b.inclusoes.total) || 0);
        const soma = base.reduce((s, v) => s + v, 0);
        blocos.forEach((b, idx) => {
          const w = soma > 0 ? base[idx] / soma : 1 / blocos.length;
          const q = Math.round(deltaQ * w);
          const v = deltaT * w;
          b.retroativas = {
            quantidade: (b.retroativas?.quantidade ?? 0) + q,
            total: (b.retroativas?.total ?? 0) + v,
            meses: mesesArr.length ? mesesArr : b.retroativas?.meses,
            mesesDetalhe: scaleDetalhe(w) ?? b.retroativas?.mesesDetalhe
          };
          b.retroativasReajuste = {
            quantidade: (b.retroativasReajuste?.quantidade ?? 0) + q,
            total: (b.retroativasReajuste?.total ?? 0) + v,
            ...mesesArr.length ? { meses: mesesArr } : {},
            ...detalheArr.length ? { mesesDetalhe: scaleDetalhe(w) } : {}
          };
          b.inclusoes = { quantidade: b.inclusoes.quantidade + q, total: b.inclusoes.total + v };
        });
      }
    } else if (mesesArr.length) {
      blocos.forEach((b) => {
        if (b.retroativas) {
          b.retroativas.meses = mesesArr;
          if (detalheArr.length) b.retroativas.mesesDetalhe = scaleDetalhe(1);
          reclassificarRetroComoReajuste(b);
        }
      });
    }
  } else if (mesesArr.length && blocos.length > 0) {
    blocos.forEach((b) => {
      if (b.retroativas) {
        b.retroativas.meses = mesesArr;
        if (detalheArr.length) b.retroativas.mesesDetalhe = scaleDetalhe(1);
        reclassificarRetroComoReajuste(b);
      }
    });
  }
  if (errosDigitacaoRetro.size > 0) {
    const lista = Array.from(errosDigitacaoRetro).map((l) => `"${l}"`).join(", ");
    const aviso = `Erro de digita\xE7\xE3o na planilha: ${lista} \u2014 deveria estar escrito "Retroativo". Essa linha N\xC3O foi somada na cobran\xE7a retroativa. Corrija a planilha e reanalise.`;
    blocos.forEach((b) => {
      if (!b.avisos.includes(aviso)) b.avisos.push(aviso);
    });
  }
  blocos.forEach((b) => {
    const decl = b.totalDeclaradoExcel;
    if (typeof decl !== "number" || decl === 0 || !b.retroativas) return;
    const soma = (b.enfermaria?.total ?? 0) + (b.apartamento?.total ?? 0) + (b.inclusoes?.total ?? 0) + (b.exclusoes?.total ?? 0) + (b.devolucoes?.total ?? 0) + (b.permuta?.total ?? 0) + (b.taxaAdesao?.total ?? 0);
    const excesso = soma - decl;
    if (excesso <= 0.05) return;
    const corte = Math.min(excesso, b.retroativas.total);
    if (corte <= 0.05) return;
    const fator = (b.retroativas.total - corte) / b.retroativas.total;
    const novaQtd = Math.max(0, Math.round(b.retroativas.quantidade * fator));
    b.inclusoes = {
      quantidade: Math.max(0, b.inclusoes.quantidade - (b.retroativas.quantidade - novaQtd)),
      total: b.inclusoes.total - corte
    };
    b.retroativas = {
      ...b.retroativas,
      quantidade: novaQtd,
      total: b.retroativas.total - corte,
      mesesDetalhe: b.retroativas.mesesDetalhe?.map((d) => ({
        mes: d.mes,
        quantidade: Math.round(d.quantidade * fator),
        total: d.total * fator
      }))
    };
  });
  const rowsResumo = lerRowsAbaResumo(wb);
  if (rowsResumo && blocos.length > 0) {
    let coparticipItems = parseCoparticipacaoRows(rowsResumo);
    if (coparticipItems.length === 0) {
      coparticipItems = parseCoparticipacaoPivotTipoCobranca(rowsResumo);
    }
    if (coparticipItems.length > 0) {
      const acumPorChave = /* @__PURE__ */ new Map();
      for (const item of coparticipItems) {
        const alvoKey = normMatch(item.nome);
        let match = null;
        if (blocos.length === 1) {
          match = blocos[0];
        } else {
          match = blocos.find((b) => normMatch(b.nome) === alvoKey) || blocos.find((b) => {
            const bk = normMatch(b.nome);
            return bk && (alvoKey.includes(bk) || bk.includes(alvoKey));
          }) || null;
        }
        if (!match) continue;
        const key = match.cnpj || match.nome;
        const acc = acumPorChave.get(key) || { substipulantes: [], quantidade: 0, total: 0 };
        acc.substipulantes.push(item);
        acc.quantidade += item.quantidade;
        acc.total += item.total;
        acumPorChave.set(key, acc);
      }
      for (const b of blocos) {
        const acc = acumPorChave.get(b.cnpj || b.nome);
        if (acc && (acc.quantidade !== 0 || acc.total !== 0)) {
          b.coparticipacao = {
            quantidade: acc.quantidade,
            total: acc.total,
            substipulantes: acc.substipulantes
          };
        }
      }
    }
  }
  return dividirBlocosPorSubBlocosDeclarados(wb, mesclarBlocosPorNomeForcado(blocos));
}
function lerSubBlocosDeclarados(wb) {
  const reCnpjRotulo = /cnpj\s*[:\-]?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i;
  const out = [];
  wb.worksheets.forEach((ws) => {
    if (norm(ws.name).includes("resumo")) return;
    const rows = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      rows.push(row.values.slice(1));
    });
    if (rows.length === 0 || rows.length > 5e3) return;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || [];
      let col = -1;
      let m = null;
      for (let c2 = 0; c2 < r.length; c2++) {
        const txt = cellToText(r[c2]);
        const hit = txt.match(reCnpjRotulo);
        if (hit) {
          col = c2;
          m = hit;
          break;
        }
      }
      if (col < 0 || !m) continue;
      const cnpj = normalizarCnpj(m[1]);
      if (cnpj.length !== 14) continue;
      const bruto = cellToText(r[col]);
      const nome = bruto.replace(reCnpjRotulo, "").replace(/^[\s\-–—:]+/, "").replace(/[\s\-–—:]+$/, "").trim();
      let idxQtd = -1;
      let idxMens = -1;
      let idxTotal = -1;
      let linhaInicio = i + 1;
      for (const cand of [i, i + 1]) {
        const rc = rows[cand] || [];
        let q = -1, me = -1, to = -1;
        for (let c2 = 0; c2 < rc.length; c2++) {
          const h = norm(rc[c2]);
          if (!h) continue;
          if (q < 0 && (h === "qtd" || h.includes("quantidade"))) q = c2;
          else if (me < 0 && h.includes("mensalidade")) me = c2;
          else if (to < 0 && (h.includes("total") || h.includes("valor"))) to = c2;
        }
        if (q >= 0 && to >= 0) {
          idxQtd = q;
          idxMens = me;
          idxTotal = to;
          linhaInicio = cand + 1;
          break;
        }
      }
      if (idxTotal < 0) continue;
      const sub = {
        cnpj,
        nome: nome || "Sem nome",
        enfQtd: 0,
        enfMens: 0,
        enfTotal: 0,
        aptQtd: 0,
        aptMens: 0,
        aptTotal: 0
      };
      for (let j = linhaInicio; j < rows.length; j++) {
        const rj = rows[j] || [];
        const label = cellToText(rj[col]).trim();
        const labelNorm = norm(label);
        if (label && reCnpjRotulo.test(label)) break;
        if (labelNorm.startsWith("total")) break;
        if (!label) {
          if (sub.enfQtd || sub.aptQtd || sub.enfTotal || sub.aptTotal) break;
          continue;
        }
        const cat = classificarPlano(label);
        if (!cat) continue;
        const qtd = idxQtd >= 0 ? toNumber(rj[idxQtd]) : NaN;
        const mens = idxMens >= 0 ? toNumber(rj[idxMens]) : NaN;
        const tot = toNumber(rj[idxTotal]);
        const q = isNaN(qtd) ? 0 : Math.round(qtd);
        const t = isNaN(tot) ? 0 : tot;
        if (cat === "enfermaria") {
          sub.enfQtd += q;
          sub.enfTotal += t;
          if (!isNaN(mens) && mens !== 0) sub.enfMens = mens;
        } else {
          sub.aptQtd += q;
          sub.aptTotal += t;
          if (!isNaN(mens) && mens !== 0) sub.aptMens = mens;
        }
      }
      if (sub.enfQtd || sub.aptQtd || sub.enfTotal || sub.aptTotal) out.push(sub);
    }
  });
  return out;
}
function dividirBlocosPorSubBlocosDeclarados(wb, blocos) {
  if (blocos.length === 0) return blocos;
  const subs = lerSubBlocosDeclarados(wb);
  if (subs.length === 0) return blocos;
  const porCnpj = /* @__PURE__ */ new Map();
  subs.forEach((s) => {
    const arr = porCnpj.get(s.cnpj) || [];
    arr.push(s);
    porCnpj.set(s.cnpj, arr);
  });
  const duplicados = /* @__PURE__ */ new Map();
  porCnpj.forEach((arr, cnpj) => {
    if (arr.length > 1) duplicados.set(cnpj, arr);
  });
  if (duplicados.size === 0) return blocos;
  const escala = (v, f) => v ? { ...v, quantidade: Math.round(v.quantidade * f), total: v.total * f } : void 0;
  const saida = [];
  for (const bloco of blocos) {
    const arr = bloco.cnpj ? duplicados.get(bloco.cnpj) : void 0;
    if (!arr) {
      saida.push(bloco);
      continue;
    }
    const totalQtd = arr.reduce((s, x) => s + x.enfQtd + x.aptQtd, 0);
    const totalVal = arr.reduce((s, x) => s + x.enfTotal + x.aptTotal, 0);
    arr.forEach((sub) => {
      const peso = totalQtd > 0 ? (sub.enfQtd + sub.aptQtd) / totalQtd : totalVal !== 0 ? (sub.enfTotal + sub.aptTotal) / totalVal : 1 / arr.length;
      const novo = {
        cnpj: bloco.cnpj,
        nome: sub.nome,
        nomeExibicao: formatNomeComCnpj(sub.nome, bloco.cnpj),
        enfermaria: {
          beneficiarios: sub.enfQtd,
          mensalidade: sub.enfMens || (sub.enfQtd > 0 ? sub.enfTotal / sub.enfQtd : 0),
          total: sub.enfTotal
        },
        apartamento: {
          beneficiarios: sub.aptQtd,
          mensalidade: sub.aptMens || (sub.aptQtd > 0 ? sub.aptTotal / sub.aptQtd : 0),
          total: sub.aptTotal
        },
        inclusoes: escala(bloco.inclusoes, peso) || { quantidade: 0, total: 0 },
        avisos: [
          ...bloco.avisos,
          `Bloco separado conforme a planilha \u2014 o CNPJ possui ${arr.length} faturamentos distintos ("${sub.nome}").`
        ],
        totalDeclaradoExcel: sub.enfTotal + sub.aptTotal
      };
      const retro2 = escala(bloco.retroativas, peso);
      if (retro2) novo.retroativas = retro2;
      const retroR = escala(bloco.retroativasReajuste, peso);
      if (retroR) novo.retroativasReajuste = retroR;
      const retroB = escala(bloco.retroativasBeneficiarios, peso);
      if (retroB) novo.retroativasBeneficiarios = retroB;
      const exc = escala(bloco.exclusoes, peso);
      if (exc) novo.exclusoes = exc;
      const dev = escala(bloco.devolucoes, peso);
      if (dev) novo.devolucoes = dev;
      const perm = escala(bloco.permuta, peso);
      if (perm) novo.permuta = perm;
      const ade = escala(bloco.taxaAdesao, peso);
      if (ade) novo.taxaAdesao = ade;
      if (bloco.complemento) {
        novo.complemento = {
          ...bloco.complemento,
          quantidade: Math.round(bloco.complemento.quantidade * peso),
          total: bloco.complemento.total * peso
        };
      }
      if (bloco.coparticipacao) {
        novo.coparticipacao = {
          ...bloco.coparticipacao,
          quantidade: Math.round(bloco.coparticipacao.quantidade * peso),
          total: bloco.coparticipacao.total * peso
        };
      }
      if (bloco.faixasEtarias?.length) {
        novo.faixasEtarias = bloco.faixasEtarias.map((f) => ({
          ...f,
          quantidade: Math.round(f.quantidade * peso),
          total: f.total * peso
        }));
      }
      saida.push(novo);
    });
  }
  return saida;
}
function mesclarBlocosPorNomeForcado(blocos) {
  const FORCE_GROUP_BY_NAME = getForceGroupByNamePatterns();
  const matchForce = (nome) => {
    const n = norm(nome);
    return FORCE_GROUP_BY_NAME.find((p) => n.includes(p)) || null;
  };
  const grupos = /* @__PURE__ */ new Map();
  const ordem = [];
  for (const b of blocos) {
    const tag = matchForce(b.nome);
    if (!tag) {
      ordem.push(b);
      continue;
    }
    const groupKey = tag.includes("jabil industrial do brasil") ? `${tag}::${normMatch(b.nome)}` : tag;
    const list = grupos.get(groupKey) || [];
    list.push(b);
    grupos.set(groupKey, list);
  }
  if (grupos.size === 0) return blocos;
  const somaCat = (arr, cat) => {
    const beneficiarios = arr.reduce((s, x) => s + (x[cat]?.beneficiarios || 0), 0);
    const total = arr.reduce((s, x) => s + (x[cat]?.total || 0), 0);
    const mensalidade = beneficiarios > 0 ? total / beneficiarios : 0;
    return { beneficiarios, mensalidade, total };
  };
  const somaQT = (arr, key) => {
    const items = arr.map((x) => x[key]).filter(Boolean);
    if (items.length === 0) return void 0;
    return { quantidade: items.reduce((s, x) => s + x.quantidade, 0), total: items.reduce((s, x) => s + x.total, 0) };
  };
  const merged = [];
  for (const [, arr] of grupos) {
    const principal = arr[0];
    const faixasMap = /* @__PURE__ */ new Map();
    arr.forEach((b) => (b.faixasEtarias || []).forEach((f) => {
      const k = `${f.idadeInicial}-${f.idadeFinal ?? "+"}`;
      const prev = faixasMap.get(k) || { ...f, quantidade: 0, total: 0 };
      prev.quantidade += f.quantidade;
      prev.total += f.total;
      faixasMap.set(k, prev);
    }));
    const cnpjs = Array.from(new Set(arr.map((x) => x.cnpj).filter(Boolean)));
    const novoBloco = {
      cnpj: principal.cnpj,
      nome: principal.nome,
      nomeExibicao: principal.nome,
      enfermaria: somaCat(arr, "enfermaria"),
      apartamento: somaCat(arr, "apartamento"),
      inclusoes: somaQT(arr, "inclusoes") || { quantidade: 0, total: 0 },
      avisos: [
        ...cnpjs.length > 1 ? [`Consolidado por nome \u2014 ${cnpjs.length} CNPJs agrupados (${cnpjs.join(", ")}).`] : []
      ]
    };
    const retro2 = somaQT(arr, "retroativas");
    if (retro2) {
      const meses = Array.from(new Set(arr.flatMap((x) => x.retroativas?.meses || [])));
      const detalheMap = /* @__PURE__ */ new Map();
      arr.forEach((x) => (x.retroativas?.mesesDetalhe || []).forEach((d) => {
        const cur = detalheMap.get(d.mes) || { quantidade: 0, total: 0 };
        cur.quantidade += d.quantidade;
        cur.total += d.total;
        detalheMap.set(d.mes, cur);
      }));
      const mesesDetalhe = Array.from(detalheMap.entries()).map(([mes, v]) => ({ mes, ...v }));
      novoBloco.retroativas = {
        ...retro2,
        ...meses.length ? { meses } : {},
        ...mesesDetalhe.length ? { mesesDetalhe } : {}
      };
    }
    const retroRea = somaQT(arr, "retroativasReajuste");
    if (retroRea) {
      const meses = Array.from(new Set(arr.flatMap((x) => x.retroativasReajuste?.meses || [])));
      novoBloco.retroativasReajuste = { ...retroRea, ...meses.length ? { meses } : {} };
    }
    const retroBen = somaQT(arr, "retroativasBeneficiarios");
    if (retroBen) novoBloco.retroativasBeneficiarios = retroBen;
    const exc = somaQT(arr, "exclusoes");
    if (exc) novoBloco.exclusoes = exc;
    const dev = somaQT(arr, "devolucoes");
    if (dev) novoBloco.devolucoes = dev;
    const perm = somaQT(arr, "permuta");
    if (perm) novoBloco.permuta = perm;
    const ade = somaQT(arr, "taxaAdesao");
    if (ade) novoBloco.taxaAdesao = ade;
    const complementos = arr.map((x) => x.complemento).filter(Boolean);
    if (complementos.length > 0) {
      novoBloco.complemento = {
        quantidade: complementos.reduce((s2, c2) => s2 + c2.quantidade, 0),
        total: complementos.reduce((s2, c2) => s2 + c2.total, 0),
        periodoLabel: complementos.find((c2) => c2.periodoLabel)?.periodoLabel ?? null,
        itens: complementos.flatMap((c2) => c2.itens || [])
      };
    }
    const copartics = arr.map((x) => x.coparticipacao).filter(Boolean);
    if (copartics.length > 0) {
      const substipulantes = copartics.flatMap((c2) => c2.substipulantes || []);
      novoBloco.coparticipacao = {
        quantidade: copartics.reduce((s, c2) => s + c2.quantidade, 0),
        total: copartics.reduce((s, c2) => s + c2.total, 0),
        ...substipulantes.length ? { substipulantes } : {}
      };
    }
    if (faixasMap.size > 0) {
      novoBloco.faixasEtarias = Array.from(faixasMap.values()).sort((a, b) => a.idadeInicial - b.idadeInicial);
    }
    const declarados = arr.map((x) => x.totalDeclaradoExcel).filter((v) => typeof v === "number");
    if (declarados.length > 0) novoBloco.totalDeclaradoExcel = declarados.reduce((s2, v) => s2 + v, 0);
    merged.push(novoBloco);
  }
  return [...ordem, ...merged];
}

// scripts/nfse-server/pdfjs-shim.js
import { getResolvedPDFJS } from "npm:unpdf@0.12.1";
var GlobalWorkerOptions = {};
function getDocument(opts) {
  return {
    promise: getResolvedPDFJS().then(
      (p) => p.getDocument({ ...opts, isEvalSupported: false, useSystemFonts: true, disableFontFace: true }).promise
    )
  };
}

// vazio:worker
var worker_default = "";

// src/lib/retroativo-nf.ts
function regexRetroativoNf() {
  const MES = String.raw`(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?(?:\s*(?:\/|-|de)?\s*\d{2,4}(?![\d,]))?`;
  const COMP = String.raw`\d{1,2}\s*\/\s*\d{2,4}(?![\d,])`;
  return new RegExp(
    String.raw`(?:^|[\s/;|(])(?:cobranca\s*)?retroa(?:tiv[ao]s?|cao)(?:\s+(?:a|de|ref\.?|referente(?:\s+a)?))?(?:\s*[-:]?\s*(?:${MES}|${COMP}))?\s*(?:\(\s*\d+\s*[a-z]*\s*\))?\s*[:\-=]?\s*(?:r\s*\$)?\s*(\d[\d.]*,\d{2})`,
    "gi"
  );
}

// src/lib/pdf-analysis-utils.ts
GlobalWorkerOptions.workerSrc = worker_default;
function soDigitosCnpj(s) {
  return (s || "").replace(/\D/g, "").slice(0, 14);
}
function extrairTomador(textoOriginal) {
  const texto = textoOriginal.replace(/\u00a0/g, " ");
  const reIni = /tomador\s*(?:d[oa]?\s*servi[çc]o|\/\s*adquirente)/i;
  const mIni = texto.match(reIni);
  if (!mIni) return { cnpj: null, nome: null };
  const idx = (mIni.index ?? 0) + mIni[0].length;
  const reFim = /(destinat[aá]rio\s*da\s*opera|intermedi[aá]rio|servi[çc]o\s*prestado|tributa[çc][aã]o)/i;
  const restante = texto.slice(idx);
  const mFim = restante.match(reFim);
  const trecho = mFim ? restante.slice(0, mFim.index) : restante.slice(0, 1500);
  const reCnpj = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/;
  const mCnpj = trecho.match(reCnpj);
  const cnpj = mCnpj ? soDigitosCnpj(mCnpj[1]) : null;
  let nome = null;
  const limparNome = (raw) => raw.replace(/\s+\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}.*$/, "").replace(/\s+(rua|avenida|av\.?|travessa|trav\.?|alameda|estrada|rodovia|pra[çc]a|quadra|conjunto|bloco)\b.*$/i, "").replace(/\s+[A-Za-zÀ-ú.]+(?:\s[A-Za-zÀ-ú.]+)?\s\/\s[A-Z]{2}\b.*$/, "").replace(/\s+\d{5}-?\d{3}\b.*$/, "").replace(/\s*(e-?mail|endere[çc]o|munic[ií]pio|cep|telefone|cnpj|inscri[çc][aã]o|raz[aã]o|fantasia)\b.*$/i, "").replace(/\s{2,}/g, " ").trim();
  const reLabel = /nome\s*\/?\s*nome\s*empresarial\s*[:\-]?\s*(.*)$/im;
  const mLabel = trecho.match(reLabel);
  if (mLabel) {
    const restoMesmaLinha = limparNome(mLabel[1] || "");
    if (restoMesmaLinha && restoMesmaLinha.length > 2) {
      nome = restoMesmaLinha;
    } else {
      const idxLabel = (mLabel.index ?? 0) + mLabel[0].length;
      const apos = trecho.slice(idxLabel).split(/\n/);
      for (const ln of apos) {
        const v = limparNome(ln);
        if (v && v.length > 2 && !/^nome\b/i.test(v)) {
          nome = v;
          break;
        }
      }
    }
    if (nome) nome = nome.toUpperCase();
    if (!nome) nome = null;
  }
  return { cnpj, nome };
}
function norm2(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
function parseValor(raw) {
  const s = raw.trim();
  if (!s) return NaN;
  if (s.includes(",")) {
    return parseFloat(s.replace(/\./g, "").replace(",", "."));
  }
  const m = s.match(/^(\d+)\.(\d{1,2})$/);
  if (m) return parseFloat(`${m[1]}.${m[2]}`);
  return parseFloat(s.replace(/\./g, ""));
}
async function extrairTextoPdf(buffer) {
  const data = buffer.slice(0);
  const pdf = await getDocument({ data }).promise;
  const partes = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items.filter((i) => typeof i.str === "string").map((i) => ({
      str: i.str,
      x: i.transform?.[4] ?? 0,
      y: i.transform?.[5] ?? 0
    }));
    const groups = [];
    items.forEach((it) => {
      const g = groups.find((gr) => Math.abs(gr.y - it.y) < 2);
      if (g) g.items.push(it);
      else groups.push({ y: it.y, items: [it] });
    });
    groups.sort((a, b) => b.y - a.y);
    groups.forEach((g) => {
      g.items.sort((a, b) => a.x - b.x);
      partes.push(g.items.map((i) => i.str).join(" "));
    });
  }
  return partes.join("\n").replace(/\u00a0/g, " ");
}
function extrairTaxaAdesao(texto) {
  const t = norm2(texto);
  const valores = [...t.matchAll(/\btaxa\s+de\s+adesao\s*[:=\-]\s*(?:r\s*\$\s*)?(\d[\d.]*,\d{2}|\d+\.\d{2})(?!\d)/g)];
  return { total: valores.length === 1 ? parseValor(valores[0][1]) : null, quantidade: null };
}
function extrairCompetenciaDescricao(texto) {
  const meses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const matches = [...norm2(texto).matchAll(/\bperiodo\s+de\s*:\s*([a-z]+)\s*\/\s*(20\d{2})\b/g)];
  if (matches.length !== 1) return null;
  const mes = meses.indexOf(matches[0][1]);
  return mes < 0 ? null : `${matches[0][2]}-${String(mes + 1).padStart(2, "0")}`;
}
async function analisarPdfFinanceiro(buffer) {
  const empty = { beneficiarios: null, mensalidade: null, total: 0 };
  const avisos = [];
  let texto;
  try {
    texto = await extrairTextoPdf(buffer);
  } catch (e) {
    return {
      enfermaria: { ...empty },
      apartamento: { ...empty },
      inclusoes: { total: 0 },
      exclusoes: { total: null },
      devolucoes: { total: null },
      valorLiquido: null,
      nfNumero: null,
      tomadorCnpj: null,
      tomadorNome: null,
      tributos: {
        valorServico: null,
        baseCalculo: null,
        totalDeducoes: null,
        aliquotaIssqn: null,
        issqn: null,
        issqnRetido: null,
        ibs: null,
        cbs: null,
        outrasRetencoes: null,
        retencaoIssqn: null
      },
      avisos: [`Falha ao abrir PDF: ${e?.message || e}`]
    };
  }
  const { cnpj: tomadorCnpj, nome: tomadorNome } = extrairTomador(texto);
  const t = norm2(texto);
  const NUM = String.raw`[\d.,]+`;
  const reCat = (cat) => new RegExp(
    // cat + qualquer rótulo curto (CE, Master, etc.) + sep + qtd x preço + sep + total
    `${cat}[\\s\\-:a-z]{0,30}?(\\d+)\\s*[xX\xD7]\\s*(${NUM})\\s*[=:]\\s*r?\\$?\\s*(${NUM})`,
    "i"
  );
  const reInclusao = new RegExp(
    `inclus(?:ao|oes|\xF5es|o|os|ido|idos|ida|idas)?\\s*[:\\-=]?\\s*r?\\$?\\s*(${NUM})`,
    "i"
  );
  let enfermaria = null;
  let apartamento = null;
  let inclusoesTotal = 0;
  let inclusoesEncontradas = false;
  const reCatFaixa = (cat) => new RegExp(
    `${cat}[\\s\\-:a-z]{0,10}?\\(?\\s*(\\d+)\\s*benefici[a\xE1]ri[oa]s?\\s*\\)?\\s*[:\\-=]?\\s*r?\\$?\\s*(${NUM})`,
    "i"
  );
  const mEnf = t.match(reCat("enfermaria"));
  if (mEnf) {
    const ben = parseInt(mEnf[1], 10);
    const men = parseValor(mEnf[2]);
    const tot = parseValor(mEnf[3]);
    if (!isNaN(ben) && !isNaN(men) && !isNaN(tot)) {
      enfermaria = { beneficiarios: ben, mensalidade: men, total: tot };
    }
  }
  if (!enfermaria) {
    const mEnfF = t.match(reCatFaixa("enfermaria"));
    if (mEnfF) {
      const ben = parseInt(mEnfF[1], 10);
      const tot = parseValor(mEnfF[2]);
      if (!isNaN(ben) && !isNaN(tot)) {
        enfermaria = { beneficiarios: ben, mensalidade: null, total: tot };
      }
    }
  }
  const mApt = t.match(reCat("apartamento"));
  if (mApt) {
    const ben = parseInt(mApt[1], 10);
    const men = parseValor(mApt[2]);
    const tot = parseValor(mApt[3]);
    if (!isNaN(ben) && !isNaN(men) && !isNaN(tot)) {
      apartamento = { beneficiarios: ben, mensalidade: men, total: tot };
    }
  }
  if (!apartamento) {
    const mAptF = t.match(reCatFaixa("apartamento"));
    if (mAptF) {
      const ben = parseInt(mAptF[1], 10);
      const tot = parseValor(mAptF[2]);
      if (!isNaN(ben) && !isNaN(tot)) {
        apartamento = { beneficiarios: ben, mensalidade: null, total: tot };
      }
    }
  }
  const mInc = t.match(reInclusao);
  if (mInc) {
    const v = parseValor(mInc[1]);
    if (!isNaN(v) && v > 0) {
      inclusoesTotal = v;
      inclusoesEncontradas = true;
    }
  }
  const reRetro = regexRetroativoNf();
  for (const mRetro of t.matchAll(reRetro)) {
    const v = parseValor(mRetro[1]);
    if (!isNaN(v) && v > 0) {
      inclusoesTotal += v;
      inclusoesEncontradas = true;
    }
  }
  if (!enfermaria) avisos.push("Categoria 'Enfermaria' n\xE3o encontrada no PDF.");
  if (!apartamento) avisos.push("Categoria 'Apartamento' n\xE3o encontrada no PDF.");
  if (!inclusoesEncontradas) avisos.push("Categoria 'Inclus\xF5es' n\xE3o encontrada no PDF.");
  let exclusoesTotal = null;
  const reExc = new RegExp(
    `exclus(?:ao|oes|\xF5es|o|os|ido|idos|ida|idas)?\\s*[:\\-=]?\\s*(\\()?\\s*(-)?\\s*r?\\$?\\s*(${NUM})\\s*(\\))?`,
    "i"
  );
  const mExc = t.match(reExc);
  if (mExc) {
    const v = parseValor(mExc[3]);
    if (!isNaN(v) && v !== 0) {
      const negativo = !!mExc[1] || !!mExc[2] || !!mExc[4];
      exclusoesTotal = negativo ? -Math.abs(v) : -Math.abs(v);
    }
  }
  let devolucoesTotal = null;
  const reDev = new RegExp(
    `devolu(?:cao|coes|ido|idos|ida|idas)?\\s*[:\\-=]?\\s*(\\()?\\s*(-)?\\s*r?\\$?\\s*(${NUM})\\s*(\\))?`,
    "i"
  );
  const mDev = t.match(reDev);
  if (mDev) {
    const v = parseValor(mDev[3]);
    if (!isNaN(v) && v !== 0) {
      devolucoesTotal = -Math.abs(v);
    }
  }
  const tLines = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[ \t]+/g, " ");
  const linhasAposRotulo = (re, qtd = 3) => {
    const m = tLines.match(re);
    if (!m || m.index == null) return [];
    const fimLinha = tLines.indexOf("\n", m.index);
    if (fimLinha < 0) return [];
    const resto = tLines.slice(fimLinha + 1);
    return resto.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, qtd);
  };
  const proximaLinhaApos = (re) => linhasAposRotulo(re, 1)[0] ?? null;
  const moneysOf = (linha) => {
    const out = [];
    const re = /r\$\s*([\d.]+,\d{2})|(?:^|\s)(\d{1,3}(?:\.\d{3})*,\d{2})(?=\s|$)/gi;
    let mm;
    while ((mm = re.exec(linha)) !== null) {
      const raw = mm[1] ?? mm[2];
      const v = parseValor(raw);
      if (!isNaN(v)) out.push(v);
    }
    return out;
  };
  let valorLiquido = null;
  let issqnRetidoVT = null;
  let valorServicoVT = null;
  const linhasVT = linhasAposRotulo(/valor\s+total\s+da\s+nfs[\s\-]?e/i, 8);
  if (linhasVT.length) {
    const corte = linhasVT.findIndex(
      (l) => /^(totais\s+aproximados|tributacao|tributação|informacoes|informações|outras\s+informacoes)/i.test(l)
    );
    const usar = (corte > 0 ? linhasVT.slice(0, corte) : linhasVT).join(" ");
    const moneys = moneysOf(usar);
    if (moneys.length >= 3) {
      valorServicoVT = moneys[0];
      issqnRetidoVT = moneys[1];
      valorLiquido = moneys[moneys.length - 1];
    } else if (moneys.length === 2) {
      valorServicoVT = moneys[0];
      valorLiquido = moneys[1];
    } else if (moneys.length === 1) {
      valorLiquido = moneys[0];
    }
    if (valorServicoVT != null && valorLiquido != null) {
      const dif = Number((valorServicoVT - valorLiquido).toFixed(2));
      if (dif > 0.01) {
        if (issqnRetidoVT == null || Math.abs(issqnRetidoVT - dif) > 0.05) {
          issqnRetidoVT = dif;
        }
      } else if (dif <= 0.01) {
        issqnRetidoVT = null;
      }
    }
  }
  if (issqnRetidoVT == null) {
    const idx = t.search(/issqn\s+retido/i);
    if (idx >= 0) {
      const janela = t.slice(idx, idx + 200);
      const moneys = moneysOf(janela);
      if (moneys.length > 0) issqnRetidoVT = moneys[moneys.length - 1];
    }
  }
  let baseCalculo = null;
  let totalDeducoes = null;
  let aliquota = null;
  let issqnDevido = null;
  const linhaTM = linhasAposRotulo(/bc\s+issqn/i, 3).join(" ");
  if (linhaTM) {
    const moneys = moneysOf(linhaTM);
    if (moneys.length >= 4) {
      totalDeducoes = moneys[moneys.length - 3];
      baseCalculo = moneys[moneys.length - 2];
      issqnDevido = moneys[moneys.length - 1];
    } else if (moneys.length === 3) {
      baseCalculo = moneys[1];
      issqnDevido = moneys[2];
    } else {
      if (moneys.length >= 2) baseCalculo = moneys[moneys.length - 2];
      if (moneys.length >= 1) issqnDevido = moneys[moneys.length - 1];
    }
    const pct = linhaTM.match(/(\d+[,.]\d+)\s*%/);
    if (pct) aliquota = parseValor(pct[1]);
  }
  if (baseCalculo == null) {
    const m = tLines.match(/(?:bc\s*issqn|base\s*de\s*calculo)[^\n]{0,40}r\$\s*([\d.]+,\d{2})/i);
    if (m) baseCalculo = parseValor(m[1]);
  }
  if (issqnDevido == null) {
    const m = tLines.match(/issqn\s*(?:apurado|devido|a\s*recolher)[^\n]{0,40}r\$\s*([\d.]+,\d{2})/i);
    if (m) issqnDevido = parseValor(m[1]);
  }
  if (aliquota == null) {
    const m = tLines.match(/aliquota\s*(?:aplicada|do\s*issqn|issqn)?[^\n]{0,20}(\d+[,.]\d+)\s*%/i);
    if (m) aliquota = parseValor(m[1]);
  }
  if (totalDeducoes == null) {
    const m = tLines.match(/total\s+deducoes(?:\/redu[cç][oõ]es)?[^\n]{0,40}r\$\s*([\d.]+,\d{2})/i);
    if (m) totalDeducoes = parseValor(m[1]);
  }
  let valorServico = valorServicoVT;
  if (valorServico == null) {
    const m = t.match(/valor\s+(?:do\s+)?servic[oõ]s?[\s\S]{0,60}?r\$\s*([\d.]+,\d{2})/i);
    if (m) valorServico = parseValor(m[1]);
  }
  let retencaoIssqn = null;
  if (/retido\s+pelo\s+tomador/i.test(tLines)) retencaoIssqn = "retido";
  else if (/n[ãa]o\s+retido/i.test(tLines)) retencaoIssqn = "nao_retido";
  if (retencaoIssqn === "nao_retido") issqnRetidoVT = null;
  const isV2 = /valor\s+da\s+operacao/.test(tLines) && /total\s+das\s+retencoes\s*\(issqn/.test(tLines);
  if (isV2) {
    const m1 = (re) => moneysOf(proximaLinhaApos(re) ?? "");
    const vServ = m1(/valor\s+da\s+operacao[^\n]*/);
    if (vServ.length) valorServico = vServ[0];
    const linhaRet = proximaLinhaApos(/total\s+das\s+retencoes\s*\(issqn[^\n]*/) ?? "";
    const celulas = [];
    {
      const reCel = /r\$\s*([\d.]+,\d{2})|(?:^|\s)(\d{1,3}(?:\.\d{3})*,\d{2})(?=\s|$)|(?:^|\s)-(?=\s|$)/gi;
      let mc;
      while ((mc = reCel.exec(linhaRet)) !== null) {
        const raw = mc[1] ?? mc[2];
        celulas.push(raw ? parseValor(raw) : null);
      }
    }
    const totalRet = celulas.length >= 1 ? celulas[0] ?? 0 : null;
    if (celulas.length >= 2 && celulas[1] != null) valorLiquido = celulas[1];
    const vDed = m1(/total\s+deducoes[^\n]*/);
    if (vDed.length) totalDeducoes = vDed[0];
    const linhaBc = proximaLinhaApos(/bc\s+issqn[^\n]*/) ?? "";
    const vBc = moneysOf(linhaBc);
    if (vBc.length >= 1) baseCalculo = vBc[0];
    if (vBc.length >= 2) issqnDevido = vBc[vBc.length - 1];
    const pct = linhaBc.match(/(\d+[,.]\d+)\s*%/);
    if (pct) aliquota = parseValor(pct[1]);
    if (/retido\s+pelo\s+tomador/.test(linhaBc)) retencaoIssqn = "retido";
    else if (/nao\s+retido/.test(linhaBc)) retencaoIssqn = "nao_retido";
    if (retencaoIssqn === "retido") {
      issqnRetidoVT = issqnDevido ?? totalRet;
    } else if (retencaoIssqn === "nao_retido") {
      issqnRetidoVT = null;
    } else if (valorServico != null && valorLiquido != null) {
      const dif = Number((valorServico - valorLiquido).toFixed(2));
      issqnRetidoVT = dif > 0.01 ? dif : null;
    }
    if (valorServico != null && valorLiquido != null && totalRet != null && Math.abs(valorServico - totalRet - valorLiquido) > 0.05) {
      console.warn("[DANFSe v2] Servi\xE7o \u2212 Reten\xE7\xF5es \u2260 L\xEDquido", { valorServico, totalRet, valorLiquido });
    }
  }
  const ibsM = tLines.match(/\bibs\b[^|\n]*?\|\s*r\$\s*([\d.]+,\d{2})/i);
  const cbsM = tLines.match(/\bcbs\b[^|\n]*?\|\s*r\$\s*([\d.]+,\d{2})/i);
  let outrasRetencoes = null;
  const mTRF = tLines.match(/total\s+das\s+retencoes\s+federais[^\n]*/i);
  if (mTRF) {
    const linha = mTRF[0];
    const v = linha.match(/r\$\s*([\d.]+,\d{2})/i);
    if (v) outrasRetencoes = parseValor(v[1]);
    else if (/\s-\s|\s-$/.test(linha)) outrasRetencoes = 0;
  }
  let nfNumero = null;
  const reNf = /n[uú]?mero\s*d[ao]?\s*nfs[\s\-]?e[^\d]{0,20}(\d{3,10})/i;
  const mNf = t.match(reNf);
  if (mNf) nfNumero = mNf[1];
  const tributos = {
    valorServico,
    baseCalculo,
    totalDeducoes,
    aliquotaIssqn: aliquota,
    issqn: issqnDevido,
    issqnRetido: issqnRetidoVT,
    ibs: ibsM ? parseValor(ibsM[1]) : null,
    cbs: cbsM ? parseValor(cbsM[1]) : null,
    outrasRetencoes,
    retencaoIssqn
  };
  return {
    enfermaria: enfermaria ?? { ...empty },
    apartamento: apartamento ?? { ...empty },
    inclusoes: { total: inclusoesTotal },
    exclusoes: { total: exclusoesTotal },
    devolucoes: { total: devolucoesTotal },
    taxaAdesao: extrairTaxaAdesao(texto),
    competenciaDescricao: extrairCompetenciaDescricao(texto),
    valorLiquido,
    nfNumero,
    tomadorCnpj,
    tomadorNome,
    tributos,
    avisos
  };
}

// src/lib/nfse-identidade-fiscal.ts
var dig = (s) => (s ?? "").replace(/\D/g, "");
var sem0 = (s) => s.replace(/^0+(?=\d)/, "");
var norm3 = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u00a0/g, " ");
function lerChave(t) {
  const m = norm3(t).match(/chave\s+de\s+acesso(?:\s+da\s+nfs-?e)?[^\d]{0,40}((?:\d[\s.]?){44,60})/i);
  const d = m ? dig(m[1]) : "";
  return d.length >= 44 ? d : null;
}
function lerNumero(t) {
  const m = norm3(t).match(/n(?:u|ú)?mero\s*d[ao]?\s*nfs[\s-]?e[^\d\n]{0,20}(\d{1,15})/i);
  return m ? sem0(m[1]) : null;
}
function lerPrestador(t) {
  const n = norm3(t);
  const ini = n.search(/(emitente\s+da\s+nfs-?e|prestador\s+(?:d[oe]s?\s+)?servi[cç]os?)/i);
  if (ini < 0) return null;
  const resto = n.slice(ini);
  const fim = resto.search(/tomador/i);
  const trecho = fim > 0 ? resto.slice(0, fim) : resto.slice(0, 1500);
  const m = trecho.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  return m ? dig(m[1]) : null;
}
function lerEmissao(t) {
  const m = norm3(t).match(/(?:data\s+e\s+hora\s+d[ae]\s+emissao|data\s+d[ae]\s+emissao|emitida\s+em)[^\d\n]{0,30}(\d{2})\/(\d{2})\/(\d{4})(?:[^\d\n]{1,5}(\d{2}:\d{2}(?::\d{2})?))?/i);
  return m ? { data: `${m[3]}-${m[2]}-${m[1]}`, hora: m[4] ?? null } : null;
}
function lerCompetencia(t) {
  const m = norm3(t).match(/competencia(?:\s+da\s+nfs-?e)?[^\d\n]{0,20}(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4})/i);
  return m ? m[1] : null;
}
function dataManaus(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) return null;
  return new Date(t - 4 * 36e5).toISOString().slice(0, 10);
}
function conferirIdentidadeFiscal(texto, e) {
  const motivos = [];
  const campo2 = (rotulo, lido, esperado, igual, obrigatorio = true) => {
    if (!esperado) {
      if (obrigatorio) motivos.push(`${rotulo}: n\xE3o informado nos metadados.`);
      return { situacao: "nao_informado", lido, esperado };
    }
    if (!lido) {
      if (obrigatorio) motivos.push(`${rotulo}: n\xE3o encontrado ou ileg\xEDvel no PDF.`);
      return { situacao: "ausente", lido, esperado };
    }
    if (!igual(lido, esperado)) {
      motivos.push(`${rotulo}: PDF ${lido} \xD7 informado ${esperado}.`);
      return { situacao: "divergente", lido, esperado };
    }
    return { situacao: "confere", lido, esperado };
  };
  const exato = (a, b) => a === b;
  const cnpj14 = (a, b) => a.length === 14 && a === b;
  const emi = lerEmissao(texto);
  const campos = {
    chave_acesso: campo2("Chave de acesso", lerChave(texto), dig(e.chaveAcesso) || null, exato),
    numero: campo2("N\xFAmero da NFS-e", lerNumero(texto), e.numeroNfse ? sem0(dig(e.numeroNfse)) || null : null, exato),
    cnpj_prestador: campo2("CNPJ do prestador", lerPrestador(texto), dig(e.cnpjPrestador) || null, cnpj14),
    cnpj_tomador: campo2("CNPJ do tomador", extrairTomador(texto).cnpj, dig(e.cnpjTomador) || null, cnpj14),
    // Emissão: conferida quando legível no PDF; ausência não bloqueia, divergência bloqueia.
    emissao: campo2("Data de emiss\xE3o", emi?.data ?? null, dataManaus(e.emitidaEm), exato, false)
  };
  const vals = Object.values(campos);
  const divergente = vals.some((c2) => c2.situacao === "divergente");
  const faltando = [campos.chave_acesso, campos.numero, campos.cnpj_prestador, campos.cnpj_tomador].some((c2) => c2.situacao !== "confere");
  const estado = divergente ? "divergencia" : faltando ? "validacao_inconclusiva" : "ok";
  return { ok: estado === "ok", estado, campos, competenciaNota: lerCompetencia(texto), motivos };
}

// src/lib/faturamento-totais.ts
function classificarValorCampo(v) {
  if (v === null || v === void 0 || v === "") return "ausente";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "invalido";
  return n === 0 ? "zero" : "valor";
}
var CATEGORIAS_TOTAL_FATURAMENTO = [
  "enfermaria",
  "apartamento",
  "inclusoes",
  "exclusoes",
  "devolucoes",
  "permuta",
  "taxaAdesao",
  "coparticipacao",
  "complemento"
];
var ROTULO_CATEGORIA = {
  enfermaria: "Mensalidade Enfermaria",
  apartamento: "Mensalidade Apartamento",
  inclusoes: "Inclus\xF5es",
  exclusoes: "Exclus\xF5es",
  devolucoes: "Devolu\xE7\xF5es",
  permuta: "Permuta",
  taxaAdesao: "Taxa de ades\xE3o",
  coparticipacao: "Coparticipa\xE7\xE3o",
  complemento: "Complemento"
};
function calcularTotalFaturamento(r) {
  let total = 0;
  const pendencias = [];
  for (const cat of CATEGORIAS_TOTAL_FATURAMENTO) {
    const c2 = r[cat];
    if (!c2) continue;
    const qtd = Number(c2.quantidade ?? c2.beneficiarios ?? 0) || 0;
    const situacao = classificarValorCampo(c2.total);
    if (situacao === "valor" || situacao === "zero") {
      total += Number(c2.total);
      continue;
    }
    if (qtd > 0) {
      pendencias.push({
        categoria: cat,
        rotulo: ROTULO_CATEGORIA[cat],
        quantidade: qtd,
        motivo: situacao === "ausente" ? "valor ausente" : "valor inv\xE1lido"
      });
    }
  }
  return {
    total: Number(total.toFixed(2)),
    completo: pendencias.length === 0,
    pendencias
  };
}
function somarTotalFaturamento(r) {
  return calcularTotalFaturamento(r).total;
}

// src/lib/pdf-total.ts
function sumPdfTotal(c2) {
  if (!c2) return null;
  if ("beneficiarios" in c2 && !("enfermaria" in c2)) {
    const s = c2;
    const partes2 = [s.inclusoes, s.exclusoes].filter((p) => p !== null).map((p) => p?.pdf ?? null);
    if (!partes2.length) return null;
    if (partes2.some((p) => p === null)) return null;
    return Number(partes2.reduce((a, b) => a + b, 0).toFixed(2));
  }
  const cr = c2;
  const partes = [
    cr.enfermaria,
    cr.apartamento,
    cr.inclusoes,
    cr.exclusoes,
    cr.devolucoes,
    cr.taxaAdesao ?? null
  ].filter((p) => p !== null).map((p) => p?.total?.pdf ?? null);
  if (!partes.length) return null;
  if (partes.some((p) => p === null)) return null;
  const soma = partes.reduce((acc, v) => acc + v, 0);
  return Number(soma.toFixed(2));
}

// src/lib/nfse-central-validador-arquivos.ts
var c = (v) => Math.round((Number(v) || 0) * 100);
var CATS_EXTRA = ["exclusoes", "devolucoes", "permuta", "taxaAdesao", "coparticipacao", "complemento"];
function temMensalidade(b) {
  return c(b.enfermaria?.total) !== 0 || c(b.apartamento?.total) !== 0 || (b.enfermaria?.beneficiarios ?? 0) > 0 || (b.apartamento?.beneficiarios ?? 0) > 0;
}
var retro = (b) => c(b.retroativas?.total);
function soRetroativo(b) {
  return !temMensalidade(b) && retro(b) !== 0 && c(b.inclusoes?.total) === retro(b) && CATS_EXTRA.every((k) => c(b[k]?.total) === 0);
}
function impressao(b) {
  return JSON.stringify([
    b.enfermaria,
    b.apartamento,
    b.inclusoes?.total,
    b.inclusoes?.quantidade,
    retro(b),
    ...CATS_EXTRA.map((k) => [b[k]?.total ?? null, b[k]?.quantidade ?? null])
  ]);
}
async function sha(buf) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return Array.from(h, (x) => x.toString(16).padStart(2, "0")).join("");
}
var brl2 = (n) => n.toFixed(2).replace(".", ",");
function detalheRetro(b) {
  const m = /* @__PURE__ */ new Map();
  for (const d of b.retroativas?.mesesDetalhe ?? []) m.set(d.mes, `${d.quantidade}|${c(d.total)}`);
  return m;
}
var SEM_LEITURA_FISCAL = {
  coparticipacao: "Coparticipa\xE7\xE3o",
  complemento: "Complemento",
  permuta: "Permuta"
};
async function comporFaturamento(planilhas, cnpjTomador) {
  const arquivos = [];
  const unicos = [];
  const hashes = /* @__PURE__ */ new Map();
  const falha = (m) => ({ bloco: null, arquivos, ambiguidade: m });
  for (const p of planilhas) {
    const h = await sha(p.dados);
    if (hashes.has(h)) {
      arquivos.push({ id: p.id, nome: p.nome, papel: "duplicado", valor: null, duplicadoDe: hashes.get(h), observacao: "Arquivo id\xEAntico (mesmo hash)." });
      continue;
    }
    hashes.set(h, p.id);
    let blocos;
    try {
      blocos = await analisarExcelFinanceiroPorCnpj(p.dados);
    } catch {
      arquivos.push({ id: p.id, nome: p.nome, papel: "ilegivel", valor: null });
      return falha(`Planilha \u201C${p.nome}\u201D ileg\xEDvel; n\xE3o \xE9 poss\xEDvel saber se comp\xF5e o faturamento.`);
    }
    const doPagador = blocos.filter((b2) => (b2.cnpj ?? "").replace(/\D/g, "") === cnpjTomador);
    if (!doPagador.length) {
      arquivos.push({ id: p.id, nome: p.nome, papel: "nao_pertinente", valor: null, observacao: "Sem bloco do CNPJ do tomador." });
      continue;
    }
    if (doPagador.length > 1) {
      arquivos.push({ id: p.id, nome: p.nome, papel: "ilegivel", valor: null });
      return falha(`Mais de um bloco do mesmo CNPJ na planilha \u201C${p.nome}\u201D.`);
    }
    const b = doPagador[0];
    const a = { id: p.id, nome: p.nome, papel: "complementar", valor: somarTotalFaturamento(b) };
    arquivos.push(a);
    const igual = unicos.find((u) => impressao(u.b) === impressao(b));
    if (igual) return falha(`\u201C${p.nome}\u201D e \u201C${igual.a.nome}\u201D s\xE3o arquivos diferentes com os mesmos valores (${brl2(a.valor)}); sem evid\xEAncia de que sejam os mesmos lan\xE7amentos, n\xE3o \xE9 poss\xEDvel decidir entre duplicidade e duas cobran\xE7as.`);
    unicos.push({ a, b });
  }
  if (!unicos.length) return falha(planilhas.length ? "Nenhuma planilha anexada cont\xE9m o CNPJ do tomador." : "Faturamento n\xE3o anexado.");
  const principais = unicos.filter((u) => temMensalidade(u.b));
  if (principais.length > 1) return falha(`Planilhas com mensalidade para o mesmo CNPJ: ${principais.map((u) => `\u201C${u.a.nome}\u201D (${brl2(u.a.valor)})`).join(", ")}; n\xE3o \xE9 poss\xEDvel saber se substituem ou complementam.`);
  const pr = principais[0] ?? unicos[0];
  pr.a.papel = "principal";
  if (!principais.length) pr.a.observacao = "Faturamento sem mensalidade.";
  const comp = structuredClone(pr.b);
  for (const u of unicos) {
    if (u === pr) continue;
    if (soRetroativo(u.b)) {
      if (retro(comp) === 0) {
        comp.inclusoes = { ...comp.inclusoes, quantidade: (comp.inclusoes?.quantidade ?? 0) + (u.b.inclusoes?.quantidade ?? 0), total: (c(comp.inclusoes?.total) + c(u.b.inclusoes.total)) / 100 };
        comp.retroativas = structuredClone(u.b.retroativas);
        u.a.observacao = "Retroativo ausente da planilha principal; somado \xE0s inclus\xF5es.";
        continue;
      }
      const base = detalheRetro(comp), arq = detalheRetro(u.b);
      if (!base.size || !arq.size)
        return falha(`Retroativo de \u201C${u.a.nome}\u201D (${brl2(retro(u.b) / 100)}) e retroativo j\xE1 presente (${brl2(retro(comp) / 100)}) sem detalhamento por compet\xEAncia; n\xE3o \xE9 poss\xEDvel comprovar se \xE9 o mesmo lan\xE7amento ou outra cobran\xE7a.`);
      const meses = [...arq.keys()];
      if (meses.every((m) => base.get(m) === arq.get(m))) {
        u.a.papel = "retroativo_incluido";
        u.a.observacao = `Retroativo de ${meses.join(", ")} com mesma quantidade e valor j\xE1 contido nas inclus\xF5es da planilha principal; n\xE3o somado.`;
        continue;
      }
      if (meses.every((m) => !base.has(m))) {
        comp.inclusoes = { ...comp.inclusoes, quantidade: (comp.inclusoes?.quantidade ?? 0) + (u.b.inclusoes?.quantidade ?? 0), total: (c(comp.inclusoes?.total) + c(u.b.inclusoes.total)) / 100 };
        comp.retroativas = {
          ...comp.retroativas,
          quantidade: (comp.retroativas.quantidade ?? 0) + (u.b.retroativas.quantidade ?? 0),
          total: (retro(comp) + retro(u.b)) / 100,
          mesesDetalhe: [...comp.retroativas.mesesDetalhe ?? [], ...u.b.retroativas.mesesDetalhe ?? []]
        };
        u.a.observacao = `Retroativo de outra compet\xEAncia (${meses.join(", ")}); cobran\xE7a distinta, somada.`;
        continue;
      }
      return falha(`Retroativo de \u201C${u.a.nome}\u201D coincide parcialmente com o da planilha principal (${meses.join(", ")}); n\xE3o \xE9 poss\xEDvel separar o que j\xE1 est\xE1 inclu\xEDdo.`);
    }
    const cats = ["inclusoes", ...CATS_EXTRA].filter((k) => c(u.b[k]?.total) !== 0);
    const sobrepostas = cats.filter((k) => c(comp[k]?.total) !== 0);
    if (temMensalidade(u.b) || sobrepostas.length || !cats.length) return falha(sobrepostas.length || temMensalidade(u.b) ? `\u201C${u.a.nome}\u201D repete categorias j\xE1 presentes (${sobrepostas.join(", ") || "mensalidade"}); n\xE3o \xE9 poss\xEDvel saber se \xE9 complemento ou substitui\xE7\xE3o.` : `\u201C${u.a.nome}\u201D n\xE3o tem valores identific\xE1veis para o CNPJ.`);
    for (const k of cats) comp[k] = { ...u.b[k] };
    if (retro(u.b) !== 0) comp.retroativas = { ...u.b.retroativas };
  }
  delete comp.totalDeclaradoExcel;
  return { bloco: comp, arquivos, ambiguidade: null };
}
async function validarArquivosCentral(i) {
  let identidade = null;
  if (i.identidade) {
    let texto = "";
    try {
      texto = await extrairTextoPdf(i.pdf);
    } catch {
      texto = "";
    }
    identidade = conferirIdentidadeFiscal(texto, i.identidade);
  }
  const { bloco, arquivos, ambiguidade } = await comporFaturamento(i.planilhas, i.cnpjTomador);
  const vazio = (motivo) => ({ leituraOk: false, motivo, valorExcel: null, valorPdf: null, valorServico: null, comparacao: null, tomadorPdf: null, arquivos, identidade, contextoDocumento: null });
  if (!bloco) return vazio(ambiguidade ?? "Composi\xE7\xE3o indeterminada.");
  const naoLidas = Object.entries(SEM_LEITURA_FISCAL).filter(([k]) => c(bloco[k]?.total) !== 0).map(([k, r]) => `${r} ${brl2(bloco[k].total)}`);
  if (naoLidas.length)
    return vazio(`Faturamento com ${naoLidas.join(", ")}: o SIGA n\xE3o l\xEA esse valor na NFS-e, ent\xE3o o total fiscal seria parcial; n\xE3o comparado (nem com o valor l\xEDquido).`);
  const pdf = await analisarPdfFinanceiro(i.pdf);
  if (pdf.avisos.some((a) => /falha ao abrir/i.test(a))) return vazio("PDF ileg\xEDvel.");
  const cmp = compararExcelComPdf(bloco, { ...pdf, arquivo: "central.pdf" }, i.tipoAnalise);
  cmp.tomadorCnpj = pdf.tomadorCnpj ?? null;
  const valorPdf = sumPdfTotal(cmp);
  const valorExcel = somarTotalFaturamento(bloco);
  const valorServico = pdf.tributos?.valorServico ?? null;
  const leituraOk = valorPdf != null && valorServico != null && !!pdf.tomadorCnpj;
  const competenciaDescricao = pdf.competenciaDescricao ?? null;
  const competenciaMovimentacao = i.contexto?.competencia ?? null;
  const impedimento = null;
  return {
    contextoDocumento: { competenciaDescricao, competenciaMovimentacao, impedimento },
    leituraOk,
    motivo: leituraOk ? null : valorServico == null && valorPdf != null && pdf.tomadorCnpj ? "Valor do servi\xE7o (bruto) n\xE3o encontrado na NFS-e; o descritivo sozinho n\xE3o \xE9 aceito." : "PDF incompleto: tomador ou valores n\xE3o encontrados.",
    valorExcel,
    valorPdf,
    valorServico,
    comparacao: cmp,
    tomadorPdf: pdf.tomadorCnpj ?? null,
    arquivos,
    identidade
  };
}
export {
  comporFaturamento,
  conferirIdentidadeFiscal,
  validarArquivosCentral
};
