
ALTER TABLE public.painel_tv_meta_diaria REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='painel_tv_meta_diaria'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.painel_tv_meta_diaria';
  END IF;
END $$;
