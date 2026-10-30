import { describe, expect, it } from "vitest";
import {
  agruparEnvios,
  agruparHistoricoEnvios,
  apenasAtuais,
  chaveDocumento,
  extensaoDe,
  FILTROS_VAZIOS,
  filtrarArquivos,
  formatarDataHoraEnvio,
  resumoEnviosEmpresa,
  tipoArquivoEnvio,
  versoesDoDocumento,
  type ArquivoEnvio,
} from "@/lib/repositorio-envios";
import {
  BUCKET_ENVIOS,
  bytesPorCaminho,
  montarItensEnvio,
  nomeSeguro,
  type AnexoEnviado,
  type DestinoEnvio,
} from "../../supabase/functions/_shared/envios-empresa";

function arquivo(parte: Partial<ArquivoEnvio>): ArquivoEnvio {
  return {
    id: parte.id ?? "a1",
    envio_id: parte.envio_id ?? "e1",
    movimentacao_id: parte.movimentacao_id ?? "m1",
    empresa_id: parte.empresa_id ?? "emp1",
    contrato: parte.contrato ?? "2171",
    competencia: parte.competencia ?? "2026-10",
    periodo: parte.periodo ?? "05-10",
    nome_arquivo: parte.nome_arquivo ?? "Relatorio_Vidas_Contrato_2171.pdf",
    bucket: parte.bucket ?? BUCKET_ENVIOS,
    storage_path: parte.storage_path ?? "envios/m1/e1/2171-pdf-relatorio.pdf",
    mime_type: parte.mime_type ?? "application/pdf",
    tamanho_bytes: parte.tamanho_bytes ?? 120000,
    tipo_relatorio: parte.tipo_relatorio ?? "Relatório de Vidas",
    enviado_por: parte.enviado_por ?? "u1",
    enviado_nome: parte.enviado_nome ?? "Junior Vieira",
    enviado_em: parte.enviado_em ?? "2026-10-27T18:30:00Z",
    origem: parte.origem ?? "Envio automático por e-mail",
    versao: parte.versao ?? 1,
    status: parte.status ?? "Enviado",
  };
}

describe("Repositório de Envios — apresentação", () => {
  it("agrupa por competência e, dentro dela, pelo período da movimentação", () => {
    const grupos = agruparEnvios([
      arquivo({ id: "a", competencia: "2026-10", periodo: "05-10", enviado_em: "2026-10-27T18:30:00Z" }),
      arquivo({ id: "b", competencia: "2026-10", periodo: "05-10", enviado_em: "2026-10-28T09:00:00Z" }),
      arquivo({ id: "c", competencia: "2026-10", periodo: "10-15" }),
      arquivo({ id: "d", competencia: "2026-09", periodo: "05-10" }),
    ]);
    expect(grupos.map((g) => g.competencia)).toEqual(["2026-10", "2026-09"]);
    expect(grupos[0].periodos.map((p) => p.periodo)).toEqual(["05-10", "10-15"]);
    expect(grupos[0].periodos[0].arquivos.map((a) => a.id)).toEqual(["b", "a"]);
    expect(grupos[1].periodos[0].arquivos.map((a) => a.id)).toEqual(["d"]);
  });

  it("não inventa período quando o arquivo não tem um", () => {
    const grupos = agruparEnvios([
      arquivo({ id: "sem", periodo: "" }),
      arquivo({ id: "com", periodo: "05-10" }),
    ]);
    expect(grupos[0].periodos.map((p) => p.periodo)).toEqual(["05-10", null]);
    expect(grupos[0].periodos[1].arquivos.map((a) => a.id)).toEqual(["sem"]);
  });

  it("lê a extensão do nome do arquivo", () => {
    expect(extensaoDe("Relatorio_Vidas_Contrato_2171.pdf")).toBe("pdf");
    expect(extensaoDe("OPS_Mensalidades_Contrato_2171.xlsx")).toBe("xlsx");
    expect(extensaoDe("sem-extensao")).toBeNull();
  });

  it("mostra data e hora do envio no formato brasileiro, no fuso de Manaus", () => {
    expect(formatarDataHoraEnvio("2026-10-27T18:30:00Z")).toBe("27/10/2026 14:30");
    expect(formatarDataHoraEnvio(null)).toBe("—");
  });

  it("resume quantos arquivos e envios a empresa tem", () => {
    expect(resumoEnviosEmpresa(1, 1)).toBe("1 arquivo");
    expect(resumoEnviosEmpresa(3, 2)).toBe("3 arquivos · 2 envios");
  });
});

describe("Repositório de Envios — registro automático dos arquivos enviados", () => {
  const principal: DestinoEnvio = {
    movimentacaoId: "mov-2171",
    empresaId: "emp-2171",
    contrato: "2171",
    competencia: "2026-10",
    periodo: "05-10",
  };
  const membro: DestinoEnvio = {
    movimentacaoId: "mov-2192",
    empresaId: "emp-2192",
    contrato: "2192",
    competencia: "2026-10",
    periodo: "10-15",
  };
  const destinoPorContrato = new Map<string, DestinoEnvio>([
    ["2171", principal],
    ["2192", membro],
  ]);

  const anexos: AnexoEnviado[] = [
    {
      nome: "Relatorio_Vidas_Contrato_2171.pdf",
      mime: "application/pdf",
      conteudo: new Uint8Array(120),
      contrato: "2171",
      tipo: "pdf",
    },
    {
      nome: "OPS_Mensalidades_Contrato_2171.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      conteudo: new Uint8Array(340),
      contrato: "2171",
      tipo: "xlsx",
    },
    {
      nome: "Relatorio_Vidas_Contrato_2192.pdf",
      mime: "application/pdf",
      conteudo: new Uint8Array(80),
      contrato: "2192",
      tipo: "pdf",
    },
  ];

  it("registra um item por arquivo enviado, com a categoria de cada relatório", () => {
    const itens = montarItensEnvio(anexos, destinoPorContrato, "envio-1");
    expect(itens).toHaveLength(3);
    expect(itens.map((i) => i.tipo_relatorio)).toEqual([
      "Relatório de Vidas",
      "OPS Mensalidades",
      "Relatório de Vidas",
    ]);
    expect(itens[0]).toMatchObject({
      movimentacao_id: "mov-2171",
      empresa_id: "emp-2171",
      contrato: "2171",
      competencia: "2026-10",
      periodo: "05-10",
      bucket: "arquivos-envios",
      tamanho_bytes: 120,
    });
    // Cada contrato do grupo responde pela própria empresa e pelo próprio período.
    expect(itens[2]).toMatchObject({
      movimentacao_id: "mov-2192",
      empresa_id: "emp-2192",
      periodo: "10-15",
    });
  });

  it("ignora arquivo de contrato desconhecido em vez de inventar empresa ou mês", () => {
    const comEstranho: AnexoEnviado[] = [
      ...anexos,
      { nome: "Relatorio_Vidas_Contrato_9999.pdf", mime: "application/pdf", conteudo: new Uint8Array(5), contrato: "9999", tipo: "pdf" },
    ];
    const itens = montarItensEnvio(comEstranho, destinoPorContrato, "envio-1");
    expect(itens).toHaveLength(3);
    expect(itens.some((i) => i.contrato === "9999")).toBe(false);
  });

  it("grava o caminho dentro da movimentação, para herdar a mesma permissão de leitura", () => {
    const itens = montarItensEnvio(anexos, destinoPorContrato, "envio-1");
    expect(itens[0].storage_path).toBe("envios/mov-2171/envio-1/2171-pdf-Relatorio_Vidas_Contrato_2171.pdf");
    const bytes = bytesPorCaminho(anexos, destinoPorContrato, "envio-1");
    expect(bytes.size).toBe(3);
    expect(bytes.get(itens[0].storage_path)?.byteLength).toBe(120);
  });

  it("bloqueia nomes com caminho ou pontos iniciais", () => {
    const sujo = nomeSeguro("../../segredo.pdf");
    expect(sujo).not.toContain("/");
    expect(sujo).not.toContain("\\");
    expect(sujo.startsWith(".")).toBe(false);
    expect(sujo.endsWith(".pdf")).toBe(true);
    expect(nomeSeguro("a/b\\c.pdf")).toBe("a_b_c.pdf");
    expect(nomeSeguro("   ")).toBe("arquivo");
  });
});

describe("Repositório de Envios — controle de versão", () => {
  it("a listagem principal mostra somente a versão atual de cada documento", () => {
    const lista = [
      arquivo({ id: "v1", versao: 1, status: "Substituído", enviado_em: "2026-10-27T12:20:00Z" }),
      arquivo({ id: "v2", versao: 2, status: "Atual", enviado_em: "2026-10-29T14:35:00Z" }),
      arquivo({ id: "outro", tipo_relatorio: "OPS Mensalidades", status: "Atual" }),
    ];
    expect(apenasAtuais(lista).map((a) => a.id)).toEqual(["v2", "outro"]);
  });

  it("reconhece o mesmo documento mesmo com nomes de arquivo diferentes", () => {
    const v1 = arquivo({
      id: "v1",
      versao: 1,
      status: "Substituído",
      nome_arquivo: "Relatorio_Vidas_2487.pdf",
      enviado_em: "2026-10-27T12:20:00Z",
    });
    const v2 = arquivo({
      id: "v2",
      versao: 2,
      status: "Atual",
      nome_arquivo: "Vidas_Ativas_Contrato_2487_20261029.pdf",
      enviado_em: "2026-10-29T14:35:00Z",
    });
    expect(chaveDocumento(v1)).toBe(chaveDocumento(v2));
  });

  it("documento de outra competência, período ou categoria não é a mesma versão", () => {
    const base = arquivo({ id: "base" });
    expect(chaveDocumento(arquivo({ competencia: "2026-11" }))).not.toBe(chaveDocumento(base));
    expect(chaveDocumento(arquivo({ periodo: "10-15" }))).not.toBe(chaveDocumento(base));
    expect(chaveDocumento(arquivo({ tipo_relatorio: "OPS Mensalidades" }))).not.toBe(chaveDocumento(base));
    expect(chaveDocumento(arquivo({ contrato: "9999" }))).not.toBe(chaveDocumento(base));
  });

  it("o histórico reúne todas as versões do documento, da mais nova para a mais antiga", () => {
    const v1 = arquivo({ id: "v1", versao: 1, status: "Substituído", enviado_em: "2026-10-27T12:20:00Z" });
    const v2 = arquivo({ id: "v2", versao: 2, status: "Atual", enviado_em: "2026-10-29T14:35:00Z" });
    const outro = arquivo({ id: "outro", tipo_relatorio: "OPS Mensalidades", status: "Atual" });
    const historico = versoesDoDocumento([v1, v2, outro], v2);
    expect(historico.map((a) => a.id)).toEqual(["v2", "v1"]);
    expect(historico[0].status).toBe("Atual");
    expect(historico[1].status).toBe("Substituído");
  });
});

describe("Repositório de Envios — filtros e histórico de envios", () => {
  it("importação para fechamento não inventa um envio de e-mail", () => {
    const historico = agruparHistoricoEnvios([arquivo({ id: "importado", envio_id: "importacao", origem: "Importação para fechamento" }), arquivo({ id: "enviado", envio_id: "email" })]);
    expect(historico.map(h => h.envio_id)).toEqual(["email"]);
  });
  it("filtra por competência, período, categoria, responsável e tipo de arquivo", () => {
    const lista = [
      arquivo({ id: "a", competencia: "2026-10", periodo: "05-10", tipo_relatorio: "Relatório de Vidas", enviado_nome: "Antonio", nome_arquivo: "vidas.pdf" }),
      arquivo({ id: "b", competencia: "2026-10", periodo: "05-10", tipo_relatorio: "OPS Mensalidades", enviado_nome: "Antonio", nome_arquivo: "ops.xlsx" }),
      arquivo({ id: "c", competencia: "2026-09", periodo: "10-15", tipo_relatorio: "Relatório de Vidas", enviado_nome: "Junior", nome_arquivo: "vidas9.pdf" }),
    ];
    expect(filtrarArquivos(lista, FILTROS_VAZIOS)).toHaveLength(3);
    expect(filtrarArquivos(lista, { ...FILTROS_VAZIOS, competencia: "2026-09" }).map((a) => a.id)).toEqual(["c"]);
    expect(filtrarArquivos(lista, { ...FILTROS_VAZIOS, periodo: "10-15" }).map((a) => a.id)).toEqual(["c"]);
    expect(filtrarArquivos(lista, { ...FILTROS_VAZIOS, categoria: "OPS Mensalidades" }).map((a) => a.id)).toEqual(["b"]);
    expect(filtrarArquivos(lista, { ...FILTROS_VAZIOS, responsavel: "Junior" }).map((a) => a.id)).toEqual(["c"]);
    expect(filtrarArquivos(lista, { ...FILTROS_VAZIOS, tipoArquivo: "Excel" }).map((a) => a.id)).toEqual(["b"]);
    expect(filtrarArquivos(lista, { ...FILTROS_VAZIOS, tipoArquivo: "PDF" }).map((a) => a.id)).toEqual(["a", "c"]);
  });

  it("reconhece o tipo de arquivo pela extensão", () => {
    expect(tipoArquivoEnvio(arquivo({ nome_arquivo: "a.pdf" }))).toBe("PDF");
    expect(tipoArquivoEnvio(arquivo({ nome_arquivo: "a.xlsx" }))).toBe("Excel");
    expect(tipoArquivoEnvio(arquivo({ nome_arquivo: "a.csv" }))).toBe("Excel");
    expect(tipoArquivoEnvio(arquivo({ nome_arquivo: "a.png" }))).toBe("Imagem");
    expect(tipoArquivoEnvio(arquivo({ nome_arquivo: "sem-extensao" }))).toBe("Outros");
  });

  it("agrupa o histórico por envio, do mais recente ao mais antigo, com os arquivos de cada um", () => {
    const lista = [
      arquivo({ id: "a", envio_id: "e1", enviado_em: "2026-10-27T12:20:00Z", tipo_relatorio: "Relatório de Vidas", enviado_nome: "Antonio" }),
      arquivo({ id: "b", envio_id: "e2", enviado_em: "2026-10-29T14:35:00Z", tipo_relatorio: "Relatório de Vidas", versao: 2, enviado_nome: "Antonio" }),
      arquivo({ id: "c", envio_id: "e2", enviado_em: "2026-10-29T14:35:00Z", tipo_relatorio: "OPS Mensalidades", enviado_nome: "Antonio" }),
    ];
    const historico = agruparHistoricoEnvios(lista);
    expect(historico.map((h) => h.envio_id)).toEqual(["e2", "e1"]);
    expect(historico[0].total).toBe(2);
    expect(historico[0].tipos).toEqual(["Relatório de Vidas", "OPS Mensalidades"]);
    expect(historico[0].competencia).toBe("2026-10");
    expect(historico[0].periodo).toBe("05-10");
    expect(historico[0].enviado_nome).toBe("Antonio");
    expect(historico[1].total).toBe(1);
  });
});
