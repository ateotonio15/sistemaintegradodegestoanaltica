import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnexoMovGrupo {
  id: string;
  movimentacao_id: string;
  empresa_id: string;
  nome_arquivo: string;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
  /** true quando o anexo pertence a outro contrato do mesmo Grupo Financeiro */
  do_grupo: boolean;
  /** nome da empresa de origem (preenchido quando do_grupo) */
  origem_empresa: string | null;
}

export interface GrupoMovInfo {
  grupoId: string | null;
  nomeGrupo: string | null;
  principalEmpresaId: string | null;
  /** empresa_id -> nome, dos contratos ativos do grupo */
  empresas: { empresa_id: string; nome: string | null }[];
  /** movimentações irmãs (mesma competência/período) dos demais contratos */
  irmaosMovIds: string[];
  /** movimentação da empresa atual */
  empresaId: string | null;
  ehPrincipal: boolean;
  ehSecundario: boolean;
}

async function carregarGrupoDaMovimentacao(movimentacaoId: string): Promise<{
  info: GrupoMovInfo;
  nomePorEmpresa: Map<string, string | null>;
} | null> {
  const { data: mov } = await supabase
    .from("movimentacoes")
    .select("id, empresa_id, mes_referencia, periodo")
    .eq("id", movimentacaoId)
    .maybeSingle();
  if (!mov) return null;

  const vazio: GrupoMovInfo = {
    grupoId: null,
    nomeGrupo: null,
    principalEmpresaId: null,
    empresas: [],
    irmaosMovIds: [],
    empresaId: mov.empresa_id,
    ehPrincipal: false,
    ehSecundario: false,
  };

  const { data: vinc } = await supabase
    .from("grupos_financeiros_contratos" as any)
    .select("grupo_id")
    .eq("empresa_id", mov.empresa_id)
    .eq("ativo", true)
    .maybeSingle();
  const grupoId = (vinc as any)?.grupo_id as string | undefined;
  if (!grupoId) return { info: vazio, nomePorEmpresa: new Map() };

  const [{ data: grupo }, { data: contratos }] = await Promise.all([
    supabase
      .from("grupos_financeiros" as any)
      .select("id, nome_grupo, status, contrato_principal_empresa_id")
      .eq("id", grupoId)
      .maybeSingle(),
    supabase
      .from("grupos_financeiros_contratos" as any)
      .select("empresa_id, nome_empresa")
      .eq("grupo_id", grupoId)
      .eq("ativo", true),
  ]);

  if (!grupo || (grupo as any).status !== "Ativo") return { info: vazio, nomePorEmpresa: new Map() };

  const lista = ((contratos as any[]) ?? []).map((c) => ({
    empresa_id: c.empresa_id as string,
    nome: (c.nome_empresa ?? null) as string | null,
  }));
  const nomePorEmpresa = new Map(lista.map((c) => [c.empresa_id, c.nome]));
  const outrasEmpresas = lista.map((c) => c.empresa_id).filter((id) => id !== mov.empresa_id);

  let irmaosMovIds: string[] = [];
  if (outrasEmpresas.length) {
    const { data: irmaos } = await supabase
      .from("movimentacoes")
      .select("id")
      .in("empresa_id", outrasEmpresas)
      .eq("mes_referencia", mov.mes_referencia)
      .eq("periodo", mov.periodo);
    irmaosMovIds = ((irmaos as any[]) ?? []).map((r) => r.id as string);
  }

  const principalEmpresaId = ((grupo as any).contrato_principal_empresa_id ?? null) as string | null;

  return {
    info: {
      grupoId,
      nomeGrupo: (grupo as any).nome_grupo as string,
      principalEmpresaId,
      empresas: lista,
      irmaosMovIds,
      empresaId: mov.empresa_id,
      ehPrincipal: !!principalEmpresaId && principalEmpresaId === mov.empresa_id,
      ehSecundario: !!principalEmpresaId && principalEmpresaId !== mov.empresa_id,
    },
    nomePorEmpresa,
  };
}

/**
 * Anexos da movimentação + anexos das movimentações irmãs do mesmo
 * Grupo Financeiro (mesma competência/período), apenas exibidos.
 */
export function useAnexosMovimentacaoGrupo(movimentacaoId: string | null | undefined) {
  return useQuery({
    queryKey: ["anexos-movimentacao-grupo", movimentacaoId],
    enabled: !!movimentacaoId,
    queryFn: async () => {
      const carregado = await carregarGrupoDaMovimentacao(movimentacaoId!);
      const info: GrupoMovInfo =
        carregado?.info ?? {
          grupoId: null,
          nomeGrupo: null,
          principalEmpresaId: null,
          empresas: [],
          irmaosMovIds: [],
          empresaId: null,
          ehPrincipal: false,
          ehSecundario: false,
        };
      const nomePorEmpresa = carregado?.nomePorEmpresa ?? new Map<string, string | null>();

      const ids = [movimentacaoId!, ...info.irmaosMovIds];
      const { data, error } = await supabase
        .from("anexos_movimentacao")
        .select("*")
        .in("movimentacao_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const anexos: AnexoMovGrupo[] = ((data as any[]) ?? []).map((a) => ({
        ...a,
        do_grupo: a.movimentacao_id !== movimentacaoId,
        origem_empresa:
          a.movimentacao_id !== movimentacaoId ? nomePorEmpresa.get(a.empresa_id) ?? null : null,
      }));

      return { anexos, grupo: info };
    },
    staleTime: 10_000,
  });
}
