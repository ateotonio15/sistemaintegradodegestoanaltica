import * as XLSX from "xlsx";

export interface ResumoVidasContrato { titulares: number; dependentes: number; total: number; modulos: { nome: string; qtd: number }[] }

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_.\-/]+/g, " ").replace(/\s+/g, " ").trim();
const COL_TIPO = ["tipo", "titularidade", "parentesco", "grau parentesco", "grau de parentesco", "tipo beneficiario", "tipo de beneficiario", "tp beneficiario", "dependencia"];
const COL_MOD = ["modulo", "modulos", "plano", "nome plano", "ds plano", "descricao plano", "produto", "nome produto"];

/** Conta titulares, dependentes e módulos no relatório de vidas (Excel) de um contrato. */
export function resumirVidasRelatorio(buffer: ArrayBuffer): ResumoVidasContrato | null {
  const wb = XLSX.read(buffer, { type: "array" });
  for (const aba of wb.SheetNames) {
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[aba], { header: 1, blankrows: false, raw: true });
    for (let h = 0; h < Math.min(20, linhas.length); h++) {
      const cab = (linhas[h] ?? []).map(norm);
      const cNome = cab.findIndex((c) => ["beneficiario", "nome", "nome beneficiario", "nome do beneficiario"].includes(c) || c === "cpf");
      if (cNome < 0) continue;
      const cTipo = cab.findIndex((c) => COL_TIPO.includes(c));
      const cMod = cab.findIndex((c) => COL_MOD.includes(c));
      let titulares = 0, dependentes = 0;
      const mods = new Map<string, number>();
      for (const l of linhas.slice(h + 1)) {
        if (!String(l?.[cNome] ?? "").trim()) continue;
        const t = norm(l?.[cTipo]);
        if (cTipo >= 0 && (t.includes("titular") || t === "t")) titulares++; else dependentes++;
        if (cMod >= 0) { const m = String(l?.[cMod] ?? "").trim() || "Sem módulo"; mods.set(m, (mods.get(m) ?? 0) + 1); }
      }
      if (cTipo < 0) { titulares += dependentes; dependentes = 0; }
      return { titulares, dependentes, total: titulares + dependentes, modulos: [...mods].map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd) };
    }
  }
  return null;
}

/** Junta contratos da mesma Administradora pelo nome. */
export function agruparPorAdministradora<T extends { nome: string }>(lista: T[]): { nome: string; itens: T[] }[] {
  const m = new Map<string, { nome: string; itens: T[] }>();
  for (const e of lista) { const k = norm(e.nome); if (!m.has(k)) m.set(k, { nome: e.nome, itens: [] }); m.get(k)!.itens.push(e); }
  return [...m.values()];
}
