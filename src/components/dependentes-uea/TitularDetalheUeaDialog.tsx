import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  History,
  Pencil,
  RotateCcw,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  useAplicarFaixaDependenteUea,
  useDesligarPorMargemUea,
  useReativarDependenteUea,
  useAtualizarMargemUea,
  useExcluirDependenteUea,
  useHistoricoTitularUea,
  useSalvarTitularUea,
  useSalvarDependenteUea,
  type DependenteInput,
} from "@/hooks/useDependentesUea";
import {
  analisarReativacao,
  faixaLabel,
  faixaParaIdade,
  faixasVigentes,
  formatBRL,
  formatCPF,
  formatDataBR,
  idadeEm,
  soDigitos,
  type DependenteCalculado,
  type FaixaUea,
  type StatusMargem,
  type TitularCalculado,
  parseValorBr,
} from "@/lib/dependentes-uea";

const STATUS_CLS: Record<StatusMargem, string> = {
  "Sem dependentes": "bg-muted text-muted-foreground",
  "Com margem": "bg-success/10 text-success",
  "Margem comprometida": "bg-warning/10 text-warning",
  "Sem margem": "bg-destructive/10 text-destructive",
};

const MOTIVOS_DESLIGAMENTO = [
  "Titular sem margem",
  "Titular com margem bloqueada",
  "Desligamento a pedido do titular",
  "Cancelamento do plano",
  "Outro motivo",
] as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titular: TitularCalculado | null;
  faixas: FaixaUea[];
  /** Quando falso, a visão é somente leitura (permissão "Visualizar Dependentes UEA"). */
  podeEditar?: boolean;
}

const vazio = (titularId: string): DependenteInput => ({
  titular_id: titularId,
  nome_completo: "",
  cpf: "",
  data_nascimento: "",
  data_adesao: "",
  parentesco: "",
  faixa_etaria: "",
  valor_mensal: 0,
  status: "ativo",
  motivo_desligamento: "",
  data_desligamento: "",
  data_reativacao: "",
  observacao: "",
});

/** Data de hoje no formato ISO, construída no fuso local. */
function hojeISOLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

export function TitularDetalheUeaDialog({
  open,
  onOpenChange,
  titular,
  faixas,
  podeEditar = true,
}: Props) {
  const salvar = useSalvarDependenteUea();
  const excluir = useExcluirDependenteUea();
  const aplicarFaixa = useAplicarFaixaDependenteUea();
  const desligarMargem = useDesligarPorMargemUea();
  const reativar = useReativarDependenteUea();
  const atualizarMargem = useAtualizarMargemUea();
  const salvarTitular = useSalvarTitularUea();
  const { data: historico = [] } = useHistoricoTitularUea(open ? titular?.id ?? null : null);

  const [margemTxt, setMargemTxt] = useState("");
  const [editando, setEditando] = useState<DependenteInput | null>(null);
  const [valorTexto, setValorTexto] = useState("");
  const [ehReativacao, setEhReativacao] = useState(false);
  const [valorCustom, setValorCustom] = useState(false);
  const [aba, setAba] = useState("dependentes");
  const [confirmarDesligar, setConfirmarDesligar] = useState<DependenteCalculado | null>(null);
  const [motivoDesligamento, setMotivoDesligamento] = useState("");
  const [outroMotivoDesligamento, setOutroMotivoDesligamento] = useState("");
  const [confirmarReativar, setConfirmarReativar] = useState<DependenteCalculado | null>(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState<DependenteCalculado | null>(null);
  const [valorInlineId, setValorInlineId] = useState<string | null>(null);
  const [valorInlineTxt, setValorInlineTxt] = useState("");
  const [aplicarFaixaDep, setAplicarFaixaDep] = useState<DependenteCalculado | null>(null);
  const [faixaSelId, setFaixaSelId] = useState<string | null>(null);
  const [editandoTitular, setEditandoTitular] = useState(false);
  const [dadosTitular, setDadosTitular] = useState({
    nome_completo: "",
    cpf: "",
    matricula: "",
    contrato: "",
    observacao: "",
  });

  const salvarValorInline = async (d: DependenteCalculado) => {
    const novo = parseValorBr(valorInlineTxt);
    await salvar.mutateAsync({
      id: d.id,
      titular_id: d.titular_id,
      nome_completo: d.nome_completo,
      cpf: d.cpf ?? null,
      data_nascimento: d.data_nascimento ?? null,
      data_adesao: d.data_adesao ?? null,
      parentesco: d.parentesco ?? null,
      faixa_etaria: d.faixa_etaria ?? null,
      valor_mensal: Number((novo || 0).toFixed(2)),
      status: d.status,
      motivo_desligamento: d.motivo_desligamento ?? null,
      data_desligamento: d.data_desligamento ?? null,
      data_reativacao: d.data_reativacao ?? null,
      observacao: d.observacao ?? null,
    });
    setValorInlineId(null);
  };

  useEffect(() => {
    if (open && titular) {
      setMargemTxt(String(titular.valor_margem));
      setDadosTitular({
        nome_completo: titular.nome_completo,
        cpf: titular.cpf,
        matricula: titular.matricula ?? "",
        contrato: titular.contrato ?? "",
        observacao: titular.observacao ?? "",
      });
    }
    if (!open) {
      setEditando(null);
      setEditandoTitular(false);
    }
  }, [open, titular?.id, titular?.valor_margem]);

  const salvarDadosTitular = async () => {
    if (!titular || !dadosTitular.nome_completo.trim() || soDigitos(dadosTitular.cpf).length !== 11) return;
    await salvarTitular.mutateAsync({
      id: titular.id,
      nome_completo: dadosTitular.nome_completo,
      cpf: soDigitos(dadosTitular.cpf),
      matricula: dadosTitular.matricula,
      contrato: dadosTitular.contrato,
      valor_margem: parseValorBr(margemTxt),
      observacao: dadosTitular.observacao,
    });
    setEditandoTitular(false);
  };

  const deps = useMemo(
    () =>
      [...(titular?.dependentes_calculados ?? [])].sort((a, b) =>
        a.status === b.status
          ? a.nome_completo.localeCompare(b.nome_completo)
          : a.status === "ativo"
          ? -1
          : 1,
      ),
    [titular],
  );

  const faixaEditando = useMemo(() => {
    if (!editando?.data_nascimento) return null;
    return faixaParaIdade(faixas, idadeEm(editando.data_nascimento));
  }, [editando?.data_nascimento, faixas]);

  const submit = async () => {
    if (!editando || !editando.nome_completo.trim()) return;
    const valorManual = parseValorBr(valorTexto);
    const valorFinal =
      valorCustom || !faixaEditando ? valorManual || 0 : Number(faixaEditando.valor_mensal);
    await salvar.mutateAsync({
      ...editando,
      cpf: editando.cpf ? soDigitos(editando.cpf) : null,
      faixa_etaria: faixaEditando ? faixaLabel(faixaEditando) : editando.faixa_etaria || null,
      valor_mensal: Number(valorFinal.toFixed(2)),
      data_reativacao: ehReativacao ? editando.data_reativacao || hojeISOLocal() : null,
    });
    setEditando(null);
  };

  const abrirEdicao = (d: DependenteCalculado) => {
    setEditando({
      id: d.id,
      titular_id: d.titular_id,
      nome_completo: d.nome_completo,
      cpf: d.cpf ?? "",
      data_nascimento: d.data_nascimento ?? "",
      data_adesao: d.data_adesao ?? "",
      parentesco: d.parentesco ?? "",
      faixa_etaria: d.faixa_etaria ?? "",
      valor_mensal: d.valor_mensal,
      status: d.status,
      motivo_desligamento: d.motivo_desligamento ?? "",
      data_desligamento: d.data_desligamento ?? "",
      data_reativacao: d.data_reativacao ?? "",
      observacao: d.observacao ?? "",
    });
    setEhReativacao(!!d.data_reativacao);
    setValorTexto(String(d.valor_mensal));
    setValorCustom(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titular?.nome_completo ?? "Titular"}</DialogTitle>
        </DialogHeader>

        {!titular ? null : editando ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold">
              {editando.id ? "Editar dependente" : "Novo dependente"}
            </p>
            <div className="grid gap-1.5">
              <Label>Nome completo *</Label>
              <Input
                value={editando.nome_completo}
                onChange={(e) => setEditando((d) => d && { ...d, nome_completo: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="grid gap-1.5">
                <Label>CPF (quando disponível)</Label>
                <Input
                  value={editando.cpf ?? ""}
                  onChange={(e) => setEditando((d) => d && { ...d, cpf: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  value={editando.data_nascimento ?? ""}
                  onChange={(e) => setEditando((d) => d && { ...d, data_nascimento: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Data de adesão</Label>
                <Input
                  type="date"
                  value={editando.data_adesao ?? ""}
                  onChange={(e) => setEditando((d) => d && { ...d, data_adesao: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Parentesco</Label>
                <Input
                  value={editando.parentesco ?? ""}
                  onChange={(e) => setEditando((d) => d && { ...d, parentesco: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Faixa etária (automática)</Label>
                <Input readOnly value={faixaEditando ? `${faixaLabel(faixaEditando)} anos` : ""} placeholder="Definida pela data de nascimento" />
              </div>
              <div className="grid gap-1.5">
                <Label>Valor mensal (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={
                    faixaEditando && !valorCustom
                      ? String(faixaEditando.valor_mensal)
                      : valorTexto
                  }
                  onChange={(e) => {
                    setValorTexto(e.target.value);
                    setValorCustom(true);
                  }}
                />
                {faixaEditando && !valorCustom ? (
                  <p className="text-[11px] text-muted-foreground">
                    Valor da faixa {faixaLabel(faixaEditando)} — edite se precisar de um valor diferente.
                  </p>
                ) : (
                  !faixaEditando && (
                    <p className="text-[11px] text-muted-foreground">
                      Sem faixa configurada para esta idade — informe o valor manualmente.
                    </p>
                  )
                )}
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select
                  value={editando.status}
                  onValueChange={(v) =>
                    setEditando(
                      (d) =>
                        d && {
                          ...d,
                          status: v as "ativo" | "desligado",
                          motivo_desligamento:
                            v === "desligado" && !d.motivo_desligamento
                              ? "Falta de margem"
                              : d.motivo_desligamento,
                        },
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="desligado">Desligado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editando.status === "desligado" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Motivo do desligamento</Label>
                  <Select
                    value={
                      /margem/i.test(editando.motivo_desligamento ?? "")
                        ? "Falta de margem"
                        : "Outro"
                    }
                    onValueChange={(v) =>
                      setEditando((d) => d && { ...d, motivo_desligamento: v === "Falta de margem" ? "Falta de margem" : "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Falta de margem">Falta de margem</SelectItem>
                      <SelectItem value="Outro">Outro motivo</SelectItem>
                    </SelectContent>
                  </Select>
                  {!/margem/i.test(editando.motivo_desligamento ?? "") && (
                    <Input
                      placeholder="Descreva o motivo"
                      value={editando.motivo_desligamento ?? ""}
                      onChange={(e) =>
                        setEditando((d) => d && { ...d, motivo_desligamento: e.target.value })
                      }
                    />
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label>Data do desligamento</Label>
                  <Input
                    type="date"
                    value={editando.data_desligamento ?? ""}
                    onChange={(e) =>
                      setEditando((d) => d && { ...d, data_desligamento: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
            <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Este cadastro é uma reativação de dependente?</Label>
                <Select
                  value={ehReativacao ? "sim" : "nao"}
                  onValueChange={(v) => {
                    const sim = v === "sim";
                    setEhReativacao(sim);
                    setEditando(
                      (d) =>
                        d && {
                          ...d,
                          data_reativacao: sim ? d.data_reativacao || hojeISOLocal() : "",
                        },
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não — inclusão nova</SelectItem>
                    <SelectItem value="sim">Sim — dependente reativado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {ehReativacao && (
                <div className="grid gap-1.5">
                  <Label>Data de reativação</Label>
                  <Input
                    type="date"
                    value={editando.data_reativacao ?? ""}
                    onChange={(e) =>
                      setEditando((d) => d && { ...d, data_reativacao: e.target.value })
                    }
                  />
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Observação</Label>
              <Textarea
                rows={2}
                value={editando.observacao ?? ""}
                onChange={(e) => setEditando((d) => d && { ...d, observacao: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditando(null)}>
                Voltar
              </Button>
              <Button onClick={submit} disabled={salvar.isPending}>
                Salvar dependente
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* DADOS DO TITULAR */}
            <Card className="rounded-2xl border-border/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dados do titular
                </p>
                {podeEditar && !editandoTitular && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Editar dados do titular"
                    onClick={() => setEditandoTitular(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {editandoTitular ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label>Nome completo *</Label>
                      <Input
                        value={dadosTitular.nome_completo}
                        onChange={(e) => setDadosTitular((d) => ({ ...d, nome_completo: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>CPF *</Label>
                      <Input
                        value={dadosTitular.cpf}
                        onChange={(e) => setDadosTitular((d) => ({ ...d, cpf: e.target.value }))}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Matrícula</Label>
                      <Input
                        value={dadosTitular.matricula}
                        onChange={(e) => setDadosTitular((d) => ({ ...d, matricula: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Contrato</Label>
                      <Input
                        value={dadosTitular.contrato}
                        onChange={(e) => setDadosTitular((d) => ({ ...d, contrato: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Observação</Label>
                      <Input
                        value={dadosTitular.observacao}
                        onChange={(e) => setDadosTitular((d) => ({ ...d, observacao: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditandoTitular(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={salvarDadosTitular} disabled={salvarTitular.isPending}>
                      Salvar dados
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-4">
                  <Campo label="Nome" value={titular.nome_completo} />
                  <Campo label="CPF" value={formatCPF(titular.cpf)} />
                  <Campo label="Matrícula" value={titular.matricula || "—"} />
                  <Campo label="Contrato" value={titular.contrato || "—"} />
                </div>
              )}
              <Separator className="my-3" />
              <div className="grid items-end gap-3 sm:grid-cols-4">
                <div className="grid gap-1.5">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Margem disponível (R$)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      inputMode="decimal"
                      readOnly={!podeEditar}
                      value={margemTxt}
                      onChange={(e) => setMargemTxt(e.target.value)}
                    />
                    {podeEditar && <Button
                      size="icon"
                      variant="outline"
                      title="Salvar margem"
                      disabled={atualizarMargem.isPending}
                      onClick={() =>
                        atualizarMargem.mutate({
                          id: titular.id,
                          valor_margem: parseValorBr(margemTxt),
                          valor_anterior: titular.valor_margem,
                        })
                      }
                    >
                      <Check className="h-4 w-4" />
                    </Button>}
                  </div>
                </div>
                <Campo
                  label="Valor total dos dependentes ativos"
                  value={formatBRL(titular.valor_total_dependentes_ativos)}
                />
                <Campo
                  label="Margem restante"
                  value={
                    <span className={cn(titular.margem_restante < 0 && "text-destructive")}>
                      {formatBRL(titular.margem_restante)}
                    </span>
                  }
                />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
                  <span
                    className={cn(
                      "mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      STATUS_CLS[titular.status_margem],
                    )}
                  >
                    {titular.status_margem}
                  </span>
                </div>
              </div>
            </Card>

            {/* ALERTA DE MARGEM */}
            {titular.margem_restante < 0 && (
              <Card className="rounded-2xl border-destructive/50 bg-destructive/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                    <div>
                      <p className="text-sm font-semibold text-destructive">SEM MARGEM</p>
                      <p className="text-sm text-destructive">
                        Os valores dos dependentes ultrapassam a margem disponível do titular em{" "}
                        {formatBRL(titular.excedente_margem)}.
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setAba("dependentes")}>
                    Analisar Dependentes
                  </Button>
                </div>
              </Card>
            )}

            {titular.requer_analise_faixa && (
              <Card className="rounded-2xl border-warning/50 bg-warning/10 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
                  <div>
                    <p className="text-sm font-semibold text-warning">
                      Nova mensalidade ultrapassa a margem disponível.
                    </p>
                    <p className="text-sm text-warning">
                      Status: Sem margem — requer análise. Com os valores das faixas vigentes o total dos
                      ativos seria {formatBRL(titular.valor_total_aplicavel)} e a margem restante{" "}
                      {formatBRL(titular.margem_restante_projetada)}. Nenhum dependente foi desligado
                      automaticamente.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <Tabs value={aba} onValueChange={setAba}>
              <TabsList>
                <TabsTrigger value="dependentes">Dependentes ({deps.length})</TabsTrigger>
                <TabsTrigger value="resumo">Resumo</TabsTrigger>
                <TabsTrigger value="historico">Histórico ({historico.length})</TabsTrigger>
              </TabsList>

              {/* DEPENDENTES — um bloco por dependente */}
              <TabsContent value="dependentes" className="space-y-3 pt-3">
                {podeEditar && (
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => { setEditando(vazio(titular.id)); setValorTexto(""); setValorCustom(false); }}>
                      <UserPlus className="mr-1.5 h-4 w-4" /> Novo dependente
                    </Button>
                  </div>
                )}
                {deps.length === 0 && (
                  <Card className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum dependente cadastrado para este titular.
                  </Card>
                )}
                {deps.map((d) => (
                  <Card key={d.id} className="rounded-2xl border-border/60 p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold uppercase">{d.nome_completo}</p>
                        <Badge variant={d.status === "ativo" ? "default" : "secondary"}>
                          {d.status_label}
                        </Badge>
                        {d.parentesco && <Badge variant="outline">{d.parentesco}</Badge>}
                      </div>
                      {podeEditar && <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => abrirEdicao(d)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {d.status === "ativo" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setConfirmarDesligar(d);
                              setMotivoDesligamento("");
                              setOutroMotivoDesligamento("");
                            }}
                          >
                            <UserMinus className="mr-1.5 h-4 w-4" /> Desligar dependente
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setConfirmarReativar(d)}>
                            <RotateCcw className="mr-1.5 h-4 w-4" /> Reativar dependente
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => setConfirmarExcluir(d)} title="Excluir dependente">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-5">
                      <Campo label="CPF" value={formatCPF(d.cpf)} />
                      <Campo label="Nascimento" value={formatDataBR(d.data_nascimento)} />
                      <Campo label="Data de adesão" value={formatDataBR(d.data_adesao)} />
                      <Campo
                        label="Idade"
                        value={d.idade_atual === null ? "—" : `${d.idade_atual} anos`}
                      />
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Faixa atual
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <p className="text-sm font-medium">{d.faixa_atual_label}</p>
                          {podeEditar && d.status === "ativo" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              title="Editar faixa vinculada"
                              onClick={() => {
                                setAplicarFaixaDep(d);
                                setFaixaSelId(d.faixa_atual?.id ?? null);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {d.faixa_atual && (
                          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                            {[d.faixa_atual.tabela_nome, d.faixa_atual.plano]
                              .filter(Boolean)
                              .join(" • ") || "—"}
                          </p>
                        )}
                      </div>
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Mensalidade
                        </p>
                        {valorInlineId === d.id ? (
                          <div className="mt-1 flex items-center gap-1.5">
                            <Input
                              autoFocus
                              inputMode="decimal"
                              className="h-8"
                              value={valorInlineTxt}
                              onChange={(e) => setValorInlineTxt(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") salvarValorInline(d);
                                if (e.key === "Escape") setValorInlineId(null);
                              }}
                            />
                            <Button
                              size="sm"
                              className="h-8"
                              disabled={salvar.isPending}
                              onClick={() => salvarValorInline(d)}
                            >
                              Salvar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8"
                              onClick={() => setValorInlineId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <p className="text-sm font-medium">{formatBRL(d.valor_mensal)}</p>
                            {podeEditar && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => {
                                  setValorInlineId(d.id);
                                  setValorInlineTxt(
                                    Number(d.valor_mensal || 0).toFixed(2).replace(".", ","),
                                  );
                                }}
                              >
                                <Pencil className="mr-1 h-3 w-3" /> Editar valor
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <Campo
                        label="Próxima mudança"
                        value={
                          d.data_proxima_mudanca ? (
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatDataBR(d.data_proxima_mudanca)}
                            </span>
                          ) : (
                            "—"
                          )
                        }
                      />
                      <Campo label="Próxima faixa" value={d.proxima_faixa_label ?? "—"} />
                      <Campo
                        label="Novo valor"
                        value={d.proximo_valor === null ? "—" : formatBRL(d.proximo_valor)}
                      />
                      {d.status === "desligado" && (
                        <>
                          <Campo label="Motivo do desligamento" value={d.motivo_desligamento || "—"} />
                          <Campo label="Data do desligamento" value={formatDataBR(d.data_desligamento)} />
                        </>
                      )}
                      {d.observacao && <Campo label="Observação" value={d.observacao} />}
                    </div>
                    {d.valor_desatualizado && d.faixa_atual && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5">
                        <p className="text-xs text-warning">
                          A faixa vigente ({faixaLabel(d.faixa_atual)} anos) prevê{" "}
                          {formatBRL(d.faixa_atual.valor_mensal)} e o cadastro está em{" "}
                          {formatBRL(d.valor_mensal)}.
                        </p>
                        {podeEditar && <Button
                          size="sm"
                          variant="outline"
                          disabled={aplicarFaixa.isPending}
                          onClick={() => {
                            setAplicarFaixaDep(d);
                            setFaixaSelId(d.faixa_atual?.id ?? null);
                          }}
                        >
                          Aplicar novo valor
                        </Button>}
                      </div>
                    )}
                  </Card>
                ))}
              </TabsContent>

              {/* RESUMO */}
              <TabsContent value="resumo" className="pt-3">
                <Card className="overflow-hidden rounded-2xl border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dependente</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deps.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>{d.nome_completo}</TableCell>
                          <TableCell className="text-right">{formatBRL(d.valor_mensal)}</TableCell>
                          <TableCell>{d.status_label}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/40 font-semibold">
                        <TableCell>TOTAL ATIVO</TableCell>
                        <TableCell className="text-right">
                          {formatBRL(titular.valor_total_dependentes_ativos)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                      <TableRow>
                        <TableCell>Margem do titular</TableCell>
                        <TableCell className="text-right">{formatBRL(titular.valor_margem)}</TableCell>
                        <TableCell />
                      </TableRow>
                      <TableRow>
                        <TableCell>Margem restante</TableCell>
                        <TableCell
                          className={cn("text-right", titular.margem_restante < 0 && "text-destructive")}
                        >
                          {formatBRL(titular.margem_restante)}
                        </TableCell>
                        <TableCell>{titular.status_margem}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>

              {/* HISTÓRICO */}
              <TabsContent value="historico" className="pt-3">
                <Card className="overflow-hidden rounded-2xl border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data e hora</TableHead>
                        <TableHead>Evento</TableHead>
                        <TableHead>Dependente</TableHead>
                        <TableHead className="text-right">De → Para</TableHead>
                        <TableHead className="text-right">Margem do titular</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historico.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                            <History className="mx-auto mb-1 h-4 w-4" />
                            Nenhum registro no histórico.
                          </TableCell>
                        </TableRow>
                      )}
                      {historico.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>{new Date(h.created_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="font-medium">{h.evento}</TableCell>
                          <TableCell>{h.dependente_nome || "—"}</TableCell>
                          <TableCell className="text-right">
                            {h.valor_anterior === null && h.valor_novo === null
                              ? "—"
                              : `${formatBRL(h.valor_anterior)} → ${formatBRL(h.valor_novo)}`}
                          </TableCell>
                          <TableCell className="text-right">
                            {h.margem_momento === null
                              ? "—"
                              : `${formatBRL(h.margem_momento)}${
                                  h.margem_restante_momento === null
                                    ? ""
                                    : ` (restante ${formatBRL(h.margem_restante_momento)})`
                                }`}
                          </TableCell>
                          <TableCell>{h.responsavel || "—"}</TableCell>
                          <TableCell>{h.motivo || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
        {/* CONFIRMAÇÃO DE DESLIGAMENTO */}
        <AlertDialog
          open={!!confirmarDesligar}
          onOpenChange={(v) => {
            if (!v) {
              setConfirmarDesligar(null);
              setMotivoDesligamento("");
              setOutroMotivoDesligamento("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desligar dependente</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Dependente: </span>
                <span className="font-medium uppercase">{confirmarDesligar?.nome_completo}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Valor: </span>
                <span className="font-medium">{formatBRL(confirmarDesligar?.valor_mensal)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Margem atual do titular: </span>
                <span className="font-medium">
                  {formatBRL(titular?.valor_margem)} · restante {formatBRL(titular?.margem_restante)}
                </span>
              </p>
              <div className="grid gap-1.5 pt-1">
                <Label>Motivo do desligamento *</Label>
                <Select value={motivoDesligamento} onValueChange={setMotivoDesligamento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_DESLIGAMENTO.map((motivo) => (
                      <SelectItem key={motivo} value={motivo}>
                        {motivo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {motivoDesligamento === "Outro motivo" && (
                <div className="grid gap-1.5">
                  <Label>Informe o motivo *</Label>
                  <Textarea
                    rows={2}
                    value={outroMotivoDesligamento}
                    onChange={(e) => setOutroMotivoDesligamento(e.target.value)}
                    placeholder="Descreva o motivo do desligamento"
                  />
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={
                  desligarMargem.isPending ||
                  !motivoDesligamento ||
                  (motivoDesligamento === "Outro motivo" && !outroMotivoDesligamento.trim())
                }
                onClick={async () => {
                  if (!confirmarDesligar || !titular) return;
                  const motivo =
                    motivoDesligamento === "Outro motivo"
                      ? outroMotivoDesligamento.trim()
                      : motivoDesligamento;
                  await desligarMargem.mutateAsync({ dependente: confirmarDesligar, titular, motivo });
                  setConfirmarDesligar(null);
                  setMotivoDesligamento("");
                  setOutroMotivoDesligamento("");
                }}
              >
                Confirmar desligamento
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* CONFIRMAÇÃO DE EXCLUSÃO */}
        <AlertDialog open={!!confirmarExcluir} onOpenChange={(v) => !v && setConfirmarExcluir(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir dependente?</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Titular: </span>
                <span className="font-medium uppercase">{titular?.nome_completo}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Dependente: </span>
                <span className="font-medium uppercase">{confirmarExcluir?.nome_completo}</span>
                {confirmarExcluir?.parentesco && (
                  <span className="text-muted-foreground"> ({confirmarExcluir.parentesco})</span>
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Valor: </span>
                <span className="font-medium">{formatBRL(confirmarExcluir?.valor_mensal)}</span>
              </p>
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-destructive">
                O registro será removido definitivamente. Esta ação não pode ser desfeita.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={excluir.isPending}
                onClick={() => {
                  if (!confirmarExcluir) return;
                  excluir.mutate(confirmarExcluir.id);
                  setConfirmarExcluir(null);
                }}
              >
                Excluir dependente
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* CONFIRMAÇÃO DE REATIVAÇÃO */}
        <AlertDialog open={!!confirmarReativar} onOpenChange={(v) => !v && setConfirmarReativar(null)}>
          <AlertDialogContent>
            {(() => {
              const analise =
                confirmarReativar && titular ? analisarReativacao(titular, confirmarReativar) : null;
              return (
                <>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {analise?.ok
                        ? "Confirmar reativação deste dependente?"
                        : "Não há margem suficiente para reativar este dependente."}
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Dependente: </span>
                      <span className="font-medium uppercase">{confirmarReativar?.nome_completo}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Margem disponível: </span>
                      <span className="font-medium">{formatBRL(analise?.disponivel)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Valor necessário: </span>
                      <span className="font-medium">{formatBRL(analise?.necessario)}</span>
                    </p>
                    {!analise?.ok && (
                      <p className="text-destructive">
                        Valor faltante: {formatBRL(analise?.faltante)}
                      </p>
                    )}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      {analise?.ok ? "Cancelar" : "Fechar"}
                    </AlertDialogCancel>
                    {analise?.ok && (
                      <Button
                        disabled={reativar.isPending}
                        onClick={async () => {
                          if (!confirmarReativar || !titular) return;
                          await reativar.mutateAsync({ dependente: confirmarReativar, titular });
                          setConfirmarReativar(null);
                        }}
                      >
                        Confirmar reativação
                      </Button>
                    )}
                  </AlertDialogFooter>
                </>
              );
            })()}
          </AlertDialogContent>
        </AlertDialog>

        {/* Escolha da faixa para aplicar o novo valor */}
        <AlertDialog
          open={!!aplicarFaixaDep}
          onOpenChange={(v) => {
            if (!v) {
              setAplicarFaixaDep(null);
              setFaixaSelId(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Faixa etária vinculada</AlertDialogTitle>
            </AlertDialogHeader>
            {aplicarFaixaDep && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Selecione a faixa etária de onde o valor será aplicado para{" "}
                  <span className="font-medium text-foreground">{aplicarFaixaDep.nome_completo}</span>
                  {aplicarFaixaDep.idade_atual !== null && ` (${aplicarFaixaDep.idade_atual} anos)`}.
                </p>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {faixasVigentes(faixas)
                    .filter(
                      (f) =>
                        aplicarFaixaDep.idade_atual !== null &&
                        aplicarFaixaDep.idade_atual >= f.idade_inicial &&
                        (f.idade_final === null || aplicarFaixaDep.idade_atual <= f.idade_final),
                    )
                    .map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFaixaSelId(f.id)}
                        className={cn(
                          "w-full rounded-lg border p-3 text-left transition-colors",
                          faixaSelId === f.id
                            ? "border-primary bg-primary/5"
                            : "border-border/60 hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{faixaLabel(f)} anos</p>
                          <p className="text-sm font-semibold">{formatBRL(f.valor_mensal)}</p>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[f.tabela_nome, f.plano, f.sequencia ? `Seq. ${f.sequencia}` : null]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      </button>
                    ))}
                  {faixasVigentes(faixas).filter(
                    (f) =>
                      aplicarFaixaDep.idade_atual !== null &&
                      aplicarFaixaDep.idade_atual >= f.idade_inicial &&
                      (f.idade_final === null || aplicarFaixaDep.idade_atual <= f.idade_final),
                  ).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma faixa vigente encontrada para a idade deste dependente.
                    </p>
                  )}
                </div>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button
                disabled={!faixaSelId || aplicarFaixa.isPending}
                onClick={() => {
                  const faixa = faixas.find((f) => f.id === faixaSelId);
                  if (!aplicarFaixaDep || !faixa) return;
                  aplicarFaixa.mutate(
                    {
                      dependente: aplicarFaixaDep,
                      faixa,
                      motivo: "Mudança de faixa etária",
                    },
                    {
                      onSettled: () => {
                        setAplicarFaixaDep(null);
                        setFaixaSelId(null);
                      },
                    },
                  );
                }}
              >
                Aplicar valor da faixa
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
