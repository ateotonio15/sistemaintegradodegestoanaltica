// Testes do processamento no servidor, com documentos e movimentações FICTÍCIOS.
// Executa os parsers reais do SIGA (pacote gerado) sem navegador nem tela aberta.
import { assertEquals, assert } from "jsr:@std/assert@1";
import { z } from "npm:zod@3";
import { processarRecebimento, chaveEntrada, type Adaptador, type Recebimento } from "./nfse-central-processador.ts";
import { resolverDestino } from "./nfse-central-regras.ts";
import { CHAVE_FICTICIA, PRESTADOR_FICTICIO, CNPJ_FICTICIO, pdfFicticio, pdfIlegivel, pdfSoInclusaoFicticio, planilhaFicticia, pdfAdesaoFicticio, planilhaAdesaoFicticia } from "./nfse-central-fixtures.ts";

const MOV = { id: "mov-1", empresa_id: "emp-1" };

Deno.test("adesão explícita compara total sem recalcular 7 x preço arredondado", async () => {
  const f = fake({ pdf: pdfAdesaoFicticio(), xls: await planilhaAdesaoFicticia() });
  assertEquals((await processarRecebimento(rec({ homologacao: true }), f.ad)).estado, "aprovado_aguardando_liberacao");
  const s = f.salvos.at(-1);
  assert(s);
  assertEquals(valores(s), [3120494, 3120494, 0]);
  const cmp = (s.validacao as any).comparacao;
  assertEquals(cmp.taxaAdesao.total, { excel: 1024.39, pdf: 1024.39, ok: true });
  assertEquals(cmp.taxaAdesao.quantidade, { excel: 7, pdf: null, conferida: false });
  assertEquals(cmp.enfermaria.beneficiarios.pdf, 55);
  assertEquals(cmp.apartamento.beneficiarios.pdf, 30);
  assertEquals(cmp.inclusoes, null);
  assertEquals(f.vinculos.length, 0);
});

Deno.test("adesão aceita espaços, acentos e R$", async () => {
  for (const linha of ["Taxa de Adesao = R$ 1.024,39 /", "TAXA  DE  ADESÃO : 1.024,39 /", "Taxa de Adesão= 1.024,39 /"]) {
    const f = fake({ pdf: pdfAdesaoFicticio(linha), xls: await planilhaAdesaoFicticia() });
    assertEquals((await processarRecebimento(rec({ homologacao: true }), f.ad)).estado, "aprovado_aguardando_liberacao");
  }
});

Deno.test("adesão ausente não é deduzida do bruto", async () => {
  const f = fake({ pdf: pdfAdesaoFicticio(""), xls: await planilhaAdesaoFicticia() });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "validacao_inconclusiva");
  assertEquals(f.vinculos.length, 0);
});

Deno.test("adesão divergente em um centavo bloqueia mesmo com bruto correto", async () => {
  const f = fake({ pdf: pdfAdesaoFicticio("Taxa de Adesão= 1.024,40 /"), xls: await planilhaAdesaoFicticia() });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "divergencia");
  assertEquals(f.vinculos.length, 0);
});

Deno.test("adesão não é contada novamente em inclusões", async () => {
  const f = fake({ pdf: pdfAdesaoFicticio(), xls: await planilhaAdesaoFicticia(true) });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "validacao_inconclusiva");
  assertEquals(f.vinculos.length, 0);
});

Deno.test("destino único: novembro no documento e outubro 15-20 na movimentação é aprovado sem deslocar competência", async () => {
  const f = fake({ pdf: pdfAdesaoFicticio(undefined, "Novembro/2026"), xls: await planilhaAdesaoFicticia(), auto: true });
  f.ad.resolverDestino = async () => ({ estado: "aguardando_validacao", motivo: null, destino: { ...MOV, mes_referencia: "2026-10", periodo: "15-20" } });
  const r = await processarRecebimento(rec({ homologacao: true }), f.ad);
  assertEquals(r.estado, "aprovado_aguardando_liberacao");
  const s = f.salvos.at(-1);
  assert(s);
  assertEquals(valores(s), [3120494, 3120494, 0]);
  const ctx = (s.validacao as any).contexto;
  assertEquals(ctx.competencia, "2026-10");
  assertEquals(ctx.periodo, "15-20");
  assertEquals(ctx.referencia_servico, "2026-11");
  assertEquals((s.validacao as any).conferido.competencia, false);
  assertEquals(f.vinculos.length, 0);
});
Deno.test("meses diferentes não aprovam se o valor diverge em um centavo", async () => {
  const f = fake({ pdf: pdfAdesaoFicticio("Taxa de Adesão= 1.024,40 /", "Novembro/2026"), xls: await planilhaAdesaoFicticia(), auto: true });
  f.ad.resolverDestino = async () => ({ estado: "aguardando_validacao", motivo: null, destino: { ...MOV, mes_referencia: "2026-10", periodo: "15-20" } });
  assertEquals((await processarRecebimento(rec({ homologacao: true }), f.ad)).estado, "divergencia");
});
const rec = (extra: Partial<Recebimento> = {}): Recebimento => ({
  id: "rec-1", estado: "aguardando_validacao", cnpj_tomador: CNPJ_FICTICIO, emitida_em: "2026-10-22T09:00:00-04:00",
  storage_path: "fila/nota.pdf", movimentacao_sugerida_id: null, movimentacao_destino_id: MOV.id, faturamento_revisao: null,
  homologacao: false, pdf_sha256: "ab", nome_arquivo: "nota.pdf", pdf_tamanho_bytes: 1,
  chave_acesso: CHAVE_FICTICIA, numero_nfse: "123", cnpj_prestador: PRESTADOR_FICTICIO, ...extra,
});

function fake(opts: { pdf: ArrayBuffer; xls: ArrayBuffer | ArrayBuffer[]; auto?: boolean; revisoes?: string[]; origens?: string[]; tipo?: string; versoes?: number }) {
  const xlss = Array.isArray(opts.xls) ? opts.xls : [opts.xls];
  const salvos: Record<string, unknown>[] = [];
  const vinculos: string[] = [];
  const baixados: string[] = [];
  const revisoes = [...(opts.revisoes ?? ["r1"])];
  const ad: Adaptador = {
    resolverDestino: async () => ({ estado: "aguardando_validacao", motivo: null, destino: MOV }),
    anexosDaMov: async () => xlss.map((_, i) => ({ id: `x${i + 1}`, mime_type: null, nome_arquivo: `fat${i + 1}.xlsx`, storage_path: `emp-1/mov-1/fat${i + 1}.xlsx`, bucket: "anexos-financeiro", origem: opts.origens?.[i] ?? "normal" })),
    revisaoAtual: async () => (revisoes.length > 1 ? revisoes.shift()! : revisoes[0]),
    tipoAnalise: async () => opts.tipo ?? "normal",
    outrasVersoes: async () => opts.versoes ?? 0,
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
  const chave = await chaveEntrada("r1", "normal", "ab");
  await processarRecebimento(rec({ estado: "divergencia", faturamento_revisao: "r1", chave_validacao: chave }), f.ad);
  assertEquals(f.baixados.length, 0);
  assert(f.salvos.at(-1)!.proxima_tentativa_em, "sai da frente da fila");
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

// ---- Revisão 23/10: valor fiscal, seleção, cache, destino ----
Deno.test("valor do serviço R$ 2.000,00 com descritivo R$ 1.000,00 não é aprovado", async () => {
  const f = fake({ pdf: pdfFicticio("1.000,00", "100.00", undefined, null, "2.000,00"), xls: await planilhaFicticia(), auto: true });
  const r = await processarRecebimento(rec(), f.ad);
  assertEquals(r.estado, "divergencia");
  const s = f.salvos.at(-1)!;
  assertEquals([s.valor_excel_centavos, s.valor_pdf_centavos, s.diferenca_centavos], [100000, 200000, 100000]);
  assertEquals((s.validacao as any).valor_descritivo_centavos, 100000);
  assertEquals(f.vinculos.length, 0);
});

Deno.test("sem valor do serviço (bruto) na nota: inconclusivo, descritivo sozinho não basta", async () => {
  const f = fake({ pdf: pdfFicticio("1.000,00", "100.00", undefined, null, null), xls: await planilhaFicticia(), auto: true });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "validacao_inconclusiva");
  assertEquals(f.vinculos.length, 0);
});

Deno.test("planilha com origem=retroativo entra na validação e é classificada pelo conteúdo", async () => {
  const f = fake({ pdf: pdfCom("200,00"), xls: [await planilhaFicticia(), await planilhaFicticia(0, [["Inclusão", 2, 200]], false)], origens: ["normal", "retroativo"] });
  await processarRecebimento(rec(), f.ad);
  assert(f.baixados.includes("anexos-financeiro/emp-1/mov-1/fat2.xlsx"));
  assertEquals(valores(f.salvos.at(-1)!), [120000, 120000, 0]);
});

Deno.test("mudança do tipo de análise invalida o cache e reavalia", async () => {
  const chaveNormal = await chaveEntrada("r1", "normal", "ab");
  const f = fake({ pdf: pdfFicticio(), xls: await planilhaFicticia(), tipo: "moto_honda" });
  const r = await processarRecebimento(rec({ estado: "divergencia", faturamento_revisao: "r1", chave_validacao: chaveNormal }), f.ad);
  assertEquals(r.estado, "validacao_inconclusiva");
  assert(f.salvos.at(-1)!.chave_validacao !== chaveNormal);
});

Deno.test("sugestão da Central não resolve dois movimentos em Faturado", () => {
  const anexos = ["m1", "m2"].map((id) => ({ financeiro_movimentacao_id: id, nome_arquivo: "fat.xlsx", origem: "normal" }));
  const base = { cnpjTomador: CNPJ_FICTICIO, empresas: [{ id: "e1", cnpj: CNPJ_FICTICIO }], pagadores: [], anexos,
    movs: [{ id: "m1", empresa_id: "e1" }, { id: "m2", empresa_id: "e1" }] };
  assertEquals(resolverDestino(base).estado, "destino_ambiguo");
  assertEquals(resolverDestino({ ...base, sugerida: "m1" }).estado, "destino_ambiguo");
  const um = { ...base, movs: [{ id: "m1", empresa_id: "e1" }] };
  assertEquals(resolverDestino({ ...um, sugerida: "m2" }).estado, "destino_ambiguo");
  assertEquals(resolverDestino({ ...um, sugerida: "m1" }).destino?.id, "m1");
});

Deno.test("leitura paginada percorre todas as páginas e trata erro como falha", async () => {
  const { todas, PAGINA } = await import("./nfse-central-db.ts");
  const total = PAGINA * 2 + 5;
  const r = await todas(async (de, ate) => ({ data: Array.from({ length: Math.max(0, Math.min(ate, total - 1) - de + 1) }, (_, i) => de + i), error: null }));
  assertEquals(r.length, total);
  let falhou = false;
  try { await todas(async () => ({ data: null, error: { message: "x" } })); } catch { falhou = true; }
  assert(falhou);
});

// ---- Identidade fiscal do conteúdo do PDF ----
const idf = (s: Record<string, unknown>) => (s.validacao as any).identidade;
const casoIdent = async (ident: Parameters<typeof pdfFicticio>[5], extra: Partial<Recebimento> = {}) => {
  const f = fake({ pdf: pdfFicticio("1.000,00", "100.00", undefined, null, undefined, ident), xls: await planilhaFicticia(), auto: false });
  const r = await processarRecebimento(rec(extra), f.ad);
  assertEquals(f.vinculos.length, 0);
  return { r, s: f.salvos.at(-1)! };
};

Deno.test("identidade: nota integralmente correta é aprovada e registra os campos conferidos", async () => {
  const f = fake({ pdf: pdfFicticio(), xls: await planilhaFicticia() });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "aprovado_aguardando_liberacao");
  const i = idf(f.salvos.at(-1)!);
  assertEquals([i.campos.chave_acesso.situacao, i.campos.numero.situacao, i.campos.cnpj_prestador.situacao, i.campos.cnpj_tomador.situacao, i.campos.emissao.situacao],
    ["confere", "confere", "confere", "confere", "confere"]);
  assertEquals(i.competenciaNota, "01/10/2026"); // registrada à parte, não é a emissão
});
Deno.test("identidade: chave divergente", async () => {
  const { r } = await casoIdent({ chave: CHAVE_FICTICIA.replace(/1$/, "2") });
  assertEquals(r.estado, "divergencia");
});
Deno.test("identidade: número divergente", async () => {
  assertEquals((await casoIdent({ numero: "124" })).r.estado, "divergencia");
});
Deno.test("identidade: outro prestador", async () => {
  assertEquals((await casoIdent({ prestador: "99.888.777/0001-66" })).r.estado, "divergencia");
});
Deno.test("identidade: filial diferente do prestador (mesma raiz) não é aceita", async () => {
  assertEquals((await casoIdent({ prestador: "11.222.333/0002-62" })).r.estado, "divergencia");
});
Deno.test("identidade: tomador de filial diferente (mesma raiz) não é aceito", async () => {
  const f = fake({ pdf: pdfFicticio("1.000,00", "100.00", "12.345.678/0002-71"), xls: await planilhaFicticia(), auto: true });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "divergencia");
});
Deno.test("identidade: chave e número ausentes no PDF ficam inconclusivos", async () => {
  const { r, s } = await casoIdent({ chave: null, numero: null });
  assertEquals(r.estado, "validacao_inconclusiva");
  assertEquals(idf(s).campos.chave_acesso.situacao, "ausente");
});
Deno.test("identidade: metadados corretos sem número informado não comprovam a nota", async () => {
  assertEquals((await casoIdent({}, { numero_nfse: null })).r.estado, "validacao_inconclusiva");
});
Deno.test("identidade: emissão divergente bloqueia; ausente não bloqueia", async () => {
  assertEquals((await casoIdent({ emissao: "21/10/2026 09:00:00" })).r.estado, "divergencia");
  assertEquals((await casoIdent({ emissao: null })).r.estado, "aprovado_aguardando_liberacao");
});
Deno.test("identidade correta com valor bruto divergente continua divergência", async () => {
  const f = fake({ pdf: pdfFicticio("1.000,00", "100.00", undefined, null, "1.000,01"), xls: await planilhaFicticia(), auto: true });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "divergencia");
  assertEquals(f.vinculos.length, 0);
});
Deno.test("outra versão de PDF da mesma nota: aprovado não anexa e exige revisão", async () => {
  const f = fake({ pdf: pdfFicticio(), xls: await planilhaFicticia(), auto: true, versoes: 1 });
  assertEquals((await processarRecebimento(rec(), f.ad)).estado, "revisao_versao_pdf");
  assertEquals(f.vinculos.length, 0);
});
Deno.test("homologação com nota correta e liberação ligada nunca anexa", async () => {
  const f = fake({ pdf: pdfFicticio(), xls: await planilhaFicticia(), auto: true });
  assertEquals((await processarRecebimento(rec({ homologacao: true }), f.ad)).estado, "aprovado_aguardando_liberacao");
  assertEquals(f.vinculos.length, 0);
});
