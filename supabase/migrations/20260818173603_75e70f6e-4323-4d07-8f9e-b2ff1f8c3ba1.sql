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
       OR NEW.status_empresa IS DISTINCT FROM OLD.status_empresa
       OR NEW.data_implantacao IS DISTINCT FROM OLD.data_implantacao
       OR NEW.responsavel_user_id IS DISTINCT FROM OLD.responsavel_user_id
       OR NEW.prazo IS DISTINCT FROM OLD.prazo
       OR NEW.grupo_contrato IS DISTINCT FROM OLD.grupo_contrato
       OR NEW.data_vencimento_fatura IS DISTINCT FROM OLD.data_vencimento_fatura
       OR NEW.data_emissao_fatura IS DISTINCT FROM OLD.data_emissao_fatura
       OR NEW.contrato_faixa_etaria IS DISTINCT FROM OLD.contrato_faixa_etaria
       OR NEW.contrato_suspenso IS DISTINCT FROM OLD.contrato_suspenso
       OR NEW.data_suspensao IS DISTINCT FROM OLD.data_suspensao
       OR NEW.motivo_suspensao IS DISTINCT FROM OLD.motivo_suspensao
       OR NEW.tipo_financeiro IS DISTINCT FROM OLD.tipo_financeiro
       OR NEW.data_rescisao IS DISTINCT FROM OLD.data_rescisao
       OR NEW.tipo_contrato IS DISTINCT FROM OLD.tipo_contrato
       OR NEW.vidas IS DISTINCT FROM OLD.vidas THEN
      RAISE EXCEPTION 'Executiva só pode alterar a executiva responsável e os dados de contato da empresa';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;