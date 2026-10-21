import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { duplicarDemanda, preservarCpf, atualizarClassificacaoManual, classificacaoCompativel } from "@/lib/demanda-form-utils";
import { useSessionState } from "@/hooks/useSessionState";
import type { Demanda } from "@/lib/demandas-utils";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { validarClassificacaoIA } from "@/lib/reclamacao-ia";

const original = { id: "original", nome_cliente: "Beneficiário", cpf: "123.456.789-00", empresa: "Empresa", setor_responsavel: "Financeiro", tipo_reclamacao: "Nota Fiscal", reclamacao: "Atraso na emissão da nota", executiva: "Executiva", detalhamento: "Nota atrasada", resolvido_setor: true, resolvido_executiva: true, data_resolucao_setor: "2026-01-01", data_resolucao_executiva: "2026-01-02", importacao_id: "lote", created_by: "autor" } as Demanda;
describe("Reclamações — regras solicitadas", () => {
  it("troca de setor limpa tipo e reclamação sem apagar beneficiário ou CPF", () => {
    expect(atualizarClassificacaoManual(original, "setor_responsavel", "Agenda Cirúrgica")).toMatchObject({ setor_responsavel: "Agenda Cirúrgica", tipo_reclamacao: "", reclamacao: "", cpf: original.cpf, nome_cliente: original.nome_cliente });
  });
  it("troca de tipo limpa somente reclamação e mantém setor", () => {
    expect(atualizarClassificacaoManual(original, "tipo_reclamacao", "Aprazamento")).toMatchObject({ setor_responsavel: "Financeiro", tipo_reclamacao: "Aprazamento", reclamacao: "" });
  });
  it("bloqueia combinação incompatível e aceita classificação válida", () => {
    expect(classificacaoCompativel(original)).toBe(true);
    expect(classificacaoCompativel({ ...original, setor_responsavel: "Agenda Cirúrgica", tipo_reclamacao: "Aprazamento", reclamacao: "Aprazamento de consulta" })).toBe(false);
  });
  it("duplica dados sem identidade ou autoria", () => {
    const copy = duplicarDemanda(original, new Date(2026, 9, 17));
    expect(copy).toMatchObject({ nome_cliente: "Beneficiário", cpf: "123.456.789-00", empresa: "Empresa", setor_responsavel: "Financeiro", executiva: "Executiva", detalhamento: "Nota atrasada" });
    expect(copy).not.toHaveProperty("id"); expect(copy).not.toHaveProperty("created_by"); expect(copy).not.toHaveProperty("importacao_id");
  });
  it("usa hoje e reinicia as resoluções", () => {
    expect(duplicarDemanda(original, new Date(2026, 9, 17))).toMatchObject({ data_reclamacao: "2026-10-17", resolvido_setor: false, resolvido_executiva: false, data_resolucao_setor: null, data_resolucao_executiva: null });
  });
  it("preserva o CPF também em reclamações não cirúrgicas", () => { expect(preservarCpf(original)).toBe("123.456.789-00"); });
  it("mantém todos os filtros após desmontagem e permite limpeza explícita", () => {
    const key = "demandas:teste:filtros";
    sessionStorage.removeItem(key);
    const filters = { dataIni: "2026-10-01", dataFim: "2026-10-31", empresa: "Empresa", setor: "Financeiro", executiva: "Executiva", status: "em_aberto", busca: "Beneficiário" };
    const first = renderHook(() => useSessionState(key, {}));
    act(() => first.result.current[1](filters)); first.unmount();
    const second = renderHook(() => useSessionState(key, {}));
    expect(second.result.current[0]).toEqual(filters);
    act(() => second.result.current[1]({})); second.unmount();
    expect(renderHook(() => useSessionState(key, {})).result.current[0]).toEqual({});
  });
  it("IA aceita somente combinação compatível e mantém correções válidas", () => {
    expect(validarClassificacaoIA({ setor_responsavel: "Financeiro", tipo_reclamacao: "Nota Fiscal", reclamacao: "Atraso na emissão da nota" })).toBe(true);
    expect(validarClassificacaoIA({ setor_responsavel: "Agenda Cirúrgica", tipo_reclamacao: "Aprazamento", reclamacao: "Aprazamento de consulta" })).toBe(false);
  });
});