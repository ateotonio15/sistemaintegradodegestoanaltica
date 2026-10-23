import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { processarRecebimento, type RecebimentoCentral } from "@/lib/nfse-central-validacao";

const ROTULO: Record<string, string> = {
  recebido_pendente: "Recebido", aguardando_faturado: "Aguardando “Faturado”",
  aguardando_faturamento_anexado: "Sem faturamento anexado", destino_ambiguo: "Destino ambíguo",
  aguardando_validacao: "Em validação", validacao_inconclusiva: "Validação inconclusiva",
  divergencia: "Divergência", fora_do_periodo: "Fora do período",
  aprovado_aguardando_liberacao: "Aprovado (não anexado)", vinculado: "Anexado", ja_recebido: "Já recebido", conflito: "Conflito",
};
const COR = (e: string) =>
  e === "vinculado" ? "default" : e === "divergencia" || e === "conflito" ? "destructive" : "secondary";
const brl = (c: number | null) => (c == null ? "—" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const cnpjFmt = (s: string) => s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
const PENDENTES = ["recebido_pendente", "aguardando_faturado", "aguardando_faturamento_anexado", "destino_ambiguo", "aguardando_validacao"];

export default function RecebidosCentral() {
  const qc = useQueryClient();
  const [processando, setProcessando] = useState(false);
  const rodou = useRef(false);
  const { data: config } = useQuery({
    queryKey: ["nfse-central-config"],
    queryFn: async () => (await supabase.from("nfse_central_config").select("auto_anexar_reais").eq("id", 1).maybeSingle()).data,
  });
  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["nfse-recebimentos"],
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.from("nfse_recebimentos").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data;
    },
  });

  const processar = async () => {
    setProcessando(true);
    try {
      for (const r of itens.filter((i) => PENDENTES.includes(i.estado))) {
        try { await processarRecebimento(r as RecebimentoCentral); } catch { /* segue para o próximo */ }
      }
    } finally {
      setProcessando(false);
      qc.invalidateQueries({ queryKey: ["nfse-recebimentos"] });
    }
  };
  useEffect(() => {
    if (!rodou.current && itens.some((i) => PENDENTES.includes(i.estado))) { rodou.current = true; processar(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Recebidos da Central</h1>
            <p className="text-sm text-muted-foreground">PDFs de NFS-e enviados pela Central e validados pelo SIGA.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={config?.auto_anexar_reais ? "default" : "outline"}>
              {config?.auto_anexar_reais ? "Anexação automática ligada" : "Anexação automática desligada (homologação)"}
            </Badge>
            <Button size="sm" variant="outline" onClick={processar} disabled={processando}>
              <RefreshCw className={`h-4 w-4 mr-1 ${processando ? "animate-spin" : ""}`} /> Reavaliar pendentes
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Recebimentos ({itens.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : !itens.length ? (
              <p className="text-sm text-muted-foreground">Nenhum PDF recebido ainda.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="p-2">Recebido</th><th className="p-2">NFS-e</th><th className="p-2">Tomador</th><th className="p-2">Emissão</th>
                    <th className="p-2">Resultado</th><th className="p-2 text-right">Faturamento</th><th className="p-2 text-right">PDF</th>
                    <th className="p-2 text-right">Diferença</th><th className="p-2">Motivo</th></tr>
                </thead>
                <tbody>
                  {itens.map((r) => (
                    <tr key={r.id} className="border-t align-top">
                      <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2">{r.numero_nfse ?? "—"}{r.homologacao && <Badge variant="outline" className="ml-1">Teste</Badge>}</td>
                      <td className="p-2 whitespace-nowrap">{cnpjFmt(r.cnpj_tomador)}</td>
                      <td className="p-2 whitespace-nowrap">{new Date(r.emitida_em).toLocaleDateString("pt-BR", { timeZone: "America/Manaus" })}</td>
                      <td className="p-2"><Badge variant={COR(r.estado) as any}>{ROTULO[r.estado] ?? r.estado}</Badge></td>
                      <td className="p-2 text-right">{brl(r.valor_excel_centavos)}</td>
                      <td className="p-2 text-right">{brl(r.valor_pdf_centavos)}</td>
                      <td className="p-2 text-right">{brl(r.diferenca_centavos)}</td>
                      <td className="p-2 max-w-md text-muted-foreground">{r.motivo ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
