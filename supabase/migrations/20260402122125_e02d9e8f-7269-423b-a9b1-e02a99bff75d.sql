
-- Create notifications table
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('nova_empresa', 'implantacao')),
  empresa_id uuid NOT NULL,
  nome_empresa text NOT NULL,
  codigo_contrato text,
  responsavel_contrato text,
  data_implantacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Everyone can read notifications
CREATE POLICY "Authenticated read notificacoes"
ON public.notificacoes FOR SELECT TO authenticated
USING (true);

-- Track which notifications each user has read
CREATE TABLE public.notificacoes_lidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacao_id uuid NOT NULL REFERENCES public.notificacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notificacao_id, user_id)
);

ALTER TABLE public.notificacoes_lidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own lidas"
ON public.notificacoes_lidas FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users insert own lidas"
ON public.notificacoes_lidas FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Trigger function: create notification on empresa INSERT
CREATE OR REPLACE FUNCTION public.notify_nova_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notificacoes (tipo, empresa_id, nome_empresa, codigo_contrato, responsavel_contrato, data_implantacao)
  VALUES (
    'nova_empresa',
    NEW.id,
    NEW.nome,
    NEW.codigo_contrato,
    NEW.responsavel_contrato,
    NEW.data_implantacao::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_nova_empresa
AFTER INSERT ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.notify_nova_empresa();

-- Trigger function: create notification on implantacao date set
CREATE OR REPLACE FUNCTION public.notify_implantacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.data_implantacao IS NULL AND NEW.data_implantacao IS NOT NULL THEN
    INSERT INTO public.notificacoes (tipo, empresa_id, nome_empresa, codigo_contrato, responsavel_contrato, data_implantacao)
    VALUES (
      'implantacao',
      NEW.id,
      NEW.nome,
      NEW.codigo_contrato,
      NEW.responsavel_contrato,
      NEW.data_implantacao::text
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_implantacao
AFTER UPDATE ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.notify_implantacao();

-- Fix incorrect periods in movimentacoes based on data_corte
UPDATE movimentacoes m
SET periodo = CASE
  WHEN e.data_corte <= 5 THEN '01-05'
  WHEN e.data_corte <= 10 THEN '05-10'
  WHEN e.data_corte <= 15 THEN '10-15'
  WHEN e.data_corte <= 20 THEN '15-20'
  WHEN e.data_corte <= 25 THEN '20-25'
  ELSE '25-30'
END
FROM empresas e
WHERE e.id = m.empresa_id
AND e.tipo_movimentacao = 'Diária'
AND e.data_corte IS NOT NULL
AND (
  (e.data_corte <= 5 AND m.periodo != '01-05') OR
  (e.data_corte > 5 AND e.data_corte <= 10 AND m.periodo != '05-10') OR
  (e.data_corte > 10 AND e.data_corte <= 15 AND m.periodo != '10-15') OR
  (e.data_corte > 15 AND e.data_corte <= 20 AND m.periodo != '15-20') OR
  (e.data_corte > 20 AND e.data_corte <= 25 AND m.periodo != '20-25') OR
  (e.data_corte > 25 AND m.periodo != '25-30')
);
