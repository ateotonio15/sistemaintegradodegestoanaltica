// Feriados nacionais BR (datas fixas + móveis baseadas na Páscoa)
import { addDays } from "date-fns";

function pascoa(year: number): Date {
  // Algoritmo de Meeus/Jones/Butcher
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31);
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export type FeriadoTipo = "Nacional" | "Estadual" | "Municipal" | "Facultativo";

export interface Feriado {
  date: Date;
  nome: string;
  tipo: FeriadoTipo;
}

const cache = new Map<number, Feriado[]>();

export function feriadosDoAno(year: number): Feriado[] {
  if (cache.has(year)) return cache.get(year)!;
  const pa = pascoa(year);
  const list: Feriado[] = [
    // Nacionais — fixos
    { date: new Date(year, 0, 1), nome: "Confraternização Universal", tipo: "Nacional" },
    { date: new Date(year, 3, 21), nome: "Tiradentes", tipo: "Nacional" },
    { date: new Date(year, 4, 1), nome: "Dia do Trabalhador", tipo: "Nacional" },
    { date: new Date(year, 8, 7), nome: "Independência do Brasil", tipo: "Nacional" },
    { date: new Date(year, 9, 12), nome: "Nossa Senhora Aparecida", tipo: "Nacional" },
    { date: new Date(year, 10, 2), nome: "Finados", tipo: "Nacional" },
    { date: new Date(year, 10, 15), nome: "Proclamação da República", tipo: "Nacional" },
    { date: new Date(year, 10, 20), nome: "Consciência Negra", tipo: "Nacional" },
    { date: new Date(year, 11, 25), nome: "Natal", tipo: "Nacional" },
    // Nacionais — móveis
    { date: addDays(pa, -2), nome: "Sexta-feira Santa", tipo: "Nacional" },
    { date: pa, nome: "Domingo de Páscoa", tipo: "Nacional" },
    { date: addDays(pa, 60), nome: "Corpus Christi", tipo: "Nacional" },
    // Estadual (AM)
    { date: new Date(year, 8, 5), nome: "Elevação do Amazonas à Província", tipo: "Estadual" },
    // Municipais (Manaus)
    { date: new Date(year, 9, 24), nome: "Aniversário de Manaus", tipo: "Municipal" },
    { date: new Date(year, 11, 8), nome: "Nossa Senhora da Conceição (Padroeira de Manaus)", tipo: "Municipal" },
  ];
  cache.set(year, list);
  return list;
}

export function feriadoEm(d: Date): Feriado | null {
  const yr = d.getFullYear();
  const key = d.toDateString();
  return feriadosDoAno(yr).find((f) => f.date.toDateString() === key) ?? null;
}
