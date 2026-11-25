import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { resumoStatusCpf, resumoValidacaoCpf } from "@/lib/cpf-status";
import type { PendenciaLinha, ValidacaoResultado } from "@/lib/relatorio-vidas-validator";
import { cn } from "@/lib/utils";

function Detalhe({ titulo, resumo, children, abrir = false, acao }: { titulo: string; resumo?: ReactNode; children: ReactNode; abrir?: boolean; acao?: string }) {
  const [open, setOpen] = useState(abrir);
  return <Collapsible open={open} onOpenChange={setOpen} className="border-b py-2">
    <CollapsibleTrigger asChild>
      <Button variant="ghost" className="h-auto w-full justify-between gap-3 whitespace-normal px-2 py-2 text-left">
        <span className="min-w-0"><span className="block text-sm font-medium">{titulo}</span>{resumo && <span className="mt-1 block text-xs font-normal text-muted-foreground">{resumo}</span>}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">{acao && <span className="hidden sm:inline">{open ? "Ocultar" : acao}</span>}<ChevronDown className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} /></span>
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent className="px-2 pb-3 pt-2">{children}</CollapsibleContent>
  </Collapsible>;
}

export function ResumoLayoutVidas({ validacao }: { validacao: ValidacaoResultado }) {
  return <section className="space-y-3 border-b pb-4" aria-label="Resumo do Layout">
    <h4 className="text-sm font-semibold">Resumo do Layout</h4>
    <dl className="grid grid-cols-3 gap-3">
      {[["Vidas", validacao.total_vidas], ["Titulares", validacao.titulares], ["Dependentes", validacao.dependentes]].map(([label, value]) =>
        <div key={label}><dd className="text-2xl font-semibold text-foreground tabular-nums">{value}</dd><dt className="text-xs text-muted-foreground">{label}</dt></div>)}
    </dl>
    <Detalhe titulo="Ver composição dos dependentes">
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
        <div><dt className="inline text-muted-foreground">Filhos: </dt><dd className="inline font-medium">{validacao.filhos ?? 0}</dd></div>
        <div><dt className="inline text-muted-foreground">Cônjuges: </dt><dd className="inline font-medium">{validacao.conjuges ?? 0}</dd></div>
        <div><dt className="inline text-muted-foreground">Outros: </dt><dd className="inline font-medium">{validacao.outros_dependentes ?? 0}</dd></div>
      </dl>
    </Detalhe>
    {validacao.erros === 0 && validacao.alertas === 0 && validacao.valido
      ? <p className="flex items-center gap-2 text-xs text-primary"><CheckCircle2 className="h-4 w-4 shrink-0" />Layout válido — nenhuma pendência encontrada</p>
      : <p className="flex flex-wrap items-center gap-3 text-xs"><span className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" />{validacao.erros} Erros</span><span className="flex items-center gap-1 text-warning"><AlertTriangle className="h-4 w-4" />{validacao.alertas} Alertas</span></p>}
  </section>;
}

export function ResumoCpfVidas({ validacao, consultaConfigurada, tentativa }: { validacao: ValidacaoResultado; consultaConfigurada: boolean; tentativa?: ReactNode }) {
  const lista = validacao.beneficiarios || [];
  const local = resumoStatusCpf(lista);
  const oficial = resumoValidacaoCpf(lista);
  return <section className="space-y-2 border-b pb-4" aria-label="Validação de CPF">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h4 className="text-sm font-semibold">Validação de CPF</h4><span className="text-xs text-muted-foreground">{lista.length} CPFs analisados</span></div>
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
      <span className="flex items-center gap-1.5 text-primary"><CheckCircle2 className="h-3.5 w-3.5" />{local.validos} válidos localmente</span>
      <span className={cn("flex items-center gap-1.5", local.invalidos > 0 ? "text-destructive" : "text-muted-foreground")}><XCircle className="h-3.5 w-3.5" />{local.invalidos} inválidos</span>
      {local.naoAnalisados > 0 && <span className="text-muted-foreground">{local.naoAnalisados} não analisados</span>}
    </div>
    {!consultaConfigurada ? <div className="space-y-1 pt-1"><p className="text-xs font-medium">Consulta oficial não configurada</p><p className="text-xs text-muted-foreground">Os CPFs foram validados localmente. A consulta cadastral oficial poderá ser habilitada futuramente.</p></div>
      : <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{oficial.validados} Validados oficialmente</Badge>
        <Badge variant="outline">{oficial.divergencias} Divergências</Badge>
        <Badge variant="outline">{oficial.nao_consultados} Não consultados</Badge>
        {oficial.alertas > 0 && <Badge variant="outline">{oficial.alertas} Situação cadastral</Badge>}{tentativa}
      </div>}
  </section>;
}

export function PendenciasLayoutVidas({ validacao, pendencias }: { validacao: ValidacaoResultado; pendencias: PendenciaLinha[] }) {
  if (!pendencias.length) return null;
  return <Detalhe titulo={`Pendências por Linha (${pendencias.length}${validacao.pendencias.length === 500 ? "+" : ""})`} abrir>
    <ScrollArea className="h-48"><div className="space-y-2 pr-3">{pendencias.map((p, i) => <div key={i} className="flex items-start gap-2 text-xs">
      {p.severidade === "erro" ? <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />}
      <span>Linha {p.linha} — <strong>{p.coluna}</strong>: {p.motivo}</span>
    </div>)}</div></ScrollArea>
  </Detalhe>;
}

export function DetalhesLayoutVidas({ validacao }: { validacao: ValidacaoResultado }) {
  const problemas = validacao.colunas.filter((c) => c.severidade !== "ok").length;
  const erroColuna = validacao.colunas.some((c) => c.severidade === "erro");
  return <section aria-label="Detalhes técnicos">
    <Detalhe titulo="Detalhes da leitura">
      <dl className="grid gap-2 text-xs sm:grid-cols-2">{[
        ["Linhas lidas", validacao.linhas_lidas ?? validacao.total_linhas], ["Válidas (I)", validacao.linhas_validas ?? validacao.total_linhas],
        ["Ignoradas vazias", validacao.linhas_ignoradas_vazias ?? 0], ["Ignoradas outro tipo", validacao.linhas_ignoradas_outro_tipo ?? 0], ["Reaproveitadas", validacao.linhas_reaproveitadas ?? 0],
      ].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{value}</dd></div>)}</dl>
    </Detalhe>
    <Detalhe titulo="Regras aplicadas na leitura" resumo={<Info className="h-3.5 w-3.5" />}>
      <div className="space-y-2 text-xs text-muted-foreground"><p>Linhas sem <strong>TIPO OPERACAO = I</strong> foram ignoradas automaticamente.</p><p>Linhas sem <strong>GRAU PARENTESCO</strong> foram identificadas automaticamente como <strong>TITULAR</strong>.</p></div>
    </Detalhe>
    <Detalhe titulo="Conferência por Coluna" abrir={erroColuna} acao="Ver conferência" resumo={<span className="inline-flex flex-wrap items-center gap-2">{erroColuna ? <XCircle className="h-3.5 w-3.5 text-destructive" /> : <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}{validacao.colunas.length} colunas conferidas · {problemas} problemas</span>}>
      {validacao.colunas_ausentes.length > 0 && <p className="mb-3 text-xs text-destructive"><strong>Colunas obrigatórias ausentes: </strong>{validacao.colunas_ausentes.join(", ")}</p>}
      <ScrollArea className="h-48"><div className="space-y-1 pr-3">{validacao.colunas.map((c) => <div key={c.coluna} className={cn("flex flex-wrap items-center justify-between gap-2 border-b py-1.5 text-xs last:border-0", c.severidade === "erro" && "text-destructive")}>
        <span className="flex items-center gap-2">{c.severidade === "ok" ? <CheckCircle2 className="h-3 w-3 text-primary" /> : c.severidade === "erro" ? <XCircle className="h-3 w-3 text-destructive" /> : <AlertTriangle className="h-3 w-3 text-warning" />}{c.coluna}{!c.presente && <Badge variant="destructive" className="text-[9px]">ausente</Badge>}</span>
        <span className="text-muted-foreground">{c.presente ? `${c.preenchidas} ok / ${c.vazias} vazias / ${c.invalidas} inválidas` : "—"}</span>
      </div>)}</div></ScrollArea>
    </Detalhe>
  </section>;
}