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

export interface Feriado {
  date: Date;
  nome: string;
}

const cache = new Map<number, Feriado[]>();

export function feriadosDoAno(year: number): Feriado[] {
  if (cache.has(year)) return cache.get(year)!;
  const pa = pascoa(year);
  const list: Feriado[] = [
    { date: new Date(year, 0, 1), nome: "Confraternização Universal" },
    { date: addDays(pa, -48), nome: "Carnaval (segunda)" },
    { date: addDays(pa, -47), nome: "Carnaval (terça)" },
    { date: addDays(pa, -2), nome: "Sexta-feira Santa" },
    { date: pa, nome: "Páscoa" },
    { date: new Date(year, 3, 21), nome: "Tiradentes" },
    { date: new Date(year, 4, 1), nome: "Dia do Trabalho" },
    { date: addDays(pa, 60), nome: "Corpus Christi" },
    { date: new Date(year, 8, 7), nome: "Independência" },
    { date: new Date(year, 9, 12), nome: "N. Sra. Aparecida" },
    { date: new Date(year, 10, 2), nome: "Finados" },
    { date: new Date(year, 10, 15), nome: "Proclamação da República" },
    { date: new Date(year, 10, 20), nome: "Consciência Negra" },
    { date: new Date(year, 11, 25), nome: "Natal" },
  ];
  cache.set(year, list);
  return list;
}

export function feriadoEm(d: Date): Feriado | null {
  const yr = d.getFullYear();
  const key = d.toDateString();
  return feriadosDoAno(yr).find((f) => f.date.toDateString() === key) ?? null;
}
