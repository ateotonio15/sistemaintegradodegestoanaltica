import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTitularesUea } from "@/hooks/useDependentesUea";
import { proximasMudancasFaixa } from "@/lib/dependentes-uea";

export function AlertaGlobalMargemUea() {
  const { titulares, isLoading } = useTitularesUea();

  const totalTitularesCriticos = useMemo(() => {
    const titularesCriticos = proximasMudancasFaixa(titulares, 90)
      .filter((mudanca) => mudanca.diferenca > 0 && mudanca.margem_apos < 0)
      .map((mudanca) => mudanca.titular_id);

    return new Set(titularesCriticos).size;
  }, [titulares]);

  if (isLoading || totalTitularesCriticos === 0) return null;

  const singular = totalTitularesCriticos === 1;

  return (
    <section
      aria-label="Alerta de mudanças de faixa com risco de falta de margem"
      className="flex flex-col gap-2 rounded-lg border border-destructive/50 bg-destructive/15 px-3 py-2.5 text-destructive shadow-sm sm:flex-row sm:items-center sm:justify-between md:px-4"
    >
      <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive/20">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight">Mudanças de faixa com risco de falta de margem</p>
          <p className="mt-0.5 text-xs font-medium leading-snug text-foreground sm:text-sm">
            {totalTitularesCriticos} {singular ? "titular ficará" : "titulares ficarão"} sem margem devido {singular ? "à próxima mudança" : "às próximas mudanças"} de faixa.
          </p>
        </div>
      </div>
      <Button asChild size="sm" variant="destructive" className="h-8 shrink-0 gap-1.5 self-end sm:self-auto">
        <Link to="/dependentes-uea?mudancas=sem_margem#proximas-mudancas">
          Ver casos
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}