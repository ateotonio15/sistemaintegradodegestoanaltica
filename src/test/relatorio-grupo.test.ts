import { describe, it, expect } from "vitest";
import { papelGrupoRelatorio, contratosAnexosDoGrupo } from "@/lib/relatorio-grupo";

describe("envio de relatórios por grupo", () => {
  it("contrato principal envia o e-mail do grupo", () => {
    expect(papelGrupoRelatorio("a", { principal_empresa_id: "a" })).toBe("principal");
  });
  it("demais contratos do grupo não enviam e-mail próprio", () => {
    expect(papelGrupoRelatorio("b", { principal_empresa_id: "a" })).toBe("membro");
  });
  it("grupo sem principal definido mantém o envio individual", () => {
    expect(papelGrupoRelatorio("b", { principal_empresa_id: null })).toBe("sem_grupo");
  });
  it("anexos do grupo excluem o principal e repetidos", () => {
    expect(contratosAnexosDoGrupo("2192", [{ contrato: "2192" }, { contrato: "2500" }, { contrato: "147" }, { contrato: "2500" }])).toEqual([147, 2500]);
  });
});
