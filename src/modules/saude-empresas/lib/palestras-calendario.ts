// Programação anual — Gestantes e Campanhas mensais

export const GESTANTES_2026: Record<number, string> = {
  0: "Boas-vindas à gestação",
  1: "Hidratação e alimentação na gestação",
  2: "Importância do pré-natal",
  3: "Vacinação na gestação",
  4: "Rede de apoio à gestante",
  5: "Vínculo com o bebê antes do nascimento",
  6: "Primeiros cuidados com o bebê",
  7: "Amamentação",
  8: "Saúde mental na gestação",
  9: "Preparo do corpo para o parto",
  10: "Pós-parto e autocuidado",
  11: "Primeiros socorros com o recém-nascido",
};

export interface CampanhaMes {
  cor: string;
  hex: string;
  tema: string;
}

export const CAMPANHAS: Record<number, CampanhaMes> = {
  0: { cor: "Branco", hex: "#f8fafc", tema: "Saúde Mental" },
  1: { cor: "Roxo", hex: "#7c3aed", tema: "Conscientização sobre a Fibromialgia" },
  2: { cor: "Lilás / Amarelo", hex: "#c084fc", tema: "Endometriose e Câncer de Colo do Útero" },
  3: { cor: "Verde", hex: "#16a34a", tema: "Dia Mundial da Saúde" },
  4: { cor: "Roxo", hex: "#7c3aed", tema: "Doenças Dermatológicas" },
  5: { cor: "Vermelho", hex: "#dc2626", tema: "Doação de Sangue" },
  6: { cor: "Amarelo", hex: "#eab308", tema: "Hepatites Virais" },
  7: { cor: "Dourado", hex: "#ca8a04", tema: "Aleitamento Materno" },
  8: { cor: "Amarelo", hex: "#eab308", tema: "Prevenção ao Suicídio" },
  9: { cor: "Rosa", hex: "#ec4899", tema: "Câncer de Mama" },
  10: { cor: "Azul", hex: "#2563eb", tema: "Câncer de Próstata / Saúde do Homem" },
  11: { cor: "Vermelho", hex: "#dc2626", tema: "Prevenção às IST's" },
};

export const MESES_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
