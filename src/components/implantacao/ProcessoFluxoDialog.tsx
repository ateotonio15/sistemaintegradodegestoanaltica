import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, GitBranch, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useContratoProcessoHistorico,
  useContratoProcessoPorImplantacao,
  useCriarContratoProcesso,
  useEncaminharContratoProcesso,
} from "@/hooks/useContratoProcessos";
import {
  RESULTADO_BADGE,
  SETORES_PRINCIPAIS,
  SETOR_LABEL,
  STATUS_ORDEM,
  STATUS_POR_SETOR,
  acaoLabel,
  setorLabel,
  statusBadge,
  statusLabel,
  type ProcessoResultado,
  type ProcessoSetor,
  type ProcessoStatus,
} from "@/lib/contrato-processo";

interface Props {
  open: boolean;
  onClose: () => void;
  implantacaoId: string;
  nomeEmpresa?: string | null;
  cnpj?: string | null;
  empresaId?: string | null;
  readOnly?: boolean;
}

function dataHora(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ProcessoFluxoDialog({ open, onClose, implantacaoId, nomeEmpresa, cnpj, empresaId, readOnly }: Props) {
  const { data: processo, isLoading } = useContratoProcessoPorImplantacao(open ? implantacaoId : null);
  const { data: historico = [] } = useContratoProcessoHistorico(processo?.id);
  const criar = useCriarContratoProcesso();
  const encaminhar = useEncaminharContratoProcesso();

  const [setorDestino, setSetorDestino] = useState<ProcessoSetor | "">("");
  const [status, setStatus] = useState<ProcessoStatus | "">("");
  const [proximaAcao, setProximaAcao] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!open) {
      setSetorDestino("");
      setStatus("");
      setProximaAcao("");
      setObservacao("");
    }
  }, [open]);

  const statusSugeridos = useMemo(() => {
    const base = setorDestino ? STATUS_POR_SETOR[setorDestino] : STATUS_ORDEM;
    const extras = STATUS_ORDEM.filter((s) => !base.includes(s));
    return [...base, ...extras];
  }, [setorDestino]);

  const handleCriar = async () => {
    try {
      await criar.mutateAsync({ implantacaoId, empresaId, nomeEmpresa, cnpj });
      toast.success("Processo criado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar processo");
    }
  };

  const handleEncaminhar = async () => {
    if (!processo || !setorDestino) return;
    try {
      await encaminhar.mutateAsync({
        processoId: processo.id,
        setorDestino,
        status: status || null,
        proximaAcao: proximaAcao.trim() || null,
        observacao: observacao.trim() || null,
      });
      toast.success(`Encaminhado para ${SETOR_LABEL[setorDestino]}`);
      setSetorDestino("");
      setStatus("");
      setProximaAcao("");
      setObservacao("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao encaminhar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Fluxo entre setores
            {processo && <Badge variant="outline">{processo.codigo}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
        ) : !processo ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Este contrato ainda não possui processo de análise.
            </p>
            {!readOnly && (
              <Button onClick={handleCriar} disabled={criar.isPending}>
                {criar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar processo
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
                <Info label="Status">
                  <Badge variant="outline" className={statusBadge(processo.status)}>
                    {statusLabel(processo.status)}
                  </Badge>
                </Info>
                <Info label="Setor atual">{setorLabel(processo.setor_atual)}</Info>
                <Info label="Responsável atual">{processo.responsavel_atual_nome || "—"}</Info>
                <Info label="Entrada no setor">{dataHora(processo.data_entrada_setor)}</Info>
                <Info label="Última movimentação">{dataHora(processo.ultima_movimentacao_em)}</Info>
                <Info label="Pendências">{processo.pendencias_abertas ?? 0}</Info>
                <Info label="Próxima ação">{processo.proxima_acao || "—"}</Info>
                <Info label="Resultado final">
                  <Badge variant="outline" className={RESULTADO_BADGE[processo.resultado_final as ProcessoResultado]}>
                    {processo.resultado_final}
                  </Badge>
                </Info>
              </CardContent>
            </Card>

            {!readOnly && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-primary" /> Encaminhar contrato
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Setor destino</label>
                      <Select value={setorDestino} onValueChange={(v) => { setSetorDestino(v as ProcessoSetor); setStatus(""); }}>
                        <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                        <SelectContent>
                          {SETORES_PRINCIPAIS.map((s) => (
                            <SelectItem key={s} value={s}>{SETOR_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Novo status</label>
                      <Select value={status} onValueChange={(v) => setStatus(v as ProcessoStatus)}>
                        <SelectTrigger><SelectValue placeholder="Manter status atual" /></SelectTrigger>
                        <SelectContent>
                          {statusSugeridos.map((s) => (
                            <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Próxima ação</label>
                    <Input
                      value={proximaAcao}
                      onChange={(e) => setProximaAcao(e.target.value)}
                      placeholder="Ex.: validar cláusula de vigência"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Observação</label>
                    <Textarea
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Opcional — fica registrada no histórico"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleEncaminhar} disabled={!setorDestino || encaminhar.isPending} className="gap-2">
                      {encaminhar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Encaminhar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Histórico de movimentações
              </p>
              {historico.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
              ) : (
                <div className="space-y-2">
                  {[...historico].reverse().map((m) => (
                    <Card key={m.id}>
                      <CardContent className="p-3 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge variant="outline">{acaoLabel(m.acao)}</Badge>
                          <span className="text-xs text-muted-foreground">{dataHora(m.created_at)}</span>
                          <span className="text-xs text-muted-foreground">· {m.user_nome || "—"}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Setor: {setorLabel(m.setor_origem)} → {m.setor_destino ? setorLabel(m.setor_destino) : "sem alteração"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Status: {statusLabel(m.status_detalhado_anterior)} → {m.status_detalhado_novo ? statusLabel(m.status_detalhado_novo) : "sem alteração"}
                        </p>
                        {m.observacao && (
                          <>
                            <Separator className="my-1" />
                            <p className="text-xs">{m.observacao}</p>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground break-words">{children}</div>
    </div>
  );
}
