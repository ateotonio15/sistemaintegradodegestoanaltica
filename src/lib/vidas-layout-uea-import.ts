import * as XLSX from "xlsx";
import { idadeEm, soDigitos, toISODateLocal } from "@/lib/dependentes-uea";

/**
 * Leitura do Layout de Vidas para o módulo Dependentes UEA.
 *
 * A relação familiar é identificada pela carteirinha: o último dígito indica a
 * ordem (0 = titular, 1..n = dependentes) e os dígitos anteriores formam a
 * BASE da família. O arquivo original nunca é alterado — a regra serve apenas
 * para interpretar, filtrar e vincular os registros na importação.
 */

export interface VidaLinha {
  linha: number;
  carteirinha: string;
  nome: string;
  cpf: string | null;
  data_nascimento: string | null;
  idade: number | null;
  parentesco: string | null;
  situacao: string | null;
  contrato: string | null;
  matricula: string | null;
}

export interface FamiliaUeaImport {
  base: string;
  titular: VidaLinha;
  dependentes: VidaLinha[];
}

export interface InconsistenciaImport {
  linha: number;
  carteirinha: string;
  nome: string;
  motivo: string;
}

export interface ResultadoLeituraVidas {
  familias: FamiliaUeaImport[];
  /** Titulares ignorados por não possuírem nenhum dependente na mesma base. */
  titularesSemDependentes: VidaLinha[];
  inconsistencias: InconsistenciaImport[];
  totalLinhas: number;
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();

function acharCol(headers: string[], alvos: string[]): number {
  for (const alvo of alvos) {
    const i = headers.findIndex((h) => h === alvo);
    if (i >= 0) return i;
  }
  for (const alvo of alvos) {
    const i = headers.findIndex((h) => h.includes(alvo));
    if (i >= 0) return i;
  }
  return -1;
}

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return toISODateLocal(v);
  if (typeof v === "object" && "text" in (v as any)) return String((v as any).text ?? "");
  return String(v).trim();
}

function parseData(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return toISODateLocal(v);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    return null;
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

/** Separa a carteirinha em base (família) e sequência (0 = titular). */
export function separarCarteirinha(carteirinha: string): { base: string; seq: number } | null {
  const d = soDigitos(carteirinha);
  if (d.length < 4) return null;
  const seq = Number(d.slice(-1));
  if (!Number.isFinite(seq)) return null;
  return { base: d.slice(0, -1), seq };
}

export async function lerLayoutVidasUea(file: File): Promise<ResultadoLeituraVidas> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });

  let melhor: { linhas: VidaLinha[]; total: number } | null = null;

  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome];
    if (!ws) continue;
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, raw: true });
    if (matriz.length === 0) continue;

    const hIdx = matriz.findIndex((r) =>
      (r ?? []).some((c) => /carteirinha|cartao/i.test(String(c ?? ""))),
    );
    if (hIdx < 0) continue;
    const headers = (matriz[hIdx] ?? []).map(norm);

    const cCart = acharCol(headers, ["CARTEIRINHA", "CARTAO", "CARTAO IDENTIFICACAO"]);
    const cNome = acharCol(headers, ["NM BENEFICIARIO", "BENEFICIARIO", "NOME BENEFICIARIO", "NOME"]);
    const cCpf = acharCol(headers, ["CPF", "NR CPF"]);
    const cNasc = acharCol(headers, ["DT NASCIMENTO", "DATA NASCIMENTO", "NASCIMENTO"]);
    const cParent = acharCol(headers, ["GRAU PARENTESCO", "PARENTESCO"]);
    const cSit = acharCol(headers, ["DS SITUACAO ATUAL", "SITUACAO ATUAL", "SITUACAO", "STATUS"]);
    const cContrato = acharCol(headers, ["NR CONTRATO", "CONTRATO"]);
    const cMat = acharCol(headers, ["MATRICULA", "NR MATRICULA", "CD MATRICULA"]);
    const cIdade = acharCol(headers, ["IDADE"]);
    if (cCart < 0 || cNome < 0) continue;

    const linhas: VidaLinha[] = [];
    for (let i = hIdx + 1; i < matriz.length; i++) {
      const row = matriz[i] ?? [];
      const carteirinha = soDigitos(texto(row[cCart]));
      const nomeBenef = texto(row[cNome]);
      if (!carteirinha && !nomeBenef) continue;
      const nasc = cNasc >= 0 ? parseData(row[cNasc]) : null;
      const idadePlanilha = cIdade >= 0 ? Number(soDigitos(texto(row[cIdade]))) : NaN;
      linhas.push({
        linha: i + 1,
        carteirinha,
        nome: nomeBenef,
        cpf: cCpf >= 0 && soDigitos(texto(row[cCpf])).length === 11 ? soDigitos(texto(row[cCpf])) : null,
        data_nascimento: nasc,
        idade: nasc ? idadeEm(nasc) : Number.isFinite(idadePlanilha) && idadePlanilha > 0 ? idadePlanilha : null,
        parentesco: cParent >= 0 ? texto(row[cParent]) || null : null,
        situacao: cSit >= 0 ? texto(row[cSit]) || null : null,
        contrato: cContrato >= 0 ? texto(row[cContrato]) || null : null,
        matricula: cMat >= 0 ? texto(row[cMat]) || null : null,
      });
    }
    if (!melhor || linhas.length > melhor.total) melhor = { linhas, total: linhas.length };
  }

  if (!melhor) {
    return { familias: [], titularesSemDependentes: [], inconsistencias: [], totalLinhas: 0 };
  }

  return agruparPorCarteirinha(melhor.linhas);
}

/** Agrupa titulares (final 0) com seus dependentes (final 1..9) pela base da carteirinha. */
export function agruparPorCarteirinha(linhas: VidaLinha[]): ResultadoLeituraVidas {
  const inconsistencias: InconsistenciaImport[] = [];
  const titulares = new Map<string, VidaLinha>();
  const dependentes = new Map<string, VidaLinha[]>();
  const vistos = new Set<string>();

  for (const l of linhas) {
    if (!l.nome) {
      inconsistencias.push({
        linha: l.linha,
        carteirinha: l.carteirinha,
        nome: "—",
        motivo: "Beneficiário sem nome",
      });
      continue;
    }
    const partes = separarCarteirinha(l.carteirinha);
    if (!partes) {
      inconsistencias.push({
        linha: l.linha,
        carteirinha: l.carteirinha || "—",
        nome: l.nome,
        motivo: "Carteirinha ausente ou não identificável com segurança",
      });
      continue;
    }
    if (vistos.has(l.carteirinha)) {
      inconsistencias.push({
        linha: l.linha,
        carteirinha: l.carteirinha,
        nome: l.nome,
        motivo: "Carteirinha repetida no arquivo (registro ignorado)",
      });
      continue;
    }
    vistos.add(l.carteirinha);

    if (partes.seq === 0) {
      titulares.set(partes.base, l);
    } else {
      const atual = dependentes.get(partes.base) ?? [];
      atual.push(l);
      dependentes.set(partes.base, atual);
    }
  }

  const familias: FamiliaUeaImport[] = [];
  const titularesSemDependentes: VidaLinha[] = [];

  titulares.forEach((titular, base) => {
    const deps = (dependentes.get(base) ?? []).sort((a, b) =>
      a.carteirinha.localeCompare(b.carteirinha),
    );
    if (deps.length === 0) {
      titularesSemDependentes.push(titular);
      return;
    }
    familias.push({ base, titular, dependentes: deps });
  });

  // Dependentes cuja base não possui titular no arquivo: conferência manual.
  dependentes.forEach((deps, base) => {
    if (titulares.has(base)) return;
    deps.forEach((d) =>
      inconsistencias.push({
        linha: d.linha,
        carteirinha: d.carteirinha,
        nome: d.nome,
        motivo: "Dependente sem titular correspondente",
      }),
    );
  });

  familias.sort((a, b) => a.titular.nome.localeCompare(b.titular.nome, "pt-BR"));

  return {
    familias,
    titularesSemDependentes: titularesSemDependentes.sort((a, b) =>
      a.titular ? 0 : a.nome.localeCompare(b.nome, "pt-BR"),
    ),
    inconsistencias,
    totalLinhas: linhas.length,
  };
}

export interface ResumoImportacaoVidas {
  familias: number;
  titulares: number;
  dependentes: number;
  ignorados: number;
  inconsistencias: number;
}

export function resumoImportacao(r: ResultadoLeituraVidas): ResumoImportacaoVidas {
  return {
    familias: r.familias.length,
    titulares: r.familias.length,
    dependentes: r.familias.reduce((acc, f) => acc + f.dependentes.length, 0),
    ignorados: r.titularesSemDependentes.length,
    inconsistencias: r.inconsistencias.length,
  };
}
