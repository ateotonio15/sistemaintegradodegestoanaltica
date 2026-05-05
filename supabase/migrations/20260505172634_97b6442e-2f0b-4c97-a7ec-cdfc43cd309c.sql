-- Replace executive UPDATE policy to allow updating any company
DROP POLICY IF EXISTS "Executivo update linked empresas" ON public.empresas;

CREATE POLICY "Executivo update empresas"
ON public.empresas
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'executivo'::app_role))
WITH CHECK (has_role(auth.uid(), 'executivo'::app_role));

-- Trigger: restrict executivo to only changing executiva_user_id (not admin bypass)
CREATE OR REPLACE FUNCTION public.guard_empresas_executivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Only enforce when the user is executivo and NOT admin
  IF public.has_role(v_uid, 'executivo'::app_role)
     AND NOT public.has_role(v_uid, 'admin'::app_role) THEN

    -- Allow only changes to executiva_user_id (and updated_at). Block any other field change.
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
       OR NEW.vidas IS DISTINCT FROM OLD.vidas THEN
      RAISE EXCEPTION 'Executiva só pode alterar a executiva responsável da empresa';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_empresas_executivo ON public.empresas;
CREATE TRIGGER trg_guard_empresas_executivo
BEFORE UPDATE ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.guard_empresas_executivo();