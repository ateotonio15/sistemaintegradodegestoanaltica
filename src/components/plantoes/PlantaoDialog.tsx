import { useEffect, useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { usePlantaoMutations, type Plantao } from "@/hooks/usePlantoes";
import { useAuth } from "@/hooks/useAuth";
import { ptBR } from "date-fns/locale";

const TURNOS = ["integral", "manhã", "tarde", "noite"];
const STATUS_OPTIONS = ["A confirmar", "Confirmado", "Concluído", "Cancelado"];

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatChip(iso: string): string {
  const d = isoToDate(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function PlantaoDialog({
  open,
  onOpenChange,
  plantao,
  defaultEmpresaId,
  defaultData,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plantao?: Plantao | null;
  defaultEmpresaId?: string;
  defaultData?: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-ativas-plantao"],
    enabled: !authLoading && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, responsavel_contrato, status_empresa")
        .order("nome");
      if (error) throw error;
      return (data ?? []).filter((e: any) => (e.status_empresa ?? "Ativa") === "Ativa");
    },
  });
  // Quando editando, carrega o nome a partir de plantoes_empresas para casar com a lista
  const { data: plantaoEmpresaNome } = useQuery({
    queryKey: ["plantao-empresa-nome", plantao?.empresa_id],
    enabled: !!plantao?.empresa_id,
    queryFn: async () => {
      const { data } = await supabase.from("plantoes_empresas").select("nome").eq("id", plantao!.empresa_id).maybeSingle();
      return data?.nome ?? "";
    },
  });
  const { upsertPlantao } = usePlantaoMutations();
  const isEdit = !!plantao;

  // Agora guardamos o NOME da empresa (id vem do "empresas"), e resolvemos para plantoes_empresas no save
  const [empresaNomeSel, setEmpresaNomeSel] = useState<string>("");
  const initialDates: string[] = plantao?.data
    ? [plantao.data]
    : defaultData
      ? [defaultData]
      : [];
  const [datas, setDatas] = useState<string[]>(initialDates);
  const [horaInicio, setHoraInicio] = useState((plantao?.hora_inicio ?? "09:00").slice(0, 5));
  const [horaFim, setHoraFim] = useState((plantao?.hora_fim ?? "10:00").slice(0, 5));
  const [status, setStatus] = useState(plantao?.status ?? "A confirmar");
  const [plantonista, setPlantonista] = useState(plantao?.plantonista ?? "");
  const [observacao, setObservacao] = useState(plantao?.observacao ?? "");
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState<Date>(initialDates[0] ? isoToDate(initialDates[0]) : new Date());

  // Inicializa nome ao editar
  useEffect(() => {
    if (plantaoEmpresaNome && !empresaNomeSel) setEmpresaNomeSel(plantaoEmpresaNome);
  }, [plantaoEmpresaNome]);
  // defaultEmpresaId (vem como plantoes_empresas.id) → carrega nome para pré-seleção
  const { data: defaultEmpresaNome } = useQuery({
    queryKey: ["plantao-empresa-nome-default", defaultEmpresaId],
    enabled: !!defaultEmpresaId && !plantao,
    queryFn: async () => {
      const { data } = await supabase.from("plantoes_empresas").select("nome").eq("id", defaultEmpresaId!).maybeSingle();
      return data?.nome ?? "";
    },
  });
  useEffect(() => {
    if (defaultEmpresaNome && !empresaNomeSel) setEmpresaNomeSel(defaultEmpresaNome);
  }, [defaultEmpresaNome]);

  const empresaNome = empresaNomeSel;
  // Executiva = usuário logado (display_name) — não vem mais do cadastro da empresa
  const { data: meuNome = "" } = useQuery({
    queryKey: ["meu-perfil-nome", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data?.display_name || data?.username || "") as string;
    },
  });

  useEffect(() => {
    if (!isEdit && meuNome) setPlantonista(meuNome);
  }, [meuNome, isEdit]);

  const selectedDates = datas.map(isoToDate);

  const toggleDates = (dates: Date[] | undefined) => {
    const next = (dates ?? []).map(dateToIso).sort();
    setDatas(isEdit ? next.slice(-1) : next);
  };

  const removeChip = (iso: string) => setDatas(datas.filter((d) => d !== iso));

  const canSave =
    !!empresaNomeSel &&
    datas.length > 0 &&
    !!horaInicio &&
    !!horaFim &&
    horaFim > horaInicio &&
    !upsertPlantao.isPending;

  const handleSave = async () => {
    // Resolve (cria se faltar) a empresa em plantoes_empresas a partir do nome selecionado
    const { data: empresaIdResolved, error: rpcErr } = await supabase.rpc("ensure_plantao_empresa", { p_nome: empresaNomeSel });
    if (rpcErr || !empresaIdResolved) {
      console.error(rpcErr);
      return;
    }
    for (const data of datas) {
      await upsertPlantao.mutateAsync({
        id: isEdit ? plantao?.id : undefined,
        empresa_id: empresaIdResolved as string,
        data,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        status,
        plantonista,
        observacao,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar plantão" : "Novo agendamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Empresa *</Label>
            <Select value={empresaNomeSel} onValueChange={setEmpresaNomeSel}>
              <SelectTrigger><SelectValue placeholder="Selecionar empresa..." /></SelectTrigger>
              <SelectContent className="max-h-72">
                {empresas.map((e: any) => (
                  <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Datas *</Label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start font-normal bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50"
                >
                  <CalendarIcon className="h-4 w-4 mr-2 text-emerald-700" />
                  {datas.length === 0
                    ? <span className="text-muted-foreground">Selecionar datas</span>
                    : isEdit
                      ? formatChip(datas[0])
                      : `${datas.length} ${datas.length === 1 ? "data selecionada" : "datas selecionadas"}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode={isEdit ? "single" : "multiple"}
                  locale={ptBR}
                  month={calMonth}
                  onMonthChange={setCalMonth}
                  selected={isEdit ? selectedDates[0] : selectedDates as any}
                  onSelect={(v: any) => {
                    if (isEdit) {
                      if (v) setDatas([dateToIso(v as Date)]);
                    } else {
                      toggleDates(v as Date[] | undefined);
                    }
                  }}
                  initialFocus
                />
                <div className="flex items-center justify-between border-t p-2">
                  <span className="text-xs text-muted-foreground pl-1">
                    {datas.length} {datas.length === 1 ? "data selecionada" : "datas selecionadas"}
                  </span>
                  <Button size="sm" onClick={() => setCalOpen(false)}>Confirmar seleção</Button>
                </div>
              </PopoverContent>
            </Popover>
            {datas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {datas.map((iso) => (
                  <Badge key={iso} variant="secondary" className="gap-1 pr-1">
                    {formatChip(iso)}
                    <button
                      type="button"
                      onClick={() => removeChip(iso)}
                      className="rounded hover:bg-muted p-0.5"
                      aria-label={`Remover ${formatChip(iso)}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início *</Label>
              <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div>
              <Label>Fim *</Label>
              <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Executiva responsável *</Label>
            <Input
              value={plantonista}
              readOnly
              disabled
              placeholder={empresaNomeSel ? "Sem executiva vinculada ao contrato" : "Selecione a empresa"}
              className="bg-muted/50"
            />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          <div>
            <Label>Status *</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!canSave} onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
