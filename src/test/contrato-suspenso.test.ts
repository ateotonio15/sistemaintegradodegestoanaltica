import { describe, it, expect } from "vitest";
import { separarSuspensos, mensagemSuspensosIgnorados } from "@/lib/contrato-suspenso";

describe("contratos suspensos em Movimentações", () => {
  it("lote ignora suspensos: 25 no período, 22 aptos, 3 suspensos", () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ empresas: { contrato_suspenso: i < 3 } }));
    const r = separarSuspensos(rows);
    expect(r.aptos.length).toBe(22);
    expect(r.suspensos).toBe(3);
  });
  it("mensagem do resumo de envio", () => {
    expect(mensagemSuspensosIgnorados(3, "envio")).toBe("3 contratos suspensos foram ignorados no envio.");
    expect(mensagemSuspensosIgnorados(0, "envio")).toBeNull();
  });
});

import { diasSuspenso as _ds, nivelSuspensao as _ns, ordenarPorSuspensao as _os } from "@/lib/contrato-suspenso";
import { describe as _d, it as _it, expect as _e } from "vitest";
_d("tempo de suspensão", () => {
  _it("01/11 a 17/11 = 16 dias", () => _e(_ds("2026-11-01", "2026-11-17")).toBe(16));
  _it("0-19 normal, 20-29 atenção, 30+ crítico", () => {
    _e(_ns(19)).toBe("normal"); _e(_ns(20)).toBe("atencao"); _e(_ns(29)).toBe("atencao"); _e(_ns(30)).toBe("critico"); _e(_ns(62)).toBe("critico");
  });
  _it("ordena críticos primeiro e mais dias antes", () => {
    _e(_os([5, 25, 31, 45, 12], (x) => x)).toEqual([45, 31, 25, 12, 5]);
  });
});

import { itensEmSuspensaoAtiva } from "@/lib/contrato-suspenso";
import { describe as _d2, it as _it2, expect as _e2 } from "vitest";
_d2("quadro de suspensos: reativados fora do período", () => {
  _it2("só o contrato ainda suspenso aparece; reativado fora do período não gera aviso", () => {
    const itens = [
      { status: "encaminhado", empresa_nome: "A.M. TECNOLOGIA" },
      { status: "analise_humana", empresa_nome: "RISADINHA" },
      { status: "devolvido_fluxo_normal", empresa_nome: "CIBEA MANAUS" },
    ];
    _e2(itensEmSuspensaoAtiva(itens).map((i) => i.empresa_nome)).toEqual(["A.M. TECNOLOGIA"]);
  });
});
