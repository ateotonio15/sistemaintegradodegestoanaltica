import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import * as XLSX from "xlsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Copy, Download, CheckCircle2, UserPlus, FileSpreadsheet, Pencil, Trash2, Flag } from "lucide-react";
import { toast } from "sonner";
import { getPublicBaseUrl } from "@/lib/public-url";
import {
  ColetaAgendamento, InscricaoStatus, STATUS_INSCRICAO_LABEL, cpfValido, fmtDataBR, fmtHora, maskCpf, maskTel,
  useColetaInscricoes, useColetaMutations,
} from "../hooks/useColeta";

const STATUS_BADGE: Record<InscricaoStatus, string> = {
  inscrita: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  realizada: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  faltou: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  cancelada: "bg-muted text-muted-foreground",
};

export function linkColeta(token: string) {
  return `${getPublicBaseUrl()}/coleta/${token}`;
}

export function ColetaDetalheSheet({ ag, onClose, onEdit }: { ag: ColetaAgendamento | null; onClose: () => void; onEdit: (a: ColetaAgendamento) => void }) {
  const { data: inscricoes = [] } = useColetaInscricoes(ag?.id);
  const m = useColetaMutations();
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState<null | { id?: string; nome: string; cpf: string; nasc: string; tel: string; setor: string }>(null);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return inscricoes.filter((i) => !q || i.nome.toLowerCase().includes(q) || (qd && i.cpf.includes(qd)));
  }, [inscricoes, busca]);

  if (!ag) return null;
  const url = linkColeta(ag.token);
  const resumo = {
    inscritas: inscricoes.filter((i) => i.status !== "cancelada").length,
    realizadas: inscricoes.filter((i) => i.status === "realizada").length,
    faltas: inscricoes.filter((i) => i.status === "faltou").length,
  };

  const baixarQr = () => {
    const c = document.getElementById("qr-coleta") as HTMLCanvasElement | null;
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `qrcode-coleta-${ag.empresa?.nome ?? ""}-${ag.data}.png`;
    a.click();
  };

  const exportar = () => {
    const rows = inscricoes.map((i) => ({
      Nome: i.nome, CPF: maskCpf(i.cpf), Nascimento: fmtDataBR(i.data_nascimento), Telefone: maskTel(i.telefone),
      "Setor/Matrícula": i.setor ?? "", Status: STATUS_INSCRICAO_LABEL[i.status], Origem: i.origem === "manual" ? "Manual" : "Link",
      "Confirmado em": i.confirmado_em ? new Date(i.confirmado_em).toLocaleString("pt-BR") : "", "Confirmado por": i.confirmado_por_nome ?? "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Inscritas");
    XLSX.writeFile(wb, `inscritas-${ag.empresa?.nome ?? "coleta"}-${ag.data}.xlsx`);
  };

  const mudar = (ids: string[], status: InscricaoStatus) => {
    if (!ids.length) return;
    m.atualizarStatusInscricoes.mutate({ ids, status }, { onSuccess: () => setSel(new Set()) });
  };

  const salvarManual = () => {
    if (!manual) return;
    if (manual.nome.trim().length < 3 || !cpfValido(manual.cpf) || !manual.nasc || manual.tel.replace(/\D/g, "").length < 10) {
      toast.error("Preencha nome, CPF válido, nascimento e telefone"); return;
    }
    if (manual.id) {
      m.editarInscricao.mutate({
        id: manual.id, nome: manual.nome.trim().toUpperCase(), cpf: manual.cpf.replace(/\D/g, ""),
        data_nascimento: manual.nasc, telefone: manual.tel.replace(/\D/g, ""), setor: manual.setor || null,
      }, { onSuccess: () => setManual(null) });
      return;
    }
    m.inscricaoManual.mutate({
      agendamento_id: ag.id, empresa_id: ag.empresa_id, nome: manual.nome.trim().toUpperCase(), cpf: manual.cpf.replace(/\D/g, ""),
      data_nascimento: manual.nasc, telefone: manual.tel.replace(/\D/g, ""), setor: manual.setor || null,
    }, { onSuccess: () => setManual(null) });
  };

  const concluida = ag.status === "concluida";

  return (
    <Sheet open={!!ag} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto space-y-5">
        <SheetHeader>
          <SheetTitle>{ag.empresa?.nome}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {fmtDataBR(ag.data)} · {fmtHora(ag.horario_inicio)}{ag.horario_fim ? ` – ${fmtHora(ag.horario_fim)}` : ""}
            {ag.responsavel ? ` · ${ag.responsavel}` : ""}{ag.local ? ` · ${ag.local}` : ""}
          </p>
          {ag.observacoes && <p className="text-xs text-muted-foreground">{ag.observacoes}</p>}
        </SheetHeader>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(ag)}><Pencil className="h-4 w-4 mr-1" />Editar</Button>
          {!concluida && (
            <Button size="sm" onClick={() => m.salvarAgendamento.mutate({ id: ag.id, status: "concluida", link_ativo: false }, { onSuccess: onClose })}>
              <Flag className="h-4 w-4 mr-1" />Concluir ação
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
            if (confirm("Excluir este agendamento e todas as inscrições?")) m.excluirAgendamento.mutate(ag.id, { onSuccess: onClose });
          }}><Trash2 className="h-4 w-4 mr-1" />Excluir</Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[["Inscritas", resumo.inscritas], ["Coletas realizadas", resumo.realizadas], ["Faltas", resumo.faltas]].map(([l, v]) => (
            <div key={l as string} className="rounded-md border border-border p-3 text-center">
              <div className="text-2xl font-semibold">{v}</div><div className="text-xs text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-border p-4 flex gap-4 flex-col sm:flex-row">
          <div className="bg-background p-2 rounded self-center"><QRCodeCanvas id="qr-coleta" value={url} size={140} includeMargin /></div>
          <div className="flex-1 space-y-3 min-w-0">
            <Input readOnly value={url} className="text-xs" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}><Copy className="h-4 w-4 mr-1" />Copiar</Button>
              <Button size="sm" variant="outline" onClick={baixarQr}><Download className="h-4 w-4 mr-1" />QR Code</Button>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><Switch checked={ag.link_ativo} disabled={concluida}
                onCheckedChange={(v) => m.salvarAgendamento.mutate({ id: ag.id, link_ativo: v })} />Inscrições abertas</label>
              <span className="text-xs text-muted-foreground">Limite: {ag.data_limite ? fmtDataBR(ag.data_limite) : "—"} · Vagas: {ag.vagas ?? "sem limite"}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Input placeholder="Buscar nome ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs h-9" />
            <Button size="sm" variant="outline" onClick={() => setManual({ nome: "", cpf: "", nasc: "", tel: "", setor: "" })}><UserPlus className="h-4 w-4 mr-1" />Cadastrar no local</Button>
            <Button size="sm" variant="outline" onClick={exportar}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          </div>

          {manual && (
            <div className="rounded-md border border-border p-3 grid grid-cols-2 gap-2">
              {manual.id && <div className="col-span-2 text-sm font-medium">Editar participante</div>}
              <div className="col-span-2"><Label>Nome completo</Label><Input value={manual.nome} onChange={(e) => setManual({ ...manual, nome: e.target.value })} /></div>
              <div><Label>CPF</Label><Input value={manual.cpf} onChange={(e) => setManual({ ...manual, cpf: maskCpf(e.target.value) })} /></div>
              <div><Label>Nascimento</Label><Input type="date" value={manual.nasc} onChange={(e) => setManual({ ...manual, nasc: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={manual.tel} onChange={(e) => setManual({ ...manual, tel: maskTel(e.target.value) })} /></div>
              <div><Label>Setor/Matrícula</Label><Input value={manual.setor} onChange={(e) => setManual({ ...manual, setor: e.target.value })} /></div>
              <div className="col-span-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setManual(null)}>Cancelar</Button>
                <Button size="sm" onClick={salvarManual}>Salvar</Button>
              </div>
            </div>
          )}

          {sel.size > 0 && (
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <span>{sel.size} selecionada(s):</span>
              <Button size="sm" onClick={() => mudar([...sel], "realizada")}><CheckCircle2 className="h-4 w-4 mr-1" />Coleta realizada</Button>
              <Button size="sm" variant="outline" onClick={() => mudar([...sel], "faltou")}>Não compareceu</Button>
              <Button size="sm" variant="outline" onClick={() => mudar([...sel], "cancelada")}>Cancelar</Button>
              <Button size="sm" variant="ghost" onClick={() => mudar([...sel], "inscrita")}>Voltar p/ inscrita</Button>
            </div>
          )}

          <div className="rounded-md border border-border divide-y divide-border">
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Checkbox checked={lista.length > 0 && lista.every((i) => sel.has(i.id))}
                onCheckedChange={(v) => setSel(v ? new Set(lista.map((i) => i.id)) : new Set())} />
              {lista.length} participante(s)
            </div>
            {lista.map((i) => (
              <div key={i.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <Checkbox checked={sel.has(i.id)} onCheckedChange={(v) => {
                  const n = new Set(sel); v ? n.add(i.id) : n.delete(i.id); setSel(n);
                }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{i.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {maskCpf(i.cpf)} · {maskTel(i.telefone)}{i.setor ? ` · ${i.setor}` : ""}{i.origem === "manual" ? " · manual" : ""}
                    {i.confirmado_em && ` · confirmado ${new Date(i.confirmado_em).toLocaleString("pt-BR")}${i.confirmado_por_nome ? ` por ${i.confirmado_por_nome}` : ""}`}
                  </div>
                </div>
                <Badge variant="outline" className={STATUS_BADGE[i.status]}>{STATUS_INSCRICAO_LABEL[i.status]}</Badge>
                <Button size="icon" variant="ghost" title="Editar participante" onClick={() => {
                  setManual({ id: i.id, nome: i.nome, cpf: maskCpf(i.cpf), nasc: i.data_nascimento ?? "", tel: maskTel(i.telefone), setor: i.setor ?? "" });
                }}><Pencil className="h-4 w-4" /></Button>
                {i.status !== "realizada" && (
                  <Button size="icon" variant="ghost" title="Coleta realizada" onClick={() => mudar([i.id], "realizada")}><CheckCircle2 className="h-4 w-4" /></Button>
                )}
              </div>
            ))}
            {!lista.length && <div className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma inscrita.</div>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
