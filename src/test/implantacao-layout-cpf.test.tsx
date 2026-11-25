import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { COLUNAS_OBRIGATORIAS } from "@/lib/relatorio-vidas-validator";
import { Step5Vidas } from "@/components/implantacao/ImplantacaoWizard";

const mocks = vi.hoisted(() => ({ download: vi.fn(), invoke: vi.fn() }));
vi.mock("@/components/implantacao/AnexoPreviewDialog", () => ({ AnexoPreviewDialog: () => null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ download: mocks.download }) }, functions: { invoke: mocks.invoke } },
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

async function planilha(cpfs: string[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Vidas");
  sheet.addRow([...COLUNAS_OBRIGATORIAS]);
  cpfs.forEach((cpf, i) => sheet.addRow(COLUNAS_OBRIGATORIAS.map((coluna) => ({
    "TIPO OPERACAO": "I", NOME: `Participante Teste ${i}`, CPF: cpf, "DATA NASC": "01/01/1990",
  } as Record<string, string>)[coluna] ?? "")));
  const bytes = await workbook.xlsx.writeBuffer();
  mocks.download.mockResolvedValue({ data: { arrayBuffer: async () => bytes }, error: null });
}

function montar(update: ReturnType<typeof vi.fn>, anterior: unknown = null) {
  function Tela() {
    const [data, setData] = useState<any>({ id: "implantacao-teste", relatorio_validacao: anterior });
    return <Step5Vidas data={data} update={(patch: any) => { update(patch); setData((prev: any) => ({ ...prev, ...patch })); }}
      relAnexo={{ nome_arquivo: "vidas.xlsx", storage_path: "teste/vidas.xlsx" }} />;
  }
  render(<Tela />);
  fireEvent.click(screen.getByRole("button", { name: "Verificar Layout" }));
}

describe("CPF integrado à verificação de layout", () => {
  it("confere automaticamente os CPFs da planilha recém-lida, não os do resultado anterior", async () => {
    await planilha(["52998224725", "11111111111"]);
    mocks.invoke.mockResolvedValue({ data: { resultados: [{ linha: 2, status: "validado_oficial", origem: "teste", consultado_em: "2026-11-25T15:33:00Z" }] }, error: null });
    const update = vi.fn();
    montar(update, { beneficiarios: [{ linha: 99, nome: "Anterior", cpf: "11144477735" }], colunas: [], colunas_ausentes: [], pendencias: [] });
    await waitFor(() => expect(update.mock.lastCall?.[0].relatorio_validacao.cpf_resumo?.validados).toBe(1));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke.mock.calls[0][1].body).toEqual({ implantacao_id: "implantacao-teste", itens: [{ linha: 2, nome: "Participante Teste 0", cpf: "52998224725", data_nasc: "01/01/1990" }] });
    expect(update.mock.lastCall?.[0].relatorio_validacao.cpf_resumo.invalidos).toBe(1);
  });

  it("mantém a conferência local se a consulta oficial estiver indisponível", async () => {
    await planilha(["52998224725", "11111111111"]);
    mocks.invoke.mockRejectedValue(new Error("indisponível"));
    const update = vi.fn();
    montar(update);
    await waitFor(() => expect(update.mock.lastCall?.[0].relatorio_validacao.cpf_resumo?.nao_consultados).toBe(1));
    const resultado = update.mock.lastCall?.[0].relatorio_validacao;
    expect(resultado.total_vidas).toBe(2);
    expect(resultado.cpf_resumo.invalidos).toBe(1);
    expect(resultado.beneficiarios[0].cpf_oficial.status).toBe("indisponivel");
  });

  it("não consulta CPFs localmente inválidos e ainda produz o resumo", async () => {
    await planilha(["11111111111"]);
    const update = vi.fn();
    montar(update);
    await waitFor(() => expect(update.mock.lastCall?.[0].relatorio_validacao.cpf_resumo?.invalidos).toBe(1));
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});