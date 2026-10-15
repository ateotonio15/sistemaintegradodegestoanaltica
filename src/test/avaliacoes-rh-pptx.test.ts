import { describe, expect, it } from "vitest";
import { criarAvaliacoesRHPptx, statusDesempenhoRH } from "@/modules/carteira-samel/lib/avaliacoes-rh-pptx";

describe("PowerPoint executivo de RH", () => {
  it("compara desempenho à média do período, sem meta fixa", () => {
    expect(statusDesempenhoRH(4.8, 4.5)).toBe("Acima da média");
    expect(statusDesempenhoRH(4.2, 4.5)).toBe("Abaixo da média");
    expect(statusDesempenhoRH(4.5, 4.5)).toBe("Na média");
    expect(statusDesempenhoRH(4.5, 4.8)).toBe("Abaixo da média");
  });

  it("gera exatamente seis slides, inclusive sem respostas ou com ranking extenso", async () => {
    for (const quantidade of [0, 20]) {
      const pptx = await criarAvaliacoesRHPptx({
        titulo: "Avaliação RH", periodo: "Out/2026",
        stats: { total: quantidade, media: quantidade ? 4.5 : 0, comentarios: 0, empresas: quantidade },
        distribuicao: [1, 2, 3, 4, 5].map(n => ({ name: `Nota ${n}`, value: n === 5 ? quantidade : 0 })),
        mediaPorPergunta: [], evolucao: [],
        rankingExecutivas: Array.from({ length: quantidade }, (_, i) => ({ nome: `Executiva ${i}`, media: 4.5, qtd: 1 })),
        rankingEmpresas: Array.from({ length: quantidade }, (_, i) => ({ nome: `Empresa ${i}`, qtd: 1 })),
      }, { capa: "image/png;base64,iVBORw0KGgo=", conteudo: "image/png;base64,iVBORw0KGgo=" });
      expect(pptx._slides.length).toBe(6);
    }
  });
});