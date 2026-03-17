-- Add executiva_user_id column to empresas
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS executiva_user_id uuid;

-- Copy existing responsavel_user_id to executiva_user_id for empresas that had an executivo assigned
-- (We'll handle data migration separately if needed)
