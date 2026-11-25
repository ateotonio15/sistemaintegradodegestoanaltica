import { describe, expect, it } from "vitest";
import { filtrarParticipante, temPendenciaParticipante } from "@/components/implantacao/vidas-apresentacao";
import type { BeneficiarioLido, ValidacaoResultado } from "@/lib/relatorio-vidas-validator";

const titular: BeneficiarioLido = { linha: 2, nome: "Titular Teste", cpf: "52998224725", data_nasc: "01/01/1990", sexo: "", tipo: "TITULAR", grau: "", titular_linha: null,
  cpf_oficial: { status: "indisponivel", origem: "nao_configurado", consultado_em: "2026-11-25T15:43:00Z" } };
const filho: BeneficiarioLido = { ...titular, linha: 3, nome: "Dependente Teste", tipo: "FILHO", grau: "6", titular_linha: 2 };
const base = { pendencias: [], beneficiarios: [titular, filho] } as unknown as ValidacaoResultado;

describe("apresentação dos participantes", () => {
  it("separa titulares e dependentes sem modificar vínculos", () => {
    expect(base.beneficiarios?.filter((b) => filtrarParticipante(b, "titulares", base, false)).map((b) => b.linha)).toEqual([2]);
    expect(base.beneficiarios?.filter((b) => filtrarParticipante(b, "dependentes", base, false)).map((b) => b.linha)).toEqual([3]);
    expect(filho.titular_linha).toBe(2);
  });
  it("consulta não configurada não representa pendência, mas CPF inválido e erro de leitura sim", () => {
    expect(temPendenciaParticipante(titular, base, false)).toBe(false);
    expect(temPendenciaParticipante({ ...filho, cpf: "11111111111" }, base, false)).toBe(true);
    const comErro = { ...base, pendencias: [{ linha: 3, coluna: "NOME DA MAE", motivo: "Ausente", severidade: "alerta" as const }] };
    expect([titular, filho].filter((b) => filtrarParticipante(b, "pendencias", comErro, false)).map((b) => b.linha)).toEqual([3]);
  });
  it("quando existir provedor, inclui exceções oficiais no filtro de pendências", () => {
    expect(temPendenciaParticipante(titular, base, true)).toBe(true);
    expect(temPendenciaParticipante({ ...titular, cpf_oficial: { ...titular.cpf_oficial, status: "divergencia", origem: "teste", consultado_em: "2026-11-25T15:43:00Z" } }, base, true)).toBe(true);
  });
});