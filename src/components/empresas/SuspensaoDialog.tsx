import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDateBR, todayLocalISO } from "@/lib/date-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Ban, RotateCcw, AlertCircle } from "lucide-react";

const MOTIVOS = [
  "Inadimplência",
  "Solicitação da empresa",
  "Pendência contratual",
  "Pendência documental",
  "Determinação administrativa",
  "Outros",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: {
    id: string;
    nome: string;
    contrato_suspenso: boolean;
    data_suspensao: string | null;
    motivo_suspensao: string | null;
    codigo_contrato?: string | null;
  } | null;
}

export function SuspensaoDialog({ open, onOpenChange, empresa }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [data, setData] = useState(todayLocalISO());
  const [motivoSel, setMotivoSel] = useState("");
  const [motivoOutro, setMotivoOutro] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (motivoSel === "Outros") setMotivo(motivoOutro);
    else setMotivo(motivoSel);
  }, [motivoSel, motivoOutro]);

  useEffect(() => {
    if (open) {
      setMotivoSel("");
      setMotivoOutro("");
      setConfirmando(false);
      setMotivo("");
      setObservacao("");
      setData(todayLocalISO());
    }
  }, [open]);

  const { data: historico = [] } = useQuery({
    queryKey: ["empresa-suspensoes", empresa?.id],
    queryFn: async () => {
      if (!empresa) return [];
      const { data, error } = await supabase
        .from("empresa_suspensoes")
        .select("*")
        .eq("empresa_id", empresa.id)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresa && open,
  });

  const userIds = Array.from(
    new Set(historico.flatMap((h: any) => [h.suspenso_por, h.reativado_por]).filter(Boolean)),
  ) as string[];
  const { data: nomes = {} } = useQuery({
    queryKey: ["suspensoes-nomes", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_user_display_names", { _ids: userIds });
      const map: Record<string, string> = {};
      (data ?? []).forEach((u: any) => (map[u.user_id] = u.display_name));
      return map;
    },
  });

  const suspender = useMutation({
    mutationFn: async () => {
      if (!empresa) return;
      const { error: e1 } = await supabase.from("empresa_suspensoes").insert({
        empresa_id: empresa.id,
        data_inicio: data,
        motivo: motivo.trim(),
        observacao: observacao.trim() || null,
        suspenso_por: user?.id ?? null,
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("empresas")
        .update({
          contrato_suspenso: true,
          data_suspensao: data,
          motivo_suspensao: motivo.trim(),
        })
        .eq("id", empresa.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresa-suspensoes"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-suspensas"] });
      toast.success("Contrato suspenso");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const reativar = useMutation({
    mutationFn: async () => {
      if (!empresa) return;
      const aberta = historico.find((h: any) => !h.data_fim);
      if (aberta) {
        const { error: e1 } = await supabase
          .from("empresa_suspensoes")
          .update({
            data_fim: data,
            reativado_por: user?.id ?? null,
            reativado_em: new Date().toISOString(),
            observacao_reativacao: observacao.trim() || null,
          })
          .eq("id", aberta.id);
        if (e1) throw e1;
      }
      const { error: e2 } = await supabase
        .from("empresas")
        .update({
          contrato_suspenso: false,
          data_suspensao: null,
          motivo_suspensao: null,
        })
        .eq("id", empresa.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresa-suspensoes"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-suspensas"] });
      toast.success("Contrato reativado");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  if (!empresa) return null;
  const isSuspenso = empresa.contrato_suspenso;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSuspenso ? (
              <>
                <RotateCcw className="h-5 w-5 text-primary" />
                Reativar contrato
              </>
            ) : (
              <>
                <Ban className="h-5 w-5 text-destructive" />
                Suspender contrato
              </>
            )}
          </DialogTitle>
          <DialogDescription>{empresa.nome}</DialogDescription>
        </DialogHeader>

        {isSuspenso && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Contrato atualmente suspenso</p>
              <p className="text-muted-foreground mt-0.5">
                Desde {formatDateBR(empresa.data_suspensao)} — {empresa.motivo_suspensao || "—"}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {!isSuspenso && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="motivo_susp">Motivo *</Label>
                <Select value={motivoSel} onValueChange={setMotivoSel}>
                  <SelectTrigger id="motivo_susp"><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                  <SelectContent>
                    {MOTIVOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                {motivoSel === "Outros" && (
                  <Input
                    value={motivoOutro}
                    onChange={(e) => setMotivoOutro(e.target.value)}
                    placeholder="Informe o motivo"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obs_susp">Observação</Label>
                <Textarea
                  id="obs_susp"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                  placeholder="Detalhes adicionais (opcional)"
                />
              </div>
            </>
          )}
          {isSuspenso && (
            <div className="space-y-1.5">
              <Label htmlFor="obs_reat">Observação da reativação</Label>
              <Textarea id="obs_reat" value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Opcional" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="data_susp">
              {isSuspenso ? "Data da reativação *" : "Data da suspensão *"}
            </Label>
            <Input
              id="data_susp"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
        </div>

        {historico.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Histórico de Suspensões
            </h4>
            <div className="rounded-lg border p-3 text-sm grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 bg-muted/30">
              <span className="text-muted-foreground">Suspensões registradas:</span>
              <span className="font-medium">{historico.length}</span>
              <span className="text-muted-foreground">Situação atual:</span>
              <span className={isSuspenso ? "font-medium text-destructive" : "font-medium text-success"}>
                {isSuspenso ? `Suspenso desde ${formatDateBR(empresa.data_suspensao)}` : "Ativo"}
              </span>
            </div>
            <Accordion
              type="multiple"
              defaultValue={historico.filter((h: any) => !h.data_fim).map((h: any) => h.id)}
              className="space-y-2 max-h-72 overflow-y-auto pr-1"
            >
              {historico.map((h: any, idx: number) => {
                const num = historico.length - idx;
                const emVigor = !h.data_fim;
                const dias = h.data_fim
                  ? Math.round(
                      (new Date(h.data_fim + "T00:00:00").getTime() - new Date(h.data_inicio + "T00:00:00").getTime()) / 86400000,
                    )
                  : null;
                return (
                  <AccordionItem
                    key={h.id}
                    value={h.id}
                    className={emVigor ? "rounded-lg border border-destructive/40 bg-destructive/5 px-3" : "rounded-lg border bg-card px-3"}
                  >
                    <AccordionTrigger className="py-2 text-sm hover:no-underline">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">Suspensão #{num}</span>
                        <span className="text-xs text-muted-foreground">
                          {emVigor ? "Suspensão atual" : `de ${formatDateBR(h.data_inicio)}`}
                        </span>
                        <Badge variant={emVigor ? "destructive" : "secondary"} className="rounded-md">
                          {emVigor ? "Em vigor" : "Encerrada"}
                        </Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="text-xs grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 pb-1">
                        <span className="text-muted-foreground">Suspensão:</span><span>{formatDateBR(h.data_inicio)}</span>
                        {!emVigor && (
                          <>
                            <span className="text-muted-foreground">Reativação:</span><span>{formatDateBR(h.data_fim)}</span>
                            <span className="text-muted-foreground">Período suspenso:</span><span>{dias} {dias === 1 ? "dia" : "dias"}</span>
                          </>
                        )}
                        <span className="text-muted-foreground">Motivo:</span><span>{h.motivo}</span>
                        <span className="text-muted-foreground">Suspenso por:</span><span>{nomes[h.suspenso_por] || "—"}</span>
                        <span className="text-muted-foreground">Registrado em:</span><span>{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                        {h.observacao && (<><span className="text-muted-foreground">Observação:</span><span>{h.observacao}</span></>)}
                        {!emVigor && (
                          <>
                            <span className="text-muted-foreground">Reativado por:</span><span>{nomes[h.reativado_por] || "—"}</span>
                            {h.reativado_em && (<><span className="text-muted-foreground">Reativado em:</span><span>{new Date(h.reativado_em).toLocaleString("pt-BR")}</span></>)}
                            {h.observacao_reativacao && (<><span className="text-muted-foreground">Obs. reativação:</span><span>{h.observacao_reativacao}</span></>)}
                          </>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}

        {confirmando ? (
          <div className="rounded-lg border p-4 space-y-2 bg-muted/40">
            <p className="font-semibold">{isSuspenso ? "Confirmar reativação deste contrato?" : "Confirmar suspensão?"}</p>
            <div className="text-sm grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
              <span className="text-muted-foreground">Empresa:</span><span>{empresa.nome}</span>
              <span className="text-muted-foreground">Contrato:</span><span>{empresa.codigo_contrato || "—"}</span>
              {isSuspenso ? (
                <>
                  <span className="text-muted-foreground">Suspenso desde:</span><span>{formatDateBR(empresa.data_suspensao)}</span>
                  <span className="text-muted-foreground">Motivo:</span><span>{empresa.motivo_suspensao || "—"}</span>
                  <span className="text-muted-foreground">Data da reativação:</span><span>{formatDateBR(data)}</span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">Data da suspensão:</span><span>{formatDateBR(data)}</span>
                  <span className="text-muted-foreground">Motivo:</span><span>{motivo}</span>
                </>
              )}
            </div>
            {!isSuspenso && (
              <p className="text-xs text-muted-foreground pt-1">
                A suspensão não excluirá informações. Enquanto estiver suspenso, o contrato será retirado dos fluxos operacionais e financeiros configurados.
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => (confirmando ? setConfirmando(false) : onOpenChange(false))}>
            Cancelar
          </Button>
          {!confirmando ? (
            <Button
              variant={isSuspenso ? "default" : "destructive"}
              onClick={() => setConfirmando(true)}
              disabled={!data || (!isSuspenso && !motivo.trim())}
            >
              {isSuspenso ? "Reativar contrato" : "Suspender contrato"}
            </Button>
          ) : isSuspenso ? (
            <Button onClick={() => reativar.mutate()} disabled={reativar.isPending}>
              {reativar.isPending ? "Reativando..." : "Confirmar reativação"}
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => suspender.mutate()} disabled={suspender.isPending}>
              {suspender.isPending ? "Suspendendo..." : "Confirmar suspensão"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
