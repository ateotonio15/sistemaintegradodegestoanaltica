import { describe, expect, it, vi } from "vitest";
import { concluirEnvioRelatorio } from "../../supabase/functions/_shared/registrar-envio-relatorio";
import { resumoEnviosRelatorio, formatarEnvioRelatorio } from "@/lib/relatorio-envio-historico";

describe("histórico confirmado de envio", () => {
  it("não registra data quando o envio falha", async () => {
    const registrar = vi.fn();
    await expect(concluirEnvioRelatorio(async () => { throw new Error("SMTP falhou"); }, registrar)).rejects.toThrow("SMTP falhou");
    expect(registrar).not.toHaveBeenCalled();
  });
  it("registra somente depois que o envio conclui com sucesso", async () => {
    const ordem: string[] = [];
    await concluirEnvioRelatorio(async () => { ordem.push("enviado"); }, async () => { ordem.push("registrado"); });
    expect(ordem).toEqual(["enviado", "registrado"]);
  });
  it("preserva os anteriores e apresenta o envio mais recente", () => {
    const envios = [{ id: "2", enviado_em: "2026-10-29T12:15:00Z", nome_remetente: "Teotonio Junior" }, { id: "1", enviado_em: "2026-10-27T13:32:00Z", nome_remetente: "Teotonio Junior" }];
    const resumo = resumoEnviosRelatorio(envios, "2026-10-27");
    expect(resumo.quantidade).toBe(2);
    expect(resumo.ultimo?.id).toBe("2");
    expect(resumo.envios.map(e => e.id)).toEqual(["1", "2"]);
    expect(envios.map(e => e.id)).toEqual(["2", "1"]);
    expect(formatarEnvioRelatorio(resumo.data ?? "")).toBe("29/10/2026 às 08:15");
  });
  it("usa Envio Empresa antigo sem inventar horário, remetente ou quantidade", () => {
    const resumo = resumoEnviosRelatorio([], "2026-10-27");
    expect(formatarEnvioRelatorio(resumo.data ?? "")).toBe("27/10/2026");
    expect(resumo.ultimo).toBeUndefined();
    expect(resumo.quantidade).toBe(0);
  });
  it("sem data e sem eventos não declara envio", () => {
    expect(resumoEnviosRelatorio([], null).data).toBeNull();
  });
  it("mantém a data antiga no histórico quando ocorre novo envio em outro dia", () => {
    const resumo = resumoEnviosRelatorio([{ id: "novo", enviado_em: "2026-10-29T12:15:00Z", nome_remetente: "Teotonio Junior" }], "2026-10-27");
    expect(resumo.quantidade).toBe(2);
    expect(resumo.envios[0]).toEqual({ id: "envio-empresa-legado", enviado_em: "2026-10-27", nome_remetente: null });
    expect(resumo.ultimo?.id).toBe("novo");
  });
});