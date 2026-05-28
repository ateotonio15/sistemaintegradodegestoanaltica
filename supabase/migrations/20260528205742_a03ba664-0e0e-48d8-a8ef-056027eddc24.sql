CREATE OR REPLACE FUNCTION public.guard_movimentacoes_comum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_autorizado boolean;
  v_tipo text;
BEGIN
  IF public.has_role(v_uid, 'comum'::app_role) OR public.has_role(v_uid, 'administradoras'::app_role) THEN
    IF OLD.data_envio_financeiro IS NOT NULL
       AND NEW.data_envio_financeiro IS DISTINCT FROM OLD.data_envio_financeiro THEN

      SELECT e.tipo_contrato INTO v_tipo FROM public.empresas e WHERE e.id = NEW.empresa_id;

      -- Administradoras profile pode alterar envio ao financeiro em movimentações de contratos ADMINISTRADORA
      IF public.has_role(v_uid, 'administradoras'::app_role) AND v_tipo = 'ADMINISTRADORA' THEN
        v_autorizado := true;
      ELSE
        v_autorizado :=
             EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = NEW.empresa_id AND e.responsavel_user_id = v_uid)
          OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = NEW.empresa_id AND eu.user_id = v_uid);
      END IF;

      IF NOT v_autorizado THEN
        RAISE EXCEPTION 'Cadastro nao pode alterar envio ao financeiro de empresa que nao e sua responsabilidade';
      END IF;
      IF NEW.data_envio_financeiro IS NOT NULL AND NEW.data_envio_financeiro > CURRENT_DATE THEN
        RAISE EXCEPTION 'Data de envio ao Financeiro nao pode ser futura';
      END IF;
    END IF;
    NEW.dentro_prazo := OLD.dentro_prazo;
  END IF;
  RETURN NEW;
END;
$$;