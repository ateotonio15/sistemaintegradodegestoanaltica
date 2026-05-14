export interface Beneficiario {
  CD_PESSOA_FISICA?: string | number;
  NM_BENEFICIARIO?: string;
  CARTEIRINHA?: string;
  IE_TITULAR_DEPENDENTE?: string;
  NM_TITULAR?: string;
  NR_SEQ_TITULAR?: string | number;
  DS_PLANO?: string;
  NM_ESTIPULANTE?: string;
  NM_SUBESTIPULANTE?: string;
  NR_CONTRATO?: string | number;
  NR_SEQ_CONTRATO?: string | number;
  DT_CONTRATO?: string;
  DS_CLASSIFICACAO?: string;
  DS_SITUACAO_ATUAL?: string;
  DT_ADESAO?: string;
  DT_RESCISAO?: string | null;
  MTV_RESCISAO?: string | null;
  DT_REATIVACAO?: string | null;
  IE_FUNCIONARIO?: string | null;
  IE_SUSPENSO?: string;
  DT_SUSPENSAO?: string | null;
  MTV_SUSPENSAO?: string | null;
  LOTE_SUSPENSAO?: string | number | null;
  CD_PAGADOR?: string | number;
  NM_PAGADOR?: string;
  DIA_VENCIMENTO?: string | number;
  CCO?: string;
  IE_CONTINUIDADE?: string;
  DT_INIC_CONTINUIDADE?: string | null;
  DT_LIMITE_CONTINUIDADE?: string | null;
  CORRETOR?: string;
  NR_SEQ_CORRETOR?: string | number;
  IDADE?: string | number;
  DT_NASCIMENTO?: string;
  IE_SEXO?: string;
  GRAU_PARENTESCO?: string;
  FAIXA_ETARIA?: string;
  [key: string]: any;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

export interface VidasFilters {
  page?: number;
  pageSize?: number;
  nr_contrato?: string;
  nm_estipulante?: string;
  ds_situacao_atual?: string;
  ie_titular_dependente?: string;
  nm_beneficiario?: string;
  carteirinha?: string;
  cd_pessoa_fisica?: string;
  ie_suspenso?: string;
  ds_plano?: string;
  nr_seq_titular?: string;
}
