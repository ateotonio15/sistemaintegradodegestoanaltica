import * as XLSX from "xlsx";
import { normalizarCpf } from "@/lib/inclusoes-vigencia";

export interface VidaRelatorio { chave: string; cpf: string | null; nome: string | null }
export interface ComparacaoVidas { periodo: number; atualizado: number; entradas: VidaRelatorio[]; saidas: VidaRelatorio[] }

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_.\-/]+/g, " ").replace(/\s+/g, " ").trim();

/** Lê as vidas do relatório de vidas (Excel) do SIGA. Usa o CPF; sem coluna de CPF, usa o nome do beneficiário. */
export function lerVidasRelatorio(buffer: ArrayBuffer): VidaRelatorio[] {
  const wb = XLSX.read(buffer, { type: "array" });
  for (const aba of wb.SheetNames) {
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[aba], { header: 1, blankrows: false, raw: false });
    for (let h = 0; h < Math.min(20, linhas.length); h++) {
      const cab = (linhas[h] ?? []).map(norm);
      const cCpf = cab.findIndex((c) => c === "cpf" || c.startsWith("cpf ") || c === "nr cpf");
      const cNome = cab.findIndex((c) => ["beneficiario", "nome", "nome beneficiario", "nome do beneficiario"].includes(c));
      if (cCpf < 0 && cNome < 0) continue;
      const mapa = new Map<string, VidaRelatorio>();
      for (const l of linhas.slice(h + 1)) {
        const cpf = cCpf >= 0 ? normalizarCpf(String(l?.[cCpf] ?? "")) : null;
        const nome = cNome >= 0 ? String(l?.[cNome] ?? "").trim() || null : null;
        const chave = cpf ?? (nome ? `NOME:${norm(nome)}` : null);
        if (chave && !mapa.has(chave)) mapa.set(chave, { chave, cpf, nome });
      }
      return [...mapa.values()];
    }
  }
  return [];
}

/** Compara o relatório do período com o atualizado: quem entrou e quem saiu. */
export function compararVidas(periodo: VidaRelatorio[], atualizado: VidaRelatorio[]): ComparacaoVidas {
  const a = new Set(periodo.map((v) => v.chave));
  const b = new Set(atualizado.map((v) => v.chave));
  return {
    periodo: a.size,
    atualizado: b.size,
    entradas: atualizado.filter((v) => !a.has(v.chave)),
    saidas: periodo.filter((v) => !b.has(v.chave)),
  };
}
