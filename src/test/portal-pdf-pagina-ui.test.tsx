import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker.js" }));
vi.mock("pdfjs-dist", () => {
  const page = {
    getViewport: () => ({ width: 8, height: 8 }),
    render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
  };
  const doc = { numPages: 3, getPage: async () => page };
  return {
    GlobalWorkerOptions: {},
    getDocument: () => ({ promise: Promise.resolve(doc), destroy: () => {} }),
  };
});

import { PortalPdfPreview } from "@/components/movimentacoes/PortalPdfPreview";

const paginaDoCanvas = (container: HTMLElement) =>
  container.querySelector("canvas")?.getAttribute("aria-label") ?? "";

const blobFake = { arrayBuffer: async () => new Uint8Array([1]) } as unknown as Blob;

describe("Campo de página digitada na prévia de PDF", () => {
  it("vai para a página digitada ao pressionar Enter", async () => {
    const { container } = render(<PortalPdfPreview blob={blobFake} />);
    const campo = await screen.findByLabelText("Número da página");
    await waitFor(() => expect(paginaDoCanvas(container)).toBe("Página 1 do relatório de vidas"));

    fireEvent.change(campo, { target: { value: "3" } });
    fireEvent.keyDown(campo, { key: "Enter" });

    await waitFor(() => expect(paginaDoCanvas(container)).toBe("Página 3 do relatório de vidas"));
    expect(campo).toHaveValue("3");
  });

  it("não passa da última página quando o número digitado é maior", async () => {
    const { container } = render(<PortalPdfPreview blob={blobFake} />);
    const campo = await screen.findByLabelText("Número da página");
    await waitFor(() => expect(paginaDoCanvas(container)).toBe("Página 1 do relatório de vidas"));

    fireEvent.change(campo, { target: { value: "9" } });
    fireEvent.blur(campo);

    await waitFor(() => expect(paginaDoCanvas(container)).toBe("Página 3 do relatório de vidas"));
    expect(campo).toHaveValue("3");
  });

  it("volta para a página atual quando o campo é esvaziado", async () => {
    const { container } = render(<PortalPdfPreview blob={blobFake} />);
    const campo = await screen.findByLabelText("Número da página");
    await waitFor(() => expect(paginaDoCanvas(container)).toBe("Página 1 do relatório de vidas"));

    fireEvent.change(campo, { target: { value: "" } });
    fireEvent.blur(campo);

    await waitFor(() => expect(paginaDoCanvas(container)).toBe("Página 1 do relatório de vidas"));
    expect(campo).toHaveValue("1");
  });
});
