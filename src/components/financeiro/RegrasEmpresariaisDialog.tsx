import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Info, Plus, Trash2, Building2, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  adicionarRegra,
  listarRegras,
  removerRegra,
  type RegraEmpresarial,
} from "@/lib/regras-empresariais";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canManage?: boolean;
}

export function RegrasEmpresariaisDialog({ open, onOpenChange, canManage = true }: Props) {
  const [regras, setRegras] = useState<RegraEmpresarial[]>([]);
  const [empresa, setEmpresa] = useState("");
  const [padrao, setPadrao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [showForm, setShowForm] = useState(false);

  const recarregar = () => setRegras(listarRegras());

  useEffect(() => {
    if (open) recarregar();
    const onChange = () => recarregar();
    window.addEventListener("regras-empresariais:changed", onChange);
    return () => window.removeEventListener("regras-empresariais:changed", onChange);
  }, [open]);

  const builtin = useMemo(() => regras.filter((r) => r.origem === "builtin"), [regras]);
  const custom = useMemo(() => regras.filter((r) => r.origem === "custom"), [regras]);

  function handleAdd() {
    const emp = empresa.trim();
    const pad = padrao.trim();
    const desc = descricao.trim();
    if (!emp || !pad) {
      toast.error("Preencha o nome da empresa e o padrão (subestipulante).");
      return;
    }
    adicionarRegra({
      empresa: emp,
      padrao: pad,
      tipo: "agrupar_por_nome",
      descricao:
        desc ||
        `Todos os beneficiários cujo subestipulante contenha "${pad}" são consolidados em um único bloco, independente do CNPJ. Matriz e filiais (CNPJs diferentes) são somadas como uma só empresa antes da comparação com o PDF.`,
    });
    toast.success("Regra adicionada. Será aplicada nas próximas análises.");
    setEmpresa("");
    setPadrao("");
    setDescricao("");
    setShowForm(false);
    recarregar();
  }

  function handleRemove(id: string) {
    if (!confirm("Remover esta regra? Ela deixará de ser aplicada nas próximas análises.")) return;
    removerRegra(id);
    toast.success("Regra removida.");
    recarregar();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Regras Empresariais
          </DialogTitle>
          <DialogDescription>
            Exceções pontuais aplicadas durante a análise financeira (Excel × PDF) para
            pagadores com particularidades.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2 -mr-2">
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Como funcionam</AlertTitle>
              <AlertDescription className="text-sm leading-relaxed">
                Por padrão a análise agrupa beneficiários <strong>por CNPJ</strong> (cada CNPJ vira um
                bloco comparado com sua NF). Quando uma empresa tem matriz + filiais com CNPJs
                diferentes mas o mesmo subestipulante, isso gera blocos separados que não batem
                com a NF consolidada. As regras abaixo forçam a consolidação{" "}
                <strong>por nome do subestipulante</strong>, somando vidas, inclusões, exclusões,
                devoluções, retroativas, taxa de adesão e faixas etárias num único bloco.
              </AlertDescription>
            </Alert>

            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Regras do sistema ({builtin.length})
              </h3>
              <div className="space-y-2">
                {builtin.map((r) => (
                  <RegraCard key={r.id} regra={r} />
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">
                  Regras customizadas ({custom.length})
                </h3>
                {canManage && !showForm && (
                  <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Adicionar regra
                  </Button>
                )}
              </div>

              {showForm && (
                <Card className="mb-3 border-primary/40">
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome da empresa</Label>
                        <Input
                          value={empresa}
                          onChange={(e) => setEmpresa(e.target.value)}
                          placeholder="Ex.: Pioneiro Combustíveis"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Padrão do subestipulante (case-insensitive)
                        </Label>
                        <Input
                          value={padrao}
                          onChange={(e) => setPadrao(e.target.value)}
                          placeholder='Ex.: "PIONEIRO COMBUSTIVEIS LTD"'
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Descrição (opcional)</Label>
                      <Textarea
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        placeholder="Explique por que essa empresa precisa da exceção (ex.: matriz + filiais com CNPJs distintos faturadas em NF única)."
                        rows={3}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <strong>Tipo da regra:</strong> Agrupar por nome (ignorar CNPJ). Linhas do
                      Excel cujo Pagador <em>contenha</em> o padrão informado serão consolidadas
                      num único bloco.
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleAdd}>
                        Salvar regra
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                {custom.length === 0 && !showForm && (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
                    Nenhuma regra customizada. Use “Adicionar regra” para incluir uma empresa
                    com particularidades parecidas.
                  </p>
                )}
                {custom.map((r) => (
                  <RegraCard
                    key={r.id}
                    regra={r}
                    onRemove={canManage ? () => handleRemove(r.id) : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegraCard({ regra, onRemove }: { regra: RegraEmpresarial; onRemove?: () => void }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm">{regra.empresa}</h4>
              <Badge variant="outline" className="text-[10px]">
                Agrupar por nome
              </Badge>
              {regra.origem === "builtin" ? (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Lock className="h-2.5 w-2.5" /> Sistema
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Custom</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Padrão: <code className="font-mono">"{regra.padrao}"</code>
            </p>
            <p className="text-sm text-foreground/90 mt-2 leading-relaxed">
              {regra.descricao}
            </p>
          </div>
          {onRemove && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onRemove}
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="Remover regra"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
