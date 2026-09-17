import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";

export const IDIOMAS_DISPONIVEIS = [{ value: "pt-BR", label: "Português (Brasil)" }];

export interface UserPreferences {
  tema: ThemeMode;
  idioma: string;
  /** true quando o usuário já tem preferência gravada no banco */
  salvo?: boolean;
}

const DEFAULTS: UserPreferences = { tema: "system", idioma: "pt-BR" };

function normalizeTema(value: string | null | undefined): ThemeMode {
  return value === "dark" || value === "light" || value === "system" ? value : DEFAULTS.tema;
}

/** Preferências pessoais do usuário logado (somente as próprias, garantido por RLS). */
export function useUserPreferences() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-preferences", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<UserPreferences> => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("tema, idioma")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { ...DEFAULTS, salvo: false };
      return { tema: normalizeTema(data.tema), idioma: data.idioma || DEFAULTS.idioma, salvo: true };
    },
    staleTime: Infinity,
  });
}

export function useSaveUserPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefs: UserPreferences) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: user.id, tema: prefs.tema, idioma: prefs.idioma }, { onConflict: "user_id" });
      if (error) throw error;
      return prefs;
    },
    onSuccess: (prefs) => {
      queryClient.setQueryData(["user-preferences", user?.id], { ...prefs, salvo: true });
    },
  });
}

/**
 * Aplica o tema salvo do usuário UMA vez por sessão/login.
 * Não reaplica em refetches para não desfazer a troca feita no botão de tema.
 */
export function useApplyUserTheme() {
  const { user } = useAuth();
  const { setMode } = useTheme();
  const { data } = useUserPreferences();
  const aplicadoPara = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || !data) return;
    if (aplicadoPara.current === user.id) return;
    aplicadoPara.current = user.id;
    // Sem preferência gravada: mantém a escolha local do dispositivo.
    if (!data.salvo) return;
    setMode(data.tema);
  }, [user?.id, data, setMode]);
}

/** Troca claro/escuro e grava a escolha no perfil do usuário. */
export function usePersistentThemeToggle() {
  const { theme, setMode } = useTheme();
  const { data } = useUserPreferences();
  const salvar = useSaveUserPreferences();

  return useCallback(() => {
    const proximo: ThemeMode = theme === "dark" ? "light" : "dark";
    setMode(proximo);
    salvar.mutate({ tema: proximo, idioma: data?.idioma || DEFAULTS.idioma });
  }, [theme, setMode, salvar, data?.idioma]);
}
