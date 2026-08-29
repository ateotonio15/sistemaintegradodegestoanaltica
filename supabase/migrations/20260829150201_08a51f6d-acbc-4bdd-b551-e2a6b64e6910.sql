ALTER TABLE public.grupos_financeiros
  ADD COLUMN IF NOT EXISTS contrato_principal_empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;