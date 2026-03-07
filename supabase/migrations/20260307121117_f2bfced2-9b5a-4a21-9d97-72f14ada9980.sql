
ALTER TABLE public.empresa_usuarios
ADD CONSTRAINT empresa_usuarios_empresa_user_unique UNIQUE (empresa_id, user_id);
