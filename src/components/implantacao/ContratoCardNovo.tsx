import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, CalendarDays, Eye, GitBranch, Trash2, User, Users } from "lucide-react";
import { formatBRLFromCentavos } from "@/lib/cobranca-retroativa-calc";
import { formatDateBR } from "@/lib/date-utils";
import { statusBadge, statusLabel, setorLabel } from "@/lib/contrato-processo";
import type { LinhaContrato } from "./ContratosFiltros";

const STATUS_LABEL: Record<string, string> = {
  em_implantacao: "Em implantação",
  aguardando_documentos: "Aguardando documentos",
  em_validacao: "Em validação",
  implantado: "Implantado",
  pendente_ajuste: "Pendente ajuste",
};

const STATUS_COLOR: Record<string, string> = {
  em_implantacao: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  aguardando_documentos: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  em_validacao: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  implantado: "bg-green-500/15 text-green-600 border-green-500/30",
  pendente_ajuste: "bg-red-500/15 text-red-600 border-red-500/30",
};

/** Valor mensal estimado do contrato (enfermaria + apartamento x vidas). */
function valorMensalCentavos(i: any): number {
  const enf = Number(i.valor_enfermaria_centavos || 0);
  const apt = Number(i.valor_apartamento_centavos || 0);
  const vEnf = Number(i.vidas_enfermaria || 0);
  const vApt = Number(i.vidas_apartamento || 0);
  if (vEnf > 0 || vApt > 0) return enf * vEnf + apt * vApt;
  const total = Number(i.total_vidas || 0);
  return (enf || apt) * total;
}

/** Limite para fechamento: 10 dias antes do início da vigência. */
function limiteFechamento(vigencia: string | null): string | null {
  if (!vigencia) return null;
  const [a, m, d] = vigencia.slice(0, 10).split("-").map(Number);
  const dt = new Date(a, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() - 10);
  return formatDateBR(dt);
}

interface Props {
  linha: LinhaContrato;
  onOpen: () => void;
  onFluxo: () => void;
  onDelete?: () => void;
}

export function ContratoCardNovo({ linha, onOpen, onFluxo, onDelete }: Props) {
  const i = linha.implantacao;
  const valor = valorMensalCentavos(i);
  const limite = limiteFechamento(i.data_vigencia);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5 space-y-3">
        {/* Cabeçalho: nome + valor */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-bold truncate">{linha.empresa}</h3>
            <p className="font-mono text-sm text-muted-foreground">{linha.cnpj}</p>
          </div>
          {valor > 0 && (
            <p className="text-lg font-bold text-primary shrink-0">{formatBRLFromCentavos(valor)}</p>
          )}
        </div>

        {/* Situação */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={STATUS_COLOR[i.status]}>
            {STATUS_LABEL[i.status] || i.status}
          </Badge>
          {linha.status && (
            <Badge variant="outline" className={statusBadge(linha.status)}>
              {statusLabel(linha.status)}
            </Badge>
          )}
          {linha.setor && (
            <span className="text-xs text-muted-foreground">
              {setorLabel(linha.setor)}
              {linha.panorama.pendenciasAbertas > 0
                ? ` · ${linha.panorama.pendenciasAbertas} pendência(s)`
                : ""}
            </span>
          )}
        </div>

        {linha.faltando.length > 0 && (
          <p className="text-xs text-muted-foreground">Falta: {linha.faltando.join(", ")}</p>
        )}

        {/* Dados */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-1 gap-x-6 text-sm">
          <p className="flex items-center gap-1.5 min-w-0">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Corretora:</span>
            <span className="truncate font-medium">{i.corretora || "Não informado"}</span>
          </p>
          <p className="flex items-center gap-1.5 min-w-0">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Vendedor:</span>
            <span className="truncate font-medium">{i.created_by_nome || "Não informado"}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Vidas:</span>
            <span className="font-medium">{i.total_vidas ?? 0}</span>
          </p>
        </div>

        <div className="text-sm text-amber-600 dark:text-amber-500 space-y-0.5">
          <p className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            Início da Vigência: {i.data_vigencia ? formatDateBR(i.data_vigencia) : "Não informado"}
          </p>
          <p className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            Limite do Fechamento: {limite || "Não informado"}
          </p>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onFluxo} title="Fluxo entre setores">
            <GitBranch className="h-4 w-4" /> Fluxo
          </Button>
          {onDelete && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-muted-foreground hover:text-red-600"
              onClick={onDelete}
              title="Excluir implantação"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={onOpen}>
            <Eye className="h-4 w-4" /> Analisar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
