import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buscarAgendaPaciente } from "@/lib/agenda-paciente-lookup";

export function useAgendaPaciente(cpf: string | null | undefined, nome: string | null | undefined, enabled = true) {
  const digits = String(cpf ?? "").replace(/\D/g, "");
  const paciente = String(nome ?? "").trim();
  const key = `${digits}|${paciente}`;
  const [ready, setReady] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setReady(key), 600);
    return () => clearTimeout(timer);
  }, [key]);
  const query = useQuery({
    queryKey: ["agenda-paciente", digits, paciente],
    queryFn: async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          buscarAgendaPaciente(digits, paciente),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("A agenda não respondeu a tempo.")), 20_000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
    enabled: enabled && ready === key && digits.length === 11 && paciente.length >= 3,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  // Nunca apresenta o aviso de outro paciente ou um resultado antigo depois de uma falha.
  return { ...query, data: enabled && ready === key && !query.isError ? query.data : undefined };
}