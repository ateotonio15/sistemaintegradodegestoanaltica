import { describe, expect, it } from "vitest";
import { podeVerSecaoHome } from "@/lib/home-secoes";
import { INTELIGENCIA_SECTIONS } from "@/pages/Home";

const secao = (titulo: string) => {
  const encontrada = INTELIGENCIA_SECTIONS.find((s) => s.title === titulo);
  if (!encontrada) throw new Error(`seção "${titulo}" não encontrada`);
  return encontrada;
};

describe("cards da tela inicial", () => {
  it("esconde Uber Corporativo e Produção de Guias para o login izabelle.santos", () => {
    const ctx = { isAdmin: false, role: "executivo", username: "izabelle.santos" };
    expect(podeVerSecaoHome(secao("Uber Corporativo"), ctx)).toBe(false);
    expect(podeVerSecaoHome(secao("Produção de Guias"), ctx)).toBe(false);
  });

  it("mantém os dois cards para outro executivo", () => {
    const ctx = { isAdmin: false, role: "executivo", username: "carla.valenca" };
    expect(podeVerSecaoHome(secao("Uber Corporativo"), ctx)).toBe(true);
    expect(podeVerSecaoHome(secao("Produção de Guias"), ctx)).toBe(true);
  });

  it("admin continua vendo os dois cards", () => {
    const ctx = { isAdmin: true, role: "admin", username: "izabelle.santos" };
    expect(podeVerSecaoHome(secao("Uber Corporativo"), ctx)).toBe(true);
    expect(podeVerSecaoHome(secao("Produção de Guias"), ctx)).toBe(true);
  });

  it("esconde o card de um login negado mesmo sem lista de perfis", () => {
    expect(
      podeVerSecaoHome({ negarUsuarios: ["izabelle.santos"] }, { isAdmin: false, role: "executivo", username: "izabelle.santos" }),
    ).toBe(false);
  });
});
