import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePlantaoMutations, type PlantaoAtendimento } from "@/hooks/usePlantoes";
import { useCreateDemanda } from "@/hooks/useDemandas";
import { parseAssunto } from "@/components/plantoes/AtendimentoDialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const TIPOS = ["Consulta", "Exames", "Reclamação", "Outros"] as const;
const CANAIS = ["Presencial", "WhatsApp"] as const;
const STATUS = ["Pendente", "Em andamento", "Resolvido", "Cancelado"] as const;

type Tipo = (typeof TIPOS)[number];
type Canal = (typeof CANAIS)[number];
type Status = (typeof STATUS)[number];

export function InlineDemandaForm({
  plantaoIds,
  defaultPlantaoId,
  empresaNome,
  executivaNome,
  dataPlantao,
}: {
  plantaoIds: string[];
  defaultPlantaoId: string;
  empresaNome?: string;
  executivaNome?: string;
  dataPlantao?: string;
}) {
  const { user, loading } = useAuth();
  const { upsertAtendimento } = usePlantaoMutations();
  const createDemanda = useCreateDemanda();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [tipo, setTipo] = useState<Tipo>("Consulta");
  const [canal, setCanal] = useState<Canal>("Presencial");
  const [status, setStatus] = useState<Status>("Pendente");
  const [observacao, setObservacao] = useState("");

  const queries = useQueries({
    queries: plantaoIds.map((id) => ({
      queryKey: ["plantoes", "atendimentos", id],
      enabled: !loading && !!user && !!id,
      queryFn: async () => {
        const { data, error } = await supabase
          .from("plantoes_atendimentos")
          .select("*")
          .eq("plantao_id", id);
        if (error) throw error;
        return data as PlantaoAtendimento[];
      },
    })),
  });

  const atendimentos = queries.flatMap((q) => q.data ?? []);
  const total = atendimentos.length;
  let consultas = 0;
  let pendencias = 0;
  let examesAutoriz = 0;
  atendimentos.forEach((a) => {
    const meta = parseAssunto(a.assunto, a.resolvido);
    const t = meta.tipo.toLowerCase();
    if (t.startsWith("consulta")) consultas++;
    if (t.startsWith("exame") && meta.status === "Resolvido") examesAutoriz++;
    if (meta.status !== "Resolvido" && meta.status !== "Cancelado") pendencias++;
  });

  const reset = () => {
    setNome(""); setCpf(""); setTipo("Consulta"); setCanal("Presencial");
    setStatus("Pendente"); setObservacao("");
  };

  const salvar = async () => {
    if (!nome.trim()) { toast.error("Informe o beneficiário"); return; }
    const now = new Date();
    const hora = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    try {
      await upsertAtendimento.mutateAsync({
        plantao_id: defaultPlantaoId,
        hora,
        nome_cliente: nome.trim(),
        cpf: cpf.trim(),
        assunto: `${tipo} · ${canal} · ${status}`,
        resolvido: status === "Resolvido",
        observacao: observacao.trim(),
      });
      toast.success("Demanda adicionada");
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    }
  };

  return (
    <div className="space-y-3">
      {!open ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="w-full gap-1.5 border-pink-200 text-pink-700 hover:bg-pink-50 hover:text-pink-800 dark:border-pink-900/50 dark:text-pink-300 dark:hover:bg-pink-950/30"
        >
          <Plus className="h-4 w-4" /> Adicionar demanda
        </Button>
      ) : (
        <div className="space-y-2 rounded-md border p-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nova demanda</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { reset(); setOpen(false); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input placeholder="Beneficiário" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
          <Input placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={20} />
          <div className="grid grid-cols-3 gap-2">
            <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={canal} onValueChange={(v) => setCanal(v as Canal)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CANAIS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            maxLength={1000}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={salvar} disabled={upsertAtendimento.isPending}>
              {upsertAtendimento.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        <Kpi label="Atendimentos" value={total} color="text-emerald-600" />
        <Kpi label="Consultas" value={consultas} />
        <Kpi label="Pendências" value={pendencias} color={pendencias > 0 ? "text-amber-600" : ""} />
        <Kpi label="Exames Autoriz." value={examesAutoriz} />
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-md border p-2 text-center">
      <div className={`text-lg font-bold ${color ?? ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}
