import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Stethoscope } from "lucide-react";
import { PaBadge } from "./PaBadge";
import { BioimpedanciaDialog } from "./BioimpedanciaDialog";
import { maskCpf } from "../lib/saude-rules";
import { useSaudeMutations, type Triagem } from "../hooks/useSaudeEmpresas";

interface Props {
  acaoId: string;
  empresaId: string;
}

export function TriagemInlineForm({ acaoId, empresaId }: Props) {
  const { upsertTriagem } = useSaudeMutations();
  const [bioOpen, setBioOpen] = useState(false);
  const [bioBase, setBioBase] = useState<Partial<Triagem> | null>(null);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [pas, setPas] = useState<string>("");
  const [pad, setPad] = useState<string>("");
  const [jejum, setJejum] = useState(false);
  const [glicemia, setGlicemia] = useState<string>("");
  const [tem_has, setHas] = useState(false);
  const [tem_dm, setDm] = useState(false);

  const reset = () => {
    setNome(""); setCpf(""); setPas(""); setPad("");
    setJejum(false); setGlicemia(""); setHas(false); setDm(false);
  };

  const buildPayload = (): Partial<Triagem> & { acao_id: string; empresa_id: string; nome: string } => ({
    acao_id: acaoId,
    empresa_id: empresaId,
    nome: nome.trim(),
    cpf: cpf || null,
    pas_mmhg: pas ? Number(pas) : null,
    pad_mmhg: pad ? Number(pad) : null,
    jejum,
    glicemia_mg_dl: glicemia ? Number(glicemia) : null,
    tem_has,
    tem_dm,
  });

  const salvarRapido = async () => {
    if (!nome.trim()) return;
    await upsertTriagem.mutateAsync(buildPayload());
    reset();
  };

  const abrirBio = () => {
    setBioBase(buildPayload());
    setBioOpen(true);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Nova triagem rápida</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4 grid gap-1.5">
          <Label>Nome *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="md:col-span-3 grid gap-1.5">
          <Label>CPF</Label>
          <Input value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" />
        </div>
        <div className="md:col-span-1 grid gap-1.5">
          <Label>PAS</Label>
          <Input inputMode="numeric" value={pas} onChange={(e) => setPas(e.target.value.replace(/\D/g, ""))} placeholder="120" />
        </div>
        <div className="md:col-span-1 grid gap-1.5">
          <Label>PAD</Label>
          <Input inputMode="numeric" value={pad} onChange={(e) => setPad(e.target.value.replace(/\D/g, ""))} placeholder="80" />
        </div>
        <div className="md:col-span-3 grid gap-1.5">
          <Label>Classificação PA</Label>
          <div className="h-9 flex items-center"><PaBadge pas={pas ? Number(pas) : null} pad={pad ? Number(pad) : null} /></div>
        </div>
        <div className="md:col-span-2 grid gap-1.5">
          <Label>Glicemia (mg/dL)</Label>
          <Input inputMode="decimal" value={glicemia} onChange={(e) => setGlicemia(e.target.value.replace(/[^\d.]/g, ""))} placeholder="92" />
        </div>
        <div className="md:col-span-2 flex items-end gap-2 pb-1">
          <Switch checked={jejum} onCheckedChange={setJejum} id="jejum" />
          <Label htmlFor="jejum" className="cursor-pointer">Jejum</Label>
        </div>
        <div className="md:col-span-2 flex items-end gap-2 pb-1">
          <Switch checked={tem_has} onCheckedChange={setHas} id="has" />
          <Label htmlFor="has" className="cursor-pointer">HAS</Label>
        </div>
        <div className="md:col-span-2 flex items-end gap-2 pb-1">
          <Switch checked={tem_dm} onCheckedChange={setDm} id="dm" />
          <Label htmlFor="dm" className="cursor-pointer">DM</Label>
        </div>
        <div className="md:col-span-4 flex items-end gap-2 justify-end">
          <Button variant="outline" onClick={abrirBio} disabled={!nome.trim()}>Bio…</Button>
          <Button onClick={salvarRapido} disabled={!nome.trim() || upsertTriagem.isPending}>
            {upsertTriagem.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
      <BioimpedanciaDialog
        open={bioOpen}
        onOpenChange={(v) => { setBioOpen(v); if (!v) reset(); }}
        triagemBase={bioBase}
      />
    </Card>
  );
}
