import { useMemo, useState } from "react";
import { Users, Eye, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { ValidacaoResultado, BeneficiarioLido, PendenciaLinha } from "@/lib/relatorio-vidas-validator";
import { cn } from "@/lib/utils";
import { mascararCpf, statusCpfLocal, statusCpfFinal, resumoStatusCpf, STATUS_CPF_LABEL, type StatusCpf } from "@/lib/cpf-status";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function CpfStatusBadge({ b }: { b: BeneficiarioLido }) {
  const s: StatusCpf = statusCpfFinal(b);
  const ruim = s === "invalido" || s === "divergencia" || s === "nao_localizado";
  const atencao = s === "situacao_atencao";
  const ok = s === "valido_local" || s === "validado_oficial";
  const cls = ruim ? "border-destructive/50 text-destructive"
    : atencao ? "border-orange-500/50 text-orange-600 dark:text-orange-400"
    : ok ? "border-primary/40 text-primary" : "text-muted-foreground";
  const txt =
    s === "validado_oficial" ? "✓ CPF validado"
    : s === "valido_local" ? "CPF válido"
    : s === "invalido" ? "CPF inválido"
    : s === "divergencia" ? "⚠ Divergência cadastral"
    : s === "nao_localizado" ? "⚠ CPF não localizado"
    : s === "situacao_atencao" ? "⚠ Situação cadastral"
    : s === "indisponivel" ? "Consulta indisponível"
    : s === "sem_data_nasc" ? "Consulta não realizada"
    : STATUS_CPF_LABEL[s];
  const o = b.cpf_oficial;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button"><Badge variant="outline" className={cn("text-[10px] font-normal cursor-pointer", cls)}>{txt}</Badge></button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-xs space-y-1.5">
        <p className="font-semibold text-sm">Validação do CPF</p>
        <p><span className="text-muted-foreground">CPF:</span> {mascararCpf(b.cpf)}</p>
        <p><span className="text-muted-foreground">Status:</span> {STATUS_CPF_LABEL[s]}</p>
        {o?.situacao && <p><span className="text-muted-foreground">Situação retornada:</span> {o.situacao}</p>}
        <p><span className="text-muted-foreground">Data/hora da consulta:</span> {o ? new Date(o.consultado_em).toLocaleString("pt-BR") : "—"}</p>
        <p><span className="text-muted-foreground">Origem:</span> {o ? (o.origem === "nao_configurado" ? "Serviço de consulta ainda não configurado" : o.origem) : "Validação local (cálculo dos dígitos)"}</p>
      </PopoverContent>
    </Popover>
  );
}

const PARENTESCO: Record<string, string> = { FILHO: "Filho(a)", CONJUGE: "Cônjuge", DEPENDENTE: "Outro" };

export function ParticipantesVidas({ validacao }: { validacao: ValidacaoResultado }) {
  const [busca, setBusca] = useState("");
  const [soErros, setSoErros] = useState(false);
  const [aberto, setAberto] = useState<BeneficiarioLido | null>(null);

  const pendPorLinha = useMemo(() => {
    const m = new Map<number, PendenciaLinha[]>();
    for (const p of validacao.pendencias || []) {
      const arr = m.get(p.linha) || [];
      arr.push(p);
      m.set(p.linha, arr);
    }
    return m;
  }, [validacao.pendencias]);

  const grupos = useMemo(() => {
    const lista = validacao.beneficiarios || [];
    const out: { titular: BeneficiarioLido | null; deps: BeneficiarioLido[] }[] = [];
    const idx = new Map<number, number>();
    for (const b of lista) {
      if (b.tipo === "TITULAR") {
        idx.set(b.linha, out.length);
        out.push({ titular: b, deps: [] });
      } else if (b.titular_linha != null && idx.has(b.titular_linha)) {
        out[idx.get(b.titular_linha)!].deps.push(b);
      } else {
        out.push({ titular: null, deps: [b] });
      }
    }
    const q = busca.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    const match = (b: BeneficiarioLido) =>
      (!q || b.nome.toLowerCase().includes(q) || (qd && b.cpf.replace(/\D/g, "").includes(qd))) &&
      (!soErros || pendPorLinha.has(b.linha));
    return out
      .map((g) => {
        const titularOk = g.titular ? match(g.titular) : false;
        const deps = g.deps.filter(match);
        if (titularOk) return { ...g, deps: soErros || q ? deps : g.deps };
        if (deps.length) return { ...g, deps };
        return null;
      })
      .filter(Boolean) as { titular: BeneficiarioLido | null; deps: BeneficiarioLido[] }[];
  }, [validacao.beneficiarios, busca, soErros, pendPorLinha]);

  if (!validacao.beneficiarios) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        Clique em "Verificar Layout" novamente para ver a lista de participantes.
      </div>
    );
  }

  const rc = resumoStatusCpf(validacao.beneficiarios || []);
  const comErro = (validacao.beneficiarios || []).filter((b) => pendPorLinha.has(b.linha)).length;

  const Linha = ({ b, dep }: { b: BeneficiarioLido; dep?: boolean }) => {
    const p = pendPorLinha.get(b.linha) || [];
    const erros = p.filter((x) => x.severidade === "erro").length;
    const alertas = p.length - erros;
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm border-l-4",
          dep ? "ml-6 border-l-blue-500" : "border-l-primary",
          erros > 0 && "border-destructive/50 border-l-destructive bg-destructive/5",
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("font-semibold uppercase truncate", dep ? "text-sm" : "text-[15px]")}>{b.nome}</span>
            {dep ? (
              <>
                <Badge variant="secondary" className="text-[10px]">Dependente</Badge>
                <Badge variant="outline" className="text-[10px]">{PARENTESCO[b.tipo]}</Badge>
              </>
            ) : (
              <Badge className="text-[10px]">Titular</Badge>
            )}
            {erros > 0 && <Badge variant="destructive" className="text-[10px] gap-1"><XCircle className="h-3 w-3" />{erros} erro(s)</Badge>}
            {alertas > 0 && <Badge variant="outline" className="text-[10px] gap-1 border-orange-500/50 text-orange-600 dark:text-orange-400"><AlertTriangle className="h-3 w-3" />{alertas} alerta(s)</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">CPF: {mascararCpf(b.cpf)} · Linha {b.linha} <CpfStatusBadge b={b} /></p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAberto(b)}>
          <Eye className="h-4 w-4" /> Visualizar Mais
        </Button>
      </div>
    );
  };

  const pendAberto = aberto ? pendPorLinha.get(aberto.linha) || [] : [];

  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><Users className="h-5 w-5 text-primary" /></div>
          <div>
            <h4 className="font-semibold text-lg leading-tight">Participantes</h4>
            <p className="text-xs text-muted-foreground">Titulares e seus dependentes lidos do Relatório de Vidas.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Buscar nome ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} className="h-8 w-52" />
          <Button size="sm" variant={soErros ? "destructive" : "outline"} onClick={() => setSoErros((v) => !v)} disabled={comErro === 0}>
            Só com erros ({comErro})
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-card px-3 py-2 text-xs">
        <span className="font-semibold">Validação de CPF</span>
        <span>Válidos localmente: <strong className="text-primary">{rc.validos}</strong></span>
        <span>Inválidos: <strong className="text-destructive">{rc.invalidos}</strong></span>
        <span>Aguardando consulta oficial: <strong>{rc.aguardando}</strong></span>
        {rc.naoAnalisados > 0 && <span>Não analisados: <strong>{rc.naoAnalisados}</strong></span>}
      </div>
      <ScrollArea className="h-[420px] pr-3">
        <div className="space-y-2">
          {grupos.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum participante encontrado.</p>}
          {grupos.map((g, i) => (
            <div key={g.titular?.linha ?? `s${i}`} className="space-y-2">
              {g.titular && <Linha b={g.titular} />}
              {g.deps.map((d) => <Linha key={d.linha} b={d} dep />)}
            </div>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase">{aberto?.nome}</DialogTitle>
            <DialogDescription>Linha {aberto?.linha} do Relatório de Vidas</DialogDescription>
          </DialogHeader>
          {aberto && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-xs text-muted-foreground">CPF</p><p>{mascararCpf(aberto.cpf)}</p><p className="text-xs text-muted-foreground">{STATUS_CPF_LABEL[statusCpfFinal(aberto)]}</p></div>
                <div><p className="text-xs text-muted-foreground">Data de nascimento</p><p>{aberto.data_nasc || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Sexo</p><p>{aberto.sexo || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Tipo</p><p>{aberto.tipo === "TITULAR" ? "Titular" : `Dependente · ${PARENTESCO[aberto.tipo]}`}</p></div>
              </div>
              <div>
                <p className="font-semibold mb-2">Erros e alertas</p>
                {pendAberto.length === 0 ? (
                  <p className="flex items-center gap-2 text-primary"><CheckCircle2 className="h-4 w-4" /> Nenhum problema encontrado.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {pendAberto.map((p, i) => (
                      <li key={i} className="flex items-center gap-2 rounded-md border p-2">
                        {p.severidade === "erro"
                          ? <XCircle className="h-4 w-4 text-destructive shrink-0" />
                          : <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />}
                        <span><strong>{p.coluna}</strong>: {p.motivo}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
