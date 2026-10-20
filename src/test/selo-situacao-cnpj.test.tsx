import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeloSituacaoCnpj } from "@/components/empresas/ConsultarCnpj";

describe("Selo da situação do CNPJ ao lado do campo", () => {
  it("mostra a situação com a palavra CNPJ quando a consulta informa", () => {
    render(<SeloSituacaoCnpj situacao="Ativa" />);
    expect(screen.getByText("CNPJ ATIVA")).toBeInTheDocument();
  });

  it("não mostra selo quando não há situação informada", () => {
    render(<SeloSituacaoCnpj situacao="" />);
    expect(screen.queryByText(/CNPJ/)).not.toBeInTheDocument();
  });
});
