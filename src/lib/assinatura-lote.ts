export type StatusLote = "concluido" | "parcial" | "falhou";

export const ROTULO_STATUS_LOTE: Record<StatusLote, string> = {
  concluido: "Concluído",
  parcial: "Concluído com falhas",
  falhou: "Falhou",
};

export function statusLote(total: number, sucesso: number): StatusLote {
  if (total > 0 && sucesso >= total) return "concluido";
  if (sucesso <= 0) return "falhou";
  return "parcial";
}

/** Executa em paralelo com limite, preservando a ordem do resultado. */
export async function emParalelo<T, R>(itens: T[], limite: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(itens.length);
  let prox = 0;
  const trab = async () => {
    while (prox < itens.length) { const i = prox++; out[i] = await fn(itens[i], i); }
  };
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trab));
  return out;
}

/** Duas posições são "a mesma" quando ficam na mesma página e a menos de 3% de distância. */
export function posicoesParecidas(a: { pagina: number; x: number; y: number }, b: { pagina: number; x: number; y: number }, tol = 0.03) {
  return a.pagina === b.pagina && Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
}
