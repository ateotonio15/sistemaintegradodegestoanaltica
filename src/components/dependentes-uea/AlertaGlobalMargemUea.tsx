import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTitularesUea } from "@/hooks/useDependentesUea";
import { formatBRL, formatDataBR, proximasMudancasFaixa } from "@/lib/dependentes-uea";

export function AlertaGlobalMargemUea() {
  const { titulares, isLoading } = useTitularesUea();
  const navigate = useNavigate();
  const [painelAberto, setPainelAberto] = useState(false);
  const [expandido, setExpandido] = useState(false);
  // Guarda o menor nº de dias já "visto" pelo usuário; pisca de novo quando esse número diminui (ex.: dia da troca).
  const [ackDias, setAckDias] = useState<number | null>(() => {
    const salvo = window.localStorage.getItem("uea-alerta-margem-ack-dias");
    const numero = salvo === null ? NaN : Number(salvo);
    return Number.isFinite(numero) ? numero : null;
  });
  const containerRef = useRef<HTMLElement | null>(null);

  // Fecha o card expandido ao clicar fora dele (mantém o painel interno funcionando).
  useEffect(() => {
    if (!expandido) return;
    const aoClicarFora = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setExpandido(false);
      }
    };
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [expandido]);

  const casosCriticos = useMemo(
    () =>
      proximasMudancasFaixa(titulares, 90)
      .filter((mudanca) => mudanca.diferenca > 0 && mudanca.margem_apos < 0)
        .sort((a, b) => {
          const porData = a.data_mudanca.localeCompare(b.data_mudanca);
          return porData !== 0 ? porData : a.margem_apos - b.margem_apos;
        }),
    [titulares],
  );

  const totalTitularesCriticos = useMemo(() => {
    const titularesCriticos = casosCriticos.map((mudanca) => mudanca.titular_id);

    return new Set(titularesCriticos).size;
  }, [casosCriticos]);

  useEffect(() => {
    if (casosCriticos.length === 0) setPainelAberto(false);
  }, [casosCriticos.length]);

  if (isLoading || totalTitularesCriticos === 0) return null;

  const singular = totalTitularesCriticos === 1;
  const menorDias = Math.min(...casosCriticos.map((caso) => caso.dias));
  // Pisca quando faltam 2 dias ou menos, até o usuário clicar; volta a piscar quando o prazo diminui (inclusive no dia da troca).
  const piscando = menorDias <= 2 && (ackDias === null || ackDias > menorDias);

  const reconhecerAlerta = () => {
    setAckDias(menorDias);
    window.localStorage.setItem("uea-alerta-margem-ack-dias", String(menorDias));
  };

  return (
    <section
      ref={containerRef}
      aria-label="Alerta de mudanças de faixa com risco de falta de margem"
      className="fixed bottom-[88px] right-4 z-40 max-w-[calc(100vw-2rem)]"
    >
      {expandido ? (
        <div className="w-[320px] rounded-lg border border-destructive/50 bg-destructive/15 p-3 text-destructive shadow-xl backdrop-blur-sm">
          <div className="flex items-start gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-destructive/20">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="pr-1 text-xs font-bold leading-tight">Mudanças de faixa com risco de falta de margem</p>
              <p className="mt-1 text-[11px] font-medium leading-snug text-foreground">
                {totalTitularesCriticos} {singular ? "titular ficará" : "titulares ficarão"} sem margem devido {singular ? "à próxima mudança" : "às próximas mudanças"} de faixa.
              </p>
              <Button
                size="sm"
                variant="destructive"
                className="mt-2 h-7 gap-1.5 px-2.5 text-xs"
                onClick={() => setPainelAberto(true)}
                aria-expanded={painelAberto}
                aria-controls="painel-casos-criticos-uea"
              >
                Ver casos
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Button>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
              onClick={() => setExpandido(false)}
              aria-label="Fechar alerta"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            reconhecerAlerta();
            setExpandido(true);
          }}
          aria-expanded={expandido}
          aria-label={`Alerta: ${totalTitularesCriticos} ${singular ? "titular ficará" : "titulares ficarão"} sem margem. Clique para ver detalhes.`}
          title="Mudanças de faixa com risco de falta de margem"
          className={`relative flex h-12 w-12 items-center justify-center rounded-full border border-destructive/60 bg-destructive text-white shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/70 ${piscando ? "animate-pulse" : ""}`}
        >
          {piscando && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" aria-hidden="true" />
          )}
          <AlertTriangle className="relative h-5 w-5" aria-hidden="true" />
        </button>
      )}


      {painelAberto && (
        <aside
          id="painel-casos-criticos-uea"
          aria-label="Titulares que ficarão sem margem"
          className={painelAberto ? "fixed inset-x-3 bottom-3 top-20 z-50 flex flex-col overflow-hidden rounded-lg border border-destructive/40 bg-background shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[460px]" : "hidden"}

        >
          <header className="shrink-0 border-b border-border bg-destructive/10 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold leading-tight text-foreground">Titulares que ficarão sem margem</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Mudanças de faixa previstas nos próximos 90 dias.</p>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => setPainelAberto(false)}
                aria-label="Fechar painel de casos"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="mt-2.5 rounded-md bg-destructive/15 px-2.5 py-1.5 text-xs font-semibold text-destructive">
              {casosCriticos.length} {casosCriticos.length === 1 ? "situação crítica" : "situações críticas"} em {totalTitularesCriticos} {singular ? "titular" : "titulares"}
            </p>
          </header>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-3 p-3 sm:p-4">
              {casosCriticos.map((caso) => {
                const urgente = caso.dias <= 7;
                return (
                  <article key={caso.dependente_id} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                    {/* Identificação */}
                    <div className="border-b border-border px-4 pt-3 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 break-words text-sm font-bold leading-snug text-foreground">{caso.titular_nome}</p>
                        <Badge variant="destructive" className="shrink-0 text-[10px] uppercase">
                          Ficará sem margem
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">Dependente: {caso.dependente_nome}</p>
                    </div>

                    {/* Data da mudança */}
                    <div className={`flex items-center justify-between gap-2 border-b border-border px-4 py-2.5 ${urgente ? "bg-destructive/10" : "bg-muted/40"}`}>
                      <div className="flex min-w-0 items-center gap-2">
                        <CalendarClock className={`h-4 w-4 shrink-0 ${urgente ? "text-destructive" : "text-muted-foreground"}`} aria-hidden="true" />
                        <p className={`text-sm font-bold ${urgente ? "text-destructive" : "text-foreground"}`}>
                          Mudança {caso.dias === 0 ? "hoje" : `em ${caso.dias} ${caso.dias === 1 ? "dia" : "dias"}`}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{formatDataBR(caso.data_mudanca)}</p>
                    </div>

                    {/* Valores: rótulo à esquerda, valor alinhado à direita */}
                    <div className="divide-y divide-border/60 px-4">
                      <div className="flex items-baseline justify-between gap-3 py-2">
                        <dt className="text-xs text-muted-foreground">Faixa</dt>
                        <dd className="text-right text-xs font-semibold text-foreground">
                          {caso.faixa_atual_label} → {caso.proxima_faixa_label ?? "—"}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 py-2">
                        <dt className="text-xs text-muted-foreground">Valor atual</dt>
                        <dd className="text-sm font-semibold tabular-nums text-foreground">{formatBRL(caso.valor_atual)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 py-2">
                        <dt className="text-xs text-muted-foreground">Novo valor</dt>
                        <dd className="text-sm font-semibold tabular-nums text-foreground">{formatBRL(caso.novo_valor)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 py-2">
                        <dt className="text-xs font-medium text-destructive">Aumento</dt>
                        <dd className="text-sm font-bold tabular-nums text-destructive">+ {formatBRL(caso.diferenca)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 py-2">
                        <dt className="text-xs text-muted-foreground">Margem atual</dt>
                        <dd className="text-sm font-semibold tabular-nums text-foreground">{formatBRL(caso.margem_atual)}</dd>
                      </div>
                    </div>

                    {/* Impacto final: margem após a mudança */}
                    <div className="mx-4 mb-3 mt-1 rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2.5">
                      <dt className="text-xs font-medium text-destructive">Margem após mudança</dt>
                      <dd className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-destructive">{formatBRL(caso.margem_apos)}</dd>
                    </div>

                    {/* Ação */}
                    <div className="flex justify-end border-t border-border bg-muted/30 px-4 py-2.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        onClick={() => {
                          reconhecerAlerta();
                          setPainelAberto(false);
                          setExpandido(false);
                          navigate(`/dependentes-uea?titular=${encodeURIComponent(caso.titular_id)}`);
                        }}
                      >
                        Ver titular
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </ScrollArea>
        </aside>
      )}
    </section>
  );
}