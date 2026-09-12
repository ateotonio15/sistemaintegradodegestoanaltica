import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Check, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  useAtualizarPendenciaProcesso,
  useContratoProcessoPendencias,
  useCriarPendenciaProcesso,
  useResolverPendenciaProcesso,
} from "@/hooks/useContratoProcessos";
import {
  MOTIVOS_PENDENCIA,
  PENDENCIA_CATEGORIAS,
  PENDENCIA_CRITICIDADES,
  PENDENCIA_CRITICIDADE_BADGE,
  PENDENCIA_STATUS_BADGE,
  PENDENCIA_STATUS_LISTA,
  SETORES_PRINCIPAIS,
  SETOR_LABEL,
  SETOR_POR_CATEGORIA,
  pendenciaEmAberto,
  setorLabel,
  type PendenciaCategoria,
  type PendenciaCriticidade,
  type PendenciaStatus,
  type ProcessoSetor,
} from "@/lib/contrato-processo";

function dataHora(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SETORES_PENDENCIA: ProcessoSetor[] = ["juridico", "cadastro", "financeiro", "documentos", "comercial"];

interface Props {
  processoId: string;
  readOnly?: boolean;
}

export function PendenciasProcessoSection({ processoId, readOnly }: Props) {
  const { data: pendencias = [], isLoading } = useContratoProcessoPendencias(processoId);
  const criar = useCriarPendenciaProcesso();
  const atualizar = useAtualizarPendenciaProcesso();
  const resolver = useResolverPendenciaProcesso();

  const [novo, setNovo] = useState(false);
  const [motivo, setMotivo] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<PendenciaCategoria>("Outros");
  const [criticidade, setCriticidade] = useState<PendenciaCriticidade>("Média");
  const [setor, setSetor] = useState<ProcessoSetor>("comercial");
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState("");

  const [resolvendo, setResolvendo] = useState<string | null>(null);
  const [obsResolucao, setObsResolucao] = useState("");
  const [verHistorico, setVerHistorico] = useState(false);

  const abertas = useMemo(() => pendencias.filter((p) => pendenciaEmAberto(p.status)), [pendencias]);
  const encerradas = useMemo(() => pendencias.filter((p) => !pendenciaEmAberto(p.status)), [pendencias]);

  const resetForm = () => {
    setNovo(false);
    setMotivo("");
    setTitulo("");
    setDescricao("");
    setCategoria("Outros");
    setCriticidade("Média");
    setSetor("comercial");
    setResponsavel("");
    setPrazo("");
  };

  const aplicarMotivo = (m: string) => {
    setMotivo(m);
    const regra = MOTIVOS_PENDENCIA.find((x) => x.motivo === m);
    if (regra) {
      setTitulo(regra.motivo);
      setCategoria(regra.categoria);
      setSetor(regra.setor);
    }
  };

  const handleCriar = async () => {
    if (!titulo.trim()) {
      toast.error("Informe o título da pendência");
      return;
    }
    try {
      await criar.mutateAsync({
        processoId,
        setor,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        categoria,
        criticidade,
        responsavelNome: responsavel.trim() || null,
        prazo: prazo || null,
      });
      toast.success("Pendência registrada");
      resetForm();
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar pendência");
    }
  };

  const handleResolver = async (id: string) => {
    if (!obsResolucao.trim()) {
      toast.error("Descreva como a pendência foi resolvida");
      return;
    }
    try {
      await resolver.mutateAsync({ id, processoId, observacao: obsResolucao });
      toast.success("Pendência resolvida");
      setResolvendo(null);
      setObsResolucao("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao resolver");
    }
  };

  const mudarStatus = async (id: string, status: PendenciaStatus) => {
    try {
      await atualizar.mutateAsync({ id, processoId, status });
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" /> Pendências
          <Badge variant="outline">{abertas.length} em aberto</Badge>
        </p>
        {!readOnly && (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setNovo((v) => !v)}>
            <Plus className="h-4 w-4" /> Nova pendência
          </Button>
        )}
      </div>

      {novo && !readOnly && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Motivo padronizado (direciona o setor)</label>
              <Select value={motivo} onValueChange={aplicarMotivo}>
                <SelectTrigger><SelectValue placeholder="Selecione ou preencha manualmente" /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS_PENDENCIA.map((m) => (
                    <SelectItem key={m.motivo} value={m.motivo}>
                      {m.motivo} · {SETOR_LABEL[m.setor]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Título</label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Resumo da pendência" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Categoria</label>
                <Select
                  value={categoria}
                  onValueChange={(v) => {
                    setCategoria(v as PendenciaCategoria);
                    setSetor(SETOR_POR_CATEGORIA[v as PendenciaCategoria]);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PENDENCIA_CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Criticidade</label>
                <Select value={criticidade} onValueChange={(v) => setCriticidade(v as PendenciaCriticidade)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PENDENCIA_CRITICIDADES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Setor responsável</label>
                <Select value={setor} onValueChange={(v) => setSetor(v as ProcessoSetor)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SETORES_PENDENCIA.map((s) => (
                      <SelectItem key={s} value={s}>{SETOR_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Responsável</label>
                <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Prazo</label>
                <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Descrição</label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Detalhe a pendência" />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
              <Button size="sm" onClick={handleCriar} disabled={criar.isPending} className="gap-2">
                {criar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando pendências...</p>
      ) : abertas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pendência em aberto.</p>
      ) : (
        <div className="space-y-2">
          {abertas.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{p.titulo}</span>
                  <Badge variant="outline" className={PENDENCIA_STATUS_BADGE[p.status as PendenciaStatus]}>
                    {p.status}
                  </Badge>
                  <Badge variant="outline" className={PENDENCIA_CRITICIDADE_BADGE[p.criticidade as PendenciaCriticidade]}>
                    {p.criticidade}
                  </Badge>
                  <Badge variant="outline">{p.categoria}</Badge>
                  <Badge variant="outline">{setorLabel(p.setor)}</Badge>
                </div>
                {p.descricao && p.descricao !== p.titulo && (
                  <p className="text-xs text-muted-foreground">{p.descricao}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Criada em {dataHora(p.created_at)} por {p.created_by_nome || "—"}
                  {p.responsavel_nome ? ` · Responsável: ${p.responsavel_nome}` : ""}
                  {p.prazo ? ` · Prazo: ${new Date(`${p.prazo}T00:00:00`).toLocaleDateString("pt-BR")}` : ""}
                </p>

                {!readOnly && (
                  <>
                    <Separator />
                    {resolvendo === p.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={obsResolucao}
                          onChange={(e) => setObsResolucao(e.target.value)}
                          rows={2}
                          placeholder="Observação da resolução (obrigatória)"
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setResolvendo(null); setObsResolucao(""); }}>
                            Cancelar
                          </Button>
                          <Button size="sm" onClick={() => handleResolver(p.id)} disabled={resolver.isPending} className="gap-2">
                            {resolver.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            Confirmar resolução
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={p.status} onValueChange={(v) => mudarStatus(p.id, v as PendenciaStatus)}>
                          <SelectTrigger className="h-8 w-[210px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PENDENCIA_STATUS_LISTA.filter((s) => s !== "Resolvida").map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setResolvendo(p.id)}>
                          <Check className="h-4 w-4" /> Resolver
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {encerradas.length > 0 && (
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => setVerHistorico((v) => !v)}>
            {verHistorico ? "Ocultar" : "Ver"} histórico de pendências ({encerradas.length})
          </Button>
          {verHistorico &&
            encerradas.map((p) => (
              <Card key={p.id} className="opacity-90">
                <CardContent className="p-3 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{p.titulo}</span>
                    <Badge variant="outline" className={PENDENCIA_STATUS_BADGE[p.status as PendenciaStatus]}>
                      {p.status === "Cancelada" ? <X className="h-3 w-3 mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                      {p.status}
                    </Badge>
                    <Badge variant="outline">{p.categoria}</Badge>
                    <Badge variant="outline">{setorLabel(p.setor)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.status} em {dataHora(p.resolvida_em)} por {p.resolvida_por_nome || "—"}
                  </p>
                  {p.observacao_resolucao && <p className="text-xs">{p.observacao_resolucao}</p>}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
