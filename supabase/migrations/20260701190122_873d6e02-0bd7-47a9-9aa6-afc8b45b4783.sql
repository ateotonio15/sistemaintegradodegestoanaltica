DROP POLICY IF EXISTS "tmp_import_uber" ON public.uber_corridas;
CREATE POLICY "tmp_import_uber" ON public.uber_corridas FOR INSERT TO anon WITH CHECK (true);
GRANT INSERT ON public.uber_corridas TO anon;