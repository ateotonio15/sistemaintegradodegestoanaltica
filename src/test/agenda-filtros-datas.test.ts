import { describe, it, expect } from "vitest";
import { montarFiltrosAgenda, montarQueryListagem, type FormularioAgenda } from "@/lib/agendaCirurgicaApi";

const form: FormularioAgenda = {
  ini: "2026-10-30",
  fim: "2026-10-30",
  nm_paciente: "Maria",
  nm_empresa: "",
  ie_status_agenda: "N",
  cd_agenda: "",
  cd_medico: "",
  cd_convenio: "",
  ignorar_datas: false,
};

describe("filtro 'Ignorar datas' da Agenda Cirúrgica", () => {
  it("sem ignorar, envia o período no formato DD/MM/AAAA", () => {
    expect(montarFiltrosAgenda(form)).toMatchObject({ dt_inicio: "30/10/2026", dt_fim: "30/10/2026" });
  });

  it("com 'ignorar datas' marcado, nenhum período é enviado", () => {
    const f = montarFiltrosAgenda({ ...form, ignorar_datas: true });
    expect(f.dt_inicio).toBe("");
    expect(f.dt_fim).toBe("");
    // os demais filtros continuam valendo
    expect(f.nm_paciente).toBe("Maria");
    expect(f.ie_status_agenda).toBe("N");
  });

  it("a consulta montada não carrega dt_inicio nem dt_fim quando as datas são ignoradas", () => {
    const q = montarQueryListagem(montarFiltrosAgenda({ ...form, ignorar_datas: true }));
    expect(q).not.toContain("dt_inicio");
    expect(q).not.toContain("dt_fim");
    expect(q).toContain("nm_paciente=Maria");
    expect(q).toContain("ie_status_agenda=N");
  });

  it("a consulta montada mantém as datas quando elas não são ignoradas", () => {
    const q = montarQueryListagem(montarFiltrosAgenda(form));
    expect(q).toContain("dt_inicio=30%2F10%2F2026");
    expect(q).toContain("dt_fim=30%2F10%2F2026");
  });

  it("usa a mesma paginação dos dois modos", () => {
    expect(montarFiltrosAgenda(form)).toMatchObject({ page: 1, limit: 50 });
    expect(montarFiltrosAgenda(form, { page: 3, limit: 500 })).toMatchObject({ page: 3, limit: 500 });
  });
});
