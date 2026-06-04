import { useState } from "react";
import { Users, Eye } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useGrupoFinanceiro } from "@/hooks/useGrupoFinanceiro";

interface Props {
  empresaId: string;
  grupoNome: string;
  onVisualizarGrupo?: (grupoId: string) => void;
}

export function GrupoTag({ empresaId, grupoNome, onVisualizarGrupo }: Props) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useGrupoFinanceiro(empresaId);
  const contratos = data?.contratos ?? [];
  const grupoId = data?.grupo?.id;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-fit"
          title="Ver empresas do grupo"
          onClick={(e) => e.stopPropagation()}
        >
          <Users className="h-2.5 w-2.5" />
          <span className="font-medium">Grupo:</span>
          <span className="truncate max-w-[160px]">{grupoNome}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-foreground">
            Grupo: {grupoNome}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Empresas vinculadas ({contratos.length})
          </div>
          <div className="border-t border-border pt-2 space-y-1.5 max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="text-xs text-muted-foreground">Carregando...</div>
            ) : contratos.length === 0 ? (
              <div className="text-xs text-muted-foreground">Nenhuma empresa vinculada.</div>
            ) : (
              contratos.map((c) => (
                <div key={c.id} className="text-xs">
                  <div className="font-medium text-foreground truncate">
                    {c.nome_empresa || "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex gap-2">
                    {c.codigo_contrato && <span>#{c.codigo_contrato}</span>}
                    {c.cnpj && <span>{c.cnpj}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
          {onVisualizarGrupo && grupoId && contratos.length > 0 && (
            <div className="border-t border-border pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full h-7 text-xs gap-1"
                onClick={() => {
                  onVisualizarGrupo(grupoId);
                  setOpen(false);
                }}
              >
                <Eye className="h-3 w-3" />
                Visualizar grupo
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
