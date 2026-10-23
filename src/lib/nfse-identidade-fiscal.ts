/**
 * Conferência da identidade fiscal de uma NFS-e lida do próprio PDF contra os
 * metadados recebidos da Central. Hash e metadados corretos não bastam: os
 * campos obrigatórios precisam estar no conteúdo e coincidir exatamente.
 * Nome ou raiz do CNPJ nunca substituem o CNPJ completo.
 */
import { extrairTomador } from "./pdf-analysis-utils";

export interface IdentidadeEsperada {
  chaveAcesso: string | null;
  numeroNfse: string | null;
  cnpjPrestador: string | null;
  cnpjTomador: string | null;
  /** Instante de emissão informado (ISO com fuso). */
  emitidaEm: string | null;
}
export type SituacaoCampo = "confere" | "divergente" | "ausente" | "nao_informado";
export interface CampoIdentidade { situacao: SituacaoCampo; lido: string | null; esperado: string | null }
export interface IdentidadeFiscal {
  ok: boolean;
  /** "divergencia" se algum campo diverge; "validacao_inconclusiva" se falta algum obrigatório. */
  estado: "ok" | "divergencia" | "validacao_inconclusiva";
  campos: { chave_acesso: CampoIdentidade; numero: CampoIdentidade; cnpj_prestador: CampoIdentidade; cnpj_tomador: CampoIdentidade; emissao: CampoIdentidade };
  /** Competência declarada na nota: apenas registrada, nunca usada como emissão nem para escolher destino. */
  competenciaNota: string | null;
  motivos: string[];
}

const dig = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const sem0 = (s: string) => s.replace(/^0+(?=\d)/, "");
const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u00a0/g, " ");

export function lerChave(t: string): string | null {
  const m = norm(t).match(/chave\s+de\s+acesso(?:\s+da\s+nfs-?e)?[^\d]{0,40}((?:\d[\s.]?){44,60})/i);
  const d = m ? dig(m[1]) : "";
  return d.length >= 44 ? d : null;
}
export function lerNumero(t: string): string | null {
  const m = norm(t).match(/n(?:u|ú)?mero\s*d[ao]?\s*nfs[\s-]?e[^\d]{0,20}(\d{1,15})/i);
  return m ? sem0(m[1]) : null;
}
export function lerPrestador(t: string): string | null {
  const n = norm(t);
  const ini = n.search(/(emitente\s+da\s+nfs-?e|prestador\s+(?:d[oe]s?\s+)?servi[cç]os?)/i);
  if (ini < 0) return null;
  const resto = n.slice(ini);
  const fim = resto.search(/tomador/i);
  const trecho = fim > 0 ? resto.slice(0, fim) : resto.slice(0, 1500);
  const m = trecho.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  return m ? dig(m[1]) : null;
}
/** Data (DD/MM/AAAA) e hora opcional da emissão. Competência é lida à parte. */
export function lerEmissao(t: string): { data: string; hora: string | null } | null {
  const m = norm(t).match(/(?:data\s+e\s+hora\s+d[ae]\s+emissao|data\s+d[ae]\s+emissao|emitida\s+em)(?:\s+da\s+nfs-?e)?[^\d]{0,30}(\d{2})\/(\d{2})\/(\d{4})(?:[^\d\n]{1,5}(\d{2}:\d{2}(?::\d{2})?))?/i);
  return m ? { data: `${m[3]}-${m[2]}-${m[1]}`, hora: m[4] ?? null } : null;
}
export function lerCompetencia(t: string): string | null {
  const m = norm(t).match(/competencia(?:\s+da\s+nfs-?e)?[^\d]{0,20}(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4})/i);
  return m ? m[1] : null;
}
/** Data de emissão em Manaus (UTC-4) a partir do instante informado. */
export function dataManaus(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) return null;
  return new Date(t - 4 * 3600_000).toISOString().slice(0, 10);
}

export function conferirIdentidadeFiscal(texto: string, e: IdentidadeEsperada): IdentidadeFiscal {
  const motivos: string[] = [];
  const campo = (rotulo: string, lido: string | null, esperado: string | null, igual: (a: string, b: string) => boolean, obrigatorio = true): CampoIdentidade => {
    if (!esperado) { if (obrigatorio) motivos.push(`${rotulo}: não informado nos metadados.`); return { situacao: "nao_informado", lido, esperado }; }
    if (!lido) { if (obrigatorio) motivos.push(`${rotulo}: não encontrado ou ilegível no PDF.`); return { situacao: "ausente", lido, esperado }; }
    if (!igual(lido, esperado)) { motivos.push(`${rotulo}: PDF ${lido} × informado ${esperado}.`); return { situacao: "divergente", lido, esperado }; }
    return { situacao: "confere", lido, esperado };
  };
  const exato = (a: string, b: string) => a === b;
  const cnpj14 = (a: string, b: string) => a.length === 14 && a === b;
  const emi = lerEmissao(texto);
  const campos = {
    chave_acesso: campo("Chave de acesso", lerChave(texto), dig(e.chaveAcesso) || null, exato),
    numero: campo("Número da NFS-e", lerNumero(texto), e.numeroNfse ? sem0(dig(e.numeroNfse)) || null : null, exato),
    cnpj_prestador: campo("CNPJ do prestador", lerPrestador(texto), dig(e.cnpjPrestador) || null, cnpj14),
    cnpj_tomador: campo("CNPJ do tomador", extrairTomador(texto).cnpj, dig(e.cnpjTomador) || null, cnpj14),
    // Emissão: conferida quando legível no PDF; ausência não bloqueia, divergência bloqueia.
    emissao: campo("Data de emissão", emi?.data ?? null, dataManaus(e.emitidaEm), exato, false),
  };
  const vals = Object.values(campos);
  const divergente = vals.some((c) => c.situacao === "divergente");
  const faltando = [campos.chave_acesso, campos.numero, campos.cnpj_prestador, campos.cnpj_tomador].some((c) => c.situacao !== "confere");
  const estado = divergente ? "divergencia" : faltando ? "validacao_inconclusiva" : "ok";
  return { ok: estado === "ok", estado, campos, competenciaNota: lerCompetencia(texto), motivos };
}
