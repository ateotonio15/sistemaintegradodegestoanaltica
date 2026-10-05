import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Save } from "lucide-react";
import { maskCpf } from "../lib/saude-rules";
import { useSaudeMutations, type Triagem } from "../hooks/useSaudeEmpresas";
import { PaBadge } from "./PaBadge";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  triagemBase: Partial<Triagem> | null;
  editing?: Triagem | null;
}

type Form = Partial<Triagem>;

const num = (v: any) => (v === "" || v == null ? null : Number(v));

function field(form: Form, set: (f: Form) => void, k: keyof Triagem) {
  return {
    value: (form as any)[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ ...form, [k]: e.target.value }),
  };
}

export function BioimpedanciaDialog({ open, onOpenChange, triagemBase, editing }: Props) {
  const { upsertTriagem, enviarFichaEmail } = useSaudeMutations();
  const [form, setForm] = useState<Form>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editing ?? triagemBase ?? {});
  }, [open, editing, triagemBase]);

  const set = (partial: Form) => setForm((f) => ({ ...f, ...partial }));

  const buildPayload = (): any => ({
    ...form,
    nome: (form.nome ?? "").toString().trim(),
    peso_kg: num(form.peso_kg),
    altura_cm: num(form.altura_cm),
    circ_abdominal_cm: num(form.circ_abdominal_cm),
    circ_quadril_cm: num(form.circ_quadril_cm),
    gordura_pct: num(form.gordura_pct),
    gordura_corporal_kg: num(form.gordura_corporal_kg),
    gordura_subcutanea_pct: num(form.gordura_subcutanea_pct),
    gordura_visceral: num(form.gordura_visceral),
    massa_muscular_kg: num(form.massa_muscular_kg),
    massa_ossea_kg: num(form.massa_ossea_kg),
    agua_corporal_pct: num(form.agua_corporal_pct),
    tmb_kcal: num(form.tmb_kcal),
    idade_metabolica: num(form.idade_metabolica),
    score_corporal: num(form.score_corporal),
    pas_mmhg: num(form.pas_mmhg),
    pad_mmhg: num(form.pad_mmhg),
    freq_cardiaca: num(form.freq_cardiaca),
    sat_o2: num(form.sat_o2),
    temperatura_c: num(form.temperatura_c),
    glicemia_mg_dl: num(form.glicemia_mg_dl),
  });

  const salvar = async (enviar: boolean) => {
    if (!form.nome || !form.acao_id || !form.empresa_id) return;
    setBusy(true);
    try {
      const saved = await upsertTriagem.mutateAsync(buildPayload());
      if (enviar && saved?.id) {
        try {
          await enviarFichaEmail.mutateAsync(saved.id);
        } catch (e) {
          console.error("Falha ao enviar ficha por e-mail", e);
        }
      }
      onOpenChange(false);
    } catch (e) {
      console.error("Falha ao salvar ficha", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ficha de Bioimpedância</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="ident">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="ident">Identificação</TabsTrigger>
            <TabsTrigger value="antrop">Antropometria</TabsTrigger>
            <TabsTrigger value="vitais">Vitais</TabsTrigger>
            <TabsTrigger value="hist">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="ident" className="grid grid-cols-2 gap-3 pt-3">
            <div className="grid gap-1.5 col-span-2"><Label>Nome *</Label><Input {...field(form, set, "nome")} /></div>
            <div className="grid gap-1.5"><Label>CPF</Label><Input value={form.cpf ?? ""} onChange={(e) => set({ cpf: maskCpf(e.target.value) })} /></div>
            <div className="grid gap-1.5"><Label>Data de nascimento</Label><Input type="date" {...field(form, set, "data_nascimento")} /></div>
            <div className="grid gap-1.5"><Label>Sexo</Label><Input {...field(form, set, "sexo")} placeholder="M / F / outro" /></div>
            <div className="grid gap-1.5"><Label>E-mail</Label><Input type="email" {...field(form, set, "email")} /></div>
            <div className="grid gap-1.5"><Label>Telefone</Label><Input {...field(form, set, "telefone")} /></div>
            <div className="grid gap-1.5"><Label>Setor</Label><Input {...field(form, set, "setor")} /></div>
            <div className="grid gap-1.5"><Label>Cargo</Label><Input {...field(form, set, "cargo")} /></div>
          </TabsContent>

          <TabsContent value="antrop" className="grid grid-cols-3 gap-3 pt-3">
            <div className="grid gap-1.5"><Label>Peso (kg)</Label><Input inputMode="decimal" {...field(form, set, "peso_kg")} /></div>
            <div className="grid gap-1.5"><Label>Altura (cm)</Label><Input inputMode="numeric" {...field(form, set, "altura_cm")} /></div>
            <div className="grid gap-1.5"><Label>Circ. abdominal (cm)</Label><Input inputMode="decimal" {...field(form, set, "circ_abdominal_cm")} /></div>
            <div className="grid gap-1.5"><Label>Circ. quadril (cm)</Label><Input inputMode="decimal" {...field(form, set, "circ_quadril_cm")} /></div>
            <div className="grid gap-1.5"><Label>Gordura %</Label><Input inputMode="decimal" {...field(form, set, "gordura_pct")} /></div>
            <div className="grid gap-1.5"><Label>Gordura corporal (kg)</Label><Input inputMode="decimal" {...field(form, set, "gordura_corporal_kg")} /></div>
            <div className="grid gap-1.5"><Label>Gordura subcutânea %</Label><Input inputMode="decimal" {...field(form, set, "gordura_subcutanea_pct")} /></div>
            <div className="grid gap-1.5"><Label>Gordura visceral</Label><Input inputMode="decimal" {...field(form, set, "gordura_visceral")} /></div>
            <div className="grid gap-1.5"><Label>Massa muscular (kg)</Label><Input inputMode="decimal" {...field(form, set, "massa_muscular_kg")} /></div>
            <div className="grid gap-1.5"><Label>Massa óssea (kg)</Label><Input inputMode="decimal" {...field(form, set, "massa_ossea_kg")} /></div>
            <div className="grid gap-1.5"><Label>Água corporal %</Label><Input inputMode="decimal" {...field(form, set, "agua_corporal_pct")} /></div>
            <div className="grid gap-1.5"><Label>TMB (kcal)</Label><Input inputMode="numeric" {...field(form, set, "tmb_kcal")} /></div>
            <div className="grid gap-1.5"><Label>Idade metabólica</Label><Input inputMode="numeric" {...field(form, set, "idade_metabolica")} /></div>
            <div className="grid gap-1.5"><Label>Score corporal</Label><Input inputMode="decimal" {...field(form, set, "score_corporal")} /></div>
          </TabsContent>

          <TabsContent value="vitais" className="grid grid-cols-3 gap-3 pt-3">
            <div className="grid gap-1.5"><Label>PAS (mmHg)</Label><Input inputMode="numeric" {...field(form, set, "pas_mmhg")} /></div>
            <div className="grid gap-1.5"><Label>PAD (mmHg)</Label><Input inputMode="numeric" {...field(form, set, "pad_mmhg")} /></div>
            <div className="grid gap-1.5"><Label>Classificação PA</Label><div className="h-9 flex items-center"><PaBadge pas={num(form.pas_mmhg)} pad={num(form.pad_mmhg)} /></div></div>
            <div className="grid gap-1.5"><Label>FC (bpm)</Label><Input inputMode="numeric" {...field(form, set, "freq_cardiaca")} /></div>
            <div className="grid gap-1.5"><Label>SatO₂ (%)</Label><Input inputMode="numeric" {...field(form, set, "sat_o2")} /></div>
            <div className="grid gap-1.5"><Label>Temperatura (°C)</Label><Input inputMode="decimal" {...field(form, set, "temperatura_c")} /></div>
            <div className="grid gap-1.5"><Label>Glicemia (mg/dL)</Label><Input inputMode="decimal" {...field(form, set, "glicemia_mg_dl")} /></div>
            <div className="grid gap-1.5 flex-row items-end gap-2"><Switch id="bjejum" checked={!!form.jejum} onCheckedChange={(v) => set({ jejum: v })} /><Label htmlFor="bjejum">Jejum</Label></div>
          </TabsContent>

          <TabsContent value="hist" className="grid grid-cols-2 gap-3 pt-3">
            <div className="flex items-center gap-2"><Switch checked={!!form.tem_has} onCheckedChange={(v) => set({ tem_has: v })} id="bhas" /><Label htmlFor="bhas">HAS</Label></div>
            <div className="flex items-center gap-2"><Switch checked={!!form.tem_dm} onCheckedChange={(v) => set({ tem_dm: v })} id="bdm" /><Label htmlFor="bdm">DM</Label></div>
            <div className="flex items-center gap-2 col-span-2"><Switch checked={!!form.usa_medicacao} onCheckedChange={(v) => set({ usa_medicacao: v })} id="bmed" /><Label htmlFor="bmed">Faz uso de medicação</Label></div>
            <div className="grid gap-1.5 col-span-2"><Label>Medicamentos</Label><Textarea rows={2} value={form.medicamentos ?? ""} onChange={(e) => set({ medicamentos: e.target.value })} /></div>
            <div className="grid gap-1.5 col-span-2"><Label>Recomendação</Label><Textarea rows={3} value={form.recomendacao ?? ""} onChange={(e) => set({ recomendacao: e.target.value })} /></div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button variant="outline" onClick={() => salvar(false)} disabled={busy || !form.nome}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
          <Button onClick={() => salvar(true)} disabled={busy || !form.nome || !form.email}>
            <Mail className="h-4 w-4 mr-1" /> Salvar e enviar por e-mail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
