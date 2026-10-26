import { describe, expect, it } from "vitest";
import { RELATORIO_VAZIO, STATUS_RELATORIO, validarRegistroRelatorio, selecionarLoteRelatorios, resumoEnvioRelatorios } from "@/lib/movimentacao-relatorio";
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
});