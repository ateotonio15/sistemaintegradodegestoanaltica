import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, WandSparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateDemanda, useUpdateDemanda } from "@/hooks/useDemandas";
import { preservarCpf } from "@/lib/demanda-form-utils";
import { sugerirReclamacao, type ClassificacaoIA } from "@/lib/reclamacao-ia";
import type { Demanda } from "@/lib/demandas-utils";
import { format } from "date-fns";
import { fetchBeneficiarioByCpf } from "@/lib/beneficiario-lookup";
import PessoaFisicaAutocomplete from "@/components/demandas/PessoaFisicaAutocomplete";
import { buscarPessoaFisica, isCpfValido, type PessoaFisicaResult } from "@/lib/pessoa-fisica-lookup";
import {
  SETORES,
  TIPOS,
  RECLAMACOES,
  getReclamacoesDisponiveis,
  normalizarReclamacao,
  isReclamacaoCirurgica,
} from "@/lib/constants";


type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  demanda?: Demanda | null;
  initialValues?: Partial<Demanda>;
  plantaoContext?: { plantao_id: string; empresa_id?: string; status?: string; canal?: string } | null;
  onSaved?: (demanda: Demanda) => void;
};

const empty = (): Partial<Demanda> => ({
  data_reclamacao: format(new Date(), "yyyy-MM-dd"),
  nome_cliente: "",
  empresa: "",
  setor_responsavel: "",
  tipo_reclamacao: "",
  reclamacao: "",
  detalhamento: "",
  observacao: "",
  executiva: "",
  cpf: "",
  data_entrada: "",
  nome_medico: "",
  nome_procedimento: "",
  encaminhado_setor: true,
  resolvido_setor: false,
  data_resolucao_setor: "",
  resolvido_executiva: false,
  data_resolucao_executiva: "",
});

function isSurgical(reclamacao: string | null | undefined) {
  return isReclamacaoCirurgica(reclamacao);
}
function maskCpf(v: string) {
  const d = String(v).replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}






export default function DemandaFormDialog({ open, onOpenChange, demanda, initialValues, plantaoContext, onSaved }: Props) {
  const [form, setForm] = useState<Partial<Demanda>>({ ...empty(), ...(initialValues || {}) });
  const create = useCreateDemanda();
  const update = useUpdateDemanda();
  const isEdit = !!demanda?.id;
  const [aiFields, setAiFields] = useState<ClassificacaoIA | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [confirmAI, setConfirmAI] = useState(false);
  const aiController = useRef<AbortController | null>(null);
  const formRef = useRef(form);
  formRef.current = form;
  useEffect(() => () => aiController.current?.abort(), []);
  const classify = async () => {
    const snapshot = formRef.current;
    if (!snapshot.empresa || !snapshot.detalhamento?.trim()) return toast.error("Informe a empresa e o detalhamento");
    const controller = new AbortController();
    aiController.current = controller;
    setAiLoading(true);
    try {
      const result = await sugerirReclamacao(snapshot.empresa, snapshot.detalhamento, controller.signal);
      if (controller.signal.aborted) return;
      if (formRef.current.empresa !== snapshot.empresa || formRef.current.detalhamento !== snapshot.detalhamento) {
        toast.error("O texto ou a empresa mudou; solicite uma nova sugestão"); return;
      }
      setForm(p => ({ ...p, ...result }));
      setAiFields(result);
    } catch (e) {
      if (!controller.signal.aborted) toast.error(e instanceof Error ? e.message : "Falha na IA");
    } finally { setAiLoading(false); }
  };

  const { data: executivas = [] } = useQuery({
    queryKey: ["executivas-list"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["executivo", "executivo_externo"]);
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [] as { user_id: string; display_name: string }[];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids)
        .order("display_name");
      return (profs ?? []).filter((p) => p.display_name) as any;
    },
  });

  const { data: empresasList = [] } = useQuery({
    queryKey: ["empresas-nomes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresas")
        .select("id, nome")
        .order("nome");
      return data ?? [];
    },
  });

  useEffect(() => {
    aiController.current?.abort();
    setAiLoading(false);
    setAiFields(null);
    setConfirmAI(false);
    if (open) {
      setForm(demanda ? { ...demanda } : { ...empty(), ...(initialValues || {}) });
    }
  }, [open, demanda, initialValues]);

  // Lookup automático de beneficiário por CPF (11 dígitos) — API Samel
  const [cpfLookupLoading, setCpfLookupLoading] = useState(false);
  useEffect(() => {
    const digits = String(form.cpf || "").replace(/\D/g, "");
    if (digits.length !== 11) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setCpfLookupLoading(true);
        const res = await fetchBeneficiarioByCpf(digits, ctrl.signal);
        if (!res) return;
        setForm((prev) => {
          const next: any = { ...prev };
          if (res.nome && !prev.nome_cliente?.trim()) next.nome_cliente = res.nome;
          if (res.empresa && !prev.empresa?.trim()) next.empresa = res.empresa;
          return next;
        });
        if (res.nome || res.empresa) toast.success("Dados do beneficiário carregados");
      } catch {
        // silencioso: se falhar, usuário digita manualmente
      } finally {
        setCpfLookupLoading(false);
      }
    }, 400);
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [form.cpf]);


  const set = <K extends keyof Demanda>(k: K, v: Demanda[K] | string | boolean) =>
    setForm((p) => ({ ...p, [k]: v as any }));

  const onSubmit = async (confirmed = false) => {
    if (!form.data_reclamacao) {
      toast.error("Informe a data da reclamação");
      return;
    }
    if (!form.nome_cliente?.trim()) {
      toast.error("Informe o nome do beneficiário");
      return;
    }
    if (!form.setor_responsavel) return toast.error("Selecione o setor responsável");
    if (!form.tipo_reclamacao) return toast.error("Selecione o tipo de reclamação");
    if (!form.reclamacao) return toast.error("Selecione a reclamação");
    if (!form.empresa) return toast.error("Selecione a empresa");

    if (isSurgical(form.reclamacao)) {
      if (!form.cpf?.trim()) return toast.error("Informe o CPF");
      if (!form.data_entrada) return toast.error("Informe a data de entrada");
      if (!form.nome_medico?.trim()) return toast.error("Informe o nome do médico");
      if (!form.nome_procedimento?.trim()) return toast.error("Informe o nome do procedimento");
    }

    if (form.resolvido_setor && !form.data_resolucao_setor) {
      return toast.error("Informe a data de resolução (setor)");
    }
    if (form.resolvido_executiva && !form.data_resolucao_executiva) {
      return toast.error("Informe a data de resolução (executiva)");
    }

    if (aiFields && !confirmed) { setConfirmAI(true); return; }

    // Normalização final antes de persistir
    const reclamacaoCanon = normalizarReclamacao(form.reclamacao);
    const cirurgico = isReclamacaoCirurgica(reclamacaoCanon);
    const payload: Partial<Demanda> = {
      ...form,
      reclamacao: reclamacaoCanon,
      // Campos cirúrgicos só persistem quando aplicável
      cpf: preservarCpf(form),
      data_entrada: cirurgico ? (form.data_entrada || null) : null,
      nome_medico: cirurgico ? (form.nome_medico || null) : null,
      nome_procedimento: cirurgico ? (form.nome_procedimento || null) : null,
      data_resolucao_setor: form.resolvido_setor ? form.data_resolucao_setor || null : null,
      data_resolucao_executiva: form.resolvido_executiva
        ? form.data_resolucao_executiva || null
        : null,
    };

    try {
      let saved: Demanda;
      if (isEdit && demanda) {
        saved = await update.mutateAsync({ id: demanda.id, patch: payload });
        toast.success("Demanda atualizada");
      } else {
        saved = await create.mutateAsync(payload);
        toast.success("Demanda criada");

        // Vincula automaticamente ao plantão de origem, se houver
        if (plantaoContext?.plantao_id) {
          try {
            const now = new Date();
            const hora = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
            await supabase.from("plantoes_atendimentos").insert({
              plantao_id: plantaoContext.plantao_id,
              demanda_id: saved.id,
              nome_cliente: saved.nome_cliente,
              cpf: saved.cpf ?? null,
              hora,
              assunto: `Reclamação · ${plantaoContext.canal || "Presencial"} · ${saved.resolvido_executiva ? "Resolvido" : (plantaoContext.status || "Pendente")}`,
              resolvido: !!saved.resolvido_executiva,
              observacao: saved.detalhamento ?? null,
            });
          } catch (err: any) {
            toast.error("Demanda criada, mas falhou vincular ao plantão: " + (err?.message || ""));
          }
        }
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    }
  };

  const loading = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar demanda" : "Nova demanda"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <Field label="Setor responsável *" automated={!!aiFields && aiFields.setor_responsavel === form.setor_responsavel}>
            <Select
              value={form.setor_responsavel || ""}
              onValueChange={(v) =>
                setForm((p) => ({
                  ...p,
                  setor_responsavel: v,
                  // cascata: troca de setor limpa tipo e reclamação
                  tipo_reclamacao: "",
                  reclamacao: "",
                }))
              }
            >
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {SETORES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                {form.setor_responsavel && !SETORES.includes(form.setor_responsavel) && (
                  <SelectItem value={form.setor_responsavel}>{form.setor_responsavel}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tipo de reclamação *" automated={!!aiFields && aiFields.tipo_reclamacao === form.tipo_reclamacao}>
            <Select
              value={form.tipo_reclamacao || ""}
              onValueChange={(v) =>
                setForm((p) => ({
                  ...p,
                  tipo_reclamacao: v,
                  // cascata: troca de tipo limpa reclamação
                  reclamacao: "",
                }))
              }
              disabled={!form.setor_responsavel}
            >
              <SelectTrigger>
                <SelectValue placeholder={form.setor_responsavel ? "Selecione..." : "Selecione um setor primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                {form.tipo_reclamacao && !TIPOS.includes(form.tipo_reclamacao) && (
                  <SelectItem value={form.tipo_reclamacao}>{form.tipo_reclamacao}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Reclamação *" automated={!!aiFields && aiFields.reclamacao === form.reclamacao}>
            {(() => {
              const opcoes = getReclamacoesDisponiveis(form.setor_responsavel, form.tipo_reclamacao);
              return (
                <Select
                  value={form.reclamacao || ""}
                  onValueChange={(v) => set("reclamacao", normalizarReclamacao(v))}
                  disabled={!form.tipo_reclamacao}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={form.tipo_reclamacao ? "Selecione..." : "Selecione um tipo primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {opcoes.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    {form.reclamacao && !opcoes.includes(form.reclamacao) && (
                      <SelectItem value={form.reclamacao}>{form.reclamacao}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              );
            })()}
          </Field>

          <Field label="Data da reclamação *">
            <Input
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              value={form.data_reclamacao || ""}
              onChange={(e) => set("data_reclamacao", e.target.value)}
            />
          </Field>
          <Field label="Executivo(a) *">
            <Select
              value={form.executiva || "__none__"}
              onValueChange={(v) => set("executiva", v === "__none__" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhuma —</SelectItem>
                {executivas.map((e: any) => (
                  <SelectItem key={e.user_id} value={e.display_name}>{e.display_name}</SelectItem>
                ))}
                {form.executiva &&
                  !executivas.some((e: any) => e.display_name === form.executiva) && (
                    <SelectItem value={form.executiva}>{form.executiva}</SelectItem>
                  )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Empresa *">
            <Select
              value={form.empresa || ""}
              onValueChange={(v) => set("empresa", v)}
            >
              <SelectTrigger><SelectValue placeholder="Selecionar empresa..." /></SelectTrigger>
              <SelectContent>
                {empresasList.map((e: any) => (
                  <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>
                ))}
                {form.empresa && !empresasList.some((e: any) => e.nome === form.empresa) && (
                  <SelectItem value={form.empresa}>{form.empresa}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="CPF do beneficiário">
            <div className="relative">
              <Input
                value={form.cpf || ""}
                onChange={(e) => set("cpf", maskCpf(e.target.value))}
                placeholder="000.000.000-00 (busca automática)"
                maxLength={14}
              />
              {cpfLookupLoading && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </Field>
          <Field label="Nome do cliente *">
            <PessoaFisicaAutocomplete
              value={form.nome_cliente || ""}
              onChange={(v) => set("nome_cliente", v)}
              placeholder="Digite pelo menos 3 letras para buscar..."
              onSelect={async (p) => {
                // Preenche imediatamente com o item selecionado
                const applyFrom = (src: PessoaFisicaResult) => {
                  setForm((prev) => ({
                    ...prev,
                    nome_cliente: src.NM_PESSOA_FISICA || prev.nome_cliente || "",
                    cpf: isCpfValido(src.NR_CPF) ? maskCpf(src.NR_CPF || "") : (prev.cpf || ""),
                  }));
                };
                applyFrom(p);
                // Segunda chamada com o CPF para obter dados atualizados
                if (isCpfValido(p.NR_CPF)) {
                  try {
                    const arr = await buscarPessoaFisica(p.NR_CPF || "");
                    if (arr.length > 0) applyFrom(arr[0]);
                  } catch (err: any) {
                    if (err?.name !== "AbortError") console.error(err);
                  }
                }
              }}
            />
          </Field>


          {isSurgical(form.reclamacao) && (
            <>
              <Field label="Data de entrada *">
                <Input
                  type="date"
                  value={form.data_entrada || ""}
                  onChange={(e) => set("data_entrada", e.target.value)}
                />
              </Field>
              <Field label="Nome do médico *">
                <Input value={form.nome_medico || ""} onChange={(e) => set("nome_medico", e.target.value)} />
              </Field>
              <Field label="Nome do procedimento *">
                <Input
                  value={form.nome_procedimento || ""}
                  onChange={(e) => set("nome_procedimento", e.target.value)}
                />
              </Field>
            </>
          )}


          <Field label="Detalhamento" className="md:col-span-2">
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={classify} disabled={aiLoading || loading || !form.empresa || !form.detalhamento?.trim()}>
                {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                {aiLoading ? "Classificando..." : "Preencher com IA"}
              </Button>
              {aiLoading && <Button type="button" size="sm" variant="ghost" onClick={() => aiController.current?.abort()}>Parar</Button>}
            </div>
            <Textarea
              rows={3}
              value={form.detalhamento || ""}
              onChange={(e) => set("detalhamento", e.target.value)}
            />
          </Field>


          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border pt-4">
            <YesNoField
              label="Encaminhado ao setor responsável?"
              value={!!form.encaminhado_setor}
              onChange={(v) => set("encaminhado_setor", v)}
            />
            <YesNoField
              label="Resolvido pelo setor?"
              value={!!form.resolvido_setor}
              onChange={(v) => {
                setForm((p) => ({
                  ...p,
                  resolvido_setor: v,
                  data_resolucao_setor: v
                    ? p.data_resolucao_setor || format(new Date(), "yyyy-MM-dd")
                    : "",
                  // se setor não resolveu, executiva também não pode ter resolvido
                  ...(v ? {} : { resolvido_executiva: false, data_resolucao_executiva: "" }),
                }));
              }}
            />
            {form.resolvido_setor && (
              <Field label="Data resolução (setor) *">
                <Input
                  type="date"
                  value={form.data_resolucao_setor || ""}
                  onChange={(e) => set("data_resolucao_setor", e.target.value)}
                />
              </Field>
            )}

            <YesNoField
              label="Resolvido pela executiva?"
              value={!!form.resolvido_executiva}
              onChange={(v) => {
                setForm((p) => ({
                  ...p,
                  resolvido_executiva: v,
                  data_resolucao_executiva: v
                    ? p.data_resolucao_executiva || format(new Date(), "yyyy-MM-dd")
                    : "",
                }));
              }}
            />
            {form.resolvido_executiva && (
              <Field label="Data resolução (executiva) *" className="md:col-span-2">
                <Input
                  type="date"
                  value={form.data_resolucao_executiva || ""}
                  onChange={(e) => set("data_resolucao_executiva", e.target.value)}
                />
              </Field>
            )}
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={() => onSubmit()} disabled={loading || aiLoading}>
            {loading ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar demanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <Dialog open={confirmAI} onOpenChange={setConfirmAI}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Confira se está tudo correto com a automação da IA</DialogTitle></DialogHeader>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-muted-foreground">Setor responsável</dt><dd>{form.setor_responsavel}</dd></div>
            <div><dt className="text-muted-foreground">Tipo de reclamação</dt><dd>{form.tipo_reclamacao}</dd></div>
            <div><dt className="text-muted-foreground">Reclamação</dt><dd>{form.reclamacao}</dd></div>
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAI(false)} disabled={loading}>Revisar</Button>
            <Button onClick={() => onSubmit(true)} disabled={loading}>{loading ? "Salvando..." : "Confirmar e salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className,
  automated,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  automated?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className || ""}`}>
      <Label className="text-xs font-medium text-muted-foreground">{label}{automated && <span className="ml-2 inline-flex items-center gap-1 text-primary"><WandSparkles className="h-3 w-3" />IA</span>}</Label>
      {children}
    </div>
  );
}

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = label.replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-5 pt-1">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="radio"
            name={id}
            checked={value === true}
            onChange={() => onChange(true)}
            className="h-4 w-4 accent-primary"
          />
          SIM
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="radio"
            name={id}
            checked={value === false}
            onChange={() => onChange(false)}
            className="h-4 w-4 accent-primary"
          />
          NÃO
        </label>
      </div>
    </div>
  );
}

function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <Label className="text-sm font-medium">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>

  );
}
