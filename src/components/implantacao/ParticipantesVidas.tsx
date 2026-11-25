import { useMemo, useState } from "react";
import { Users, Eye, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { ValidacaoResultado, BeneficiarioLido, PendenciaLinha } from "@/lib/relatorio-vidas-validator";
import { cn } from "@/lib/utils";
import { mascararCpf, statusCpfLocal, statusCpfFinal, pendenciasCpfOficiais, categoriaCpf, STATUS_CPF_LABEL, type CategoriaCpf, type StatusCpf } from "@/lib/cpf-status";
import { CONSULTA_OFICIAL_CONFIGURADA, filtrarParticipante, type FiltroParticipantes } from "./vidas-apresentacao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function CpfStatusBadge({ b, consultaConfigurada }: { b: BeneficiarioLido; consultaConfigurada: boolean }) {
  const s: StatusCpf = consultaConfigurada ? statusCpfFinal(b) : statusCpfLocal(b.cpf);
  if (s === "valido_local" || s === "validado_oficial") return null;
  const ruim = s === "invalido" || s === "divergencia" || s === "nao_localizado";
  const atencao = s === "situacao_atencao";
  const cls = ruim ? "border-destructive/50 text-destructive"
    : atencao ? "border-warning/50 text-warning"
    : "text-muted-foreground";
  const txt =
    s === "invalido" ? "CPF inválido"
    : s === "divergencia" ? "⚠ Divergência cadastral"
    : s === "nao_localizado" ? "⚠ CPF não localizado"
    : s === "situacao_atencao" ? "⚠ Situação cadastral"
    : s === "indisponivel" ? "Consulta com erro"
    : s === "sem_data_nasc" ? "Consulta não realizada"
    : STATUS_CPF_LABEL[s];
  const o = b.cpf_oficial;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-auto p-0"><Badge variant="outline" className={cn("text-[10px] font-normal cursor-pointer", cls)}>{txt}</Badge></Button>
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

export function ParticipantesVidas({ validacao, consultaConfigurada = CONSULTA_OFICIAL_CONFIGURADA }: { validacao: ValidacaoResultado; consultaConfigurada?: boolean }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroParticipantes>("todos");
  const [filtroCpf, setFiltroCpf] = useState<"todos" | CategoriaCpf>("todos");
  const [aberto, setAberto] = useState<BeneficiarioLido | null>(null);

  const pendPorLinha = useMemo(() => {
    const m = new Map<number, PendenciaLinha[]>();
    for (const p of [...(validacao.pendencias || []), ...(consultaConfigurada ? pendenciasCpfOficiais(validacao.beneficiarios || []) : [])]) {
      const arr = m.get(p.linha) || [];
      arr.push(p);
      m.set(p.linha, arr);
    }
    return m;
  }, [validacao.pendencias, validacao.beneficiarios, consultaConfigurada]);

  const grupos = useMemo(() => {
    const lista = validacao.beneficiarios || [];
    const out: { titular: BeneficiarioLido | null; deps: BeneficiarioLido[] }[] = [];
    const idx = new Map<number, number>();
    for (const b of lista) {
      if (b.tipo === "TITULAR") {
        idx.set(b.linha, out.length);
        out.push({ titular: b, deps: [] });
      } else if (b.titular_linha != null && idx.has(b.titular_linha)) {
        const index = idx.get(b.titular_linha);
        if (index !== undefined) out[index].deps.push(b);
      } else {
        out.push({ titular: null, deps: [b] });
      }
    }
    const q = busca.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    const match = (b: BeneficiarioLido) =>
      (!q || b.nome.toLowerCase().includes(q) || (qd && b.cpf.replace(/\D/g, "").includes(qd))) &&
      filtrarParticipante(b, filtro, validacao, consultaConfigurada) &&
      (!consultaConfigurada || filtroCpf === "todos" || categoriaCpf(b) === filtroCpf);
    return out
      .map((g) => {
        const titularOk = g.titular ? match(g.titular) : false;
        const deps = g.deps.filter(match);
        if (titularOk) return { ...g, deps };
        if (deps.length) return { titular: null, deps };
        return null;
      })
      .filter(Boolean) as { titular: BeneficiarioLido | null; deps: BeneficiarioLido[] }[];
  }, [validacao, busca, filtro, filtroCpf, consultaConfigurada]);

  if (!validacao.beneficiarios) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        Clique em "Verificar Layout" novamente para ver a lista de participantes.
      </div>
    );
  }

  const Linha = ({ b, dep }: { b: BeneficiarioLido; dep?: boolean }) => {
    const p = pendPorLinha.get(b.linha) || [];
    const erros = p.filter((x) => x.severidade === "erro").length;
    const alertas = p.length - erros;
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0",
          dep && "ml-3 border-l-2 border-l-border pl-3 sm:ml-5",
          erros > 0 && "border-destructive/50",
        )}
      >
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-words text-sm font-semibold uppercase">{b.nome}</span>
            {dep ? (
              <>
                <Badge variant="secondary" className="text-[10px]">Dependente</Badge>
                <Badge variant="outline" className="text-[10px]">{PARENTESCO[b.tipo]}</Badge>
              </>
            ) : (
              <Badge className="text-[10px]">Titular</Badge>
            )}
            {erros > 0 && <Badge variant="destructive" className="text-[10px] gap-1"><XCircle className="h-3 w-3" />{erros} erro(s)</Badge>}
            {alertas > 0 && <Badge variant="outline" className="text-[10px] gap-1 border-warning/50 text-warning"><AlertTriangle className="h-3 w-3" />{alertas} alerta(s)</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">CPF: {mascararCpf(b.cpf)} · Linha {b.linha} <CpfStatusBadge b={b} consultaConfigurada={consultaConfigurada} /></p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAberto(b)}>
          <Eye className="h-4 w-4" /> Visualizar Mais
        </Button>
      </div>
    );
  };

  const pendAberto = aberto ? pendPorLinha.get(aberto.linha) || [] : [];

  return (
    <section className="space-y-3" aria-label="Participantes">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><Users className="h-5 w-5 text-primary" /></div>
          <div>
            <h4 className="font-semibold text-lg leading-tight">Participantes</h4>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="Buscar nome ou CPF" placeholder="Buscar nome ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} className="h-8 w-full sm:w-52" />
          <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroParticipantes)}>
            <SelectTrigger aria-label="Filtrar participantes" className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="titulares">Titulares</SelectItem>
              <SelectItem value="dependentes">Dependentes</SelectItem>
              <SelectItem value="pendencias">Com pendência</SelectItem>
            </SelectContent>
          </Select>
          {consultaConfigurada && <Select value={filtroCpf} onValueChange={(v) => setFiltroCpf(v as "todos" | CategoriaCpf)}>
            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="validado">Validados</SelectItem>
              <SelectItem value="invalido">Inválidos</SelectItem>
              <SelectItem value="divergencia">Divergência</SelectItem>
              <SelectItem value="situacao">Situação cadastral</SelectItem>
              <SelectItem value="nao_consultado">Não consultados</SelectItem>
            </SelectContent>
          </Select>}
        </div>
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
                <div><p className="text-xs text-muted-foreground">CPF</p><p>{mascararCpf(aberto.cpf)}</p><p className="text-xs text-muted-foreground">{STATUS_CPF_LABEL[statusCpfLocal(aberto.cpf)]}</p></div>
                <div><p className="text-xs text-muted-foreground">Data de nascimento</p><p>{aberto.data_nasc || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Sexo</p><p>{aberto.sexo || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Tipo</p><p>{aberto.tipo === "TITULAR" ? "Titular" : `Dependente · ${PARENTESCO[aberto.tipo]}`}</p></div>
              </div>
              {aberto.cpf_oficial && <div className="space-y-1 border-t pt-3 text-xs">
                <p className="font-semibold">Consulta oficial</p>
                <p>{consultaConfigurada ? STATUS_CPF_LABEL[statusCpfFinal(aberto)] : "Consulta oficial não configurada"}</p>
                {aberto.cpf_oficial.situacao && <p>Situação retornada: {aberto.cpf_oficial.situacao}</p>}
                <p className="text-muted-foreground">Data/hora: {new Date(aberto.cpf_oficial.consultado_em).toLocaleString("pt-BR")}</p>
                <p className="text-muted-foreground">Origem: {aberto.cpf_oficial.origem === "nao_configurado" ? "Serviço de consulta ainda não configurado" : aberto.cpf_oficial.origem}</p>
              </div>}
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
                          : <AlertTriangle className="h-4 w-4 text-warning shrink-0" />}
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
    </section>
  );
}
