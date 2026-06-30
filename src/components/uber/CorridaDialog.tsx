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
  "Taxa de destaque",
  "Implantação",
  "Portal de Treinamento",
  "Integração",
  "Gravação da Palestra",
];
const FORMAS_PAGAMENTO = ["Pix", "Cartão", "Dinheiro"];

export function CorridaDialog({ open, onOpenChange, corrida }: Props) {
  const upsert = useUpsertCorrida();
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<UberCorrida>>({});
  const [empresaOpen, setEmpresaOpen] = useState(false);

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-uber-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: meuNome = "" } = useQuery({
    queryKey: ["meu-perfil-nome-uber", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data?.display_name || data?.username || "") as string;
    },
  });

  useEffect(() => {
    if (open) {
      setForm(
        corrida ?? {
          data: new Date().toISOString().slice(0, 10),
          cancelada: false,
          valor: 0,
          tem_reembolso: false,
          valor_reembolso: 0,
          reembolso: 0,
          responsavel: meuNome,
        }
      );
    }
  }, [open, corrida, meuNome]);

  const set = (k: keyof UberCorrida, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.data || !form.colaborador) return;
    await upsert.mutateAsync(form);
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
            <Input value={form.origem ?? ""} onChange={(e) => set("origem", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Destino</Label>
            <Input value={form.destino ?? ""} onChange={(e) => set("destino", e.target.value)} />
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
                            set("empresa", e.nome);
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
            <Input value={form.responsavel ?? ""} onChange={(e) => set("responsavel", e.target.value)} />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={form.valor ?? 0} onChange={(e) => set("valor", Number(e.target.value))} />
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
              disabled={!form.tem_reembolso}
              value={form.valor_reembolso ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                setForm((p) => ({ ...p, valor_reembolso: v, reembolso: v }));
              }}
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
