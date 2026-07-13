import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  KPIS_JULHO_2026,
  CAMPANHAS_JULHO_2026,
  ENGAJAMENTO_JULHO_2026,
  TOP_EMPRESAS_JULHO_2026,
  TRIAGEM_JULHO_2026,
} from "../lib/exec-mock-julho-2026";

const sb = supabase as any;

export interface DashboardFilters {
  mes: number; // 1-12
  ano: number;
  empresaId?: string | null;
  tipo?: string | null;
  executiva?: string | null;
}

function startEndIso(mes: number, ano: number) {
  const ini = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0);
  const p = (d: Date) => d.toISOString().slice(0, 10);
  return { ini: p(ini), fim: p(fim) };
}

export function useDashboardExecutivo(filtros: DashboardFilters) {
  return useQuery({
    queryKey: ["exec_dashboard", filtros],
    queryFn: async () => {
      const { ini, fim } = startEndIso(filtros.mes, filtros.ano);

      const [acoesRes, palestrasRes, triagensRes] = await Promise.all([
        sb.from("acoes_saude")
          .select("id,empresa_id,data_acao,tem_pa,tem_glicemia,executiva_responsavel,empresa:empresas(nome)")
          .gte("data_acao", ini).lte("data_acao", fim),
        sb.from("palestras_saude")
          .select("id,empresa_id,data_palestra,tema,empresa:empresas(nome)")
          .gte("data_palestra", ini).lte("data_palestra", fim),
        sb.from("triagens").select("id,acao_id,pa_sistolica,pa_diastolica,glicemia,imc,tabagista"),
      ]);

      const acoes = acoesRes.data ?? [];
      const palestras = palestrasRes.data ?? [];

      // filtros
      const acoesF = acoes.filter((a: any) =>
        (!filtros.empresaId || a.empresa_id === filtros.empresaId) &&
        (!filtros.executiva || a.executiva_responsavel === filtros.executiva)
      );

      const isJulho2026 = filtros.mes === 7 && filtros.ano === 2026;
      const sinaisVitais = acoesF.filter((a: any) => a.tem_pa || a.tem_glicemia).length;
      const totalAcoes = acoesF.length + palestras.length;

      const empresasSet = new Set<string>();
      acoesF.forEach((a: any) => empresasSet.add(a.empresa_id));
      palestras.forEach((p: any) => empresasSet.add(p.empresa_id));

      const kpisReal = {
        totalAcoes,
        empresasAtendidas: empresasSet.size,
        palestras: palestras.length,
        psa: 0,
        sinaisVitais,
        coletasPreventivas: 0,
        campanhasAtivas: 0,
        mediaSemanal: Math.round(totalAcoes / 4.3),
      };

      // fallback quando o banco não tem dado ainda para o mês
      const useMock = isJulho2026 && totalAcoes < KPIS_JULHO_2026.totalAcoes;
      const kpis = useMock ? KPIS_JULHO_2026 : kpisReal;

      // Top empresas
      const contEmp = new Map<string, { nome: string; acoes: number }>();
      const feed = [
        ...acoesF.map((a: any) => ({ nome: a.empresa?.nome ?? "—" })),
        ...palestras.map((p: any) => ({ nome: p.empresa?.nome ?? "—" })),
      ];
      feed.forEach((f) => {
        const cur = contEmp.get(f.nome) ?? { nome: f.nome, acoes: 0 };
        cur.acoes += 1;
        contEmp.set(f.nome, cur);
      });
      const topEmpresas = useMock
        ? TOP_EMPRESAS_JULHO_2026
        : Array.from(contEmp.values()).sort((a, b) => b.acoes - a.acoes).slice(0, 8);

      const campanhas = useMock
        ? CAMPANHAS_JULHO_2026
        : [
            { nome: "Sinais Vitais", valor: sinaisVitais, cor: "#004d40" },
            { nome: "Palestras", valor: palestras.length, cor: "#1b998b" },
          ];

      const engajamento = useMock
        ? ENGAJAMENTO_JULHO_2026
        : [
            { nome: "Sinais Vitais", valor: sinaisVitais, pct: totalAcoes ? +(sinaisVitais / totalAcoes * 100).toFixed(1) : 0, cor: "#004d40" },
            { nome: "Palestras", valor: palestras.length, pct: totalAcoes ? +(palestras.length / totalAcoes * 100).toFixed(1) : 0, cor: "#1b998b" },
          ];

      const triagens = triagensRes.data ?? [];
      const triagemAgg = useMock ? TRIAGEM_JULHO_2026 : (() => {
        // agrega por empresa a partir de acoes+triagens
        const acaoEmpresa = new Map<string, string>();
        acoesF.forEach((a: any) => acaoEmpresa.set(a.id, a.empresa?.nome ?? "—"));
        const perEmp = new Map<string, any>();
        triagens.forEach((t: any) => {
          const emp = acaoEmpresa.get(t.acao_id);
          if (!emp) return;
          const cur = perEmp.get(emp) ?? { empresa: emp, atendidos: 0, pa_alta: 0, gli_alta: 0, imc_alto: 0, tabagismo: 0 };
          cur.atendidos += 1;
          if ((t.pa_sistolica ?? 0) >= 140 || (t.pa_diastolica ?? 0) >= 90) cur.pa_alta += 1;
          if ((t.glicemia ?? 0) >= 200) cur.gli_alta += 1;
          if ((t.imc ?? 0) >= 30) cur.imc_alto += 1;
          if (t.tabagista) cur.tabagismo += 1;
          perEmp.set(emp, cur);
        });
        return Array.from(perEmp.values()).sort((a, b) => b.atendidos - a.atendidos);
      })();

      return { kpis, campanhas, engajamento, topEmpresas, triagemAgg, usouMock: useMock };
    },
  });
}
