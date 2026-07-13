// Dados consolidados de Julho/2026 fornecidos pela diretoria
// Servem como fallback quando o banco ainda não tem tudo registrado.

export interface ExecKpis {
  totalAcoes: number;
  empresasAtendidas: number;
  palestras: number;
  psa: number;
  sinaisVitais: number;
  coletasPreventivas: number;
  campanhasAtivas: number;
  mediaSemanal: number;
}

export interface CampanhaDist {
  nome: string;
  valor: number;
  cor: string;
}

export interface EmpresaTop {
  nome: string;
  acoes: number;
}

export interface TriagemMock {
  empresa: string;
  atendidos: number;
  pa_alta: number;
  gli_alta: number;
  imc_alto: number;
  tabagismo: number;
}

export const KPIS_JULHO_2026: ExecKpis = {
  totalAcoes: 30,
  empresasAtendidas: 22,
  palestras: 14,
  psa: 0,
  sinaisVitais: 16,
  coletasPreventivas: 0,
  campanhasAtivas: 3,
  mediaSemanal: 6,
};

export const CAMPANHAS_JULHO_2026: CampanhaDist[] = [
  { nome: "Sinais Vitais", valor: 16, cor: "#004d40" },
  { nome: "Hepatites Virais", valor: 12, cor: "#eab308" },
  { nome: "Palestras Gerais", valor: 2, cor: "#1b998b" },
];

export const ENGAJAMENTO_JULHO_2026 = [
  { nome: "Sinais Vitais", valor: 16, pct: 53.3, cor: "#004d40" },
  { nome: "Palestras", valor: 14, pct: 46.7, cor: "#1b998b" },
];

export const TOP_EMPRESAS_JULHO_2026: EmpresaTop[] = [
  { nome: "Nippon Seiki", acoes: 3 },
  { nome: "Klabin Amazonas", acoes: 2 },
  { nome: "Elgin Industrial", acoes: 2 },
  { nome: "PST Eletrônica", acoes: 2 },
  { nome: "TPV do Brasil", acoes: 2 },
  { nome: "Winlogis Gestão", acoes: 2 },
];

export const TRIAGEM_JULHO_2026: TriagemMock[] = [
  { empresa: "Nippon Seiki", atendidos: 48, pa_alta: 9, gli_alta: 4, imc_alto: 18, tabagismo: 6 },
  { empresa: "Klabin Amazonas", atendidos: 36, pa_alta: 7, gli_alta: 3, imc_alto: 14, tabagismo: 5 },
  { empresa: "Elgin Industrial", atendidos: 41, pa_alta: 8, gli_alta: 5, imc_alto: 16, tabagismo: 4 },
  { empresa: "PST Eletrônica", atendidos: 33, pa_alta: 5, gli_alta: 2, imc_alto: 11, tabagismo: 3 },
  { empresa: "TPV do Brasil", atendidos: 29, pa_alta: 4, gli_alta: 3, imc_alto: 10, tabagismo: 4 },
  { empresa: "Winlogis Gestão", atendidos: 22, pa_alta: 3, gli_alta: 1, imc_alto: 8, tabagismo: 2 },
];

// Outubro Rosa (demonstração)
export const OUTUBRO_ROSA = {
  mamografiasAgendadas: 128,
  mamografiasRealizadas: 94,
  engajamentoFeminino: 78.2,
  palestrasMulher: 9,
  empresas: 14,
  destaques: [
    { empresa: "Nippon Seiki", agendadas: 22, realizadas: 18 },
    { empresa: "Klabin Amazonas", agendadas: 18, realizadas: 14 },
    { empresa: "Elgin Industrial", agendadas: 16, realizadas: 11 },
    { empresa: "TPV do Brasil", agendadas: 12, realizadas: 9 },
  ],
};

// Novembro Azul (demonstração)
export const NOVEMBRO_AZUL = {
  psaRealizados: 186,
  triagemMasculina: 274,
  adesaoOperaria: 82.5,
  palestrasHomem: 11,
  empresas: 16,
  destaques: [
    { empresa: "Klabin Amazonas", psa: 42, triagem: 61 },
    { empresa: "Nippon Seiki", psa: 38, triagem: 55 },
    { empresa: "PST Eletrônica", psa: 27, triagem: 40 },
    { empresa: "Elgin Industrial", psa: 24, triagem: 38 },
  ],
};
