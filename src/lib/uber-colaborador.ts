// Unificação apenas para exibição nos relatórios do Uber. Nunca altera o histórico.
const ALIAS: Record<string, string> = {
  NICCOLLI: "NICCOLLI VICTÓRIA LOPES MACIEL VIEIRA",
  NICOLLI: "NICCOLLI VICTÓRIA LOPES MACIEL VIEIRA",
  "NICCOLLI VICTORIA LOPES MACIEL VIEIRA": "NICCOLLI VICTÓRIA LOPES MACIEL VIEIRA",
  THIAGO: "THIAGO GARCIA DOS REIS GUARLOTT",
  "THIAGO GARCIA DOS REIS GUARLOTT": "THIAGO GARCIA DOS REIS GUARLOTT",
  MARCIA: "MÁRCIA",
  "MARIA EDUARDO": "MARIA EDUARDA",
  "MARIA EDURADA": "MARIA EDUARDA",
  TAWNNI: "TAWNNY",
  THAWNNY: "TAWNNY",
  JOSEANE: "JOSIANE",
  LORENA: "LORENN",
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Chave sem prefixos (ENF., TEC., TEC. DE ENF.), acentos, caixa e espaços extras. */
export function chaveColaborador(nome: string | null | undefined): string {
  let s = semAcento(String(nome ?? "")).toUpperCase().replace(/\s+/g, " ").trim();
  s = s.replace(/^(TEC[.,]?\s*DE\s+ENF[A]?[.,]?|ENF[A]?[.,]?|TEC[.,]?)\s*/, "").trim();
  s = s.replace(/\s*-\s.*$/, "").trim(); // "TEC. THIAGO - Entrega de material..."
  return s;
}

export function nomeUnificadoColaborador(nome: string | null | undefined): string {
  const k = chaveColaborador(nome);
  if (!k) return String(nome ?? "").trim();
  return ALIAS[k] ?? k;
}
