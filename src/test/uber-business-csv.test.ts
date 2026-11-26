import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { agruparUber, casarResponsavel, conferirUber, dataUber, horaUber, lerUberCsv, pendenciasUber } from "@/lib/uber-business-csv";

const csv = readFileSync("src/test/fixtures/uber-business-anonimo.csv", "utf8");
const parsed = () => lerUberCsv(csv, "teste.csv");
describe("Uber Business — regras da importação", () => {
  it("lê as 105 linhas do exemplo e agrupa em 97 viagens", () => {
    const r = parsed(); expect(r.linhasLidas).toBe(105); expect(agruparUber(r.viagens)).toHaveLength(97);
  });
  it("identifica os dois envios", () => expect(agruparUber(parsed().viagens).filter(v => v.envio)).toHaveLength(2));
  it("soma as transações em centavos, total R$ 2.716,80", () => {
    expect(agruparUber(parsed().viagens).reduce((s, v) => s + Math.round(v.valor * 100), 0)).toBe(271680);
  });
  it("interpreta MM/DD/AAAA: 11/03/2026 é 3 de novembro, sem UTC", () => expect(dataUber("11/03/2026")).toBe("2026-11-03"));
  it("mantém o intervalo 03/11/2026 a 26/11/2026", () => {
    const datas = agruparUber(parsed().viagens).map(v => v.data).sort(); expect(datas[0]).toBe("2026-11-03"); expect(datas.at(-1)).toBe("2026-11-26");
  });
  it("converte AM/PM para HH:mm incluindo meio-dia e meia-noite", () => {
    expect(horaUber("5:30AM")).toBe("05:30"); expect(horaUber("4:01PM")).toBe("16:01"); expect(horaUber("12:00AM")).toBe("00:00"); expect(horaUber("12:00PM")).toBe("12:00");
  });
  it("rejeita datas e horários inválidos", () => { expect(() => dataUber("02/30/2026")).toThrow(); expect(() => horaUber("13:30PM")).toThrow(); });
  it("aceita campos com ponto e vírgula e novas linhas entre aspas", () => {
    expect(parsed().viagens[0].origem).toBe("Origem fictícia; bloco 1"); expect(parsed().viagens[0].destino).toBe("Destino fictício\nBloco 2");
  });
  it("ignora colunas extras e mantém só o primeiro nome", () => {
    const v = parsed().viagens[0]; expect(v.responsavel).toBe("Jaina"); expect(Object.values(v)).not.toContain("não persistir");
  });
  it("identifica cabeçalhos por nome, sem acentos ou maiúsculas", () => {
    expect(lerUberCsv(csv.replace("Endereço de destino", "ENDERECO DE DESTINO"), "teste").linhasLidas).toBe(105);
  });
  it("não permite importar se falta coluna obrigatória", () => expect(() => lerUberCsv(csv.replace("Endereço de destino", "Outra coluna"), "teste")).toThrow("Endereço de destino"));
  it("ignora Payment antes de somar", () => {
    const h = "Data da solicitação (local);Hora da solicitação (local);Nome;Endereço de partida;Endereço de destino;Valor da transação: BRL;ID da viagem/Uber Eats;Serviço;Tipo de cancelamento;Tipo de transação";
    const r = lerUberCsv(`${h}\n11/03/2026;5:30AM;Jaina Setor;A;B;29.95;x;Uber;--;Charge\n11/03/2026;5:30AM;Jaina Setor;A;B;29.95;x;Uber;--;Payment`, "teste");
    expect(r.payments).toBe(1); expect(agruparUber(r.viagens)[0].valor).toBe(29.95);
  });
  it("agrupa por ID preservando dados da primeira linha e marca cancelamento", () => {
    const v = parsed().viagens[0]; const agrupadas = agruparUber([v, { ...v, valor: 0.05, origem: "Outro", cancelada: true }]);
    expect(agrupadas).toHaveLength(1); expect(agrupadas[0].origem).toBe(v.origem); expect(agrupadas[0].valor).toBe((Math.round(v.valor * 100) + 5) / 100); expect(agrupadas[0].cancelada).toBe(true);
  });
  it("não seleciona viagens já importadas e não altera corridas existentes", () => {
    const v = agruparUber(parsed().viagens)[0]; const existentes = [{ uber_trip_id: v.uber_trip_id, data: v.data, horario: v.horario, valor: v.valor }]; const antes = JSON.stringify(existentes);
    const r = conferirUber([v], existentes, ["Jaina Oliveira"])[0]; expect(r.jaExiste).toBe(true); expect(r.selecionada).toBe(false); expect(JSON.stringify(existentes)).toBe(antes);
  });
  it("desmarca possível duplicata por data, hora e valor inclusive horário do banco com segundos", () => {
    const v = agruparUber(parsed().viagens)[0]; const r = conferirUber([v], [{ data: v.data, horario: `${v.horario}:00`, valor: v.valor }], [])[0]; expect(r.possivelDuplicata).toBe(true); expect(r.selecionada).toBe(false);
  });
  it("deixa envios desmarcados e usa Envio de Material", () => {
    const v = conferirUber(agruparUber(parsed().viagens), [], []).filter(r => r.envio); expect(v).toHaveLength(2); expect(v.every(r => !r.selecionada && r.motivo === "Envio de Material")).toBe(true);
  });
  it("casa responsável pelo primeiro nome sem acentos, não usa setor e não escolhe casos ambíguos", () => {
    expect(casarResponsavel("JÁINA Departamento", ["Jaina Oliveira"])).toBe("Jaina Oliveira"); expect(casarResponsavel("Jaina", ["Jaina Oliveira", "Jaina Souza"])).toBe("");
  });
  it("mantém pendente sem colaborador; completar o campo obrigatório resolve", () => {
    const r = conferirUber([agruparUber(parsed().viagens)[0]], [], [])[0]; expect(pendenciasUber(r)).toEqual(["Colaborador"]); expect(pendenciasUber({ ...r, colaborador: "Passageiro cadastrado" })).toEqual([]);
  });
});
import { casarResponsavel as casarR } from "@/lib/uber-business-csv";
describe("responsável na importação Uber", () => {
  const lista = ["Jaina", "Jaina Oliveira", "Mayara Meireles", "Márcia Ribeiro", "Niccolli Victória"];
  it("casa pelo primeiro nome com o nome completo", () => {
    expect(casarR("Jaina", lista)).toBe("Jaina Oliveira");
    expect(casarR("Marcia", lista)).toBe("Márcia Ribeiro");
    expect(casarR("NICCOLLI", lista)).toBe("Niccolli Victória");
  });
  it("não escolhe quando há dois com o mesmo primeiro nome", () => {
    expect(casarR("Márcia", [...lista, "Márcia Tereza"])).toBe("");
  });
  it("deixa vazio quando ninguém tem o primeiro nome", () => {
    expect(casarR("Carla", lista)).toBe("");
  });
});

import { RESPONSAVEIS_UBER, conferirUber as conf } from "@/lib/uber-business-csv";
describe("lista fixa de responsáveis Uber", () => {
  it("Márcia vai para Márcia Ribeiro mesmo existindo outra Márcia fora da lista", () => {
    expect(casarR("Marcia", RESPONSAVEIS_UBER)).toBe("Márcia Ribeiro");
    expect(casarR("Mayara")).toBe("Mayara Meireles");
  });
  it("Nome nunca vira colaborador", () => {
    const [l] = conf([{ uber_trip_id: "t1", data: "2026-11-03", horario: "10:00", responsavel: "Jaina", setor_solicitante: "Rel", origem: "a", destino: "b", valor: 10, cancelada: false, envio: false, arquivos: [] } as never], [], RESPONSAVEIS_UBER);
    expect(l.colaborador).toBe(""); expect(l.passageiro_id).toBeNull(); expect(l.responsavel).toBe("Jaina Oliveira");
  });
});
