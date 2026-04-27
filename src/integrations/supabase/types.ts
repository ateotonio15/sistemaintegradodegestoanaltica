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
      financeiro_movimentacoes: {
        Row: {
          cobranca_registrada: boolean
          created_at: string
          data_envio_nota: string | null
          data_vencimento: string | null
          dentro_prazo: boolean
          empresa_id: string
          enviado_por_user_id: string | null
          id: string
          mes_referencia: string
          observacoes: string | null
          periodo: string
          responsavel: string | null
          tipo_cobranca: string | null
          updated_at: string
        }
        Insert: {
          cobranca_registrada?: boolean
          created_at?: string
          data_envio_nota?: string | null
          data_vencimento?: string | null
          dentro_prazo?: boolean
          empresa_id: string
          enviado_por_user_id?: string | null
          id?: string
          mes_referencia: string
          observacoes?: string | null
          periodo: string
          responsavel?: string | null
          tipo_cobranca?: string | null
          updated_at?: string
        }
        Update: {
          cobranca_registrada?: boolean
          created_at?: string
          data_envio_nota?: string | null
          data_vencimento?: string | null
          dentro_prazo?: boolean
          empresa_id?: string
          enviado_por_user_id?: string | null
          id?: string
          mes_referencia?: string
          observacoes?: string | null
          periodo?: string
          responsavel?: string | null
          tipo_cobranca?: string | null
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
      ],
    },
  },
} as const
