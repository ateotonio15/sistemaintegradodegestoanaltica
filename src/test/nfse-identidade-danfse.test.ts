import { describe, it, expect } from "vitest";
import { lerNumero, lerEmissao, lerChave } from "@/lib/nfse-identidade-fiscal";

// Formato DANFSe v2.0: rótulo numa linha, valor na linha seguinte.
const texto = "CHAVE DE ACESSO DA NFS-e\n13026032284537141000138000000001779026109779221276\nNÚMERO DA NFS-e\n17790\nCOMPETÊNCIA DA NFS-e\n23/10/2026\nDATA E HORA DA EMISSÃO DA NFS-e\n23/10/2026 09:39:21\nNÚMERO DA DPS\n332965";

describe("identidade fiscal em DANFSe com rótulos em linhas separadas", () => {
  it("lê o número da NFS-e, não o da DPS", () => expect(lerNumero(texto)).toBe("17790"));
  it("lê a data de emissão", () => expect(lerEmissao(texto)?.data).toBe("2026-10-23"));
  it("lê a chave", () => expect(lerChave(texto)).toBe("13026032284537141000138000000001779026109779221276"));
});
