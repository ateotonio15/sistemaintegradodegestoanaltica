-- Add tipo_contrato to empresas
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS tipo_contrato text NOT NULL DEFAULT 'EMPRESARIAL';

ALTER TABLE public.empresas
  DROP CONSTRAINT IF EXISTS empresas_tipo_contrato_check;
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_tipo_contrato_check
  CHECK (tipo_contrato IN ('EMPRESARIAL','ADMINISTRADORA'));

-- Update guard_empresas_executivo
CREATE OR REPLACE FUNCTION public.guard_empresas_executivo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF public.has_role(v_uid, 'executivo'::app_role)
     AND NOT public.has_role(v_uid, 'admin'::app_role) THEN
    IF NEW.nome IS DISTINCT FROM OLD.nome
       OR NEW.cnpj IS DISTINCT FROM OLD.cnpj
       OR NEW.responsavel_contrato IS DISTINCT FROM OLD.responsavel_contrato
       OR NEW.operadora_plano IS DISTINCT FROM OLD.operadora_plano
       OR NEW.data_corte IS DISTINCT FROM OLD.data_corte
       OR NEW.dia_movimentacao IS DISTINCT FROM OLD.dia_movimentacao
       OR NEW.observacoes IS DISTINCT FROM OLD.observacoes
       OR NEW.codigo_contrato IS DISTINCT FROM OLD.codigo_contrato
       OR NEW.tipo_movimentacao IS DISTINCT FROM OLD.tipo_movimentacao
       OR NEW.periodo_movimentacao IS DISTINCT FROM OLD.periodo_movimentacao
       OR NEW.email_empresa IS DISTINCT FROM OLD.email_empresa
       OR NEW.status_empresa IS DISTINCT FROM OLD.status_empresa
       OR NEW.data_implantacao IS DISTINCT FROM OLD.data_implantacao
       OR NEW.responsavel_user_id IS DISTINCT FROM OLD.responsavel_user_id
       OR NEW.prazo IS DISTINCT FROM OLD.prazo
       OR NEW.grupo_contrato IS DISTINCT FROM OLD.grupo_contrato
       OR NEW.telefone_empresa IS DISTINCT FROM OLD.telefone_empresa
       OR NEW.contato_empresa IS DISTINCT FROM OLD.contato_empresa
       OR NEW.data_vencimento_fatura IS DISTINCT FROM OLD.data_vencimento_fatura
       OR NEW.data_emissao_fatura IS DISTINCT FROM OLD.data_emissao_fatura
       OR NEW.endereco IS DISTINCT FROM OLD.endereco
       OR NEW.contrato_faixa_etaria IS DISTINCT FROM OLD.contrato_faixa_etaria
       OR NEW.contrato_suspenso IS DISTINCT FROM OLD.contrato_suspenso
       OR NEW.data_suspensao IS DISTINCT FROM OLD.data_suspensao
       OR NEW.motivo_suspensao IS DISTINCT FROM OLD.motivo_suspensao
       OR NEW.tipo_financeiro IS DISTINCT FROM OLD.tipo_financeiro
       OR NEW.data_rescisao IS DISTINCT FROM OLD.data_rescisao
       OR NEW.tipo_contrato IS DISTINCT FROM OLD.tipo_contrato
       OR NEW.vidas IS DISTINCT FROM OLD.vidas THEN
      RAISE EXCEPTION 'Executiva só pode alterar a executiva responsável da empresa';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- RLS policies for administradoras
CREATE POLICY "Administradoras view all empresas"
  ON public.empresas FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role));

CREATE POLICY "Administradoras view all movimentacoes"
  ON public.movimentacoes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role));

CREATE POLICY "Administradoras view all empresa_usuarios"
  ON public.empresa_usuarios FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role));

CREATE POLICY "Administradoras view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role));

CREATE POLICY "Administradoras read implantacoes"
  ON public.implantacoes_contratos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role));

CREATE POLICY "Administradoras read impl anexos"
  ON public.implantacao_anexos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role));