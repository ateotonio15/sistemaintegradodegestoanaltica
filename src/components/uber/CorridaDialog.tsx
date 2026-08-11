import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUpsertCorrida, type UberCorrida } from "@/hooks/useUberCorridas";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  corrida?: UberCorrida | null;
}

const TIPOS = ["Ida", "Volta", "Ida e Volta"];
const MOTIVOS = [
  "Plantão de Atendimento",
  "Envio de Material",
  "Técnica Honda",
  "Coleta de Preventivo",
  "Coleta de PSA",
  "Ação de Saúde",
  "Palestra",
  "Coleta de sangue",
  "Taxa cancelamento",
  "Implantação",
  "Treinamento Portal",
  "Integração",
  "Gravação da Palestra",
];
const FORMAS_PAGAMENTO = ["Pix", "Cartão", "Dinheiro"];
const ENDERECO_SAMEL = "Samel - Av. Joaquim Nabuco, 1550 - Centro";

function EnderecoCombobox({
  value,
  onChange,
  opcoes,
}: {
  value: string;
  onChange: (v: string) => void;
  opcoes: string[];
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn("w-full justify-between font-normal text-left", !value && "text-muted-foreground")}
        >
          <span className="truncate">{value || "Selecione ou digite o endereço"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter>
          <CommandInput placeholder="Buscar endereço..." value={busca} onValueChange={setBusca} />
          <CommandList>
            <CommandEmpty>
              {busca.trim() ? (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent"
                  onClick={() => { onChange(busca.trim()); setOpen(false); setBusca(""); }}
                >
                  Usar "{busca.trim()}"
                </button>
              ) : (
                "Nenhum endereço encontrado."
              )}
            </CommandEmpty>
            <CommandGroup>
              {opcoes.map((o) => (
                <CommandItem
                  key={o}
                  value={o}
                  onSelect={() => { onChange(o); setOpen(false); setBusca(""); }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === o ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function CorridaDialog({ open, onOpenChange, corrida }: Props) {
  const upsert = useUpsertCorrida();
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<UberCorrida>>({});
  const [empresaOpen, setEmpresaOpen] = useState(false);

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-uber-select-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, endereco")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; endereco: string | null }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: meuNome = "" } = useQuery({
    queryKey: ["meu-perfil-nome-uber", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data?.display_name || "") as string;
    },
  });

  const { data: enderecosUsados = [] } = useQuery({
    queryKey: ["uber-enderecos-usados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uber_corridas" as any)
        .select("origem, destino")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as { origem: string | null; destino: string | null }[];
    },
    staleTime: 60 * 1000,
  });

  const enderecos = useMemo(() => {
    const set = new Set<string>();
    set.add(ENDERECO_SAMEL);
    enderecosUsados.forEach((c) => {
      [c.origem, c.destino].forEach((v) => { if (v && v.trim()) set.add(v.trim()); });
    });
    empresas.forEach((e) => { if (e.endereco && e.endereco.trim()) set.add(e.endereco.trim()); });
    const arr = Array.from(set);
    return [ENDERECO_SAMEL, ...arr.filter((a) => a !== ENDERECO_SAMEL).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [enderecosUsados, empresas]);

  useEffect(() => {
    if (open) {
      setForm(
        corrida ?? {
          data: new Date().toISOString().slice(0, 10),
          cancelada: false,
          valor: null as any,
          tem_reembolso: false,
          valor_reembolso: null as any,
          reembolso: null as any,
          responsavel: meuNome,
        }
      );
    }
  }, [open, corrida, meuNome]);

  const set = (k: keyof UberCorrida, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.data || !form.colaborador) return;
    await upsert.mutateAsync({
      ...form,
      valor: Number(form.valor ?? 0),
      valor_reembolso: Number(form.valor_reembolso ?? 0),
      reembolso: Number(form.reembolso ?? form.valor_reembolso ?? 0),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{corrida ? "Editar corrida" : "Nova corrida"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Data *</Label>
            <Input type="date" value={form.data ?? ""} onChange={(e) => set("data", e.target.value)} />
          </div>
          <div>
            <Label>Horário</Label>
            <Input type="time" value={form.horario ?? ""} onChange={(e) => set("horario", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Colaborador *</Label>
            <Input value={form.colaborador ?? ""} onChange={(e) => set("colaborador", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Origem</Label>
            <EnderecoCombobox value={form.origem ?? ""} onChange={(v) => set("origem", v)} opcoes={enderecos} />
          </div>
          <div className="sm:col-span-2">
            <Label>Destino</Label>
            <EnderecoCombobox value={form.destino ?? ""} onChange={(v) => set("destino", v)} opcoes={enderecos} />
          </div>
          <div>
            <Label>Motivo</Label>
            <Select value={form.motivo ?? ""} onValueChange={(v) => set("motivo", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo ?? ""} onValueChange={(v) => set("tipo", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Empresa</Label>
            <Popover open={empresaOpen} onOpenChange={setEmpresaOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className={cn("w-full justify-between font-normal", !form.empresa && "text-muted-foreground")}
                >
                  {form.empresa || "Selecione a empresa"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar empresa..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                    <CommandGroup>
                      {empresas.map((e) => (
                        <CommandItem
                          key={e.id}
                          value={e.nome}
                          onSelect={() => {
                            setForm((p) => {
                              const next: Partial<UberCorrida> = { ...p, empresa: e.nome };
                              if (e.endereco) {
                                if (p.tipo === "Volta") {
                                  next.origem = e.endereco;
                                } else if (p.tipo === "Ida e Volta") {
                                  next.origem = e.endereco;
                                  next.destino = e.endereco;
                                } else {
                                  next.destino = e.endereco;
                                }
                              }
                              return next;
                            });
                            setEmpresaOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", form.empresa === e.nome ? "opacity-100" : "opacity-0")} />
                          {e.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={form.forma_pagamento ?? ""} onValueChange={(v) => set("forma_pagamento", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={form.responsavel ?? meuNome} readOnly disabled />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0,00"
              value={form.valor === null || form.valor === undefined ? "" : String(form.valor)}
              onChange={(e) => set("valor", e.target.value === "" ? null : Number(e.target.value))}
              onBlur={(e) => { if (e.target.value === "") set("valor", 0); }}
            />
          </div>
          <div>
            <Label>Tem reembolso?</Label>
            <Select
              value={form.tem_reembolso ? "sim" : "nao"}
              onValueChange={(v) => {
                const tem = v === "sim";
                setForm((p) => {
                  const anterior = Number(p.valor_reembolso ?? p.reembolso ?? 0);
                  const valor = Number(p.valor ?? 0);
                  const novoVal = tem ? (anterior > 0 ? anterior : valor) : 0;
                  return { ...p, tem_reembolso: tem, valor_reembolso: novoVal, reembolso: novoVal };
                });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nao">Não</SelectItem>
                <SelectItem value="sim">Sim</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor do reembolso (R$)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0,00"
              disabled={!form.tem_reembolso}
              value={form.valor_reembolso === null || form.valor_reembolso === undefined ? "" : String(form.valor_reembolso)}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                setForm((p) => ({ ...p, valor_reembolso: v as any, reembolso: v as any }));
              }}
              onBlur={(e) => { if (e.target.value === "") setForm((p) => ({ ...p, valor_reembolso: 0, reembolso: 0 })); }}
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={!!form.cancelada} onCheckedChange={(v) => set("cancelada", v)} />
            <Label>Cancelada</Label>
          </div>
          <div className="sm:col-span-2">
            <Label>Observação</Label>
            <Textarea rows={2} value={form.observacao ?? ""} onChange={(e) => set("observacao", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={upsert.isPending || !form.data || !form.colaborador}>
            {upsert.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
