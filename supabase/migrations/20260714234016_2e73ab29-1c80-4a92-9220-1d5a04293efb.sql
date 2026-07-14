
ALTER TABLE public.atendimentos_mensagens REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimentos_mensagens';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
