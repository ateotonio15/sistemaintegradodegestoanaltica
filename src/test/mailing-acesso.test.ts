import { describe, expect, it } from "vitest";
import { podeExibirAtalhoMailing } from "@/lib/mailing-acesso";

describe("Atalho Mailing de Brindes", () => {
  it("está disponível para Executivo", () => {
    expect(podeExibirAtalhoMailing("executivo")).toBe(true);
  });
  it("está disponível para Executivo Externo", () => {
    expect(podeExibirAtalhoMailing("executivo_externo")).toBe(true);
  });
  it("preserva o acesso administrativo sem liberar perfis não autorizados", () => {
    expect(podeExibirAtalhoMailing("admin")).toBe(true);
    expect(podeExibirAtalhoMailing("financeiro")).toBe(false);
    expect(podeExibirAtalhoMailing(null)).toBe(false);
  });
});