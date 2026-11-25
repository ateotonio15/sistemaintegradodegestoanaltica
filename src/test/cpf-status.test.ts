import { describe, it, expect } from "vitest";
import { normalizarCpf, statusCpfLocal, mascararCpf, resumoStatusCpf, elegivelConsultaOficial } from "@/lib/cpf-status";

describe("status do CPF", () => {
  it("normaliza pontos, traços e espaços", () => {
    expect(normalizarCpf(" 012.345.678-90 ")).toBe("01234567890");
  });
  it("números todos iguais são inválidos", () => {
    for (const c of ["00000000000", "11111111111", "99999999999"]) expect(statusCpfLocal(c)).toBe("invalido");
  });
  it("quantidade errada de dígitos é inválida", () => {
    expect(statusCpfLocal("1234567890")).toBe("invalido");
  });
  it("dígito verificador errado é inválido e correto é válido localmente", () => {
    expect(statusCpfLocal("529.982.247-25")).toBe("valido_local");
    expect(statusCpfLocal("529.982.247-24")).toBe("invalido");
  });
  it("CPF vazio fica não analisado", () => {
    expect(statusCpfLocal("")).toBe("nao_analisado");
  });
  it("inválido nunca vai para consulta oficial", () => {
    expect(elegivelConsultaOficial("invalido")).toBe(false);
    expect(elegivelConsultaOficial("valido_local")).toBe(true);
  });
  it("mascara mostrando só os 2 últimos dígitos", () => {
    expect(mascararCpf("52998224725")).toBe("***.***.***-25");
  });
  it("resumo conta válidos, inválidos e aguardando", () => {
    const r = resumoStatusCpf([{ cpf: "52998224725" }, { cpf: "11111111111" }, { cpf: "" }]);
    expect(r).toEqual({ validos: 1, invalidos: 1, aguardando: 1, naoAnalisados: 1 });
  });
});

import { statusCpfFinal } from "@/lib/cpf-status";
describe("status final com consulta oficial", () => {
  const oficial = (status: any) => ({ status, origem: "x", consultado_em: "2026-11-25T00:00:00Z" });
  it("CPF inválido local continua inválido mesmo com resultado", () => {
    expect(statusCpfFinal({ cpf: "11111111111", cpf_oficial: oficial("validado_oficial") })).toBe("invalido");
  });
  it("consulta indisponível não vira válido nem inválido", () => {
    expect(statusCpfFinal({ cpf: "52998224725", cpf_oficial: oficial("indisponivel") })).toBe("indisponivel");
  });
  it("sem consulta fica válido localmente", () => {
    expect(statusCpfFinal({ cpf: "52998224725" })).toBe("valido_local");
  });
});

import { resumoValidacaoCpf, precisaNovaTentativa, categoriaCpf } from "@/lib/cpf-status";
describe("resumo da validação de CPF", () => {
  const ok = "52998224725";
  const t = "2026-11-25T10:00:00Z";
  it("conta categorias e falha técnica não vira erro", () => {
    const lista = [
      { cpf: ok, cpf_oficial: { status: "validado_oficial" as const, origem: "x", consultado_em: t } },
      { cpf: "11111111111" },
      { cpf: ok, cpf_oficial: { status: "divergencia" as const, origem: "x", consultado_em: t } },
      { cpf: ok, cpf_oficial: { status: "indisponivel" as const, origem: "erro_tecnico", consultado_em: t } },
    ];
    const r = resumoValidacaoCpf(lista);
    expect([r.validados, r.invalidos, r.divergencias, r.nao_consultados]).toEqual([1, 1, 1, 1]);
    expect(precisaNovaTentativa(lista[3])).toBe(true);
    expect(precisaNovaTentativa(lista[0])).toBe(false);
    expect(categoriaCpf(lista[3])).toBe("nao_consultado");
  });
});
