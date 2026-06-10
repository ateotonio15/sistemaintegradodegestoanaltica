import { useEffect, useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateDemanda, useUpdateDemanda } from "@/hooks/useDemandas";
import type { Demanda } from "@/lib/demandas-utils";
import { format } from "date-fns";


type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  demanda?: Demanda | null;
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
  encaminhado_setor: false,
  resolvido_setor: false,
  data_resolucao_setor: "",
  resolvido_executiva: false,
  data_resolucao_executiva: "",
});

const SURGICAL = ["aprazamento cirurgico", "cancelamento cirurgico"];
function normalize(s: string | null | undefined) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}
function isSurgical(reclamacao: string | null | undefined) {
  return SURGICAL.includes(normalize(reclamacao));
}
function maskCpf(v: string) {
  const d = String(v).replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

const SETORES = [
  "Agenda Cirúrgica",
  "Atendimento",
  "Auditoria",
  "Cadastro",
  "Clínica Externa",
  "Direção Clínica",
  "Financeiro",
  "T.I",
];
const TIPOS = [
  "Aplicativo Samel",
  "Aprazamento",
  "Cancelamento",
  "Assistencial",
  "Conduta Médica",
  "Falha Cadastral",
  "Nota Fiscal",
  "Portal",
  "Reclamação",
  "T.I",
];
const RECLAMACOES = [
  "Aprazamento cirúrgico",
  "Aprazamento de consulta",
  "Aprazamento de exame",
  "Aprazamento de neuro pediatra",
  "Aprazamento de ortopedista",
  "Aprazamento de terapia adulto",
  "Aprazamento de terapia infantil",
  "Aprazamento fisioterapia ortopédica",
  "Aprazamento fisioterapia pediátrica",
  "Cancelamento cirúrgico",
  "Cancelamento de consulta",
  "Cancelamento de exame",
  "Cancelamento de terapia adulto",
  "Atraso na emissão da nota",
  "Atraso na medicação",
  "Despreparo assistencial",
  "Falha de processo",
  "Indisponibilidade de dados",
  "Telemedicina",
  "Aplicativo",
];



export default function DemandaFormDialog({ open, onOpenChange, demanda }: Props) {
  const [form, setForm] = useState<Partial<Demanda>>(empty());
  const create = useCreateDemanda();
  const update = useUpdateDemanda();
  const isEdit = !!demanda?.id;

  const { data: executivas = [] } = useQuery({
    queryKey: ["executivas-list"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "executivo");
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
    if (open) {
      setForm(demanda ? { ...demanda } : empty());
    }
  }, [open, demanda]);

  }, [open, demanda]);


  const set = <K extends keyof Demanda>(k: K, v: Demanda[K] | string | boolean) =>
    setForm((p) => ({ ...p, [k]: v as any }));

  const onSubmit = async () => {
    if (!form.data_reclamacao) {
      toast.error("Informe a data da reclamação");
      return;
    }
    if (!form.nome_cliente?.trim()) {
      toast.error("Informe o nome do beneficiário");
      return;
    }
    if (isSurgical(form.reclamacao)) {
      if (!form.cpf?.trim()) return toast.error("Informe o CPF");
      if (!form.data_entrada) return toast.error("Informe a data de entrada");
      if (!form.nome_medico?.trim()) return toast.error("Informe o nome do médico");
      if (!form.nome_procedimento?.trim()) return toast.error("Informe o nome do procedimento");
    }

    try {
      if (isEdit && demanda) {
        await update.mutateAsync({ id: demanda.id, patch: form });
        toast.success("Demanda atualizada");
      } else {
        await create.mutateAsync(form);
        toast.success("Demanda criada");
      }
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
          <Field label="Data da reclamação *">
            <Input
              type="date"
              value={form.data_reclamacao || ""}
              onChange={(e) => set("data_reclamacao", e.target.value)}
            />
          </Field>
          <Field label="Beneficiário *">
            <Input value={form.nome_cliente || ""} onChange={(e) => set("nome_cliente", e.target.value)} />
          </Field>

          {isSurgical(form.reclamacao) && (
            <>
              <Field label="CPF *">
                <Input
                  value={form.cpf || ""}
                  onChange={(e) => set("cpf", maskCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </Field>
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

          <Field label="Empresa">
            <Input value={form.empresa || ""} onChange={(e) => set("empresa", e.target.value)} />
          </Field>
          <Field label="Setor responsável">
            <Input value={form.setor_responsavel || ""} onChange={(e) => set("setor_responsavel", e.target.value)} />
          </Field>
          <Field label="Tipo">
            <Input value={form.tipo_reclamacao || ""} onChange={(e) => set("tipo_reclamacao", e.target.value)} />
          </Field>
          <Field label="Reclamação">
            <Input value={form.reclamacao || ""} onChange={(e) => set("reclamacao", e.target.value)} />
          </Field>
          <Field label="Executiva responsável" className="md:col-span-2">
            <Select
              value={form.executiva || "__none__"}
              onValueChange={(v) => set("executiva", v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhuma —</SelectItem>
                {executivas.map((e: any) => (
                  <SelectItem key={e.user_id} value={e.display_name}>
                    {e.display_name}
                  </SelectItem>
                ))}
                {form.executiva &&
                  !executivas.some((e: any) => e.display_name === form.executiva) && (
                    <SelectItem value={form.executiva}>{form.executiva}</SelectItem>
                  )}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Detalhamento" className="md:col-span-2">
            <Textarea
              rows={3}
              value={form.detalhamento || ""}
              onChange={(e) => set("detalhamento", e.target.value)}
            />
          </Field>


          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border pt-4">
            <SwitchField
              label="Encaminhado ao setor"
              checked={!!form.encaminhado_setor}
              onChange={(v) => set("encaminhado_setor", v)}
            />
            <SwitchField
              label="Resolvido pelo setor"
              checked={!!form.resolvido_setor}
              onChange={(v) => {
                set("resolvido_setor", v);
                if (v && !form.data_resolucao_setor) {
                  set("data_resolucao_setor", format(new Date(), "yyyy-MM-dd"));
                }
              }}
            />
            <Field label="Data resolução (setor)">
              <Input
                type="date"
                value={form.data_resolucao_setor || ""}
                onChange={(e) => set("data_resolucao_setor", e.target.value)}
              />
            </Field>
            <SwitchField
              label="Resolvido pela executiva"
              checked={!!form.resolvido_executiva}
              onChange={(v) => {
                set("resolvido_executiva", v);
                if (v && !form.data_resolucao_executiva) {
                  set("data_resolucao_executiva", format(new Date(), "yyyy-MM-dd"));
                }
              }}
            />
            <Field label="Data resolução (executiva)" className="md:col-span-2">
              <Input
                type="date"
                value={form.data_resolucao_executiva || ""}
                onChange={(e) => set("data_resolucao_executiva", e.target.value)}
              />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar demanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className || ""}`}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
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
