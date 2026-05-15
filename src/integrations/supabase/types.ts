export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alertas_financeiro: {
        Row: {
          created_at: string
          data_envio: string
          empresa_id: string
          empresa_nome: string
          enviado_por_nome: string | null
          enviado_por_user_id: string | null
          finalizado_em: string | null
          id: string
          movimentacao_id: string
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_envio?: string
          empresa_id: string
          empresa_nome: string
          enviado_por_nome?: string | null
          enviado_por_user_id?: string | null
          finalizado_em?: string | null
          id?: string
          movimentacao_id: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_envio?: string
          empresa_id?: string
          empresa_nome?: string
          enviado_por_nome?: string | null
          enviado_por_user_id?: string | null
          finalizado_em?: string | null
          id?: string
          movimentacao_id?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      alertas_reajuste: {
        Row: {
          created_at: string
          criado_por_nome: string | null
          criado_por_user_id: string | null
          destinatario_user_id: string | null
          empresa_id: string
          empresa_nome: string
          finalizado_em: string | null
          id: string
          reajuste_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string | null
          destinatario_user_id?: string | null
          empresa_id: string
          empresa_nome: string
          finalizado_em?: string | null
          id?: string
          reajuste_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string | null
          destinatario_user_id?: string | null
          empresa_id?: string
          empresa_nome?: string
          finalizado_em?: string | null
          id?: string
          reajuste_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      anexos_financeiro: {
        Row: {
          created_at: string
          financeiro_movimentacao_id: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          origem: string
          storage_path: string
          tamanho_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          financeiro_movimentacao_id: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          origem?: string
          storage_path: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          financeiro_movimentacao_id?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          origem?: string
          storage_path?: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anexos_financeiro_financeiro_movimentacao_id_fkey"
            columns: ["financeiro_movimentacao_id"]
            isOneToOne: false
            referencedRelation: "financeiro_movimentacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      anexos_movimentacao: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          mime_type: string | null
          movimentacao_id: string
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          mime_type?: string | null
          movimentacao_id: string
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          mime_type?: string | null
          movimentacao_id?: string
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      cobrancas: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          financeiro_movimentacao_id: string
          id: string
          motivo: string
          observacao: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          financeiro_movimentacao_id: string
          id?: string
          motivo: string
          observacao?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          financeiro_movimentacao_id?: string
          id?: string
          motivo?: string
          observacao?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_financeiro_movimentacao_id_fkey"
            columns: ["financeiro_movimentacao_id"]
            isOneToOne: false
            referencedRelation: "financeiro_movimentacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas_retroativas: {
        Row: {
          competencia: string
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          financeiro_movimentacao_id: string | null
          id: string
          updated_at: string
          valor_centavos: number
        }
        Insert: {
          competencia: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          financeiro_movimentacao_id?: string | null
          id?: string
          updated_at?: string
          valor_centavos: number
        }
        Update: {
          competencia?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          financeiro_movimentacao_id?: string | null
          id?: string
          updated_at?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_retroativas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_retroativas_financeiro_movimentacao_id_fkey"
            columns: ["financeiro_movimentacao_id"]
            isOneToOne: false
            referencedRelation: "financeiro_movimentacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_suspensoes: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          empresa_id: string
          id: string
          motivo: string
          observacao: string | null
          reativado_por: string | null
          suspenso_por: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          empresa_id: string
          id?: string
          motivo: string
          observacao?: string | null
          reativado_por?: string | null
          suspenso_por?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          empresa_id?: string
          id?: string
          motivo?: string
          observacao?: string | null
          reativado_por?: string | null
          suspenso_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_suspensoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_usuarios: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_usuarios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      empresas: {
        Row: {
          cnpj: string | null
          codigo_contrato: string | null
          contato_empresa: string | null
          contrato_faixa_etaria: boolean
          contrato_suspenso: boolean
          created_at: string
          data_corte: number | null
          data_emissao_fatura: number | null
          data_implantacao: string | null
          data_rescisao: string | null
          data_suspensao: string | null
          data_vencimento_fatura: number | null
          dia_movimentacao: number | null
          email_empresa: string | null
          endereco: string | null
          executiva_user_id: string | null
          grupo_contrato: string | null
          id: string
          motivo_suspensao: string | null
          nome: string
          observacoes: string | null
          operadora_plano: string | null
          periodo_movimentacao: string | null
          prazo: string | null
          responsavel_contrato: string | null
          responsavel_user_id: string | null
          status_empresa: string | null
          telefone_empresa: string | null
          tipo_financeiro: string | null
          tipo_movimentacao: string | null
          updated_at: string
          vidas: number
        }
        Insert: {
          cnpj?: string | null
          codigo_contrato?: string | null
          contato_empresa?: string | null
          contrato_faixa_etaria?: boolean
          contrato_suspenso?: boolean
          created_at?: string
          data_corte?: number | null
          data_emissao_fatura?: number | null
          data_implantacao?: string | null
          data_rescisao?: string | null
          data_suspensao?: string | null
          data_vencimento_fatura?: number | null
          dia_movimentacao?: number | null
          email_empresa?: string | null
          endereco?: string | null
          executiva_user_id?: string | null
          grupo_contrato?: string | null
          id?: string
          motivo_suspensao?: string | null
          nome: string
          observacoes?: string | null
          operadora_plano?: string | null
          periodo_movimentacao?: string | null
          prazo?: string | null
          responsavel_contrato?: string | null
          responsavel_user_id?: string | null
          status_empresa?: string | null
          telefone_empresa?: string | null
          tipo_financeiro?: string | null
          tipo_movimentacao?: string | null
          updated_at?: string
          vidas?: number
        }
        Update: {
          cnpj?: string | null
          codigo_contrato?: string | null
          contato_empresa?: string | null
          contrato_faixa_etaria?: boolean
          contrato_suspenso?: boolean
          created_at?: string
          data_corte?: number | null
          data_emissao_fatura?: number | null
          data_implantacao?: string | null
          data_rescisao?: string | null
          data_suspensao?: string | null
          data_vencimento_fatura?: number | null
          dia_movimentacao?: number | null
          email_empresa?: string | null
          endereco?: string | null
          executiva_user_id?: string | null
          grupo_contrato?: string | null
          id?: string
          motivo_suspensao?: string | null
          nome?: string
          observacoes?: string | null
          operadora_plano?: string | null
          periodo_movimentacao?: string | null
          prazo?: string | null
          responsavel_contrato?: string | null
          responsavel_user_id?: string | null
          status_empresa?: string | null
          telefone_empresa?: string | null
          tipo_financeiro?: string | null
          tipo_movimentacao?: string | null
          updated_at?: string
          vidas?: number
        }
        Relationships: [
          {
            foreignKeyName: "empresas_responsavel_user_id_fkey"
            columns: ["responsavel_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      financeiro_analises: {
        Row: {
          analisado_por: string | null
          analisado_por_nome: string | null
          created_at: string
          data_analise: string
          divergencias: Json
          empresa_id: string
          financeiro_movimentacao_id: string | null
          hash_excel: string | null
          hash_pdf: string | null
          id: string
          mensagem_final: string | null
          mes_referencia: string
          nome_arquivo_excel: string | null
          nome_arquivo_pdf: string | null
          pagador_cnpj: string | null
          pagador_id: string | null
          pagador_nome: string | null
          periodo: string
          qtd_excel_apartamento: number | null
          qtd_excel_enfermaria: number | null
          qtd_pdf_apartamento: number | null
          qtd_pdf_enfermaria: number | null
          resultado_completo: Json | null
          status_analise: string
          tipo_analise: string | null
          updated_at: string
          valor_excel_apartamento: number | null
          valor_excel_enfermaria: number | null
          valor_excel_exclusoes: number | null
          valor_excel_inclusoes: number | null
          valor_pdf_apartamento: number | null
          valor_pdf_enfermaria: number | null
          valor_pdf_exclusoes: number | null
          valor_pdf_inclusoes: number | null
        }
        Insert: {
          analisado_por?: string | null
          analisado_por_nome?: string | null
          created_at?: string
          data_analise?: string
          divergencias?: Json
          empresa_id: string
          financeiro_movimentacao_id?: string | null
          hash_excel?: string | null
          hash_pdf?: string | null
          id?: string
          mensagem_final?: string | null
          mes_referencia: string
          nome_arquivo_excel?: string | null
          nome_arquivo_pdf?: string | null
          pagador_cnpj?: string | null
          pagador_id?: string | null
          pagador_nome?: string | null
          periodo: string
          qtd_excel_apartamento?: number | null
          qtd_excel_enfermaria?: number | null
          qtd_pdf_apartamento?: number | null
          qtd_pdf_enfermaria?: number | null
          resultado_completo?: Json | null
          status_analise?: string
          tipo_analise?: string | null
          updated_at?: string
          valor_excel_apartamento?: number | null
          valor_excel_enfermaria?: number | null
          valor_excel_exclusoes?: number | null
          valor_excel_inclusoes?: number | null
          valor_pdf_apartamento?: number | null
          valor_pdf_enfermaria?: number | null
          valor_pdf_exclusoes?: number | null
          valor_pdf_inclusoes?: number | null
        }
        Update: {
          analisado_por?: string | null
          analisado_por_nome?: string | null
          created_at?: string
          data_analise?: string
          divergencias?: Json
          empresa_id?: string
          financeiro_movimentacao_id?: string | null
          hash_excel?: string | null
          hash_pdf?: string | null
          id?: string
          mensagem_final?: string | null
          mes_referencia?: string
          nome_arquivo_excel?: string | null
          nome_arquivo_pdf?: string | null
          pagador_cnpj?: string | null
          pagador_id?: string | null
          pagador_nome?: string | null
          periodo?: string
          qtd_excel_apartamento?: number | null
          qtd_excel_enfermaria?: number | null
          qtd_pdf_apartamento?: number | null
          qtd_pdf_enfermaria?: number | null
          resultado_completo?: Json | null
          status_analise?: string
          tipo_analise?: string | null
          updated_at?: string
          valor_excel_apartamento?: number | null
          valor_excel_enfermaria?: number | null
          valor_excel_exclusoes?: number | null
          valor_excel_inclusoes?: number | null
          valor_pdf_apartamento?: number | null
          valor_pdf_enfermaria?: number | null
          valor_pdf_exclusoes?: number | null
          valor_pdf_inclusoes?: number | null
        }
        Relationships: []
      }
      financeiro_arquivos: {
        Row: {
          anexo_financeiro_id: string | null
          bucket: string
          categoria: string
          competencia: string
          created_at: string
          empresa_id: string
          extensao: string | null
          financeiro_movimentacao_id: string | null
          hash_arquivo: string | null
          id: string
          mime_type: string | null
          nome_armazenado: string
          nome_original: string
          observacao: string | null
          origem: string
          status: string
          storage_path: string
          tamanho_bytes: number | null
          updated_at: string
          uploaded_by: string | null
          uploaded_by_nome: string | null
          versao: number
          versao_de: string | null
        }
        Insert: {
          anexo_financeiro_id?: string | null
          bucket?: string
          categoria: string
          competencia: string
          created_at?: string
          empresa_id: string
          extensao?: string | null
          financeiro_movimentacao_id?: string | null
          hash_arquivo?: string | null
          id?: string
          mime_type?: string | null
          nome_armazenado: string
          nome_original: string
          observacao?: string | null
          origem?: string
          status?: string
          storage_path: string
          tamanho_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_nome?: string | null
          versao?: number
          versao_de?: string | null
        }
        Update: {
          anexo_financeiro_id?: string | null
          bucket?: string
          categoria?: string
          competencia?: string
          created_at?: string
          empresa_id?: string
          extensao?: string | null
          financeiro_movimentacao_id?: string | null
          hash_arquivo?: string | null
          id?: string
          mime_type?: string | null
          nome_armazenado?: string
          nome_original?: string
          observacao?: string | null
          origem?: string
          status?: string
          storage_path?: string
          tamanho_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_nome?: string | null
          versao?: number
          versao_de?: string | null
        }
        Relationships: []
      }
      financeiro_movimentacoes: {
        Row: {
          aguardando_nota_em: string | null
          cobranca_registrada: boolean
          created_at: string
          data_envio_nota: string | null
          data_prorrogacao: string | null
          data_vencimento: string | null
          dentro_prazo: boolean
          dia_emissao: number | null
          empresa_id: string
          enviado_por_user_id: string | null
          id: string
          mes_referencia: string
          motivo_prorrogacao: string | null
          observacao_prorrogacao: string | null
          observacoes: string | null
          periodo: string
          possui_prorrogacao: boolean
          responsavel: string | null
          tipo_analise: string
          tipo_cobranca: string | null
          updated_at: string
        }
        Insert: {
          aguardando_nota_em?: string | null
          cobranca_registrada?: boolean
          created_at?: string
          data_envio_nota?: string | null
          data_prorrogacao?: string | null
          data_vencimento?: string | null
          dentro_prazo?: boolean
          dia_emissao?: number | null
          empresa_id: string
          enviado_por_user_id?: string | null
          id?: string
          mes_referencia: string
          motivo_prorrogacao?: string | null
          observacao_prorrogacao?: string | null
          observacoes?: string | null
          periodo: string
          possui_prorrogacao?: boolean
          responsavel?: string | null
          tipo_analise?: string
          tipo_cobranca?: string | null
          updated_at?: string
        }
        Update: {
          aguardando_nota_em?: string | null
          cobranca_registrada?: boolean
          created_at?: string
          data_envio_nota?: string | null
          data_prorrogacao?: string | null
          data_vencimento?: string | null
          dentro_prazo?: boolean
          dia_emissao?: number | null
          empresa_id?: string
          enviado_por_user_id?: string | null
          id?: string
          mes_referencia?: string
          motivo_prorrogacao?: string | null
          observacao_prorrogacao?: string | null
          observacoes?: string | null
          periodo?: string
          possui_prorrogacao?: boolean
          responsavel?: string | null
          tipo_analise?: string
          tipo_cobranca?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_pagadores: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          empresa_id: string
          id: string
          nome_pagador: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nome_pagador: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome_pagador?: string
          updated_at?: string
        }
        Relationships: []
      }
      fora_prazo_exclusoes: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          mes_referencia: string
          motivo: string | null
          periodo: string
          removido_por: string | null
          removido_por_nome: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          mes_referencia: string
          motivo?: string | null
          periodo: string
          removido_por?: string | null
          removido_por_nome?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          mes_referencia?: string
          motivo?: string | null
          periodo?: string
          removido_por?: string | null
          removido_por_nome?: string | null
        }
        Relationships: []
      }
      implantacao_anexos: {
        Row: {
          created_at: string
          id: string
          implantacao_id: string
          mime_type: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
          tipo: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          implantacao_id: string
          mime_type?: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
          tipo?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          implantacao_id?: string
          mime_type?: string | null
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tipo?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      implantacao_logs: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          id: string
          implantacao_id: string
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          implantacao_id: string
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          implantacao_id?: string
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: []
      }
      implantacoes_contratos: {
        Row: {
          acomodacao: string | null
          cep: string | null
          cnpj: string | null
          codigo_contrato: string | null
          corretora: string | null
          created_at: string
          created_by: string | null
          created_by_nome: string | null
          data_corte: number | null
          data_vencimento: string | null
          data_vigencia: string | null
          dia_movimentacao: number | null
          empresa_id: string | null
          endereco: string | null
          etapa_atual: number
          faixas_etarias: Json | null
          grupo_contrato: string | null
          id: string
          inicio_atendimento: string | null
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          modalidade: string | null
          nome_empresa: string | null
          percentual_agenciamento: number | null
          percentual_vitalicio: number | null
          periodo_movimentacao: string | null
          relatorio_validacao: Json | null
          status: Database["public"]["Enums"]["implantacao_status"]
          telefone: string | null
          ticket: string | null
          ticket_auto_sync: boolean
          tipo_contrato: string | null
          total_vidas: number | null
          updated_at: string
          valor_apartamento_centavos: number | null
          valor_enfermaria_centavos: number | null
          vidas_dependentes: number | null
          vidas_titulares: number | null
        }
        Insert: {
          acomodacao?: string | null
          cep?: string | null
          cnpj?: string | null
          codigo_contrato?: string | null
          corretora?: string | null
          created_at?: string
          created_by?: string | null
          created_by_nome?: string | null
          data_corte?: number | null
          data_vencimento?: string | null
          data_vigencia?: string | null
          dia_movimentacao?: number | null
          empresa_id?: string | null
          endereco?: string | null
          etapa_atual?: number
          faixas_etarias?: Json | null
          grupo_contrato?: string | null
          id?: string
          inicio_atendimento?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          modalidade?: string | null
          nome_empresa?: string | null
          percentual_agenciamento?: number | null
          percentual_vitalicio?: number | null
          periodo_movimentacao?: string | null
          relatorio_validacao?: Json | null
          status?: Database["public"]["Enums"]["implantacao_status"]
          telefone?: string | null
          ticket?: string | null
          ticket_auto_sync?: boolean
          tipo_contrato?: string | null
          total_vidas?: number | null
          updated_at?: string
          valor_apartamento_centavos?: number | null
          valor_enfermaria_centavos?: number | null
          vidas_dependentes?: number | null
          vidas_titulares?: number | null
        }
        Update: {
          acomodacao?: string | null
          cep?: string | null
          cnpj?: string | null
          codigo_contrato?: string | null
          corretora?: string | null
          created_at?: string
          created_by?: string | null
          created_by_nome?: string | null
          data_corte?: number | null
          data_vencimento?: string | null
          data_vigencia?: string | null
          dia_movimentacao?: number | null
          empresa_id?: string | null
          endereco?: string | null
          etapa_atual?: number
          faixas_etarias?: Json | null
          grupo_contrato?: string | null
          id?: string
          inicio_atendimento?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          modalidade?: string | null
          nome_empresa?: string | null
          percentual_agenciamento?: number | null
          percentual_vitalicio?: number | null
          periodo_movimentacao?: string | null
          relatorio_validacao?: Json | null
          status?: Database["public"]["Enums"]["implantacao_status"]
          telefone?: string | null
          ticket?: string | null
          ticket_auto_sync?: boolean
          tipo_contrato?: string | null
          total_vidas?: number | null
          updated_at?: string
          valor_apartamento_centavos?: number | null
          valor_enfermaria_centavos?: number | null
          vidas_dependentes?: number | null
          vidas_titulares?: number | null
        }
        Relationships: []
      }
      movimentacoes: {
        Row: {
          created_at: string
          data_envio_empresa: string | null
          data_envio_financeiro: string | null
          data_retorno_empresa: string | null
          dentro_prazo: boolean | null
          empresa_id: string
          id: string
          mes_referencia: string
          observacoes: string | null
          periodo: string
          responsavel_movimentacao: string | null
          tipo_movimentacao: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_envio_empresa?: string | null
          data_envio_financeiro?: string | null
          data_retorno_empresa?: string | null
          dentro_prazo?: boolean | null
          empresa_id: string
          id?: string
          mes_referencia: string
          observacoes?: string | null
          periodo: string
          responsavel_movimentacao?: string | null
          tipo_movimentacao?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_envio_empresa?: string | null
          data_envio_financeiro?: string | null
          data_retorno_empresa?: string | null
          dentro_prazo?: boolean | null
          empresa_id?: string
          id?: string
          mes_referencia?: string
          observacoes?: string | null
          periodo?: string
          responsavel_movimentacao?: string | null
          tipo_movimentacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          codigo_contrato: string | null
          created_at: string
          data_implantacao: string | null
          empresa_id: string
          id: string
          nome_empresa: string
          responsavel_contrato: string | null
          tipo: string
        }
        Insert: {
          codigo_contrato?: string | null
          created_at?: string
          data_implantacao?: string | null
          empresa_id: string
          id?: string
          nome_empresa: string
          responsavel_contrato?: string | null
          tipo: string
        }
        Update: {
          codigo_contrato?: string | null
          created_at?: string
          data_implantacao?: string | null
          empresa_id?: string
          id?: string
          nome_empresa?: string
          responsavel_contrato?: string | null
          tipo?: string
        }
        Relationships: []
      }
      notificacoes_lidas: {
        Row: {
          created_at: string
          id: string
          notificacao_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notificacao_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notificacao_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_lidas_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "notificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      reajuste_faixas: {
        Row: {
          created_at: string
          id: string
          idade_final: number
          idade_inicial: number
          modalidade: string
          percentual: number
          reajuste_id: string
          updated_at: string
          valor_atual_centavos: number
          valor_final_centavos: number
          valor_reajustado_centavos: number
          valor_retroativo_centavos: number
        }
        Insert: {
          created_at?: string
          id?: string
          idade_final: number
          idade_inicial: number
          modalidade: string
          percentual?: number
          reajuste_id: string
          updated_at?: string
          valor_atual_centavos?: number
          valor_final_centavos?: number
          valor_reajustado_centavos?: number
          valor_retroativo_centavos?: number
        }
        Update: {
          created_at?: string
          id?: string
          idade_final?: number
          idade_inicial?: number
          modalidade?: string
          percentual?: number
          reajuste_id?: string
          updated_at?: string
          valor_atual_centavos?: number
          valor_final_centavos?: number
          valor_reajustado_centavos?: number
          valor_retroativo_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "reajuste_faixas_reajuste_id_fkey"
            columns: ["reajuste_id"]
            isOneToOne: false
            referencedRelation: "reajustes_anuais"
            referencedColumns: ["id"]
          },
        ]
      }
      reajustes: {
        Row: {
          competencia: string
          created_at: string
          created_by: string | null
          empresa_id: string
          financeiro_movimentacao_id: string | null
          id: string
          parcelas: number
          parcelas_aporte: number | null
          possui_aporte: boolean
          updated_at: string
          valor_aporte_centavos: number | null
          valor_centavos: number
        }
        Insert: {
          competencia: string
          created_at?: string
          created_by?: string | null
          empresa_id: string
          financeiro_movimentacao_id?: string | null
          id?: string
          parcelas: number
          parcelas_aporte?: number | null
          possui_aporte?: boolean
          updated_at?: string
          valor_aporte_centavos?: number | null
          valor_centavos: number
        }
        Update: {
          competencia?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          financeiro_movimentacao_id?: string | null
          id?: string
          parcelas?: number
          parcelas_aporte?: number | null
          possui_aporte?: boolean
          updated_at?: string
          valor_aporte_centavos?: number | null
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "reajustes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reajustes_financeiro_movimentacao_id_fkey"
            columns: ["financeiro_movimentacao_id"]
            isOneToOne: false
            referencedRelation: "financeiro_movimentacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      reajustes_anuais: {
        Row: {
          ano: number
          competencia: string | null
          confirmado_por: string | null
          confirmado_por_nome: string | null
          created_at: string
          data_aplicacao: string | null
          data_confirmacao: string | null
          data_liberacao: string | null
          empresa_id: string
          id: string
          liberado_por: string | null
          liberado_por_nome: string | null
          mes_reajuste: number | null
          meses_retroativos: number
          observacao: string | null
          percentual: number | null
          percentual_unico_apartamento: boolean
          percentual_unico_enfermaria: boolean
          possui_apartamento: boolean
          possui_enfermaria: boolean
          status: string
          status_reajuste: string
          updated_at: string
          usa_faixa_etaria_apartamento: boolean
          usa_faixa_etaria_enfermaria: boolean
          usuario_id: string | null
          usuario_nome: string | null
          valor_antigo_apartamento_centavos: number | null
          valor_antigo_centavos: number | null
          valor_antigo_enfermaria_centavos: number | null
          valor_final_apartamento_centavos: number
          valor_final_centavos: number
          valor_final_enfermaria_centavos: number
          valor_reajustado_apartamento_centavos: number | null
          valor_reajustado_centavos: number | null
          valor_reajustado_enfermaria_centavos: number | null
          valor_retroativo_apartamento_centavos: number
          valor_retroativo_centavos: number
          valor_retroativo_enfermaria_centavos: number
        }
        Insert: {
          ano: number
          competencia?: string | null
          confirmado_por?: string | null
          confirmado_por_nome?: string | null
          created_at?: string
          data_aplicacao?: string | null
          data_confirmacao?: string | null
          data_liberacao?: string | null
          empresa_id: string
          id?: string
          liberado_por?: string | null
          liberado_por_nome?: string | null
          mes_reajuste?: number | null
          meses_retroativos?: number
          observacao?: string | null
          percentual?: number | null
          percentual_unico_apartamento?: boolean
          percentual_unico_enfermaria?: boolean
          possui_apartamento?: boolean
          possui_enfermaria?: boolean
          status?: string
          status_reajuste?: string
          updated_at?: string
          usa_faixa_etaria_apartamento?: boolean
          usa_faixa_etaria_enfermaria?: boolean
          usuario_id?: string | null
          usuario_nome?: string | null
          valor_antigo_apartamento_centavos?: number | null
          valor_antigo_centavos?: number | null
          valor_antigo_enfermaria_centavos?: number | null
          valor_final_apartamento_centavos?: number
          valor_final_centavos?: number
          valor_final_enfermaria_centavos?: number
          valor_reajustado_apartamento_centavos?: number | null
          valor_reajustado_centavos?: number | null
          valor_reajustado_enfermaria_centavos?: number | null
          valor_retroativo_apartamento_centavos?: number
          valor_retroativo_centavos?: number
          valor_retroativo_enfermaria_centavos?: number
        }
        Update: {
          ano?: number
          competencia?: string | null
          confirmado_por?: string | null
          confirmado_por_nome?: string | null
          created_at?: string
          data_aplicacao?: string | null
          data_confirmacao?: string | null
          data_liberacao?: string | null
          empresa_id?: string
          id?: string
          liberado_por?: string | null
          liberado_por_nome?: string | null
          mes_reajuste?: number | null
          meses_retroativos?: number
          observacao?: string | null
          percentual?: number | null
          percentual_unico_apartamento?: boolean
          percentual_unico_enfermaria?: boolean
          possui_apartamento?: boolean
          possui_enfermaria?: boolean
          status?: string
          status_reajuste?: string
          updated_at?: string
          usa_faixa_etaria_apartamento?: boolean
          usa_faixa_etaria_enfermaria?: boolean
          usuario_id?: string | null
          usuario_nome?: string | null
          valor_antigo_apartamento_centavos?: number | null
          valor_antigo_centavos?: number | null
          valor_antigo_enfermaria_centavos?: number | null
          valor_final_apartamento_centavos?: number
          valor_final_centavos?: number
          valor_final_enfermaria_centavos?: number
          valor_reajustado_apartamento_centavos?: number | null
          valor_reajustado_centavos?: number | null
          valor_reajustado_enfermaria_centavos?: number | null
          valor_retroativo_apartamento_centavos?: number
          valor_retroativo_centavos?: number
          valor_retroativo_enfermaria_centavos?: number
        }
        Relationships: []
      }
      saude_agendamentos: {
        Row: {
          created_at: string
          data: string
          empresa_id: string
          endereco_empresa: string | null
          enfermeira_user_id: string
          hora_fim: string
          hora_inicio: string
          id: string
          observacao: string | null
          status: string
          tipo_palestra: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          empresa_id: string
          endereco_empresa?: string | null
          enfermeira_user_id: string
          hora_fim: string
          hora_inicio: string
          id?: string
          observacao?: string | null
          status?: string
          tipo_palestra: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          empresa_id?: string
          endereco_empresa?: string | null
          enfermeira_user_id?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          observacao?: string | null
          status?: string
          tipo_palestra?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saude_agendamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      alertar_financeiro_nota: {
        Args: {
          p_empresa_id: string
          p_mes_referencia: string
          p_periodo: string
        }
        Returns: string
      }
      enviar_movimentacao_ao_financeiro: {
        Args: { p_mov_id: string }
        Returns: string
      }
      fin_arq_categoria_auto: {
        Args: { _mime: string; _nome: string }
        Returns: string
      }
      get_comum_users_empresa_count: {
        Args: never
        Returns: {
          display_name: string
          empresa_count: number
          user_id: string
        }[]
      }
      get_email_by_username: { Args: { _username: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      solicitar_reajuste: { Args: { p_empresa_id: string }; Returns: string }
      vincular_empresas_por_responsavel: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "comum"
        | "executivo"
        | "visualizacao"
        | "enfermeira"
        | "financeiro"
        | "diretora"
      implantacao_status:
        | "em_implantacao"
        | "aguardando_documentos"
        | "em_validacao"
        | "implantado"
        | "pendente_ajuste"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "comum",
        "executivo",
        "visualizacao",
        "enfermeira",
        "financeiro",
        "diretora",
      ],
      implantacao_status: [
        "em_implantacao",
        "aguardando_documentos",
        "em_validacao",
        "implantado",
        "pendente_ajuste",
      ],
    },
  },
} as const
