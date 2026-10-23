// Testes do processamento no servidor, com documentos e movimentações FICTÍCIOS.
// Executa os parsers reais do SIGA (pacote gerado) sem navegador nem tela aberta.
import { assertEquals, assert } from "jsr:@std/assert@1";
import { z } from "npm:zod@3";
import { processarRecebimento, type Adaptador, type Recebimento } from "./nfse-central-processador.ts";
import { CNPJ_FICTICIO, pdfFicticio, pdfIlegivel, pdfSoInclusaoFicticio, planilhaFicticia } from "./nfse-central-fixtures.ts";

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
    baixar: async (bucket, path) => { baixados.push(`${bucket}/${path}`); if (bucket === "nfse-entrada") return opts.pdf; const i = Number(path.match(/fat(\d+)/)![1]) - 1; return xlss[i].slice(0); },
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
const RETRO_JUN: [string, number | null, number][] = [["Retroação à Junho/26", null, 0], ["M.Empresarial", 2, 200]];
const RETRO_JUL: [string, number | null, number][] = [["Retroação à Julho/26", null, 0], ["M.Empresarial", 2, 200]];
const pdfCom = (inc: string) => pdfFicticio("1.000,00", "100.00", undefined, inc);

Deno.test("duas planilhas pertinentes (mensalidade + inclusões) somam uma vez cada", async () => {
  const f = fake({ pdf: pdfCom("200,00"), xls: [await planilhaFicticia(), await planilhaFicticia(0, [["Inclusão", 2, 200]], false)] });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "aprovado_aguardando_liberacao");
  const s = f.salvos.at(-1)!;
  assertEquals(valores(s), [120000, 120000, 0]);
  assertEquals(papeis(s), ["principal", "complementar"]);
  assertEquals(f.vinculos.length, 0);
});

Deno.test("cópia idêntica (mesmo hash) é reconhecida e contada uma vez", async () => {
  const x = await planilhaFicticia();
  const f = fake({ pdf: pdfFicticio(), xls: [x, x.slice(0)] });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "aprovado_aguardando_liberacao");
  const s = f.salvos.at(-1)!;
  assertEquals(valores(s), [100000, 100000, 0]);
  assertEquals(papeis(s), ["principal", "duplicado"]);
});

Deno.test("documentos distintos com o mesmo valor não são tratados como duplicados", async () => {
  const f = fake({ pdf: pdfFicticio(), xls: [await planilhaFicticia(), await planilhaFicticia(1000, [], true, true)] });
  const r = await processarRecebimento(rec(), f.ad);
  assertEquals(r.estado, "validacao_inconclusiva");
  assert(/mesmos valores/.test(r.motivo ?? ""));
  assertEquals(f.salvos.at(-1)!.valor_excel_centavos ?? null, null);
});

Deno.test("retroativo da mesma competência, quantidade e valor já incluído não é somado", async () => {
  const f = fake({ pdf: pdfCom("200,00"), xls: [await planilhaFicticia(1000, RETRO_JUN), await planilhaFicticia(0, RETRO_JUN, false)] });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "aprovado_aguardando_liberacao");
  const s = f.salvos.at(-1)!;
  assertEquals(valores(s), [120000, 120000, 0]); // 140000 se contasse duas vezes
  assertEquals(papeis(s), ["principal", "retroativo_incluido"]);
});

Deno.test("retroativo de mesmo valor referente a outra competência é cobrança distinta e soma", async () => {
  const f = fake({ pdf: pdfCom("400,00"), xls: [await planilhaFicticia(1000, RETRO_JUN), await planilhaFicticia(0, RETRO_JUL, false)] });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "aprovado_aguardando_liberacao");
  const s = f.salvos.at(-1)!;
  assertEquals(valores(s), [140000, 140000, 0]);
  assertEquals(papeis(s), ["principal", "complementar"]);
});

Deno.test("retroativo de mesmo total sem detalhamento por competência fica inconclusivo", async () => {
  const f = fake({ pdf: pdfCom("200,00"),
    xls: [await planilhaFicticia(1000, [["Cobrança Retroativa", 2, 200]]), await planilhaFicticia(0, [["Cobrança Retroativa", 2, 200]], false)] });
  const r = await processarRecebimento(rec(), f.ad);
  assertEquals(r.estado, "validacao_inconclusiva");
  assert(/detalhamento por competência/.test(r.motivo ?? ""));
});

Deno.test("coparticipação não é comparada com total parcial da nota", async () => {
  const f = fake({ pdf: pdfFicticio(), xls: [await planilhaFicticia(), await planilhaFicticia(0, [["Coparticipação", 2, 200]], false)] });
  const r = await processarRecebimento(rec(), f.ad);
  assertEquals(r.estado, "validacao_inconclusiva");
  assert(/Coparticipação/.test(r.motivo ?? ""));
  assertEquals(f.salvos.at(-1)!.diferenca_centavos ?? null, null);
});

Deno.test("faturamento válido sem mensalidade (só inclusões) é aprovado sem anexar", async () => {
  const f = fake({ pdf: pdfSoInclusaoFicticio("200,00"), xls: await planilhaFicticia(0, [["Inclusão", 2, 200]], false) });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "aprovado_aguardando_liberacao");
  const s = f.salvos.at(-1)!;
  assertEquals(valores(s), [20000, 20000, 0]);
  assertEquals((s.validacao as any).conferido.competencia, false);
  assertEquals(f.vinculos.length, 0);
});

Deno.test("duas planilhas com mensalidade distintas: inconclusivo", async () => {
  const f = fake({ pdf: pdfFicticio(), xls: [await planilhaFicticia(1000), await planilhaFicticia(900)] });
  const r = await processarRecebimento(rec(), f.ad);
  assertEquals(r.estado, "validacao_inconclusiva");
  assert(/mensalidade para o mesmo CNPJ/.test(r.motivo ?? ""));
});
