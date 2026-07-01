import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useSaudeMutations, type AcaoSaude, type AcaoSaudeTipo, type AcaoSaudeStatus } from "../hooks/useSaudeEmpresas";
import { useAuth } from "@/hooks/useAuth";

const sb = supabase as any;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  acao?: AcaoSaude | null;
  empresaIdLock?: string;
  onSaved?: (id: string) => void;
}

export function NovaAcaoDialog({ open, onOpenChange, acao, empresaIdLock, onSaved }: Props) {
  const { user } = useAuth();
  const { upsertAcao } = useSaudeMutations();
  const [empresaId, setEmpresaId] = useState<string>("");
  const [dataAcao, setDataAcao] = useState<string>("");
  const [horaInicio, setHoraInicio] = useState<string>("");
  const [horaFim, setHoraFim] = useState<string>("");
  const [tipo, setTipo] = useState<AcaoSaudeTipo>("triagem");
  const [status, setStatus] = useState<AcaoSaudeStatus>("agendada");
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [obs, setObs] = useState("");
  const [popOpen, setPopOpen] = useState(false);
  const [temPa, setTemPa] = useState(true);
  const [temGli, setTemGli] = useState(true);
  const [temBio, setTemBio] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile_me", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await sb.from("profiles").select("display_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas_select_saude"],
    enabled: open,
    queryFn: async () => {
      const { data } = await sb
        .from("empresas")
        .select("id,nome,codigo_contrato")
        .eq("status_empresa", "Ativa")
        .order("nome");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (acao) {
      setEmpresaId(acao.empresa_id);
      setDataAcao(acao.data_acao);
      setHoraInicio(acao.hora_inicio ?? "");
      setHoraFim(acao.hora_fim ?? "");
      setTipo(acao.tipo);
      setStatus(acao.status);
      setTitulo(acao.titulo ?? "");
      setLocal(acao.local ?? "");
      setObs(acao.observacoes ?? "");
      setTemPa(acao.tem_pa ?? true);
      setTemGli(acao.tem_glicemia ?? true);
      setTemBio(acao.tem_bioimpedancia ?? false);
    } else {
      setEmpresaId(empresaIdLock ?? "");
      setDataAcao(new Date().toISOString().slice(0, 10));
      setHoraInicio("");
      setHoraFim("");
      setTipo("triagem");
      setStatus("agendada");
      setTitulo("");
      setLocal("");
      setObs("");
      setTemPa(true);
      setTemGli(true);
      setTemBio(false);
    }
  }, [open, acao, empresaIdLock]);

  const submit = async () => {
    if (!empresaId || !dataAcao) return;
    const res = await upsertAcao.mutateAsync({
      id: acao?.id,
      empresa_id: empresaId,
      data_acao: dataAcao,
      hora_inicio: horaInicio || null,
      hora_fim: horaFim || null,
      tipo,
      status,
      titulo: titulo || null,
      local: local || null,
      observacoes: obs || null,
      enfermeira_user_id: acao?.enfermeira_user_id ?? user?.id ?? null,
      enfermeira_nome: acao?.enfermeira_nome ?? profile?.display_name ?? null,
      tem_pa: temPa,
      tem_glicemia: temGli,
      tem_bioimpedancia: temBio,
    });
    onOpenChange(false);
    if (res?.id) onSaved?.(res.id);
  };

  const empSel = empresas.find((e: any) => e.id === empresaId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{acao ? "Editar ação" : "Nova ação de saúde"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {!empresaIdLock && (
            <div className="grid gap-1.5">
              <Label>Empresa *</Label>
              <Popover open={popOpen} onOpenChange={setPopOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="justify-between">
                    {empSel ? `${empSel.nome}${empSel.codigo_contrato ? ` · ${empSel.codigo_contrato}` : ""}` : "Selecione..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar empresa..." />
                    <CommandList>
                      <CommandEmpty>Sem resultados</CommandEmpty>
                      <CommandGroup>
                        {empresas.map((e: any) => (
                          <CommandItem key={e.id} value={`${e.nome} ${e.codigo_contrato ?? ""}`} onSelect={() => { setEmpresaId(e.id); setPopOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", e.id === empresaId ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{e.nome}{e.codigo_contrato ? ` · ${e.codigo_contrato}` : ""}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Data *</Label>
              <Input type="date" value={dataAcao} onChange={(e) => setDataAcao(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Início</Label>
              <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Fim</Label>
              <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as AcaoSaudeTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="triagem">Triagem</SelectItem>
                  <SelectItem value="palestra">Palestra</SelectItem>
                  <SelectItem value="preventiva">Preventiva</SelectItem>
                  <SelectItem value="bioimpedancia">Bioimpedância</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AcaoSaudeStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agendada">Agendada</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Triagem cardiometabólica Q2" />
          </div>
          <div className="grid gap-1.5">
            <Label>Local</Label>
            <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Endereço ou sala" />
          </div>
          <div className="grid gap-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Serviços incluídos na ação</Label>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer">
                <Switch checked={temPa} onCheckedChange={setTemPa} />
                <span className="text-sm">Pressão Arterial</span>
              </label>
              <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer">
                <Switch checked={temGli} onCheckedChange={setTemGli} />
                <span className="text-sm">Glicemia</span>
              </label>
              <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer">
                <Switch checked={temBio} onCheckedChange={setTemBio} />
                <span className="text-sm">Bioimpedância</span>
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!empresaId || !dataAcao || upsertAcao.isPending}>
            {upsertAcao.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
