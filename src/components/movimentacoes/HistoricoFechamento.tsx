import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function HistoricoFechamento({ movimentacaoId }: { movimentacaoId: string | null }) {
  const { data, isError } = useQuery({
    queryKey: ["historico-fechamento", movimentacaoId], enabled: !!movimentacaoId,
    queryFn: async () => {
      if (!movimentacaoId) return [];
      const { data, error } = await supabase.from("movimentacao_fechamento_historico")
        .select("*").eq("movimentacao_id", movimentacaoId).order("criado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  if (isError) return <p className="text-xs text-destructive">Não foi possível carregar o histórico do fechamento.</p>;
  if (!data?.length) return null;
  return <details className="border-t border-border pt-2">
    <summary className="cursor-pointer text-xs font-medium">Histórico do fechamento ({data.length})</summary>
    <ul className="mt-2 max-h-60 space-y-3 overflow-y-auto">
      {data.map(item => <li key={item.id} className="text-xs space-y-1 break-words">
        <p className="text-muted-foreground">{new Date(item.criado_em).toLocaleString("pt-BR", { timeZone: "America/Manaus" })}</p>
        <p className="font-medium">{item.evento === "arquivo_importado" ? "Arquivo importado automaticamente" : "Continuou com documentos pendentes"}</p>
        {item.nome_arquivo && <p>{item.nome_arquivo} · {item.tipo_relatorio}</p>}
        {item.pendencias.length > 0 && <p className="text-warning">Pendências: {item.pendencias.join("; ")}</p>}
        <p>Contrato: {item.contrato} · Competência: {item.competencia} · {item.origem}</p>
        <p>Responsável: {item.usuario_nome}</p>
      </li>)}
    </ul>
  </details>;
}