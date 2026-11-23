// Meses em que a Coleta de PSA pode ser agendada (0 = janeiro).
// Novembro Azul (10) e dezembro (11).
export const PSA_MESES = [10, 11] as const;

export function psaMesPermitido(d: Date): boolean {
  return (PSA_MESES as readonly number[]).includes(d.getMonth());
}
