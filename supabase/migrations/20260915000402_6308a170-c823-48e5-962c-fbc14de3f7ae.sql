CREATE TABLE public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tema TEXT NOT NULL DEFAULT 'system',
  idioma TEXT NOT NULL DEFAULT 'pt-BR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_prefs_select" ON public.user_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own_prefs_insert" ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_prefs_update" ON public.user_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_prefs_delete" ON public.user_preferences FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();