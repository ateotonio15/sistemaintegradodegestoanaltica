import { describe, it, expect } from "vitest";
import { resumoApresentacao } from "@/modules/saude-empresas/lib/apresentacao-saude";

const base = {
  total: 20,
  paCounts: { "Ótima": 6, Normal: 6, "PA Elevada": 2, "Hipertensão Estágio 1": 2, "Hipertensão Estágio 2": 1, "Hipertensão Estágio 3": 1, "Não realizado": 2 },
  gliCounts: { Normal: 9, "Pré-Diabetes": 4, "Alterada pós-prandial": 1, Diabetes: 1, "Não realizado": 5 },
  encaminhamentos: 10,
};

describe("apresentação da campanha", () => {
  it("percentuais usam só quem foi avaliado", () => {
    const r = resumoApresentacao(base);
    expect(r.basePa).toBe(18);
    expect(r.baseGli).toBe(15);
    expect(r.pctGliAlt).toBe(40);
  });
  it("títulos são conclusões calculadas", () => {
    const r = resumoApresentacao(base);
    expect(r.tituloNumeros).toBe("Metade dos colaboradores triados precisa de acompanhamento");
    expect(r.tituloGlicemia).toBe("4 em cada 10 colaboradores têm glicemia fora do ideal");
    expect(r.tituloPa).toBe("7 em cada 10 estão com a pressão em dia; 3 em cada 10 precisam de atenção");
  });
  it("PA vem antes quando é o principal ponto de atenção", () => {
    expect(resumoApresentacao(base).paPrimeiro).toBe(false);
    const r = resumoApresentacao({ ...base, paCounts: { ...base.paCounts, "Ótima": 0, Normal: 2, "Hipertensão Estágio 1": 12 } });
    expect(r.paPrimeiro).toBe(true);
  });
});

import { filtrarGrupo, opcoesGrupo, faixaEtaria } from "@/modules/saude-empresas/lib/apresentacao-saude";
describe("filtros da apresentação", () => {
  const t = (setor: string, idade: number) => ({ pas_mmhg: 120, pad_mmhg: 80, glicemia_mg_dl: 90, jejum: true, setor, sexo: null, idade });
  const lista = [...Array(5)].map(() => t("Produção", 35)).concat([...Array(4)].map(() => t("RH", 45)));
  it("grupo com menos de 5 colaboradores não é exibido", () => {
    expect(filtrarGrupo(lista, "setor", "RH").pequeno).toBe(true);
    expect(filtrarGrupo(lista, "setor", "PRODUÇÃO").pequeno).toBe(false);
  });
  it("dimensão sem dados é omitida", () => {
    const o = opcoesGrupo(lista);
    expect(o.sexo).toBeUndefined();
    expect(o.setor?.length).toBe(2);
    expect(faixaEtaria(35)).toBe("30 a 39 anos");
  });
});
