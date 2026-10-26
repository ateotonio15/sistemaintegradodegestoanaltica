import { describe, expect, it } from "vitest";
import { RELATORIO_VAZIO, STATUS_RELATORIO, validarRegistroRelatorio, selecionarLoteRelatorios, resumoEnvioRelatorios, classificarPreparacao, resumoLoteEnvio } from "@/lib/movimentacao-relatorio";
import { PERIODOS } from "@/lib/movimentacao-utils";
describe("controle manual independente do relatório", () => {
  it("mantém exatamente os seis períodos existentes", () => {
    expect(PERIODOS).toEqual(["01-05", "05-10", "10-15", "15-20", "20-25", "25-30"]);
  });
  it("lote de Out/2026 25-30 considera somente linhas filtradas e aptas", () => {
    const apto = { ...RELATORIO_VAZIO, status: "Pronto para envio", destinatarios: "RH" };
    const registros = new Map([ ["visivel", apto], ["oculta", apto], ["sem", { ...apto, destinatarios: " " }], ["enviada", { ...apto, status: "Enviado" }], ["novembro", apto], ["periodo-novo", apto] ]);
    const ids = ["visivel", "sem", "enviada", "novembro", "periodo-novo"];
    const filtradas = ids.map(id => ({ id, empresa_id: id, periodo: id === "periodo-novo" ? "26-31" : "25-30", mes_referencia: id === "novembro" ? "2026-11" : "2026-10" }));
    expect(selecionarLoteRelatorios(filtradas, registros, "2026-10", PERIODOS).map(r => r.id)).toEqual(["visivel"]);
  });
  it("resumo conta enviados, conferidos e divergentes como enviados, mantendo pendentes", () => {
    const registros = new Map([ ["enviado", { ...RELATORIO_VAZIO, status: "Enviado", data_envio: "2026-10-26" }], ["conferido", { ...RELATORIO_VAZIO, status: "Conferido pela empresa", data_envio: "2026-10-26" }], ["divergente", { ...RELATORIO_VAZIO, status: "Divergência informada", data_envio: "2026-10-26" }] ]);
    expect(resumoEnvioRelatorios(["enviado", "conferido", "divergente", "nao-gerado", "pendente"], registros)).toEqual({ total: 5, enviados: 3, pendentes: 2 });
  });
  it("começa Não gerado sem envio nem confirmação", () => {
    expect(RELATORIO_VAZIO).toMatchObject({ status: "Não gerado", data_envio: null, confirmacao: "Aguardando" });
    expect(validarRegistroRelatorio(RELATORIO_VAZIO)).toBeNull();
  });
  it("aceita todos os nove estados solicitados", () => {
    expect(STATUS_RELATORIO).toHaveLength(9);
    for (const status of STATUS_RELATORIO) {
      const confirmacao = ["Conferido pela empresa", "Divergência informada"].includes(status) ? status : "Aguardando";
      expect(validarRegistroRelatorio({ ...RELATORIO_VAZIO, status, destinatarios: "rh@empresa.com.br", data_envio: "2026-10-26", confirmacao })).toBeNull();
    }
  });
  it("não registra Enviado sem destinatários", () => {
    expect(validarRegistroRelatorio({ ...RELATORIO_VAZIO, status: "Enviado", data_envio: "2026-10-26" })).not.toBeNull();
  });
  it("não registra Enviado sem data", () => {
    expect(validarRegistroRelatorio({ ...RELATORIO_VAZIO, status: "Enviado", destinatarios: "RH" })).not.toBeNull();
  });
  it("confirmação divergente não pode ser registrada como conferida", () => {
    expect(validarRegistroRelatorio({ ...RELATORIO_VAZIO, status: "Conferido pela empresa", destinatarios: "RH", data_envio: "2026-10-26", confirmacao: "Divergência informada" })).not.toBeNull();
  });
  it("preparar marca pronta com destinatário e sem destinatário sem e-mail", () => {
    expect(classificarPreparacao(undefined, "rh@empresa.com.br")).toBe("pronto");
    expect(classificarPreparacao(RELATORIO_VAZIO, " ")).toBe("sem_destinatario");
    expect(classificarPreparacao({ ...RELATORIO_VAZIO, status: "Sem destinatário" }, "rh@empresa.com.br")).toBe("pronto");
  });
  it("preparar nunca reabre relatório já enviado, conferido ou divergente", () => {
    for (const status of ["Enviado", "Conferido pela empresa", "Divergência informada"]) {
      expect(classificarPreparacao({ ...RELATORIO_VAZIO, status, destinatarios: "RH", data_envio: "2026-10-26" }, "novo@empresa.com.br")).toBe("final");
    }
  });
  it("resumo do envio separa prontas, sem destinatário e com erro, e só as aptas entram no lote", () => {
    const itens = [{ id: "pronta" }, { id: "sem-dest" }, { id: "erro" }, { id: "sem-registro" }, { id: "enviada" }];
    const registros = new Map([
      ["pronta", { ...RELATORIO_VAZIO, status: "Pronto para envio", destinatarios: "rh@empresa.com.br" }],
      ["sem-dest", { ...RELATORIO_VAZIO, status: "Sem destinatário" }],
      ["erro", { ...RELATORIO_VAZIO, status: "Erro no envio", destinatarios: "rh@empresa.com.br" }],
      ["enviada", { ...RELATORIO_VAZIO, status: "Enviado", destinatarios: "RH", data_envio: "2026-10-26" }],
    ]);
    const resumo = resumoLoteEnvio(itens, registros);
    expect(resumo).toMatchObject({ selecionadas: 5, prontas: 1, semDestinatario: 1, comErro: 3 });
    expect(resumo.aptas.map(i => i.id)).toEqual(["pronta"]);
  });
});