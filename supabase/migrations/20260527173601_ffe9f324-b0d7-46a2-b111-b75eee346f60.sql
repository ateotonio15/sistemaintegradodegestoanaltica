
-- Fix anexos-implantacao storage policies: restrict to authenticated role
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname IN ('Implantacao delete anexos','Implantacao update anexos')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Implantacao delete anexos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'anexos-implantacao'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid())
);

CREATE POLICY "Implantacao update anexos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'anexos-implantacao'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid())
)
WITH CHECK (
  bucket_id = 'anexos-implantacao'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner = auth.uid())
);

-- Restrict Realtime channel subscriptions: only authenticated users with explicit role
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated app users can use realtime" ON realtime.messages;

CREATE POLICY "Authenticated app users can use realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  OR public.has_role(auth.uid(), 'diretora'::public.app_role)
  OR public.has_role(auth.uid(), 'visualizacao'::public.app_role)
  OR public.has_role(auth.uid(), 'administradoras'::public.app_role)
  OR public.has_role(auth.uid(), 'comum'::public.app_role)
  OR public.has_role(auth.uid(), 'executivo'::public.app_role)
  OR public.has_role(auth.uid(), 'enfermeira'::public.app_role)
  OR public.has_role(auth.uid(), 'vendas'::public.app_role)
);
