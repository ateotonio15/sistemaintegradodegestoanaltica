import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateBR } from "@/lib/date-utils";
import { nomeArquivoRelatorio, relatorioBadgeClass, rotuloCurtoRelatorio, type RegistroRelatorio } from "@/lib/movimentacao-relatorio";

/**
 * Badge compacto do status do relatório de vidas na aba "Movimentações".
 * Ao clicar, mostra os detalhes (arquivo, destinatários, envio e status completo).
 * Apenas apresentação: nunca altera o registro nem o status da movimentação.
 */
export function RelatorioStatusBadge({ registro, empresaNome, mesReferencia, dataEnvioEmpresa, desabilitado, rotulo }: {
  registro: RegistroRelatorio;
  empresaNome: string;
  mesReferencia: string | null;
  dataEnvioEmpresa?: string | null;
  desabilitado?: boolean;
  rotulo?: string;
}) {
  if (desabilitado) {
    return <Badge variant="outline" className="rounded-md whitespace-nowrap">{rotulo ?? "—"}</Badge>;
  }
  const destinatarios = registro.destinatarios.split(/[\n;,]+/).map(d => d.trim()).filter(Boolean);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer" aria-label={`Detalhes do relatório de vidas de ${empresaNome}`}>
          <Badge className={`${relatorioBadgeClass(registro.status)} rounded-md border whitespace-nowrap`}>
            {rotuloCurtoRelatorio(registro.status)}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm" align="start">
        <div className="space-y-3">
          <div>
            <p className="font-semibold">Relatório:</p>
            <p className="break-all text-muted-foreground">{nomeArquivoRelatorio(empresaNome, mesReferencia ?? "")}</p>
          </div>
          <div>
            <p className="font-semibold">Destinatários:</p>
            {destinatarios.length > 0
              ? destinatarios.map(d => <p key={d} className="text-muted-foreground">{d}</p>)
              : <p className="text-muted-foreground">—</p>}
          </div>
          <div>
            <p className="font-semibold">Enviado:</p>
            <p className="text-muted-foreground">{formatDateBR(registro.data_envio ?? dataEnvioEmpresa ?? null)}</p>
          </div>
          <div>
            <p className="font-semibold">Status:</p>
            <p className="text-muted-foreground">{registro.status}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
