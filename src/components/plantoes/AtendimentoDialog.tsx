import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlantaoMutations, type PlantaoAtendimento } from "@/hooks/usePlantoes";
import { useCreateDemanda } from "@/hooks/useDemandas";
import { fetchBeneficiarioByCpf } from "@/lib/beneficiario-lookup";
import { toast } from "sonner";

const TIPOS = ["Consulta", "Exames", "Reclamação", "Outros"];
const CANAIS = ["Presencial", "WhatsApp"];
const STATUS = ["Pendente", "Em andamento", "Resolvido", "Cancelado"] as const;
type Status = (typeof STATUS)[number];

export function parseAssunto(assunto: string | null | undefined, resolvidoFallback = false): { tipo: string; canal: string; status: Status } {
  const fallbackStatus: Status = resolvidoFallback ? "Resolvido" : "Pendente";
  if (!assunto) return { tipo: "Consulta", canal: "Presencial", status: fallbackStatus };
  const parts = assunto.split("·").map((s) => s.trim());
  const tipo = TIPOS.find((t) => t.toLowerCase() === (parts[0] ?? "").toLowerCase()) ?? parts[0] ?? "Consulta";
  const canal = CANAIS.find((c) => c.toLowerCase() === (parts[1] ?? "").toLowerCase()) ?? "Presencial";
  const status = (STATUS.find((s) => s.toLowerCase() === (parts[2] ?? "").toLowerCase()) ?? fallbackStatus) as Status;
  return { tipo, canal, status };
}

export function AtendimentoDialog({
  open,
  onOpenChange,
  plantaoId,
  atendimento,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plantaoId: string;
  atendimento?: PlantaoAtendimento | null;
}) {
  const { upsertAtendimento } = usePlantaoMutations();
  const createDemanda = useCreateDemanda();
  const initial = parseAssunto(atendimento?.assunto, atendimento?.resolvido);
  const [nome, setNome] = useState(atendimento?.nome_cliente ?? "");
  const [cpf, setCpf] = useState(atendimento?.cpf ?? "");
  const [tipo, setTipo] = useState(initial.tipo);
  const [canal, setCanal] = useState(initial.canal);
  const [status, setStatus] = useState<Status>(initial.status);
  const [observacao, setObservacao] = useState(atendimento?.observacao ?? "");
  const [cpfLookupLoading, setCpfLookupLoading] = useState(false);
  const [empresaDetectada, setEmpresaDetectada] = useState<string>("");

  // Busca automática dos dados do beneficiário pelo CPF
  useEffect(() => {
    const digits = String(cpf || "").replace(/\D/g, "");
    if (digits.length !== 11) { setEmpresaDetectada(""); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setCpfLookupLoading(true);
        const res = await fetchBeneficiarioByCpf(digits, ctrl.signal);
        if (!res) return;
        if (res.nome && !nome.trim()) setNome(res.nome);
        if (res.empresa) setEmpresaDetectada(res.empresa);
        if (res.nome || res.empresa) toast.success("Dados do beneficiário carregados");
      } catch { /* silencioso */ }
      finally { setCpfLookupLoading(false); }
    }, 400);
    return () => { ctrl.abort(); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpf]);


  // Busca o plantão para obter contexto (empresa/executiva/data) — usado para vincular ao Relatório de Demandas
  const { data: plantaoCtx } = useQuery({
    queryKey: ["plantao-ctx", plantaoId],
    enabled: open && !!plantaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plantoes")
        .select("id, data, plantonista, empresa:plantoes_empresas(nome)")
        .eq("id", plantaoId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const now = new Date();
  const horaAtual = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{atendimento ? "Editar demanda" : "Adicionar demanda"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Beneficiário" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
          <Input placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={20} />
          <div className="grid grid-cols-3 gap-2">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
              <SelectContent>{CANAIS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            maxLength={1000}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!nome.trim() || upsertAtendimento.isPending || createDemanda.isPending}
            onClick={async () => {
              try {
                await upsertAtendimento.mutateAsync({
                  id: atendimento?.id,
                  plantao_id: plantaoId,
                  hora: atendimento?.hora ?? horaAtual,
                  nome_cliente: nome.trim(),
                  cpf: cpf.trim(),
                  assunto: `${tipo} · ${canal} · ${status}`,
                  resolvido: status === "Resolvido",
                  observacao: observacao.trim(),
                });

                // Se for Reclamação e for novo registro, gera demanda vinculada ao Relatório de Demandas
                if (!atendimento && tipo === "Reclamação") {
                  try {
                    await createDemanda.mutateAsync({
                      data_reclamacao: plantaoCtx?.data || new Date().toISOString().slice(0, 10),
                      nome_cliente: nome.trim(),
                      cpf: cpf.trim() || null,
                      empresa: plantaoCtx?.empresa?.nome || "",
                      executiva: plantaoCtx?.plantonista || "",
                      setor_responsavel: "Atendimento",
                      tipo_reclamacao: "Reclamação",
                      reclamacao: "Reclamação",
                      detalhamento: observacao.trim() || null,
                      resolvido_executiva: status === "Resolvido",
                      data_resolucao_executiva: status === "Resolvido" ? new Date().toISOString().slice(0, 10) : null,
                    } as any);
                    toast.success("Demanda adicionada e vinculada ao relatório");
                  } catch (err: any) {
                    toast.error("Atendimento salvo, mas falhou vincular ao relatório: " + (err?.message || ""));
                  }
                }

                onOpenChange(false);
              } catch (e: any) {
                toast.error(e?.message || "Erro ao salvar");
              }
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
