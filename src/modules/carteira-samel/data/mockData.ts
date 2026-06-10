export type GrupoTamanho = "≥500" | "100-499" | "30-99";

export interface EmpresaCarteira {
  id: string;
  nome: string;
  contrato: string;
  vigenciaInicio: string; // ISO yyyy-mm-dd
  vidas: number;
  reajusteMes: number;
  reajusteValor: number;
  origemDado: "Manual" | "Importado";
  grupoTamanho: GrupoTamanho;
  inativa?: boolean;
  motivoInativacao?: string;
  dataInativacao?: string;
}

const today = new Date();
const yyyy = today.getFullYear();

export const mockEmpresas: EmpresaCarteira[] = [
  { id: "e1", nome: "INDÚSTRIAS ALPHA LTDA", contrato: "1001", vigenciaInicio: `${yyyy - 3}-03-15`, vidas: 820, reajusteMes: 3, reajusteValor: 12.4, origemDado: "Importado", grupoTamanho: "≥500" },
  { id: "e2", nome: "BETA TRANSPORTES S/A", contrato: "1002", vigenciaInicio: `${yyyy - 2}-07-01`, vidas: 350, reajusteMes: 7, reajusteValor: 9.8, origemDado: "Manual", grupoTamanho: "100-499" },
  { id: "e3", nome: "GAMMA SERVIÇOS EIRELI", contrato: "1003", vigenciaInicio: `${yyyy - 1}-11-20`, vidas: 65, reajusteMes: 11, reajusteValor: 14.5, origemDado: "Manual", grupoTamanho: "30-99" },
  { id: "e4", nome: "DELTA ALIMENTOS LTDA", contrato: "1004", vigenciaInicio: `${yyyy - 4}-01-10`, vidas: 1200, reajusteMes: 1, reajusteValor: 8.2, origemDado: "Importado", grupoTamanho: "≥500" },
  { id: "e5", nome: "EPSILON CONSTRUTORA", contrato: "1005", vigenciaInicio: `${yyyy - 2}-05-05`, vidas: 240, reajusteMes: 5, reajusteValor: 11.0, origemDado: "Manual", grupoTamanho: "100-499" },
  { id: "e6", nome: "ZETA TECH SOLUTIONS", contrato: "1006", vigenciaInicio: `${yyyy - 1}-09-01`, vidas: 92, reajusteMes: 9, reajusteValor: 13.7, origemDado: "Importado", grupoTamanho: "30-99" },
  { id: "e7", nome: "ETA LOGÍSTICA", contrato: "1007", vigenciaInicio: `${yyyy - 5}-06-12`, vidas: 540, reajusteMes: 6, reajusteValor: 10.1, origemDado: "Manual", grupoTamanho: "≥500" },
  { id: "e8", nome: "THETA SAÚDE OCUPACIONAL", contrato: "1008", vigenciaInicio: `${yyyy - 3}-02-28`, vidas: 178, reajusteMes: 2, reajusteValor: 9.5, origemDado: "Manual", grupoTamanho: "100-499" },
  { id: "e9", nome: "IOTA MINERAÇÃO", contrato: "1009", vigenciaInicio: `${yyyy - 2}-10-01`, vidas: 980, reajusteMes: 10, reajusteValor: 15.2, origemDado: "Importado", grupoTamanho: "≥500" },
  { id: "e10", nome: "KAPPA EDUCAÇÃO", contrato: "1010", vigenciaInicio: `${yyyy - 1}-04-18`, vidas: 145, reajusteMes: 4, reajusteValor: 7.9, origemDado: "Manual", grupoTamanho: "100-499" },
  { id: "e11", nome: "LAMBDA VAREJO", contrato: "1011", vigenciaInicio: `${yyyy - 4}-08-22`, vidas: 47, reajusteMes: 8, reajusteValor: 12.0, origemDado: "Manual", grupoTamanho: "30-99" },
  { id: "e12", nome: "MU INDÚSTRIA QUÍMICA", contrato: "1012", vigenciaInicio: `${yyyy - 3}-12-05`, vidas: 760, reajusteMes: 12, reajusteValor: 16.4, origemDado: "Importado", grupoTamanho: "≥500" },
];
