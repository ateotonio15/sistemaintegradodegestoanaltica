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
      acoes_preventivas: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_nome: string | null
          data: string
          empresa_id: string
          endereco: string | null
          executiva_nome: string | null
          executiva_user_id: string | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          motivo_cancelamento: string | null
          observacao: string | null
          status: Database["public"]["Enums"]["acao_preventiva_status"]
          tipo: Database["public"]["Enums"]["acao_preventiva_tipo"]
          updated_at: string
          updated_by: string | null
          updated_by_nome: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_nome?: string | null
          data: string
          empresa_id: string
          endereco?: string | null
          executiva_nome?: string | null
          executiva_user_id?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          motivo_cancelamento?: string | null
          observacao?: string | null
          status?: Database["public"]["Enums"]["acao_preventiva_status"]
          tipo: Database["public"]["Enums"]["acao_preventiva_tipo"]
          updated_at?: string
          updated_by?: string | null
          updated_by_nome?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_nome?: string | null
          data?: string
          empresa_id?: string
          endereco?: string | null
          executiva_nome?: string | null
          executiva_user_id?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          motivo_cancelamento?: string | null
          observacao?: string | null
          status?: Database["public"]["Enums"]["acao_preventiva_status"]
          tipo?: Database["public"]["Enums"]["acao_preventiva_tipo"]
          updated_at?: string
          updated_by?: string | null
          updated_by_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acoes_preventivas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      acoes_saude: {
        Row: {
          created_at: string
          created_by: string | null
          data_acao: string
          empresa_id: string
          enfermeira_nome: string | null
          enfermeira_user_id: string | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          local: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["acao_saude_status"]
          tipo: Database["public"]["Enums"]["acao_saude_tipo"]
          titulo: string | null
          total_atendidos: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_acao: string
          empresa_id: string
          enfermeira_nome?: string | null
          enfermeira_user_id?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          local?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["acao_saude_status"]
          tipo?: Database["public"]["Enums"]["acao_saude_tipo"]
          titulo?: string | null
          total_atendidos?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_acao?: string
          empresa_id?: string
          enfermeira_nome?: string | null
          enfermeira_user_id?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          local?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["acao_saude_status"]
          tipo?: Database["public"]["Enums"]["acao_saude_tipo"]
          titulo?: string | null
          total_atendidos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acoes_saude_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
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
          destinatario_role: string | null
          destinatario_user_id: string | null
          empresa_id: string
          empresa_nome: string
          finalizado_em: string | null
          id: string
          reajuste_id: string
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string | null
          destinatario_role?: string | null
          destinatario_user_id?: string | null
          empresa_id: string
          empresa_nome: string
          finalizado_em?: string | null
          id?: string
          reajuste_id: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string | null
          destinatario_role?: string | null
          destinatario_user_id?: string | null
          empresa_id?: string
          empresa_nome?: string
          finalizado_em?: string | null
          id?: string
          reajuste_id?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      anexos_financeiro: {
        Row: {
          compartilhado_grupo: boolean
          contrato_origem_id: string | null
          created_at: string
          financeiro_movimentacao_id: string
          grupo_id: string | null
          id: string
          mime_type: string | null
          nome_arquivo: string
          origem: string
          storage_path: string
          tamanho_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          compartilhado_grupo?: boolean
          contrato_origem_id?: string | null
          created_at?: string
          financeiro_movimentacao_id: string
          grupo_id?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          origem?: string
          storage_path: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          compartilhado_grupo?: boolean
          contrato_origem_id?: string | null
          created_at?: string
          financeiro_movimentacao_id?: string
          grupo_id?: string | null
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
          {
            foreignKeyName: "anexos_financeiro_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_financeiros"
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
          motivo: string | null
          status_calc: string
          tipo_ajuste: string
          updated_at: string
          valor_centavos: number
          valor_total_calculado_centavos: number | null
          valor_total_manual_centavos: number | null
        }
        Insert: {
          competencia: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          financeiro_movimentacao_id?: string | null
          id?: string
          motivo?: string | null
          status_calc?: string
          tipo_ajuste?: string
          updated_at?: string
          valor_centavos: number
          valor_total_calculado_centavos?: number | null
          valor_total_manual_centavos?: number | null
        }
        Update: {
          competencia?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          financeiro_movimentacao_id?: string | null
          id?: string
          motivo?: string | null
          status_calc?: string
          tipo_ajuste?: string
          updated_at?: string
          valor_centavos?: number
          valor_total_calculado_centavos?: number | null
          valor_total_manual_centavos?: number | null
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
      cobrancas_retroativas_itens: {
        Row: {
          alterado_manualmente: boolean
          beneficiario_nome: string
          beneficiario_titular: string | null
          cobranca_retroativa_id: string
          codigo_beneficiario: string | null
          created_at: string
          data_alteracao: string | null
          data_fim: string
          data_inicio: string
          dias_proporcionais: number
          id: string
          matricula: string | null
          mensalidade_centavos: number
          observacao: string | null
          plano_modulo: string
          tipo_beneficiario: string | null
          tipo_lancamento: string
          updated_at: string
          usuario_alteracao_id: string | null
          usuario_alteracao_nome: string | null
          valor_calculado_centavos: number
          valor_final_centavos: number
        }
        Insert: {
          alterado_manualmente?: boolean
          beneficiario_nome: string
          beneficiario_titular?: string | null
          cobranca_retroativa_id: string
          codigo_beneficiario?: string | null
          created_at?: string
          data_alteracao?: string | null
          data_fim: string
          data_inicio: string
          dias_proporcionais?: number
          id?: string
          matricula?: string | null
          mensalidade_centavos: number
          observacao?: string | null
          plano_modulo: string
          tipo_beneficiario?: string | null
          tipo_lancamento?: string
          updated_at?: string
          usuario_alteracao_id?: string | null
          usuario_alteracao_nome?: string | null
          valor_calculado_centavos?: number
          valor_final_centavos?: number
        }
        Update: {
          alterado_manualmente?: boolean
          beneficiario_nome?: string
          beneficiario_titular?: string | null
          cobranca_retroativa_id?: string
          codigo_beneficiario?: string | null
          created_at?: string
          data_alteracao?: string | null
          data_fim?: string
          data_inicio?: string
          dias_proporcionais?: number
          id?: string
          matricula?: string | null
          mensalidade_centavos?: number
          observacao?: string | null
          plano_modulo?: string
          tipo_beneficiario?: string | null
          tipo_lancamento?: string
          updated_at?: string
          usuario_alteracao_id?: string | null
          usuario_alteracao_nome?: string | null
          valor_calculado_centavos?: number
          valor_final_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_retroativas_itens_cobranca_retroativa_id_fkey"
            columns: ["cobranca_retroativa_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_retroativas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas_retroativas_periodos: {
        Row: {
          created_at: string
          data_fim_periodo: string
          data_inicio_periodo: string
          dias_cobrados: number
          dias_mes: number
          id: string
          item_id: string
          mensalidade_centavos: number
          mes_referencia: string
          valor_calculado_centavos: number
          valor_diario_centavos: number
        }
        Insert: {
          created_at?: string
          data_fim_periodo: string
          data_inicio_periodo: string
          dias_cobrados: number
          dias_mes: number
          id?: string
          item_id: string
          mensalidade_centavos: number
          mes_referencia: string
          valor_calculado_centavos: number
          valor_diario_centavos: number
        }
        Update: {
          created_at?: string
          data_fim_periodo?: string
          data_inicio_periodo?: string
          dias_cobrados?: number
          dias_mes?: number
          id?: string
          item_id?: string
          mensalidade_centavos?: number
          mes_referencia?: string
          valor_calculado_centavos?: number
          valor_diario_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_retroativas_periodos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_retroativas_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_avaliacao_formularios: {
        Row: {
          created_at: string
          id: string
          instrucoes: string | null
          perguntas: Json
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instrucoes?: string | null
          perguntas?: Json
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instrucoes?: string | null
          perguntas?: Json
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      cs_avaliacao_respostas: {
        Row: {
          comentario: string | null
          compartilhamento_id: string | null
          created_at: string
          formulario_id: string
          id: string
          nome_empresa: string | null
          nome_executiva: string | null
          nota_media: number | null
          respondente: string | null
          respostas: Json
        }
        Insert: {
          comentario?: string | null
          compartilhamento_id?: string | null
          created_at?: string
          formulario_id: string
          id?: string
          nome_empresa?: string | null
          nome_executiva?: string | null
          nota_media?: number | null
          respondente?: string | null
          respostas?: Json
        }
        Update: {
          comentario?: string | null
          compartilhamento_id?: string | null
          created_at?: string
          formulario_id?: string
          id?: string
          nome_empresa?: string | null
          nome_executiva?: string | null
          nota_media?: number | null
          respondente?: string | null
          respostas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cs_avaliacao_respostas_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "cs_avaliacao_formularios"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_avaliacao_risco: {
        Row: {
          classificacao_final: string | null
          created_at: string
          data_avaliacao: string
          empresa_id: string
          id: string
          pontuacao_total: number | null
          reclamacoes: string | null
          relacionamento: string | null
          renovacao_proximidade: string | null
          satisfacao: string | null
          semaforo: string | null
          sinistralidade_classificacao: string | null
          updated_at: string
        }
        Insert: {
          classificacao_final?: string | null
          created_at?: string
          data_avaliacao?: string
          empresa_id: string
          id?: string
          pontuacao_total?: number | null
          reclamacoes?: string | null
          relacionamento?: string | null
          renovacao_proximidade?: string | null
          satisfacao?: string | null
          semaforo?: string | null
          sinistralidade_classificacao?: string | null
          updated_at?: string
        }
        Update: {
          classificacao_final?: string | null
          created_at?: string
          data_avaliacao?: string
          empresa_id?: string
          id?: string
          pontuacao_total?: number | null
          reclamacoes?: string | null
          relacionamento?: string | null
          renovacao_proximidade?: string | null
          satisfacao?: string | null
          semaforo?: string | null
          sinistralidade_classificacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cs_avaliacoes_executiva: {
        Row: {
          contrato: string | null
          created_at: string
          created_by: string | null
          empresa: string
          id: string
          observacao: string | null
          relacionamento: string | null
          satisfacao: string | null
        }
        Insert: {
          contrato?: string | null
          created_at?: string
          created_by?: string | null
          empresa: string
          id?: string
          observacao?: string | null
          relacionamento?: string | null
          satisfacao?: string | null
        }
        Update: {
          contrato?: string | null
          created_at?: string
          created_by?: string | null
          empresa?: string
          id?: string
          observacao?: string | null
          relacionamento?: string | null
          satisfacao?: string | null
        }
        Relationships: []
      }
      cs_sinistralidade_historico: {
        Row: {
          ano: number
          contrato: string | null
          created_at: string
          created_by: string | null
          empresa: string
          id: string
          indexador: string | null
          mes: string
          observacao: string | null
          percentual_reajuste: number | null
          sinistralidade: number | null
        }
        Insert: {
          ano: number
          contrato?: string | null
          created_at?: string
          created_by?: string | null
          empresa: string
          id?: string
          indexador?: string | null
          mes: string
          observacao?: string | null
          percentual_reajuste?: number | null
          sinistralidade?: number | null
        }
        Update: {
          ano?: number
          contrato?: string | null
          created_at?: string
          created_by?: string | null
          empresa?: string
          id?: string
          indexador?: string | null
          mes?: string
          observacao?: string | null
          percentual_reajuste?: number | null
          sinistralidade?: number | null
        }
        Relationships: []
      }
      cs_sinistralidade_mensal: {
        Row: {
          ano_referencia: number
          created_at: string
          data_registro: string
          empresa_id: string
          id: string
          mes_referencia: number
          reajuste_percentual: number | null
          sinistralidade_percentual: number | null
          updated_at: string
        }
        Insert: {
          ano_referencia: number
          created_at?: string
          data_registro?: string
          empresa_id: string
          id?: string
          mes_referencia: number
          reajuste_percentual?: number | null
          sinistralidade_percentual?: number | null
          updated_at?: string
        }
        Update: {
          ano_referencia?: number
          created_at?: string
          data_registro?: string
          empresa_id?: string
          id?: string
          mes_referencia?: number
          reajuste_percentual?: number | null
          sinistralidade_percentual?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      demandas: {
        Row: {
          cpf: string | null
          created_at: string
          created_by: string | null
          data_entrada: string | null
          data_reclamacao: string
          data_resolucao_executiva: string | null
          data_resolucao_setor: string | null
          detalhamento: string | null
          empresa: string | null
          encaminhado_setor: boolean
          executiva: string | null
          id: string
          importacao_id: string | null
          nome_cliente: string
          nome_medico: string | null
          nome_procedimento: string | null
          observacao: string | null
          reclamacao: string | null
          resolvido_executiva: boolean
          resolvido_setor: boolean
          setor_responsavel: string | null
          tipo_reclamacao: string | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_entrada?: string | null
          data_reclamacao: string
          data_resolucao_executiva?: string | null
          data_resolucao_setor?: string | null
          detalhamento?: string | null
          empresa?: string | null
          encaminhado_setor?: boolean
          executiva?: string | null
          id?: string
          importacao_id?: string | null
          nome_cliente: string
          nome_medico?: string | null
          nome_procedimento?: string | null
          observacao?: string | null
          reclamacao?: string | null
          resolvido_executiva?: boolean
          resolvido_setor?: boolean
          setor_responsavel?: string | null
          tipo_reclamacao?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_entrada?: string | null
          data_reclamacao?: string
          data_resolucao_executiva?: string | null
          data_resolucao_setor?: string | null
          detalhamento?: string | null
          empresa?: string | null
          encaminhado_setor?: boolean
          executiva?: string | null
          id?: string
          importacao_id?: string | null
          nome_cliente?: string
          nome_medico?: string | null
          nome_procedimento?: string | null
          observacao?: string | null
          reclamacao?: string | null
          resolvido_executiva?: boolean
          resolvido_setor?: boolean
          setor_responsavel?: string | null
          tipo_reclamacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandas_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_implantacao_historico: {
        Row: {
          created_at: string
          data_implantacao: string | null
          detalhes: Json | null
          empresa_id: string
          evento: string
          id: string
          primeira_competencia: string | null
          primeiro_fechamento_em: string | null
          primeiro_processamento_em: string | null
        }
        Insert: {
          created_at?: string
          data_implantacao?: string | null
          detalhes?: Json | null
          empresa_id: string
          evento: string
          id?: string
          primeira_competencia?: string | null
          primeiro_fechamento_em?: string | null
          primeiro_processamento_em?: string | null
        }
        Update: {
          created_at?: string
          data_implantacao?: string | null
          detalhes?: Json | null
          empresa_id?: string
          evento?: string
          id?: string
          primeira_competencia?: string | null
          primeiro_fechamento_em?: string | null
          primeiro_processamento_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_implantacao_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_prioridade_maxima: {
        Row: {
          ativo: boolean | null
          created_at: string
          criado_em: string
          criado_por_nome: string | null
          criado_por_user_id: string
          empresa_id: string
          id: string
          motivo: string
          motivo_remocao: string | null
          observacoes: string | null
          removido_em: string | null
          removido_por_nome: string | null
          removido_por_user_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          criado_em?: string
          criado_por_nome?: string | null
          criado_por_user_id: string
          empresa_id: string
          id?: string
          motivo: string
          motivo_remocao?: string | null
          observacoes?: string | null
          removido_em?: string | null
          removido_por_nome?: string | null
          removido_por_user_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          criado_em?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string
          empresa_id?: string
          id?: string
          motivo?: string
          motivo_remocao?: string | null
          observacoes?: string | null
          removido_em?: string | null
          removido_por_nome?: string | null
          removido_por_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_prioridade_maxima_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          config_financeira_confirmada: boolean
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
          email_financeiro_cliente: string | null
          endereco: string | null
          envio_boleto_com_nota: boolean
          executiva_user_id: string | null
          exige_po_pc: boolean
          exige_relatorio_antes_nota: boolean
          faixas_etarias: Json | null
          grupo_contrato: string | null
          id: string
          motivo_suspensao: string | null
          nao_faturado_financeiro: boolean
          nome: string
          observacao_padrao_financeiro: string | null
          observacoes: string | null
          operadora_plano: string | null
          pagamento_via_deposito: boolean
          periodo_cobranca_inicio: string | null
          periodo_especifico_cobranca: boolean
          periodo_movimentacao: string | null
          prazo: string | null
          primeira_competencia_financeira: string | null
          primeiro_fechamento_em: string | null
          primeiro_processamento_financeiro_em: string | null
          prioridade_maxima_id: string | null
          regra_prorrogacao: string | null
          responsavel_contrato: string | null
          responsavel_user_id: string | null
          status_empresa: string | null
          status_implantacao: string
          telefone_empresa: string | null
          tem_coparticipacao: boolean
          tipo_contrato: string
          tipo_financeiro: string | null
          tipo_movimentacao: string | null
          ultima_alteracao_em: string | null
          ultima_alteracao_nome: string | null
          ultima_alteracao_user_id: string | null
          updated_at: string
          valor_apartamento_centavos: number | null
          valor_enfermaria_centavos: number | null
          vidas: number
        }
        Insert: {
          cnpj?: string | null
          codigo_contrato?: string | null
          config_financeira_confirmada?: boolean
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
          email_financeiro_cliente?: string | null
          endereco?: string | null
          envio_boleto_com_nota?: boolean
          executiva_user_id?: string | null
          exige_po_pc?: boolean
          exige_relatorio_antes_nota?: boolean
          faixas_etarias?: Json | null
          grupo_contrato?: string | null
          id?: string
          motivo_suspensao?: string | null
          nao_faturado_financeiro?: boolean
          nome: string
          observacao_padrao_financeiro?: string | null
          observacoes?: string | null
          operadora_plano?: string | null
          pagamento_via_deposito?: boolean
          periodo_cobranca_inicio?: string | null
          periodo_especifico_cobranca?: boolean
          periodo_movimentacao?: string | null
          prazo?: string | null
          primeira_competencia_financeira?: string | null
          primeiro_fechamento_em?: string | null
          primeiro_processamento_financeiro_em?: string | null
          prioridade_maxima_id?: string | null
          regra_prorrogacao?: string | null
          responsavel_contrato?: string | null
          responsavel_user_id?: string | null
          status_empresa?: string | null
          status_implantacao?: string
          telefone_empresa?: string | null
          tem_coparticipacao?: boolean
          tipo_contrato?: string
          tipo_financeiro?: string | null
          tipo_movimentacao?: string | null
          ultima_alteracao_em?: string | null
          ultima_alteracao_nome?: string | null
          ultima_alteracao_user_id?: string | null
          updated_at?: string
          valor_apartamento_centavos?: number | null
          valor_enfermaria_centavos?: number | null
          vidas?: number
        }
        Update: {
          cnpj?: string | null
          codigo_contrato?: string | null
          config_financeira_confirmada?: boolean
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
          email_financeiro_cliente?: string | null
          endereco?: string | null
          envio_boleto_com_nota?: boolean
          executiva_user_id?: string | null
          exige_po_pc?: boolean
          exige_relatorio_antes_nota?: boolean
          faixas_etarias?: Json | null
          grupo_contrato?: string | null
          id?: string
          motivo_suspensao?: string | null
          nao_faturado_financeiro?: boolean
          nome?: string
          observacao_padrao_financeiro?: string | null
          observacoes?: string | null
          operadora_plano?: string | null
          pagamento_via_deposito?: boolean
          periodo_cobranca_inicio?: string | null
          periodo_especifico_cobranca?: boolean
          periodo_movimentacao?: string | null
          prazo?: string | null
          primeira_competencia_financeira?: string | null
          primeiro_fechamento_em?: string | null
          primeiro_processamento_financeiro_em?: string | null
          prioridade_maxima_id?: string | null
          regra_prorrogacao?: string | null
          responsavel_contrato?: string | null
          responsavel_user_id?: string | null
          status_empresa?: string | null
          status_implantacao?: string
          telefone_empresa?: string | null
          tem_coparticipacao?: boolean
          tipo_contrato?: string
          tipo_financeiro?: string | null
          tipo_movimentacao?: string | null
          ultima_alteracao_em?: string | null
          ultima_alteracao_nome?: string | null
          ultima_alteracao_user_id?: string | null
          updated_at?: string
          valor_apartamento_centavos?: number | null
          valor_enfermaria_centavos?: number | null
          vidas?: number
        }
        Relationships: [
          {
            foreignKeyName: "empresas_prioridade_maxima_id_fkey"
            columns: ["prioridade_maxima_id"]
            isOneToOne: false
            referencedRelation: "empresa_prioridade_maxima"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_responsavel_user_id_fkey"
            columns: ["responsavel_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      feriados: {
        Row: {
          ano: number
          created_at: string
          data: string
          id: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          data: string
          id?: string
          nome: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          data?: string
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      ferias_cadastro: {
        Row: {
          created_at: string
          criado_por_nome: string | null
          criado_por_user_id: string | null
          data_fim: string
          data_inicio: string
          encerrada_em: string | null
          id: string
          iniciada_em: string | null
          observacao: string | null
          responsavel_original_nome: string
          responsavel_original_user_id: string
          status: Database["public"]["Enums"]["ferias_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string | null
          data_fim: string
          data_inicio: string
          encerrada_em?: string | null
          id?: string
          iniciada_em?: string | null
          observacao?: string | null
          responsavel_original_nome: string
          responsavel_original_user_id: string
          status?: Database["public"]["Enums"]["ferias_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string | null
          data_fim?: string
          data_inicio?: string
          encerrada_em?: string | null
          id?: string
          iniciada_em?: string | null
          observacao?: string | null
          responsavel_original_nome?: string
          responsavel_original_user_id?: string
          status?: Database["public"]["Enums"]["ferias_status"]
          updated_at?: string
        }
        Relationships: []
      }
      ferias_cadastro_empresas: {
        Row: {
          created_at: string
          empresa_id: string
          ferias_id: string
          id: string
          motivo_retencao: string | null
          redistribuida_em: string | null
          responsavel_original_user_id: string
          responsavel_temporario_nome: string | null
          responsavel_temporario_user_id: string
          retornada_em: string | null
          status: Database["public"]["Enums"]["ferias_empresa_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          ferias_id: string
          id?: string
          motivo_retencao?: string | null
          redistribuida_em?: string | null
          responsavel_original_user_id: string
          responsavel_temporario_nome?: string | null
          responsavel_temporario_user_id: string
          retornada_em?: string | null
          status?: Database["public"]["Enums"]["ferias_empresa_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          ferias_id?: string
          id?: string
          motivo_retencao?: string | null
          redistribuida_em?: string | null
          responsavel_original_user_id?: string
          responsavel_temporario_nome?: string | null
          responsavel_temporario_user_id?: string
          retornada_em?: string | null
          status?: Database["public"]["Enums"]["ferias_empresa_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ferias_cadastro_empresas_ferias_id_fkey"
            columns: ["ferias_id"]
            isOneToOne: false
            referencedRelation: "ferias_cadastro"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_analise_execucao_itens: {
        Row: {
          comparado: boolean
          created_at: string
          diferenca: number | null
          divergencias: Json
          empresa_cnpj: string | null
          empresa_codigo: string | null
          empresa_id: string
          empresa_nome: string | null
          erros: Json
          excel_encontrado: boolean
          execucao_id: string
          financeiro_movimentacao_id: string | null
          hash_excel: string | null
          hash_pdf: string | null
          id: string
          mes_referencia: string
          nome_arquivo_excel: string | null
          nome_arquivo_pdf: string | null
          pagador_cnpj: string | null
          pagador_id: string | null
          pagador_nome: string | null
          pdf_encontrado: boolean
          periodo: string
          proxima_acao: string | null
          resultado_completo: Json | null
          status: string
          valor_excel: number | null
          valor_pdf: number | null
        }
        Insert: {
          comparado?: boolean
          created_at?: string
          diferenca?: number | null
          divergencias?: Json
          empresa_cnpj?: string | null
          empresa_codigo?: string | null
          empresa_id: string
          empresa_nome?: string | null
          erros?: Json
          excel_encontrado?: boolean
          execucao_id: string
          financeiro_movimentacao_id?: string | null
          hash_excel?: string | null
          hash_pdf?: string | null
          id?: string
          mes_referencia: string
          nome_arquivo_excel?: string | null
          nome_arquivo_pdf?: string | null
          pagador_cnpj?: string | null
          pagador_id?: string | null
          pagador_nome?: string | null
          pdf_encontrado?: boolean
          periodo: string
          proxima_acao?: string | null
          resultado_completo?: Json | null
          status: string
          valor_excel?: number | null
          valor_pdf?: number | null
        }
        Update: {
          comparado?: boolean
          created_at?: string
          diferenca?: number | null
          divergencias?: Json
          empresa_cnpj?: string | null
          empresa_codigo?: string | null
          empresa_id?: string
          empresa_nome?: string | null
          erros?: Json
          excel_encontrado?: boolean
          execucao_id?: string
          financeiro_movimentacao_id?: string | null
          hash_excel?: string | null
          hash_pdf?: string | null
          id?: string
          mes_referencia?: string
          nome_arquivo_excel?: string | null
          nome_arquivo_pdf?: string | null
          pagador_cnpj?: string | null
          pagador_id?: string | null
          pagador_nome?: string | null
          pdf_encontrado?: boolean
          periodo?: string
          proxima_acao?: string | null
          resultado_completo?: Json | null
          status?: string
          valor_excel?: number | null
          valor_pdf?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_analise_execucao_itens_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "financeiro_analise_execucoes"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_analise_execucoes: {
        Row: {
          aguardando_faturamento: number
          created_at: string
          divergentes: number
          erro_leitura: number
          executado_por: string | null
          executado_por_nome: string | null
          finalizada_em: string | null
          id: string
          iniciada_em: string
          mes_referencia: string
          ok: number
          periodo: string
          sem_ambos: number
          sem_excel: number
          sem_movimentacao: number
          sem_pdf: number
          status: string
          total: number
          updated_at: string
          valor_total_analisado: number
          valor_total_divergente: number
        }
        Insert: {
          aguardando_faturamento?: number
          created_at?: string
          divergentes?: number
          erro_leitura?: number
          executado_por?: string | null
          executado_por_nome?: string | null
          finalizada_em?: string | null
          id?: string
          iniciada_em?: string
          mes_referencia: string
          ok?: number
          periodo: string
          sem_ambos?: number
          sem_excel?: number
          sem_movimentacao?: number
          sem_pdf?: number
          status?: string
          total?: number
          updated_at?: string
          valor_total_analisado?: number
          valor_total_divergente?: number
        }
        Update: {
          aguardando_faturamento?: number
          created_at?: string
          divergentes?: number
          erro_leitura?: number
          executado_por?: string | null
          executado_por_nome?: string | null
          finalizada_em?: string | null
          id?: string
          iniciada_em?: string
          mes_referencia?: string
          ok?: number
          periodo?: string
          sem_ambos?: number
          sem_excel?: number
          sem_movimentacao?: number
          sem_pdf?: number
          status?: string
          total?: number
          updated_at?: string
          valor_total_analisado?: number
          valor_total_divergente?: number
        }
        Relationships: []
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
      financeiro_chips_ocultos: {
        Row: {
          competencia: string
          empresa_id: string
          id: string
          ocultado_em: string
          status: string | null
          user_id: string
        }
        Insert: {
          competencia: string
          empresa_id: string
          id?: string
          ocultado_em?: string
          status?: string | null
          user_id: string
        }
        Update: {
          competencia?: string
          empresa_id?: string
          id?: string
          ocultado_em?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_chips_ocultos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_movimentacoes: {
        Row: {
          aguardando_nota_em: string | null
          boleto_confirmado_em: string | null
          boleto_confirmado_por: string | null
          boleto_dda: boolean
          cobranca_registrada: boolean
          created_at: string
          data_envio_nota: string | null
          data_prorrogacao: string | null
          data_vencimento: string | null
          dentro_prazo: boolean
          dia_emissao: number | null
          empresa_id: string
          enviado_por_user_id: string | null
          faturamento_iniciado_em: string | null
          faturamento_iniciado_por: string | null
          faturamento_iniciado_por_nome: string | null
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
          tipo_lancamento: string
          updated_at: string
        }
        Insert: {
          aguardando_nota_em?: string | null
          boleto_confirmado_em?: string | null
          boleto_confirmado_por?: string | null
          boleto_dda?: boolean
          cobranca_registrada?: boolean
          created_at?: string
          data_envio_nota?: string | null
          data_prorrogacao?: string | null
          data_vencimento?: string | null
          dentro_prazo?: boolean
          dia_emissao?: number | null
          empresa_id: string
          enviado_por_user_id?: string | null
          faturamento_iniciado_em?: string | null
          faturamento_iniciado_por?: string | null
          faturamento_iniciado_por_nome?: string | null
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
          tipo_lancamento?: string
          updated_at?: string
        }
        Update: {
          aguardando_nota_em?: string | null
          boleto_confirmado_em?: string | null
          boleto_confirmado_por?: string | null
          boleto_dda?: boolean
          cobranca_registrada?: boolean
          created_at?: string
          data_envio_nota?: string | null
          data_prorrogacao?: string | null
          data_vencimento?: string | null
          dentro_prazo?: boolean
          dia_emissao?: number | null
          empresa_id?: string
          enviado_por_user_id?: string | null
          faturamento_iniciado_em?: string | null
          faturamento_iniciado_por?: string | null
          faturamento_iniciado_por_nome?: string | null
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
          tipo_lancamento?: string
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
      grupos_financeiros: {
        Row: {
          atualizado_por_id: string | null
          atualizado_por_nome: string | null
          created_at: string
          criado_por_id: string | null
          criado_por_nome: string | null
          dia_vencimento: number | null
          forma_pagamento: string | null
          forma_pagamento_compartilhada: boolean
          id: string
          nome_grupo: string
          observacao: string | null
          status: string
          updated_at: string
          vencimento_compartilhado: boolean
        }
        Insert: {
          atualizado_por_id?: string | null
          atualizado_por_nome?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome?: string | null
          dia_vencimento?: number | null
          forma_pagamento?: string | null
          forma_pagamento_compartilhada?: boolean
          id?: string
          nome_grupo: string
          observacao?: string | null
          status?: string
          updated_at?: string
          vencimento_compartilhado?: boolean
        }
        Update: {
          atualizado_por_id?: string | null
          atualizado_por_nome?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome?: string | null
          dia_vencimento?: number | null
          forma_pagamento?: string | null
          forma_pagamento_compartilhada?: boolean
          id?: string
          nome_grupo?: string
          observacao?: string | null
          status?: string
          updated_at?: string
          vencimento_compartilhado?: boolean
        }
        Relationships: []
      }
      grupos_financeiros_auditoria: {
        Row: {
          acao: string
          contrato_origem_id: string | null
          contratos_impactados: string[] | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          data_hora: string
          descricao: string | null
          grupo_id: string | null
          id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          contrato_origem_id?: string | null
          contratos_impactados?: string[] | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          data_hora?: string
          descricao?: string | null
          grupo_id?: string | null
          id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          contrato_origem_id?: string | null
          contratos_impactados?: string[] | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          data_hora?: string
          descricao?: string | null
          grupo_id?: string | null
          id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grupos_financeiros_auditoria_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_financeiros"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos_financeiros_contratos: {
        Row: {
          adicionado_em: string
          adicionado_por_id: string | null
          adicionado_por_nome: string | null
          ativo: boolean
          cnpj: string | null
          codigo_contrato: string | null
          created_at: string
          empresa_id: string
          grupo_id: string
          id: string
          nome_empresa: string | null
          removido_em: string | null
          removido_por_id: string | null
          removido_por_nome: string | null
          updated_at: string
        }
        Insert: {
          adicionado_em?: string
          adicionado_por_id?: string | null
          adicionado_por_nome?: string | null
          ativo?: boolean
          cnpj?: string | null
          codigo_contrato?: string | null
          created_at?: string
          empresa_id: string
          grupo_id: string
          id?: string
          nome_empresa?: string | null
          removido_em?: string | null
          removido_por_id?: string | null
          removido_por_nome?: string | null
          updated_at?: string
        }
        Update: {
          adicionado_em?: string
          adicionado_por_id?: string | null
          adicionado_por_nome?: string | null
          ativo?: boolean
          cnpj?: string | null
          codigo_contrato?: string | null
          created_at?: string
          empresa_id?: string
          grupo_id?: string
          id?: string
          nome_empresa?: string | null
          removido_em?: string | null
          removido_por_id?: string | null
          removido_por_nome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_financeiros_contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupos_financeiros_contratos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_financeiros"
            referencedColumns: ["id"]
          },
        ]
      }
      historicos_financeiros: {
        Row: {
          competencia: string
          created_at: string
          data_geracao: string
          empresa_id: string
          financeiro_movimentacao_id: string
          id: string
          motivo_prorrogacao: string | null
          periodo: string
          prorrogado: boolean
          texto_historico: string
          updated_at: string
          usuario_geracao: string | null
          usuario_geracao_nome: string | null
          vencimento_utilizado: string | null
        }
        Insert: {
          competencia: string
          created_at?: string
          data_geracao?: string
          empresa_id: string
          financeiro_movimentacao_id: string
          id?: string
          motivo_prorrogacao?: string | null
          periodo: string
          prorrogado?: boolean
          texto_historico: string
          updated_at?: string
          usuario_geracao?: string | null
          usuario_geracao_nome?: string | null
          vencimento_utilizado?: string | null
        }
        Update: {
          competencia?: string
          created_at?: string
          data_geracao?: string
          empresa_id?: string
          financeiro_movimentacao_id?: string
          id?: string
          motivo_prorrogacao?: string | null
          periodo?: string
          prorrogado?: boolean
          texto_historico?: string
          updated_at?: string
          usuario_geracao?: string | null
          usuario_geracao_nome?: string | null
          vencimento_utilizado?: string | null
        }
        Relationships: []
      }
      honda_exclusoes: {
        Row: {
          concluido: boolean
          cpf: string
          created_at: string
          data_demissao: string
          id: string
          importado_em: string
          importado_por: string | null
          motivo: string | null
          nome_beneficiario: string
          sequencia: string | null
          tipo_operacao: string | null
          updated_at: string
        }
        Insert: {
          concluido?: boolean
          cpf: string
          created_at?: string
          data_demissao: string
          id?: string
          importado_em?: string
          importado_por?: string | null
          motivo?: string | null
          nome_beneficiario: string
          sequencia?: string | null
          tipo_operacao?: string | null
          updated_at?: string
        }
        Update: {
          concluido?: boolean
          cpf?: string
          created_at?: string
          data_demissao?: string
          id?: string
          importado_em?: string
          importado_por?: string | null
          motivo?: string | null
          nome_beneficiario?: string
          sequencia?: string | null
          tipo_operacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      implantacao_alertas: {
        Row: {
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          destinatario_role: string
          destinatario_user_id: string | null
          empresa_nome: string | null
          finalizado_em: string | null
          id: string
          implantacao_id: string
          mensagem: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          destinatario_role: string
          destinatario_user_id?: string | null
          empresa_nome?: string | null
          finalizado_em?: string | null
          id?: string
          implantacao_id: string
          mensagem?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          destinatario_role?: string
          destinatario_user_id?: string | null
          empresa_nome?: string | null
          finalizado_em?: string | null
          id?: string
          implantacao_id?: string
          mensagem?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      implantacao_anexos: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          implantacao_id: string | null
          mime_type: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
          tipo: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          implantacao_id?: string | null
          mime_type?: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
          tipo?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          implantacao_id?: string | null
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
          aprovado_em: string | null
          aprovado_por: string | null
          aprovado_por_nome: string | null
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
          enviado_cadastro_em: string | null
          enviado_diretoria_em: string | null
          enviado_diretoria_por: string | null
          enviado_diretoria_por_nome: string | null
          etapa_atual: number
          faixas_etarias: Json | null
          grupo_contrato: string | null
          id: string
          implantado_em: string | null
          implantado_por: string | null
          implantado_por_nome: string | null
          inicio_atendimento: string | null
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          modalidade: string | null
          motivo_correcao: string | null
          nome_empresa: string | null
          observacao_diretoria: string | null
          percentual_agenciamento: number | null
          percentual_vitalicio: number | null
          periodo_movimentacao: string | null
          progresso: number
          relatorio_validacao: Json | null
          responsavel_cadastro_nome: string | null
          responsavel_cadastro_user_id: string | null
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
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string | null
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
          enviado_cadastro_em?: string | null
          enviado_diretoria_em?: string | null
          enviado_diretoria_por?: string | null
          enviado_diretoria_por_nome?: string | null
          etapa_atual?: number
          faixas_etarias?: Json | null
          grupo_contrato?: string | null
          id?: string
          implantado_em?: string | null
          implantado_por?: string | null
          implantado_por_nome?: string | null
          inicio_atendimento?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          modalidade?: string | null
          motivo_correcao?: string | null
          nome_empresa?: string | null
          observacao_diretoria?: string | null
          percentual_agenciamento?: number | null
          percentual_vitalicio?: number | null
          periodo_movimentacao?: string | null
          progresso?: number
          relatorio_validacao?: Json | null
          responsavel_cadastro_nome?: string | null
          responsavel_cadastro_user_id?: string | null
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
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string | null
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
          enviado_cadastro_em?: string | null
          enviado_diretoria_em?: string | null
          enviado_diretoria_por?: string | null
          enviado_diretoria_por_nome?: string | null
          etapa_atual?: number
          faixas_etarias?: Json | null
          grupo_contrato?: string | null
          id?: string
          implantado_em?: string | null
          implantado_por?: string | null
          implantado_por_nome?: string | null
          inicio_atendimento?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          modalidade?: string | null
          motivo_correcao?: string | null
          nome_empresa?: string | null
          observacao_diretoria?: string | null
          percentual_agenciamento?: number | null
          percentual_vitalicio?: number | null
          periodo_movimentacao?: string | null
          progresso?: number
          relatorio_validacao?: Json | null
          responsavel_cadastro_nome?: string | null
          responsavel_cadastro_user_id?: string | null
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
      importacoes: {
        Row: {
          created_at: string
          id: string
          importado_por: string | null
          importado_por_nome: string | null
          nome_arquivo: string
          total_registros: number
        }
        Insert: {
          created_at?: string
          id?: string
          importado_por?: string | null
          importado_por_nome?: string | null
          nome_arquivo: string
          total_registros?: number
        }
        Update: {
          created_at?: string
          id?: string
          importado_por?: string | null
          importado_por_nome?: string | null
          nome_arquivo?: string
          total_registros?: number
        }
        Relationships: []
      }
      mailing_brindes: {
        Row: {
          cargo: string | null
          cep: string | null
          cidade: string | null
          contato_nome: string | null
          created_at: string
          created_by: string | null
          email: string | null
          empresa_nome: string
          endereco: string | null
          entregue_em: string | null
          enviado_em: string | null
          executiva: string | null
          id: string
          observacoes: string | null
          rastreio_codigo: string | null
          status: string
          telefone: string | null
          tipo_cesta: string | null
          transportadora: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          contato_nome?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa_nome: string
          endereco?: string | null
          entregue_em?: string | null
          enviado_em?: string | null
          executiva?: string | null
          id?: string
          observacoes?: string | null
          rastreio_codigo?: string | null
          status?: string
          telefone?: string | null
          tipo_cesta?: string | null
          transportadora?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          contato_nome?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa_nome?: string
          endereco?: string | null
          entregue_em?: string | null
          enviado_em?: string | null
          executiva?: string | null
          id?: string
          observacoes?: string | null
          rastreio_codigo?: string | null
          status?: string
          telefone?: string | null
          tipo_cesta?: string | null
          transportadora?: string | null
          uf?: string | null
          updated_at?: string
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
      painel_tv_meta_diaria: {
        Row: {
          created_at: string
          data: string
          empresas_snapshot: Json
          iniciada_em: string
          updated_at: string
          usuarios: Json
          valor: number
        }
        Insert: {
          created_at?: string
          data: string
          empresas_snapshot?: Json
          iniciada_em?: string
          updated_at?: string
          usuarios?: Json
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          empresas_snapshot?: Json
          iniciada_em?: string
          updated_at?: string
          usuarios?: Json
          valor?: number
        }
        Relationships: []
      }
      plantoes: {
        Row: {
          created_at: string
          data: string
          empresa_id: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          observacao: string | null
          plantonista: string | null
          status: string
          turno: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          empresa_id: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          observacao?: string | null
          plantonista?: string | null
          status?: string
          turno?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          empresa_id?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          observacao?: string | null
          plantonista?: string | null
          status?: string
          turno?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "plantoes_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      plantoes_atendimentos: {
        Row: {
          assunto: string | null
          cpf: string | null
          created_at: string
          demanda_id: string | null
          hora: string | null
          id: string
          nome_cliente: string
          observacao: string | null
          plantao_id: string
          resolvido: boolean
          updated_at: string
        }
        Insert: {
          assunto?: string | null
          cpf?: string | null
          created_at?: string
          demanda_id?: string | null
          hora?: string | null
          id?: string
          nome_cliente: string
          observacao?: string | null
          plantao_id: string
          resolvido?: boolean
          updated_at?: string
        }
        Update: {
          assunto?: string | null
          cpf?: string | null
          created_at?: string
          demanda_id?: string | null
          hora?: string | null
          id?: string
          nome_cliente?: string
          observacao?: string | null
          plantao_id?: string
          resolvido?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantoes_atendimentos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantoes_atendimentos_plantao_id_fkey"
            columns: ["plantao_id"]
            isOneToOne: false
            referencedRelation: "plantoes"
            referencedColumns: ["id"]
          },
        ]
      }
      plantoes_empresas: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          observacao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          observacao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          observacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      process_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          job_type: string
          message: string | null
          payload: Json
          progress: number
          result: Json | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          job_type: string
          message?: string | null
          payload?: Json
          progress?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          job_type?: string
          message?: string | null
          payload?: Json
          progress?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          aprovado_em: string | null
          aprovado_por_nome: string | null
          aprovado_por_user_id: string | null
          competencia: string | null
          confirmado_por: string | null
          confirmado_por_nome: string | null
          created_at: string
          data_aplicacao: string | null
          data_confirmacao: string | null
          data_liberacao: string | null
          empresa_id: string
          id: string
          indexador_financeiro: string | null
          liberado_por: string | null
          liberado_por_nome: string | null
          mes_reajuste: number | null
          meses_retroativos: number
          motivo_rejeicao: string | null
          observacao: string | null
          percentual: number | null
          percentual_unico_apartamento: boolean
          percentual_unico_enfermaria: boolean
          possui_apartamento: boolean
          possui_enfermaria: boolean
          rejeitado_em: string | null
          rejeitado_por_nome: string | null
          rejeitado_por_user_id: string | null
          retroativo_aplicado_em: string | null
          retroativo_aplicado_por_nome: string | null
          retroativo_aplicado_por_user_id: string | null
          sinistralidade_percentual: number | null
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
          aprovado_em?: string | null
          aprovado_por_nome?: string | null
          aprovado_por_user_id?: string | null
          competencia?: string | null
          confirmado_por?: string | null
          confirmado_por_nome?: string | null
          created_at?: string
          data_aplicacao?: string | null
          data_confirmacao?: string | null
          data_liberacao?: string | null
          empresa_id: string
          id?: string
          indexador_financeiro?: string | null
          liberado_por?: string | null
          liberado_por_nome?: string | null
          mes_reajuste?: number | null
          meses_retroativos?: number
          motivo_rejeicao?: string | null
          observacao?: string | null
          percentual?: number | null
          percentual_unico_apartamento?: boolean
          percentual_unico_enfermaria?: boolean
          possui_apartamento?: boolean
          possui_enfermaria?: boolean
          rejeitado_em?: string | null
          rejeitado_por_nome?: string | null
          rejeitado_por_user_id?: string | null
          retroativo_aplicado_em?: string | null
          retroativo_aplicado_por_nome?: string | null
          retroativo_aplicado_por_user_id?: string | null
          sinistralidade_percentual?: number | null
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
          aprovado_em?: string | null
          aprovado_por_nome?: string | null
          aprovado_por_user_id?: string | null
          competencia?: string | null
          confirmado_por?: string | null
          confirmado_por_nome?: string | null
          created_at?: string
          data_aplicacao?: string | null
          data_confirmacao?: string | null
          data_liberacao?: string | null
          empresa_id?: string
          id?: string
          indexador_financeiro?: string | null
          liberado_por?: string | null
          liberado_por_nome?: string | null
          mes_reajuste?: number | null
          meses_retroativos?: number
          motivo_rejeicao?: string | null
          observacao?: string | null
          percentual?: number | null
          percentual_unico_apartamento?: boolean
          percentual_unico_enfermaria?: boolean
          possui_apartamento?: boolean
          possui_enfermaria?: boolean
          rejeitado_em?: string | null
          rejeitado_por_nome?: string | null
          rejeitado_por_user_id?: string | null
          retroativo_aplicado_em?: string | null
          retroativo_aplicado_por_nome?: string | null
          retroativo_aplicado_por_user_id?: string | null
          sinistralidade_percentual?: number | null
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
      reajustes_historico: {
        Row: {
          created_at: string
          dados: Json | null
          empresa_id: string
          evento: string
          id: string
          observacao: string | null
          reajuste_id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          empresa_id: string
          evento: string
          id?: string
          observacao?: string | null
          reajuste_id: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          created_at?: string
          dados?: Json | null
          empresa_id?: string
          evento?: string
          id?: string
          observacao?: string | null
          reajuste_id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reajustes_historico_reajuste_id_fkey"
            columns: ["reajuste_id"]
            isOneToOne: false
            referencedRelation: "reajustes_anuais"
            referencedColumns: ["id"]
          },
        ]
      }
      triagens: {
        Row: {
          acao_id: string
          agua_corporal_pct: number | null
          altura_cm: number | null
          cargo: string | null
          circ_abdominal_cm: number | null
          circ_quadril_cm: number | null
          classificacao_glicemia: string | null
          classificacao_pa: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          data_nascimento: string | null
          email: string | null
          empresa_id: string
          enviado_email_em: string | null
          freq_cardiaca: number | null
          glicemia_mg_dl: number | null
          gordura_corporal_kg: number | null
          gordura_pct: number | null
          gordura_subcutanea_pct: number | null
          gordura_visceral: number | null
          id: string
          idade: number | null
          idade_metabolica: number | null
          imc: number | null
          jejum: boolean
          massa_muscular_kg: number | null
          massa_ossea_kg: number | null
          medicamentos: string | null
          nome: string
          pad_mmhg: number | null
          pas_mmhg: number | null
          peso_kg: number | null
          rcq: number | null
          recomendacao: string | null
          risco_geral: string | null
          sat_o2: number | null
          score_corporal: number | null
          setor: string | null
          sexo: string | null
          telefone: string | null
          tem_dm: boolean
          tem_has: boolean
          temperatura_c: number | null
          tmb_kcal: number | null
          updated_at: string
          usa_medicacao: boolean
        }
        Insert: {
          acao_id: string
          agua_corporal_pct?: number | null
          altura_cm?: number | null
          cargo?: string | null
          circ_abdominal_cm?: number | null
          circ_quadril_cm?: number | null
          classificacao_glicemia?: string | null
          classificacao_pa?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_nascimento?: string | null
          email?: string | null
          empresa_id: string
          enviado_email_em?: string | null
          freq_cardiaca?: number | null
          glicemia_mg_dl?: number | null
          gordura_corporal_kg?: number | null
          gordura_pct?: number | null
          gordura_subcutanea_pct?: number | null
          gordura_visceral?: number | null
          id?: string
          idade?: number | null
          idade_metabolica?: number | null
          imc?: number | null
          jejum?: boolean
          massa_muscular_kg?: number | null
          massa_ossea_kg?: number | null
          medicamentos?: string | null
          nome: string
          pad_mmhg?: number | null
          pas_mmhg?: number | null
          peso_kg?: number | null
          rcq?: number | null
          recomendacao?: string | null
          risco_geral?: string | null
          sat_o2?: number | null
          score_corporal?: number | null
          setor?: string | null
          sexo?: string | null
          telefone?: string | null
          tem_dm?: boolean
          tem_has?: boolean
          temperatura_c?: number | null
          tmb_kcal?: number | null
          updated_at?: string
          usa_medicacao?: boolean
        }
        Update: {
          acao_id?: string
          agua_corporal_pct?: number | null
          altura_cm?: number | null
          cargo?: string | null
          circ_abdominal_cm?: number | null
          circ_quadril_cm?: number | null
          classificacao_glicemia?: string | null
          classificacao_pa?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_nascimento?: string | null
          email?: string | null
          empresa_id?: string
          enviado_email_em?: string | null
          freq_cardiaca?: number | null
          glicemia_mg_dl?: number | null
          gordura_corporal_kg?: number | null
          gordura_pct?: number | null
          gordura_subcutanea_pct?: number | null
          gordura_visceral?: number | null
          id?: string
          idade?: number | null
          idade_metabolica?: number | null
          imc?: number | null
          jejum?: boolean
          massa_muscular_kg?: number | null
          massa_ossea_kg?: number | null
          medicamentos?: string | null
          nome?: string
          pad_mmhg?: number | null
          pas_mmhg?: number | null
          peso_kg?: number | null
          rcq?: number | null
          recomendacao?: string | null
          risco_geral?: string | null
          sat_o2?: number | null
          score_corporal?: number | null
          setor?: string | null
          sexo?: string | null
          telefone?: string | null
          tem_dm?: boolean
          tem_has?: boolean
          temperatura_c?: number | null
          tmb_kcal?: number | null
          updated_at?: string
          usa_medicacao?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "triagens_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "acoes_saude"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "triagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      uber_corridas: {
        Row: {
          cancelada: boolean
          colaborador: string
          created_at: string
          created_by: string | null
          criado_por: string | null
          data: string
          destino: string | null
          empresa: string | null
          forma_pagamento: string | null
          horario: string | null
          id: string
          motivo: string | null
          observacao: string | null
          origem: string | null
          reembolso: number | null
          responsavel: string | null
          tipo: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          cancelada?: boolean
          colaborador: string
          created_at?: string
          created_by?: string | null
          criado_por?: string | null
          data: string
          destino?: string | null
          empresa?: string | null
          forma_pagamento?: string | null
          horario?: string | null
          id?: string
          motivo?: string | null
          observacao?: string | null
          origem?: string | null
          reembolso?: number | null
          responsavel?: string | null
          tipo?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          cancelada?: boolean
          colaborador?: string
          created_at?: string
          created_by?: string | null
          criado_por?: string | null
          data?: string
          destino?: string | null
          empresa?: string | null
          forma_pagamento?: string | null
          horario?: string | null
          id?: string
          motivo?: string | null
          observacao?: string | null
          origem?: string | null
          reembolso?: number | null
          responsavel?: string | null
          tipo?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: []
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
      vidas_historico_administradoras: {
        Row: {
          calculado_em: string
          empresa_id: string
          entradas: number
          id: string
          mes_referencia: string
          saidas: number
          total_anterior: number
          total_atual: number
        }
        Insert: {
          calculado_em?: string
          empresa_id: string
          entradas?: number
          id?: string
          mes_referencia: string
          saidas?: number
          total_anterior?: number
          total_atual?: number
        }
        Update: {
          calculado_em?: string
          empresa_id?: string
          entradas?: number
          id?: string
          mes_referencia?: string
          saidas?: number
          total_anterior?: number
          total_atual?: number
        }
        Relationships: [
          {
            foreignKeyName: "vidas_historico_administradoras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _criar_alerta_reajuste_role: {
        Args: { p_reajuste: string; p_role: string; p_tipo: string }
        Returns: undefined
      }
      _log_impl: {
        Args: { _acao: string; _detalhes: Json; _impl: string }
        Returns: undefined
      }
      _log_reajuste: {
        Args: {
          p_dados?: Json
          p_evento: string
          p_obs?: string
          p_reajuste: string
        }
        Returns: undefined
      }
      _periodo_para_empresa: {
        Args: { p_empresa: Database["public"]["Tables"]["empresas"]["Row"] }
        Returns: string
      }
      adicionar_contrato_grupo: {
        Args: { p_empresa_id: string; p_grupo_id: string }
        Returns: string
      }
      alertar_financeiro_nota: {
        Args: {
          p_empresa_id: string
          p_mes_referencia: string
          p_periodo: string
        }
        Returns: string
      }
      aplicar_cancelar_faturamento_grupo: {
        Args: { p_mov_id: string }
        Returns: number
      }
      aplicar_dda_grupo: {
        Args: {
          p_boleto_dda: boolean
          p_mov_id: string
          p_pagamento_deposito: boolean
        }
        Returns: number
      }
      aplicar_dia_emissao_grupo: {
        Args: { p_dia_emissao: number; p_mov_id: string }
        Returns: number
      }
      aplicar_envio_nota_grupo: {
        Args: { p_data_envio: string; p_mov_id: string }
        Returns: number
      }
      aplicar_ferias_programadas: { Args: never; Returns: number }
      aplicar_iniciar_faturamento_grupo: {
        Args: { p_mov_id: string }
        Returns: number
      }
      aplicar_retroativo_reajuste: {
        Args: { p_id: string; p_obs?: string }
        Returns: undefined
      }
      aplicar_vencimento_grupo: {
        Args: { p_data_vencimento: string; p_mov_id: string }
        Returns: number
      }
      aprovar_implantacao:
        | { Args: { p_impl: string; p_observacao?: string }; Returns: string }
        | {
            Args: {
              p_impl: string
              p_observacao?: string
              p_responsavel?: string
              p_responsavel_nome?: string
            }
            Returns: string
          }
      aprovar_reajuste: {
        Args: { p_id: string; p_obs?: string }
        Returns: undefined
      }
      ativar_contratos_pendentes: { Args: never; Returns: number }
      calc_pascoa: { Args: { _ano: number }; Returns: string }
      calcular_idade: { Args: { p_nasc: string }; Returns: number }
      calcular_imc: {
        Args: { p_altura_cm: number; p_peso: number }
        Returns: number
      }
      calcular_primeira_competencia: {
        Args: { p_empresa_id: string }
        Returns: string
      }
      calcular_rcq: { Args: { p_abd: number; p_qua: number }; Returns: number }
      can_access_honda_exclusoes: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_read_triagem: {
        Args: { _empresa_id: string; _uid: string }
        Returns: boolean
      }
      cancelar_ferias_cadastro: { Args: { p_ferias_id: string }; Returns: Json }
      classificar_glicemia: {
        Args: { p_jejum: boolean; p_valor: number }
        Returns: string
      }
      classificar_pa: {
        Args: { p_pad: number; p_pas: number }
        Returns: string
      }
      confirmar_reajuste_cadastro: {
        Args: { p_id: string }
        Returns: undefined
      }
      criar_ferias_cadastro: {
        Args: {
          p_atribuicoes: Json
          p_data_fim: string
          p_data_inicio: string
          p_nome: string
          p_user_id: string
        }
        Returns: string
      }
      demanda_can_edit: { Args: { _executiva: string }; Returns: boolean }
      enviar_implantacao_diretoria: {
        Args: { p_impl: string }
        Returns: string
      }
      enviar_movimentacao_ao_financeiro: {
        Args: { p_mov_id: string }
        Returns: string
      }
      excluir_implantacao: { Args: { p_id: string }; Returns: Json }
      fin_arq_categoria_auto: {
        Args: { _mime: string; _nome: string }
        Returns: string
      }
      finalizar_implantacao_cadastro: {
        Args: { p_impl: string }
        Returns: string
      }
      gerar_feriados_ano: { Args: { _ano: number }; Returns: undefined }
      gerar_primeira_cobranca_financeira: {
        Args: { p_empresa_id: string }
        Returns: number
      }
      get_cadastro_workload: {
        Args: never
        Returns: {
          display_name: string
          empresas: number
          implantacoes: number
          user_id: string
        }[]
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
      is_saude_editor: { Args: { _uid: string }; Returns: boolean }
      is_saude_reader: { Args: { _uid: string }; Returns: boolean }
      liberar_reajuste_financeiro: {
        Args: { p_id: string }
        Returns: undefined
      }
      marcar_prioridade_maxima: {
        Args: { p_empresa_id: string; p_motivo: string; p_observacoes?: string }
        Returns: string
      }
      processar_retorno_ferias: { Args: never; Returns: number }
      rejeitar_implantacao: {
        Args: { p_impl: string; p_motivo: string }
        Returns: string
      }
      rejeitar_reajuste: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      remover_contrato_grupo: {
        Args: { p_vinculo_id: string }
        Returns: undefined
      }
      remover_prioridade_maxima: {
        Args: { p_empresa_id: string; p_motivo_remocao?: string }
        Returns: undefined
      }
      simular_redistribuicao_ferias: {
        Args: { p_user_id: string }
        Returns: Json
      }
      solicitar_correcao_implantacao: {
        Args: { p_impl: string; p_motivo: string }
        Returns: string
      }
      solicitar_reajuste: { Args: { p_empresa_id: string }; Returns: string }
      tem_movimentacao_pendente: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      vincular_empresas_por_responsavel: { Args: never; Returns: undefined }
    }
    Enums: {
      acao_preventiva_status:
        | "a_confirmar"
        | "confirmado"
        | "concluido"
        | "cancelado"
      acao_preventiva_tipo: "sinais_vitais" | "preventivo" | "psa"
      acao_saude_status: "agendada" | "em_andamento" | "concluida" | "cancelada"
      acao_saude_tipo:
        | "triagem"
        | "palestra"
        | "preventiva"
        | "bioimpedancia"
        | "outro"
      app_role:
        | "admin"
        | "comum"
        | "executivo"
        | "visualizacao"
        | "enfermeira"
        | "financeiro"
        | "diretora"
        | "vendas"
        | "administradoras"
        | "coordenadora"
        | "diretora_saude"
      ferias_empresa_status:
        | "pendente_inicio"
        | "redistribuida"
        | "aguardando_fechamento"
        | "retornada"
      ferias_status:
        | "programada"
        | "em_andamento"
        | "encerrada"
        | "aguardando_retorno_contratos"
      implantacao_status:
        | "em_implantacao"
        | "aguardando_documentos"
        | "em_validacao"
        | "implantado"
        | "pendente_ajuste"
        | "documentacao_pendente"
        | "em_analise_diretoria"
        | "aprovado_diretoria"
        | "enviado_cadastro"
        | "rejeitado"
        | "necessita_correcao"
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
      acao_preventiva_status: [
        "a_confirmar",
        "confirmado",
        "concluido",
        "cancelado",
      ],
      acao_preventiva_tipo: ["sinais_vitais", "preventivo", "psa"],
      acao_saude_status: ["agendada", "em_andamento", "concluida", "cancelada"],
      acao_saude_tipo: [
        "triagem",
        "palestra",
        "preventiva",
        "bioimpedancia",
        "outro",
      ],
      app_role: [
        "admin",
        "comum",
        "executivo",
        "visualizacao",
        "enfermeira",
        "financeiro",
        "diretora",
        "vendas",
        "administradoras",
        "coordenadora",
        "diretora_saude",
      ],
      ferias_empresa_status: [
        "pendente_inicio",
        "redistribuida",
        "aguardando_fechamento",
        "retornada",
      ],
      ferias_status: [
        "programada",
        "em_andamento",
        "encerrada",
        "aguardando_retorno_contratos",
      ],
      implantacao_status: [
        "em_implantacao",
        "aguardando_documentos",
        "em_validacao",
        "implantado",
        "pendente_ajuste",
        "documentacao_pendente",
        "em_analise_diretoria",
        "aprovado_diretoria",
        "enviado_cadastro",
        "rejeitado",
        "necessita_correcao",
      ],
    },
  },
} as const
