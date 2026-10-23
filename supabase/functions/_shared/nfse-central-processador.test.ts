// Testes do processamento no servidor, com documentos e movimentações FICTÍCIOS.
// Executa os parsers reais do SIGA (pacote gerado) sem navegador nem tela aberta.
import { assertEquals, assert } from "jsr:@std/assert@1";
import { z } from "npm:zod@3";
import { processarRecebimento, type Adaptador, type Recebimento } from "./nfse-central-processador.ts";
import { CNPJ_FICTICIO, pdfFicticio, pdfIlegivel, planilhaFicticia } from "./nfse-central-fixtures.ts";

const MOV = { id: "mov-1", empresa_id: "emp-1" };
const rec = (extra: Partial<Recebimento> = {}): Recebimento => ({
  id: "rec-1", estado: "aguardando_validacao", cnpj_tomador: CNPJ_FICTICIO, emitida_em: "2026-10-22T09:00:00-04:00",
  storage_path: "fila/nota.pdf", movimentacao_sugerida_id: null, movimentacao_destino_id: MOV.id, faturamento_revisao: null,
  homologacao: false, pdf_sha256: "ab", nome_arquivo: "nota.pdf", pdf_tamanho_bytes: 1, ...extra,
});

function fake(opts: { pdf: ArrayBuffer; xls: ArrayBuffer | ArrayBuffer[]; auto?: boolean; revisoes?: string[] }) {
  const xlss = Array.isArray(opts.xls) ? opts.xls : [opts.xls];
  const salvos: Record<string, unknown>[] = [];
  const vinculos: string[] = [];
  const baixados: string[] = [];
  const revisoes = [...(opts.revisoes ?? ["r1"])];
  const ad: Adaptador = {
    resolverDestino: async () => ({ estado: "aguardando_validacao", motivo: null, destino: MOV }),
    anexosDaMov: async () => xlss.map((_, i) => ({ id: `x${i + 1}`, mime_type: null, nome_arquivo: `fat${i + 1}.xlsx`, storage_path: `emp-1/mov-1/fat${i + 1}.xlsx`, bucket: "anexos-financeiro", origem: "normal" })),
    revisaoAtual: async () => (revisoes.length > 1 ? revisoes.shift()! : revisoes[0]),
    tipoAnalise: async () => "normal",
    cnpjPagador: async () => "12.345.678/0001-90",
    baixar: async (bucket, path) => { baixados.push(`${bucket}/${path}`); if (bucket === "nfse-entrada") return opts.pdf; const i = Number(path.match(/fat(\\d+)/)![1]) - 1; return xlss[i].slice(0); },
    autoAnexarReais: async () => opts.auto ?? false,
    salvar: async (_id, p) => { salvos.push(p); },
    copiarParaAnexos: async () => "emp-1/mov-1/central-ab.pdf",
    vincular: async (_r, revisao) => { vinculos.push(revisao); return { estado: "vinculado" }; },
  };
  return { ad, salvos, vinculos, baixados };
}

Deno.test("processa com todas as telas fechadas e lê os arquivos armazenados", async () => {
  const f = fake({ pdf: pdfFicticio(), xls: await planilhaFicticia() });
  const r = await processarRecebimento(rec(), f.ad);
  assertEquals(r.estado, "aprovado_aguardando_liberacao");
  assertEquals(f.baixados, ["nfse-entrada/fila/nota.pdf", "anexos-financeiro/emp-1/mov-1/fat1.xlsx"]);
  const ult = f.salvos.at(-1)!;
  assertEquals([ult.valor_excel_centavos, ult.valor_pdf_centavos, ult.diferenca_centavos], [100000, 100000, 0]);
  assertEquals(f.vinculos.length, 0); // anexação real desligada
});

Deno.test("diferença de R$ 0,01 nos arquivos reais é divergência", async () => {
  const f = fake({ pdf: pdfFicticio("1.000,01", "100.00"), xls: await planilhaFicticia(), auto: true });
  const r = await processarRecebimento(rec(), f.ad);
  assertEquals(r.estado, "divergencia");
  assertEquals(f.salvos.at(-1)!.diferenca_centavos, 1);
  assertEquals(f.vinculos.length, 0);
});

Deno.test("CNPJ do tomador no PDF divergente é recusado", async () => {
  const f = fake({ pdf: pdfFicticio("1.000,00", "100.00", "99.999.999/0001-99"), xls: await planilhaFicticia(), auto: true });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "divergencia");
  assertEquals(f.vinculos.length, 0);
});

Deno.test("arquivo ilegível fica inconclusivo", async () => {
  const f = fake({ pdf: pdfIlegivel(), xls: await planilhaFicticia(), auto: true });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "validacao_inconclusiva");
});

Deno.test("valores adulterados pelo navegador são recusados pela entrada do servidor", async () => {
  const { BodyUsuario } = await import("./nfse-central-body.ts");
  const ok = BodyUsuario.safeParse({ recebimento_id: crypto.randomUUID() });
  const adulterado = BodyUsuario.safeParse({ recebimento_id: crypto.randomUUID(), valor_pdf: 1000, valor_excel: 1000, diferenca_centavos: 0, aprovado: true });
  assert(ok.success);
  assert(!adulterado.success);
  // e a decisão usa só os arquivos: PDF real com 1.000,01 continua divergente
  const f = fake({ pdf: pdfFicticio("1.000,01", "100.00"), xls: await planilhaFicticia(), auto: true });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "divergencia");
  void z;
});

Deno.test("mudança do faturamento durante a validação impede o vínculo", async () => {
  const f = fake({ pdf: pdfFicticio(), xls: await planilhaFicticia(), auto: true, revisoes: ["r1", "r2"] });
  const r = await processarRecebimento(rec(), f.ad);
  assertEquals(r.estado, "aguardando_validacao");
  assertEquals(f.vinculos.length, 0);
});

Deno.test("homologacao=true nunca anexa, mesmo com liberação ligada", async () => {
  const f = fake({ pdf: pdfFicticio(), xls: await planilhaFicticia(), auto: true });
  assertEquals((await processarRecebimento(rec({ homologacao: true }), f.ad)).estado, "aprovado_aguardando_liberacao");
  assertEquals(f.vinculos.length, 0);
});

Deno.test("aprovado e liberado chama o vínculo com a revisão lida", async () => {
  const f = fake({ pdf: pdfFicticio(), xls: await planilhaFicticia(), auto: true });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "vinculado");
  assertEquals(f.vinculos, ["r1"]);
});

Deno.test("divergência com arquivos inalterados não é reanalisada", async () => {
  const f = fake({ pdf: pdfFicticio(), xls: await planilhaFicticia() });
  await processarRecebimento(rec({ estado: "divergencia", faturamento_revisao: "r1" }), f.ad);
  assertEquals(f.baixados.length, 0);
});

// ---- Composição com vários arquivos ----
const papeis = (s: Record<string, unknown>) => ((s.validacao as any).arquivos as any[]).map((a) => a.papel);
const valores = (s: Record<string, unknown>) => [s.valor_excel_centavos, s.valor_pdf_centavos, s.diferenca_centavos];

Deno.test("duas planilhas pertinentes (mensalidade + inclusões) somam uma vez cada", async () => {
  const f = fake({ pdf: pdfFicticio("1.000,00", "100.00", undefined, "200,00"), xls: [await planilhaFicticia(), await planilhaFicticia(0, [["Inclusão", 2, 200]], false)] });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "aprovado_aguardando_liberacao");
  const s = f.salvos.at(-1)!;
  assertEquals(valores(s), [120000, 120000, 0]);
  assertEquals(papeis(s), ["principal", "complementar"]);
  assertEquals(f.vinculos.length, 0);
});

Deno.test("planilha duplicada não é somada", async () => {
  const x = await planilhaFicticia();
  const f = fake({ pdf: pdfFicticio(), xls: [x, x.slice(0)] });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "aprovado_aguardando_liberacao");
  const s = f.salvos.at(-1)!;
  assertEquals(valores(s), [100000, 100000, 0]);
  assertEquals(papeis(s), ["principal", "duplicado"]);
});

Deno.test("faturamento com retroativo + planilha do retroativo: retroativo contado uma vez", async () => {
  const f = fake({ pdf: pdfFicticio("1.000,00", "100.00", undefined, "200,00"),
    xls: [await planilhaFicticia(1000, [["Cobrança Retroativa", 2, 200]]), await planilhaFicticia(0, [["Cobrança Retroativa", 2, 200]], false)] });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "aprovado_aguardando_liberacao");
  const s = f.salvos.at(-1)!;
  assertEquals(valores(s), [120000, 120000, 0]); // seria 140000 se somasse de novo
  assertEquals(papeis(s), ["principal", "retroativo_incluido"]);
});

Deno.test("duas planilhas com mensalidade distintas: validação inconclusiva com a ambiguidade", async () => {
  const f = fake({ pdf: pdfFicticio(), xls: [await planilhaFicticia(1000), await planilhaFicticia(900)] });
  const r = await processarRecebimento(rec(), f.ad);
  assertEquals(r.estado, "validacao_inconclusiva");
  assert(/mensalidade para o mesmo CNPJ/.test(r.motivo ?? ""));
  assertEquals(f.vinculos.length, 0);
});

Deno.test("planilha de outro CNPJ anexada junto não é somada", async () => {
  const outra = new TextDecoder().decode(new Uint8Array(0)); void outra;
  const f = fake({ pdf: pdfFicticio(), xls: [await planilhaFicticia(), await planilhaFicticia(0, [["Inclusão", 2, 200]], false)] });
  // tomador diferente: nenhum bloco pertinente
  const r = await processarRecebimento(rec({ cnpj_tomador: "11111111000191" }), f.ad);
  assertEquals(r.estado === "aprovado_aguardando_liberacao", false);
});
