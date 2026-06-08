import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useHondaExclusoes, getDiasRestantes, getHondaStatus } from "@/hooks/useHondaExclusoes";
import { HondaMotoProgress } from "./HondaMotoProgress";
import { formatCpf } from "@/lib/honda-exclusoes-import";
import { formatDateBR } from "@/lib/date-utils";
import { AlertTriangle } from "lucide-react";

/**
 * Banner global de alerta para exclusões programadas.
 * Aparece a partir de D-1 00:00 e permanece até 23:59 da data de demissão.
 */
export function HondaAlertasBanner() {
  const { data = [] } = useHondaExclusoes();

  const alertas = useMemo(() => {
    return data.filter((item) => {
      if (item.concluido) return false;
      const dias = getDiasRestantes(item);
      // D-1 (amanhã) e D-0 (hoje). Atrasado também alerta.
      return dias <= 1;
    });
  }, [data]);

  if (alertas.length === 0) return null;

  return (
    <Alert className="border-primary/40 bg-primary/5">
      <AlertTriangle className="h-4 w-4 text-primary" />
      <AlertTitle className="flex items-center gap-2">
        Exclusão Programada Honda
        <Link to="/honda-exclusoes" className="text-xs font-normal text-primary hover:underline ml-auto">
          ver tudo
        </Link>
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-2">
          {alertas.slice(0, 5).map((a) => {
            const dias = getDiasRestantes(a);
            const status = getHondaStatus(a);
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{a.nome_beneficiario}</span>
                <span className="text-muted-foreground font-mono text-xs">{formatCpf(a.cpf)}</span>
                <span className="text-muted-foreground text-xs">
                  {formatDateBR(a.data_demissao)} • {a.motivo || status}
                </span>
                <div className="ml-auto min-w-[140px]">
                  <HondaMotoProgress diasRestantes={dias} showLabel />
                </div>
              </div>
            );
          })}
          {alertas.length > 5 && (
            <p className="text-xs text-muted-foreground pt-1">+ {alertas.length - 5} outras exclusões.</p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
