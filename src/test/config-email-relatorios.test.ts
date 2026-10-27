import { describe, expect, it } from "vitest";
import { validarConfigEmail } from "@/lib/config-email-relatorios";

const dados = { dominio: "samel.com.br", nome_remetente: "Samel", email_remetente: "relatorios@samel.com.br", email_resposta: "" };
describe("Dados do remetente", () => {
  it("aceita remetente do domínio Samel e resposta opcional", () => { expect(validarConfigEmail(dados)).toBeNull(); });
  it("rejeita remetente de outro domínio", () => { expect(validarConfigEmail({ ...dados, email_remetente: "relatorios@outro.com.br" })).not.toBeNull(); });
  it("rejeita URL no lugar do domínio", () => { expect(validarConfigEmail({ ...dados, dominio: "https://samel.com.br" })).not.toBeNull(); });
  it("rejeita e-mail de resposta inválido", () => { expect(validarConfigEmail({ ...dados, email_resposta: "financeiro" })).not.toBeNull(); });
  it("exige nome de remetente", () => { expect(validarConfigEmail({ ...dados, nome_remetente: " " })).not.toBeNull(); });
});
import { validarRemetenteUsuario } from "@/lib/config-email-relatorios";
describe("remetente individual do Cadastro", () => {
  it("aceita e-mail @samel.com.br", () => expect(validarRemetenteUsuario({ nome_remetente: "Ana", email_remetente: "ana@samel.com.br", email_resposta: "" })).toBeNull());
  it("recusa outro domínio", () => expect(validarRemetenteUsuario({ nome_remetente: "Ana", email_remetente: "ana@gmail.com", email_resposta: "" })).not.toBeNull());
});
