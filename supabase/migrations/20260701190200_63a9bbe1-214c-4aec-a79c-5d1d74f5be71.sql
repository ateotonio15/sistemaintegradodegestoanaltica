DROP POLICY IF EXISTS "tmp_import_uber" ON public.uber_corridas;
REVOKE INSERT ON public.uber_corridas FROM anon;