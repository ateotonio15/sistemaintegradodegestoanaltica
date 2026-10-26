import { describe, it, expect } from "vitest";
import { correspondeStatus, tomDias, metricasPendentes, formatarDataAgenda, formatarHoraAgenda, celulaCsvSegura } from "@/lib/agenda-pendentes";
import type { PendenteProcedimentoItem } from "@/lib/agendaCirurgicaApi";
describe("regras dos procedimentos pendentes", () => {
  it("Em Risco inclui somente 0 a 2 dias", () => { expect([-1,0,1,2,3].filter(d => correspondeStatus(d,"risco"))).toEqual([0,1,2]); });
  it("Vencidos inclui somente negativos", () => { expect([-2,-1,0,2].filter(d => correspondeStatus(d,"vencidos"))).toEqual([-2,-1]); });
  it("No Prazo inclui valores maiores que 2", () => { expect([0,2,3,5].filter(d => correspondeStatus(d,"prazo"))).toEqual([3,5]); });
  it("cores mudam em 2, 3, 5 e 6 dias", () => { expect([-1,2,3,5,6].map(tomDias)).toEqual(["danger","danger","warning","warning","success"]); });
  it("KPI risco inclui vencidos e próximo é o menor valor", () => { const dados = [-3,0,2,4].map(d => ({dias_para_execucao:d})) as PendenteProcedimentoItem[]; expect(metricasPendentes(dados)).toEqual({total:4,proximo:-3,risco:3}); expect(metricasPendentes([]).proximo).toBeNull(); });
  it("preserva data e hora locais sem conversão UTC", () => { expect(formatarDataAgenda("2026-10-21T00:30:00",true)).toBe("21/10/2026 00:30"); });
  it("mostra a data da agenda como DD/MM/AAAA", () => { expect(formatarDataAgenda("2026-11-09")).toBe("09/11/2026"); });
  it("lê só a hora de um horário que chega como data/hora completa", () => { expect(formatarHoraAgenda("2026-11-09T19:00:00.000Z")).toBe("19:00"); });
  it("mantém horário já curto e ignora valor vazio", () => { expect(formatarHoraAgenda("19:00:00")).toBe("19:00"); expect(formatarHoraAgenda("")).toBe(""); });
  it("neutraliza fórmulas na exportação CSV", () => { expect(celulaCsvSegura("=1+1")).toBe('"\'=1+1"'); });
});