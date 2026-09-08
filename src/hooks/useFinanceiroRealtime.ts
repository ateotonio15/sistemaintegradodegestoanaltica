import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscription Realtime EXCLUSIVA da aba Financeiro.
 *
 * - Monta UM canal único por instância (cleanup ao desmontar).
 * - Escuta INSERT/UPDATE/DELETE das tabelas que alimentam a tabela Financeiro:
 *   financeiro_movimentacoes, anexos_financeiro, financeiro_pagadores,
 *   cobrancas, movimentacoes, anexos_movimentacao.
 * - Invalida apenas as query-keys correspondentes (refetch incremental do
 *   React Query — sem reload de página, sem reset de filtros/estado local).
 * - Eventos são acumulados e aplicados em batch (debounce) para evitar
 *   tempestades de refetch.
 * - Se chegar um burst (>= burstThreshold em janela curta), em vez de
 *   atualizar sozinho, devolve `pendingCount > 0` para o componente
 *   exibir um aviso "Novas alterações disponíveis" com botão manual.
 */
export function useFinanceiroRealtime(opts: {
  enabled: boolean;
  mesReferencia: string;
  debounceMs?: number;
  burstThreshold?: number;
  burstWindowMs?: number;
}) {
  const {
    enabled,
    mesReferencia,
    debounceMs = 350,
    burstThreshold = 8,
    burstWindowMs = 2000,
  } = opts;

  const qc = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);

  const pendingKeysRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstWindowStartRef = useRef<number>(0);
  const burstCountRef = useRef<number>(0);
  const burstModeRef = useRef<boolean>(false);

  const flush = () => {
    const keys = Array.from(pendingKeysRef.current);
    pendingKeysRef.current.clear();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    burstModeRef.current = false;
    burstCountRef.current = 0;
    setPendingCount(0);
    keys.forEach((k) => {
      qc.invalidateQueries({ queryKey: [k] });
    });
  };

  useEffect(() => {
    if (!enabled) return;

    const enqueue = (queryKey: string) => {
      pendingKeysRef.current.add(queryKey);

      // Detecção de burst (muitas mudanças em janela curta)
      const now = Date.now();
      if (now - burstWindowStartRef.current > burstWindowMs) {
        burstWindowStartRef.current = now;
        burstCountRef.current = 0;
        burstModeRef.current = false;
      }
      burstCountRef.current += 1;

      if (burstCountRef.current >= burstThreshold) {
        burstModeRef.current = true;
      }

      // Em burst apenas aumentamos o debounce (coalescência), mas SEMPRE
      // atualizamos automaticamente — nunca exigimos reload manual.
      const delay = burstModeRef.current ? Math.max(debounceMs, 1200) : debounceMs;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, delay);
    };


    const channel = supabase
      .channel(`financeiro-realtime-${mesReferencia}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financeiro_movimentacoes" },
        (payload) => {
          const row: any = payload.new ?? payload.old;
          if (!row || row.mes_referencia === mesReferencia) {
            enqueue("financeiro");
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "anexos_financeiro" },
        () => enqueue("financeiro-anexos-list"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financeiro_pagadores" },
        () => enqueue("financeiro-pagadores-all"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cobrancas" },
        () => enqueue("cobrancas-abertas"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "movimentacoes" },
        (payload) => {
          const row: any = payload.new ?? payload.old;
          if (!row || row.mes_referencia === mesReferencia) {
            enqueue("financeiro-operacionais-v3");
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "anexos_movimentacao" },
        () => enqueue("financeiro-operacionais-v3"),
      )
      .subscribe();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingKeysRef.current.clear();
      burstModeRef.current = false;
      burstCountRef.current = 0;
      setPendingCount(0);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, mesReferencia, debounceMs, burstThreshold, burstWindowMs]);

  return { pendingCount, applyPending: flush };
}
