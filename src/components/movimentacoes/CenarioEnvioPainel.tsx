import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CENARIOS_ENVIO, LISTA_CENARIOS, montarEmailCenario, type CenarioEnvio } from "../../../supabase/functions/_shared/cenario-envio";

export interface EscolhaCenario { cenario: CenarioEnvio; justificativa: string; motivoAlteracao: string }

export function CenarioEnvioPainel({ sugerido, valor, onChange, anexos, codigo, nome, corte, disabled }: {
  sugerido: CenarioEnvio; valor: EscolhaCenario; onChange: (v: EscolhaCenario) => void; anexos: number; codigo: string; nome: string; corte: string | null; disabled?: boolean;
}) {
  const [ver, setVer] = useState(false);
  const info = CENARIOS_ENVIO[valor.cenario];
  const alterado = valor.cenario !== sugerido;
  const email = montarEmailCenario(valor.cenario, { codigo, nome, corte, justificativa: valor.justificativa || "(informe a justificativa)" });
  return <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">Cenário de envio</h3>
      <Badge variant="outline">Sugerido: {CENARIOS_ENVIO[sugerido].rotulo}</Badge>
    </div>
    <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <div><dt className="text-xs text-muted-foreground">Cenário</dt><dd className="font-medium">{info.rotulo}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Modelo</dt><dd>{info.modelo}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Destino</dt><dd>{info.destino}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Anexos</dt><dd>{anexos} arquivo{anexos === 1 ? "" : "s"}</dd></div>
    </dl>
    <div className="space-y-1"><Label htmlFor="cenario-envio">Alterar cenário</Label>
      <Select disabled={disabled} value={valor.cenario} onValueChange={c => onChange({ ...valor, cenario: c as CenarioEnvio })}>
        <SelectTrigger id="cenario-envio"><SelectValue /></SelectTrigger>
        <SelectContent>{LISTA_CENARIOS.map(c => <SelectItem key={c} value={c}>{CENARIOS_ENVIO[c].rotulo}{c === sugerido ? " (sugerido)" : ""}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    {valor.cenario === "financeiro" && <div className="space-y-1"><Label htmlFor="cenario-justificativa">Motivo/Justificativa *</Label>
      <Textarea id="cenario-justificativa" disabled={disabled} value={valor.justificativa} placeholder="Ex.: Encaminhamento realizado sem retorno da empresa." onChange={e => onChange({ ...valor, justificativa: e.target.value })} />
      <p className="text-xs text-muted-foreground">Os destinatários acima devem ser os e-mails do Financeiro.</p></div>}
    {alterado && valor.cenario !== "financeiro" && <div className="space-y-1"><Label htmlFor="cenario-motivo">Motivo da alteração *</Label>
      <Textarea id="cenario-motivo" disabled={disabled} value={valor.motivoAlteracao} onChange={e => onChange({ ...valor, motivoAlteracao: e.target.value })} /></div>}
    <Button type="button" variant="outline" size="sm" onClick={() => setVer(true)}><Eye className="mr-2 h-4 w-4" />Visualizar e-mail</Button>
    <Dialog open={ver} onOpenChange={setVer}><DialogContent className="sm:max-w-[680px]">
      <DialogHeader><DialogTitle>Visualizar e-mail</DialogTitle><DialogDescription>{info.rotulo} — {info.modelo}</DialogDescription></DialogHeader>
      <p className="text-sm"><span className="text-muted-foreground">Assunto: </span><span className="font-medium">{email.assunto}</span></p>
      <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded-md border p-3 text-sm">{email.texto.split("\n").filter(Boolean).map((l, i) => <p key={i}>{l}</p>)}<p className="pt-2 text-muted-foreground">Resumo do relatório, "Permanecerei à disposição.", "Cordialmente," e assinatura.</p></div>
    </DialogContent></Dialog>
  </div>;
}
