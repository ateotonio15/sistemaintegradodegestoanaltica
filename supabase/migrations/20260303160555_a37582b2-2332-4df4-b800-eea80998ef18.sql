
-- Add responsavel_user_id column to empresas
ALTER TABLE public.empresas
ADD COLUMN responsavel_user_id uuid REFERENCES public.profiles(user_id);

-- Add foreign key constraint on empresa_usuarios if missing
-- empresa_usuarios already exists, just ensure cascade
ALTER TABLE public.empresa_usuarios
DROP CONSTRAINT IF EXISTS empresa_usuarios_empresa_id_fkey;
ALTER TABLE public.empresa_usuarios
ADD CONSTRAINT empresa_usuarios_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.empresa_usuarios
DROP CONSTRAINT IF EXISTS empresa_usuarios_user_id_fkey;
ALTER TABLE public.empresa_usuarios
ADD CONSTRAINT empresa_usuarios_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add unique constraint if not exists
ALTER TABLE public.empresa_usuarios
DROP CONSTRAINT IF EXISTS empresa_usuarios_empresa_id_user_id_key;
ALTER TABLE public.empresa_usuarios
ADD CONSTRAINT empresa_usuarios_empresa_id_user_id_key UNIQUE (empresa_id, user_id);

-- Drop old RLS policies on empresas that we'll replace
DROP POLICY IF EXISTS "User view linked empresas" ON public.empresas;

-- New policy: user sees empresas where responsavel_user_id = auth.uid() OR linked via empresa_usuarios
CREATE POLICY "User view own empresas"
ON public.empresas
FOR SELECT
USING (
  responsavel_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.empresa_id = empresas.id AND eu.user_id = auth.uid()
  )
);

-- Backfill: set responsavel_user_id based on existing empresa_usuarios links
UPDATE public.empresas e
SET responsavel_user_id = eu.user_id
FROM public.empresa_usuarios eu
WHERE eu.empresa_id = e.id
AND e.responsavel_user_id IS NULL;
