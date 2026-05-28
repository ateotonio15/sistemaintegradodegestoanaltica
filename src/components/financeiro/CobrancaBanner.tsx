import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle } from "lucide-react";

interface CobrancaAberta {
  id: string;
  motivo: string;
  data: string;
  observacao: string | null;
  empresa_id: string;
  empresa_nome: string;
}

export function CobrancaBanner() {
  const { user, isAdmin, role, isExecutivo } = useAuth();
  const navigate = useNavigate();

  const { data: cobrancas = [] } = useQuery<CobrancaAberta[]>({
    queryKey: ["cobrancas-abertas-user", user?.id, role],
    queryFn: async () => {
      if (!user) return [];

      // 1) IDs de empresas que o usuário "vê" para fins de alerta
      let empresaIds: string[] = [];

      if (isAdmin) {
        // admin vê tudo — busca todas com cobrança aberta sem filtrar
        const { data: cobs, error } = await supabase
          .from("cobrancas")
          .select("id, motivo, data, observacao, financeiro_movimentacao_id")
          .eq("status", "aberta")
          .order("data", { ascending: false })
          .limit(20);
        if (error) throw error;
        if (!cobs || cobs.length === 0) return [];
        const movIds = cobs.map((c) => c.financeiro_movimentacao_id);
        const { data: movs } = await supabase
          .from("financeiro_movimentacoes")
          .select("id, empresa_id")
          .in("id", movIds);
        const movMap = new Map((movs ?? []).map((m: any) => [m.id, m.empresa_id]));
        const empIds = Array.from(new Set((movs ?? []).map((m: any) => m.empresa_id)));
        const { data: emps } = await supabase
          .from("empresas")
          .select("id, nome")
          .in("id", empIds);
        const empMap = new Map((emps ?? []).map((e: any) => [e.id, e.nome]));
        return cobs.map((c) => ({
          id: c.id,
          motivo: c.motivo,
          data: c.data,
          observacao: c.observacao,
          empresa_id: movMap.get(c.financeiro_movimentacao_id) ?? "",
          empresa_nome: empMap.get(movMap.get(c.financeiro_movimentacao_id) ?? "") ?? "—",
        }));
      }

      if (isExecutivo) {
        const { data: emps } = await supabase
          .from("empresas")
          .select("id, nome")
          .eq("executiva_user_id", user.id);
        empresaIds = (emps ?? []).map((e: any) => e.id);
      } else if (role === "comum" || role === "administradoras") {
        const { data: links } = await supabase
          .from("empresa_usuarios")
          .select("empresa_id, empresas:empresa_id(nome)")
          .eq("user_id", user.id);
        empresaIds = (links ?? []).map((l: any) => l.empresa_id);
        const { data: resp } = await supabase
          .from("empresas")
          .select("id, nome")
          .eq("responsavel_user_id", user.id);
        for (const e of resp ?? []) {
          if (!empresaIds.includes(e.id)) empresaIds.push(e.id);
        }
      } else {
        return [];
      }

      if (empresaIds.length === 0) return [];

      // 2) Buscar movs financeiras dessas empresas
      const { data: movs } = await supabase
        .from("financeiro_movimentacoes")
        .select("id, empresa_id")
        .in("empresa_id", empresaIds);
      if (!movs || movs.length === 0) return [];
      const movIds = movs.map((m: any) => m.id);
      const movMap = new Map(movs.map((m: any) => [m.id, m.empresa_id]));

      // 3) Buscar cobranças abertas dessas movs
      const { data: cobs } = await supabase
        .from("cobrancas")
        .select("id, motivo, data, observacao, financeiro_movimentacao_id")
        .in("financeiro_movimentacao_id", movIds)
        .eq("status", "aberta")
        .order("data", { ascending: false })
        .limit(20);
      if (!cobs || cobs.length === 0) return [];

      // 4) Nome empresa
      const empIds = Array.from(new Set(cobs.map((c) => movMap.get(c.financeiro_movimentacao_id))));
      const { data: emps } = await supabase
        .from("empresas")
        .select("id, nome")
        .in("id", empIds as string[]);
      const empMap = new Map((emps ?? []).map((e: any) => [e.id, e.nome]));

      return cobs.map((c) => ({
        id: c.id,
        motivo: c.motivo,
        data: c.data,
        observacao: c.observacao,
        empresa_id: (movMap.get(c.financeiro_movimentacao_id) as string) ?? "",
        empresa_nome: empMap.get(movMap.get(c.financeiro_movimentacao_id) as string) ?? "—",
      }));
    },
    enabled: !!user,
  });

  if (cobrancas.length === 0) return null;

  const first = cobrancas[0];
  const more = cobrancas.length - 1;

  return (
    <button
      onClick={() => navigate(isAdmin ? "/financeiro" : "/movimentacoes")}
      className="w-full text-left rounded-xl border border-destructive/40 bg-destructive/10 hover:bg-destructive/15 transition-colors p-3 flex items-center gap-3"
    >
      <div className="h-9 w-9 rounded-lg bg-destructive/20 flex items-center justify-center shrink-0">
        <AlertTriangle className="h-4 w-4 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-destructive">
          ⚠️ {first.empresa_nome} possui pendência financeira
          {more > 0 && (
            <span className="ml-1 font-normal text-destructive/80">
              (+{more} {more === 1 ? "outra" : "outras"})
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          Motivo: {first.motivo}
          {first.observacao ? ` — ${first.observacao}` : ""}
        </p>
      </div>
    </button>
  );
}
