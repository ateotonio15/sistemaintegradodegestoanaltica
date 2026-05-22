import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, XCircle, FileText, Building2, Users, Calendar, Paperclip, Rocket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SelecionarResponsavelCadastroDialog } from "./SelecionarResponsavelCadastroDialog";
import { formatDateBR, formatDay } from "@/lib/date-utils";
import { formatCentavosBRL } from "@/lib/reajuste-utils";


interface Props {
  implantacaoId: string;
  open: boolean;
  onClose: () => void;
  readOnly?: boolean;
}

export function AnaliseImplantacaoDialog({ implantacaoId, open, onClose, readOnly = false }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [obs, setObs] = useState("");
  const [motivo, setMotivo] = useState("");
  const [mode, setMode] = useState<"view" | "correcao" | "rejeicao">("view");
  const [atribuirOpen, setAtribuirOpen] = useState(false);

  const { data: impl } = useQuery({
    queryKey: ["impl-analise", implantacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes_contratos" as any)
        .select("*")
        .eq("id", implantacaoId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: open && !!implantacaoId,
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ["impl-anexos", implantacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_anexos" as any)
        .select("*")
        .eq("implantacao_id", implantacaoId);
      if (error) throw error;
      return data as any[];
    },
    enabled: open && !!implantacaoId,
  });

  const aprovar = useMutation({
    mutationFn: async (resp: { userId: string; userNome: string }) => {
      const { error } = await supabase.rpc("aprovar_implantacao" as any, {
        p_impl: implantacaoId,
        p_observacao: obs || null,
        p_responsavel: resp.userId,
        p_responsavel_nome: resp.userNome,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["impl-alertas"] });
      toast({ title: "Contrato aprovado e atribuído ao Cadastro!" });
      setAtribuirOpen(false);
      onClose();
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao aprovar", variant: "destructive" }),
  });

  const corrigir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("solicitar_correcao_implantacao" as any, { p_impl: implantacaoId, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["impl-alertas"] });
      toast({ title: "Correção solicitada à equipe de Vendas" });
      onClose();
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao solicitar correção", variant: "destructive" }),
  });

  const rejeitar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("rejeitar_implantacao" as any, { p_impl: implantacaoId, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["impl-alertas"] });
      toast({ title: "Implantação rejeitada" });
      onClose();
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao rejeitar", variant: "destructive" }),
  });

  const liberar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("finalizar_implantacao_cadastro" as any, { p_impl: implantacaoId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["implantacoes-andamento"] });
      qc.invalidateQueries({ queryKey: ["impl-alertas"] });
      toast({ title: "Contrato liberado! Empresa criada automaticamente." });
      onClose();
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao liberar contrato", variant: "destructive" }),
  });

  const handleDownload = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("anexos-implantacao").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast({ title: "Erro ao abrir anexo", description: error?.message, variant: "destructive" });
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };


  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Análise de Implantação
          </DialogTitle>
          <DialogDescription>Revise os dados, anexos e histórico antes de aprovar ou solicitar correção.</DialogDescription>
        </DialogHeader>

        {!impl ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-5">
            {/* Cabeçalho */}
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {impl.nome_empresa || "Empresa sem nome"}
                    </h3>
                    <p className="text-xs text-muted-foreground">CNPJ: {impl.cnpj || "—"} · Contrato: {impl.codigo_contrato || "—"}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Enviado por {impl.enviado_diretoria_por_nome || impl.created_by_nome || "—"}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2">
                  <div><p className="text-muted-foreground">Vidas</p><p className="font-semibold text-sm flex items-center gap-1"><Users className="h-3 w-3" />{impl.total_vidas ?? "—"}</p></div>
                  <div><p className="text-muted-foreground">Vigência</p><p className="font-semibold text-sm flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateBR(impl.data_vigencia)}</p></div>
                  <div><p className="text-muted-foreground">Acomodação</p><p className="font-semibold text-sm">{impl.acomodacao || "—"}</p></div>
                  <div><p className="text-muted-foreground">Modalidade</p><p className="font-semibold text-sm">{impl.modalidade || "—"}</p></div>
                  <div><p className="text-muted-foreground">Tipo de Contrato</p><p className="font-semibold text-sm">{impl.tipo_contrato || "—"}</p></div>
                  <div><p className="text-muted-foreground">Período Movimentação</p><p className="font-semibold text-sm">{impl.periodo_movimentacao || "—"}</p></div>
                  <div><p className="text-muted-foreground">Dia Vencimento</p><p className="font-semibold text-sm flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDay(impl.data_vencimento)}</p></div>
                </div>

              </CardContent>
            </Card>

            {/* Anexos */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Paperclip className="h-4 w-4" /> Documentos ({(readOnly ? anexos.filter((a: any) => {
                const tipo = String(a.tipo || "").toLowerCase();
                const nome = String(a.nome_arquivo || "").toLowerCase();
                if (tipo === "anexo_1" || tipo === "relatorio_vidas") return true;
                if (nome.includes("cartao") && nome.includes("cnpj")) return true;
                if (nome.includes("cartão") && nome.includes("cnpj")) return true;
                return false;
              }) : anexos).length})</h4>
              {(() => {
                const visiveis = readOnly ? anexos.filter((a: any) => {
                  const tipo = String(a.tipo || "").toLowerCase();
                  const nome = String(a.nome_arquivo || "").toLowerCase();
                  if (tipo === "anexo_1" || tipo === "relatorio_vidas") return true;
                  if ((nome.includes("cartao") || nome.includes("cartão")) && nome.includes("cnpj")) return true;
                  return false;
                }) : anexos;
                if (visiveis.length === 0) return <p className="text-sm text-muted-foreground">Sem anexos.</p>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {visiveis.map((a: any) => (
                      <button key={a.id} onClick={() => handleDownload(a.storage_path, a.nome_arquivo)}
                        className="flex items-center gap-2 text-left text-sm p-2 rounded-lg border hover:bg-accent transition-colors">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate flex-1">{a.nome_arquivo}</span>
                        <Badge variant="secondary" className="text-[10px]">{a.tipo}</Badge>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Dados para Implantação (oriundos do Anexo 1) */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Dados para Implantação</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs p-3 rounded-lg border bg-muted/30">
                <div><p className="text-muted-foreground">Telefone</p><p className="font-semibold text-sm">{impl.telefone || "—"}</p></div>
                <div><p className="text-muted-foreground">Inscrição Municipal</p><p className="font-semibold text-sm">{impl.inscricao_municipal || "—"}</p></div>
                <div><p className="text-muted-foreground">Inscrição Estadual</p><p className="font-semibold text-sm">{impl.inscricao_estadual || "—"}</p></div>
                <div className="md:col-span-2"><p className="text-muted-foreground">Endereço</p><p className="font-semibold text-sm">{impl.endereco || "—"}</p></div>
                <div><p className="text-muted-foreground">CEP</p><p className="font-semibold text-sm">{impl.cep || "—"}</p></div>
                <div><p className="text-muted-foreground">Grupo Contrato</p><p className="font-semibold text-sm">{impl.grupo_contrato || "—"}</p></div>
                <div><p className="text-muted-foreground">Vidas Titulares</p><p className="font-semibold text-sm">{impl.vidas_titulares ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Vidas Dependentes</p><p className="font-semibold text-sm">{impl.vidas_dependentes ?? "—"}</p></div>
              </div>
            </div>

            {/* Dados Comerciais */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Dados Comerciais</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs p-3 rounded-lg border bg-muted/30">
                <div><p className="text-muted-foreground">Valor Enfermaria</p><p className="font-semibold text-sm">{impl.valor_enfermaria_centavos != null ? formatCentavosBRL(impl.valor_enfermaria_centavos) : "—"}</p></div>
                <div><p className="text-muted-foreground">Valor Apartamento</p><p className="font-semibold text-sm">{impl.valor_apartamento_centavos != null ? formatCentavosBRL(impl.valor_apartamento_centavos) : "—"}</p></div>
                <div><p className="text-muted-foreground">% Agenciamento</p><p className="font-semibold text-sm">{impl.percentual_agenciamento != null ? `${Number(impl.percentual_agenciamento).toFixed(2).replace(".", ",")}%` : "—"}</p></div>
                <div><p className="text-muted-foreground">% Vitalício</p><p className="font-semibold text-sm">{impl.percentual_vitalicio != null ? `${Number(impl.percentual_vitalicio).toFixed(2).replace(".", ",")}%` : "—"}</p></div>
                <div><p className="text-muted-foreground">Corretora</p><p className="font-semibold text-sm">{impl.corretora || "—"}</p></div>
                <div><p className="text-muted-foreground">Código do Contrato</p><p className="font-semibold text-sm">{impl.codigo_contrato || "—"}</p></div>
              </div>
            </div>



            {/* Ação Cadastro: Liberar contrato */}
            {readOnly && impl.status !== "implantado" && impl.status !== "rejeitado" && (
              <div className="pt-2 border-t">
                <Button
                  onClick={() => liberar.mutate()}
                  disabled={liberar.isPending}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Rocket className="h-4 w-4" /> {liberar.isPending ? "Liberando…" : "Liberar contrato"}
                </Button>
              </div>
            )}

            {!readOnly && mode === "view" && (
              <div className="space-y-3 pt-2 border-t">
                <div>
                  <label className="text-sm font-medium">Observação (opcional)</label>
                  <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Comentário para o cadastro…" rows={2} />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={() => setAtribuirOpen(true)} disabled={aprovar.isPending} className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Aprovar e enviar ao Cadastro
                  </Button>
                  <Button onClick={() => setMode("correcao")} variant="outline" className="gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4" /> Solicitar correção
                  </Button>
                  <Button onClick={() => setMode("rejeicao")} variant="outline" className="gap-2 border-red-500/50 text-red-600 hover:bg-red-500/10">
                    <XCircle className="h-4 w-4" /> Rejeitar
                  </Button>
                </div>
              </div>
            )}

            {!readOnly && mode !== "view" && (
              <div className="space-y-3 pt-2 border-t">
                <div>
                  <label className="text-sm font-medium">
                    {mode === "correcao" ? "Motivo da correção" : "Motivo da rejeição"} *
                  </label>
                  <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
                    placeholder={mode === "correcao" ? "Descreva o que precisa ser ajustado…" : "Descreva o motivo da rejeição…"} />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setMode("view"); setMotivo(""); }}>Cancelar</Button>
                  <Button
                    disabled={!motivo.trim() || corrigir.isPending || rejeitar.isPending}
                    onClick={() => mode === "correcao" ? corrigir.mutate() : rejeitar.mutate()}
                    className={mode === "correcao" ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"}
                  >
                    {mode === "correcao" ? "Enviar para correção" : "Confirmar rejeição"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
      <SelecionarResponsavelCadastroDialog
        open={atribuirOpen}
        onClose={() => setAtribuirOpen(false)}
        onConfirm={(userId, userNome) => aprovar.mutate({ userId, userNome })}
        loading={aprovar.isPending}
      />
    </Dialog>
  );
}
