import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

export function HistoricoFechamento({ movimentacaoId }: { movimentacaoId: string | null }) {
  const [aberto, setAberto] = useState(false);
  const { data, isError, isLoading } = useQuery({
    queryKey: ["historico-fechamento", movimentacaoId], enabled: aberto && !!movimentacaoId,
    queryFn: async () => {
      if (!movimentacaoId) return [];
      const { data, error } = await supabase.from("movimentacao_fechamento_historico")
        .select("*").eq("movimentacao_id", movimentacaoId).order("criado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  if (!movimentacaoId) return null;
  return <Dialog open={aberto} onOpenChange={setAberto}>
    <DialogTrigger asChild><Button type="button" variant="ghost" size="sm" className="h-7 w-fit px-0 text-xs text-muted-foreground"><History className="mr-1.5 h-3.5 w-3.5" />Ver histórico</Button></DialogTrigger>
    <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Histórico do fechamento</DialogTitle><DialogDescription>Registros da movimentação selecionada.</DialogDescription></DialogHeader>
      {isLoading && <p role="status" className="text-sm text-muted-foreground">Carregando histórico...</p>}
      {isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar o histórico do fechamento.</p>}
      {!isLoading && !isError && !data?.length && <p className="text-sm text-muted-foreground">Nenhum registro de fechamento.</p>}
    <ul className="space-y-3 divide-y divide-border">
      {data?.map(item => <li key={item.id} className="text-xs space-y-1 break-words pt-3 first:pt-0">
        <p className="text-muted-foreground">{new Date(item.criado_em).toLocaleString("pt-BR", { timeZone: "America/Manaus" })}</p>
        <p className="font-medium">{item.evento === "arquivo_importado" ? "Arquivo importado automaticamente" : "Continuou com documentos pendentes"}</p>
        {item.nome_arquivo && <p>{item.nome_arquivo} · {item.tipo_relatorio}</p>}
        {item.pendencias.length > 0 && <p className="text-warning">Pendências: {item.pendencias.join("; ")}</p>}
        <p>Contrato: {item.contrato} · Competência: {item.competencia} · {item.origem}</p>
        <p>Responsável: {item.usuario_nome}</p>
      </li>)}
    </ul>
    </DialogContent>
  </Dialog>;
}