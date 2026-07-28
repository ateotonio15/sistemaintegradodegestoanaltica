
CREATE POLICY "atd anexos read auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'atendimentos-anexos');

CREATE POLICY "atd anexos insert auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'atendimentos-anexos');

CREATE POLICY "atd anexos update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'atendimentos-anexos' AND owner = auth.uid());

CREATE POLICY "atd anexos delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'atendimentos-anexos' AND owner = auth.uid());
