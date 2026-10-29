import { formatDateBR } from "./date-utils";

export type EnvioRelatorio = { id: string; enviado_em: string; nome_remetente: string | null };
export function resumoEnviosRelatorio(envios: EnvioRelatorio[], dataEnvioEmpresa?: string | null) {
  const ordenados = [...envios].sort((a, b) => Date.parse(a.enviado_em) - Date.parse(b.enviado_em));
  const ultimo = ordenados.at(-1);
  return { envios: ordenados, ultimo, data: ultimo?.enviado_em ?? dataEnvioEmpresa ?? null, quantidade: ordenados.length };
}
export function formatarEnvioRelatorio(valor: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return formatDateBR(valor);
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime())) return "—";
  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Manaus" }).format(data);
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Manaus", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(data);
  return `${dia} às ${hora}`;
}