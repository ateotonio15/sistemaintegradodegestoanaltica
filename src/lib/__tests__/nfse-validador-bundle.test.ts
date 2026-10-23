import { execFileSync } from "node:child_process";
import { describe, it, expect } from "vitest";

describe("pacote do validador da Central", () => {
  it("está sincronizado com os parsers do SIGA", () => {
    expect(() => execFileSync("node", ["scripts/build-nfse-validador.mjs", "--check"], { stdio: "pipe" })).not.toThrow();
  });
});
