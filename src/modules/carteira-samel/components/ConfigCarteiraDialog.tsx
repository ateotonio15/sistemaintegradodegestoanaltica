import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { META_PADRAO } from "../lib/evolucao-mensal";
import { CarteiraConfig, useCarteiraConfig, useUpsertCarteiraConfig } from "../hooks/useEvolucaoMensal";

/**
 * Configuração por empresa/carteira: meta de sinistralidade (break even)
 * e uso de custos internos "in company".
 */
export function ConfigCarteiraDialog({
  open,
  onOpenChange,
  empresas,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empresas: { id: string; nome: string }[];
}) {
  const { data: config = {} } = useCarteiraConfig();
  const upsert = useUpsertCarteiraConfig();
  const [busca, setBusca] = useState("");
  const [rascunho, setRascunho] = useState<Record<string, CarteiraConfig>>({});

  const lista = useMemo(
    () =>
      empresas.filter((e) => e.nome.toLowerCase().includes(busca.toLowerCase())),
    [empresas, busca],
  );

  const valor = (id: string): CarteiraConfig =>
    rascunho[id] ||
    config[id] || { empresa_id: id, meta_sinistralidade: META_PADRAO, usa_in_company: false };

  const setValor = (id: string, patch: Partial<CarteiraConfig>) =>
    setRascunho((p) => ({ ...p, [id]: { ...valor(id), ...patch, empresa_id: id } }));

  const salvar = async () => {
    const pend = Object.values(rascunho);
    if (!pend.length) {
      onOpenChange(false);
      return;
    }
    try {
      for (const cfg of pend) {
        await upsert.mutateAsync({
          ...cfg,
          meta_sinistralidade: cfg.meta_sinistralidade > 0 ? cfg.meta_sinistralidade : META_PADRAO,
        });
      }
      toast.success(`${pend.length} configuração(ões) salva(s)`);
      setRascunho({});
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuração da carteira</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Defina a <strong>meta de sinistralidade (break even)</strong> de cada contrato — ex.: Samel 70%,
          Yamaha 75% — e sinalize se a carteira possui custos administrativos internos (in company).
        </p>
        <Input
          placeholder="Buscar empresa..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-9"
        />
        <div className="rounded-lg border divide-y max-h-[50vh] overflow-y-auto">
          {lista.map((e) => {
            const v = valor(e.id);
            const alterado = !!rascunho[e.id];
            return (
              <div key={e.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="flex-1 min-w-[160px] text-sm font-medium truncate">
                  {e.nome}
                  {alterado && (
                    <Badge variant="secondary" className="ml-2">
                      alterado
                    </Badge>
                  )}
                </span>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Meta %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 w-24"
                    value={Number((v.meta_sinistralidade * 100).toFixed(2))}
                    onChange={(ev) =>
                      setValor(e.id, { meta_sinistralidade: (Number(ev.target.value) || 0) / 100 })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={v.usa_in_company}
                    onCheckedChange={(c) => setValor(e.id, { usa_in_company: c })}
                  />
                  <Label className="text-xs text-muted-foreground">Custos in company</Label>
                </div>
              </div>
            );
          })}
          {lista.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma empresa encontrada.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => (setRascunho({}), onOpenChange(false))}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={upsert.isPending}>
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
