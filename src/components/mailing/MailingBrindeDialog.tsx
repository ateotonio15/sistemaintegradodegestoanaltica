import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

type EmpresaCadastro = {
  id: string;
  nome: string;
  endereco: string | null;
  telefone_empresa: string | null;
  email_empresa: string | null;
};

const normTxt = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export type MailingBrinde = {
  id: string;
  empresa_nome: string;
  contato_nome: string | null;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  status: "pendente" | "enviado" | "entregue" | "devolvido";
  rastreio_codigo: string | null;
  transportadora: string | null;
  enviado_em: string | null;
  entregue_em: string | null;
  observacoes: string | null;
  tipo_cesta: "A" | "B" | "C" | null;
  executiva: string | null;
  data_nascimento: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: MailingBrinde | null;
  onSaved: () => void;
};

type FormState = {
  empresa_nome: string;
  contato_nome: string;
  cargo: string;
  email: string;
  telefone: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  status: MailingBrinde["status"];
  rastreio_codigo: string;
  transportadora: string;
  observacoes: string;
  tipo_cesta: "A" | "B" | "C" | "";
  executiva: string;
  data_nascimento: string;
};

const empty: FormState = {
  empresa_nome: "",
  contato_nome: "",
  cargo: "",
  email: "",
  telefone: "",
  endereco: "",
  cidade: "",
  uf: "",
  cep: "",
  status: "pendente",
  rastreio_codigo: "",
  transportadora: "",
  observacoes: "",
  tipo_cesta: "",
  executiva: "",
  data_nascimento: "",
};

const todayIso = () => new Date().toISOString();

export function MailingBrindeDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);

  const { data: empresasCadastro = [] } = useQuery({
    queryKey: ["mailing-empresas-cadastro"],
    enabled: open,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id,nome,endereco,telefone_empresa,email_empresa")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as EmpresaCadastro[];
    },
  });

  const termo = normTxt(form.empresa_nome);
  const sugestoes = termo.length >= 2
    ? empresasCadastro.filter((e) => normTxt(e.nome).includes(termo)).slice(0, 8)
    : [];

  const escolherEmpresa = (e: EmpresaCadastro) => {
    setForm((p) => ({
      ...p,
      empresa_nome: e.nome,
      endereco: e.endereco?.trim() || p.endereco,
      telefone: p.telefone || e.telefone_empresa || "",
      email: p.email || e.email_empresa || "",
    }));
    setSugestoesAbertas(false);
  };

  useEffect(() => {
    if (editing) {
      setForm({
        empresa_nome: editing.empresa_nome,
        contato_nome: editing.contato_nome ?? "",
        cargo: editing.cargo ?? "",
        email: editing.email ?? "",
        telefone: editing.telefone ?? "",
        endereco: editing.endereco ?? "",
        cidade: editing.cidade ?? "",
        uf: editing.uf ?? "",
        cep: editing.cep ?? "",
        status: editing.status,
        rastreio_codigo: editing.rastreio_codigo ?? "",
        transportadora: editing.transportadora ?? "",
        observacoes: editing.observacoes ?? "",
        tipo_cesta: editing.tipo_cesta ?? "",
        executiva: editing.executiva ?? "",
        data_nascimento: editing.data_nascimento ?? "",
      });
    } else {
      setForm({ ...empty });
    }
  }, [editing, open]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.empresa_nome.trim()) {
      toast.error("Empresa é obrigatória");
      return;
    }
    setSaving(true);

    const enviado_em =
      form.status === "enviado" || form.status === "entregue"
        ? editing?.enviado_em ?? todayIso()
        : null;
    const entregue_em =
      form.status === "entregue" ? editing?.entregue_em ?? todayIso() : null;

    const payload = {
      empresa_nome: form.empresa_nome.trim(),
      contato_nome: form.contato_nome.trim() || null,
      cargo: form.cargo.trim() || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      endereco: form.endereco.trim() || null,
      cidade: form.cidade.trim() || null,
      uf: form.uf.trim().toUpperCase() || null,
      cep: form.cep.trim() || null,
      status: form.status,
      rastreio_codigo: form.rastreio_codigo.trim() || null,
      transportadora: form.transportadora.trim() || null,
      observacoes: form.observacoes.trim() || null,
      tipo_cesta: form.tipo_cesta || null,
      executiva: form.executiva.trim() || null,
      data_nascimento: form.data_nascimento || null,
      enviado_em,
      entregue_em,
    };

    let error;
    if (editing) {
      ({ error } = await supabase
        .from("mailing_brindes")
        .update(payload)
        .eq("id", editing.id));
    } else {
      const { data: u } = await supabase.auth.getUser();
      ({ error } = await supabase
        .from("mailing_brindes")
        .insert({ ...payload, created_by: u.user?.id }));
    }

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success(editing ? "Atualizado" : "Contato adicionado");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar contato" : "Novo contato"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
          <div className="relative md:col-span-2">
            <Label>Empresa *</Label>
            <Input
              value={form.empresa_nome}
              onChange={(e) => {
                set("empresa_nome", e.target.value);
                setSugestoesAbertas(true);
              }}
              onFocus={() => setSugestoesAbertas(true)}
              onBlur={() => setTimeout(() => setSugestoesAbertas(false), 150)}
              maxLength={200}
              placeholder="Digite para buscar empresas cadastradas"
              autoComplete="off"
            />
            {sugestoesAbertas && sugestoes.length > 0 && (
              <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                {sugestoes.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => escolherEmpresa(e)}
                    className="block w-full px-3 py-2 text-left hover:bg-accent"
                  >
                    <div className="text-sm font-medium text-popover-foreground">{e.nome}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {e.endereco || "Sem endereço cadastrado"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label>Contato</Label>
            <Input
              value={form.contato_nome}
              onChange={(e) => set("contato_nome", e.target.value)}
              maxLength={150}
            />
          </div>
          <div>
            <Label>Cargo</Label>
            <Input
              value={form.cargo}
              onChange={(e) => set("cargo", e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input
              value={form.telefone}
              onChange={(e) => set("telefone", e.target.value)}
              maxLength={30}
            />
          </div>
          <div>
            <Label>Data de nascimento</Label>
            <Input
              type="date"
              value={form.data_nascimento}
              onChange={(e) => set("data_nascimento", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Endereço</Label>
            <Input
              value={form.endereco}
              onChange={(e) => set("endereco", e.target.value)}
              maxLength={300}
              placeholder="Rua, número, complemento, bairro"
            />
          </div>
          <div>
            <Label>Tipo de cesta</Label>
            <Select
              value={form.tipo_cesta || "none"}
              onValueChange={(v) => set("tipo_cesta", v === "none" ? "" : (v as "A" | "B" | "C"))}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="A">Cesta tipo A</SelectItem>
                <SelectItem value="B">Cesta tipo B</SelectItem>
                <SelectItem value="C">Cesta tipo C</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Executiva responsável</Label>
            <Input
              value={form.executiva}
              onChange={(e) => set("executiva", e.target.value)}
              maxLength={100}
              placeholder="Ex.: Mayara"
            />
          </div>

          <div className="md:col-span-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => set("status", v as typeof form.status)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
                <SelectItem value="devolvido">Devolvido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
