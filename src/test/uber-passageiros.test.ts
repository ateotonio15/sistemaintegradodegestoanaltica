import { describe, it, expect } from "vitest";
import {
  validarPassageiro,
  normalizarPassageiroParaSalvar,
  resumoCorridaPadrao,
  origemSugeridaPeloPadrao,
  montarCorridaVolta,
  encontrarPassageiroPorNome,
  UBER_MOTIVOS,
} from "@/lib/uber-passageiros";

const base = {
  nome: "Maria Silva",
  setor: "Enfermagem",
  endereco: "Rua A, 100",
  whatsapp: "(92) 99999-0000",
  ativo: true,
  tem_corrida_padrao: false,
  usar_endereco_origem: true,
  origem_padrao: null,
  tipo_padrao: null,
  motivo_padrao: null,
};

describe("validarPassageiro", () => {
  it("exige nome, setor, endereço e WhatsApp", () => {
    expect(validarPassageiro({ ...base, nome: " " })).toMatch(/nome completo/i);
    expect(validarPassageiro({ ...base, setor: "" })).toMatch(/setor/i);
    expect(validarPassageiro({ ...base, endereco: "" })).toMatch(/endereço/i);
    expect(validarPassageiro({ ...base, whatsapp: "" })).toMatch(/whatsapp/i);
    expect(validarPassageiro(base)).toBeNull();
  });

  it("com corrida padrão ligada, tipo e motivo são obrigatórios", () => {
    const comPadrao = { ...base, tem_corrida_padrao: true };
    expect(validarPassageiro(comPadrao)).toMatch(/tipo padrão/i);
    expect(validarPassageiro({ ...comPadrao, tipo_padrao: "Ida" })).toMatch(/motivo padrão/i);
    expect(
      validarPassageiro({ ...comPadrao, tipo_padrao: "Ida", motivo_padrao: UBER_MOTIVOS[0] }),
    ).toBeNull();
  });

  it("exige origem padrão quando não usa o endereço cadastrado", () => {
    const p = {
      ...base,
      tem_corrida_padrao: true,
      tipo_padrao: "Volta",
      motivo_padrao: UBER_MOTIVOS[0],
      usar_endereco_origem: false,
    };
    expect(validarPassageiro(p)).toMatch(/origem padrão/i);
    expect(validarPassageiro({ ...p, origem_padrao: "Rua B, 200" })).toBeNull();
  });
});

describe("normalizarPassageiroParaSalvar", () => {
  it("com o toggle desligado, limpa todos os campos de padrão", () => {
    const salvo = normalizarPassageiroParaSalvar({
      ...base,
      tem_corrida_padrao: false,
      usar_endereco_origem: false,
      origem_padrao: "Rua B",
      tipo_padrao: "Ida",
      motivo_padrao: "Palestra",
    });
    expect(salvo.origem_padrao).toBeNull();
    expect(salvo.tipo_padrao).toBeNull();
    expect(salvo.motivo_padrao).toBeNull();
    expect(salvo.usar_endereco_origem).toBe(true);
  });

  it("com endereço cadastrado como origem, descarta a origem padrão digitada", () => {
    const salvo = normalizarPassageiroParaSalvar({
      ...base,
      tem_corrida_padrao: true,
      usar_endereco_origem: true,
      origem_padrao: "Rua B",
      tipo_padrao: "Ida",
      motivo_padrao: "Palestra",
    });
    expect(salvo.origem_padrao).toBeNull();
    expect(salvo.tipo_padrao).toBe("Ida");
  });
});

describe("resumo e origem sugerida", () => {
  it("resumo mostra tipo e motivo ou traço", () => {
    expect(resumoCorridaPadrao(base)).toBe("—");
    expect(
      resumoCorridaPadrao({ ...base, tem_corrida_padrao: true, tipo_padrao: "Ida", motivo_padrao: "Palestra" }),
    ).toBe("Ida · Palestra");
  });

  it("origem sugerida usa o endereço cadastrado ou a origem padrão", () => {
    expect(origemSugeridaPeloPadrao(base)).toBeNull();
    expect(
      origemSugeridaPeloPadrao({ ...base, tem_corrida_padrao: true, usar_endereco_origem: true }),
    ).toBe("Rua A, 100");
    expect(
      origemSugeridaPeloPadrao({
        ...base,
        tem_corrida_padrao: true,
        usar_endereco_origem: false,
        origem_padrao: "Rua C, 300",
      }),
    ).toBe("Rua C, 300");
  });
});

describe("montarCorridaVolta", () => {
  it("inverte origem/destino, troca Ida por Volta e limpa o horário", () => {
    const volta = montarCorridaVolta({ origem: "A", destino: "B", tipo: "Ida" });
    expect(volta).toEqual({ origem: "B", destino: "A", tipo: "Volta", horario: null });
  });

  it("troca Volta por Ida e mantém 'Ida e Volta' como está", () => {
    expect(montarCorridaVolta({ origem: "A", destino: "B", tipo: "Volta" }).tipo).toBe("Ida");
    expect(montarCorridaVolta({ origem: "A", destino: "B", tipo: "Ida e Volta" }).tipo).toBe("Ida e Volta");
  });
});

describe("encontrarPassageiroPorNome", () => {
  const lista = [
    { nome: "Maria Silva", ativo: true },
    { nome: "João Inativo", ativo: false },
  ];

  it("encontra por nome exato ignorando maiúsculas e espaços", () => {
    expect(encontrarPassageiroPorNome(lista, "  maria silva ")).toBe(true);
  });

  it("não aceita passageiro inativo nem nome parcial", () => {
    expect(encontrarPassageiroPorNome(lista, "João Inativo")).toBe(false);
    expect(encontrarPassageiroPorNome(lista, "Maria")).toBe(false);
    expect(encontrarPassageiroPorNome(lista, "")).toBe(false);
  });
});
