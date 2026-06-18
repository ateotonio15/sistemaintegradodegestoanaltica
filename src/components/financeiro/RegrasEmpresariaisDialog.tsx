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
import { Info, Plus, Trash2, Building2, Lock, ChevronRight, ArrowLeft } from "lucide-react";
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

type View = "list" | "detail" | "new";

export function RegrasEmpresariaisDialog({ open, onOpenChange, canManage = true }: Props) {
  const [regras, setRegras] = useState<RegraEmpresarial[]>([]);
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState("");
  const [padrao, setPadrao] = useState("");
  const [descricao, setDescricao] = useState("");

  const recarregar = () => setRegras(listarRegras());

  useEffect(() => {
    if (open) {
      recarregar();
      setView("list");
      setSelectedId(null);
    }
    const onChange = () => recarregar();
    window.addEventListener("regras-empresariais:changed", onChange);
    return () => window.removeEventListener("regras-empresariais:changed", onChange);
  }, [open]);

  const selected = useMemo(
    () => regras.find((r) => r.id === selectedId) || null,
    [regras, selectedId],
  );

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
    setView("list");
    recarregar();
  }

  function handleRemove(id: string) {
    if (!confirm("Remover esta regra? Ela deixará de ser aplicada nas próximas análises.")) return;
    removerRegra(id);
    toast.success("Regra removida.");
    if (selectedId === id) {
      setSelectedId(null);
      setView("list");
    }
    recarregar();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {view !== "list" && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 -ml-1"
                onClick={() => setView("list")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Building2 className="h-5 w-5 text-primary" />
            {view === "detail" && selected
              ? selected.empresa
              : view === "new"
              ? "Nova regra"
              : "Regras Empresariais"}
          </DialogTitle>
          {view === "list" && (
            <DialogDescription>
              Exceções pontuais aplicadas durante a análise financeira (Excel × PDF).
            </DialogDescription>
          )}
        </DialogHeader>

        {view === "list" && (
          <div className="space-y-2">
            {regras.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedId(r.id);
                  setView("detail");
                }}
                className="w-full text-left rounded-md border bg-card hover:bg-accent/40 transition-colors px-3 py-2.5 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{r.empresa}</span>
                    {r.origem === "builtin" ? (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Lock className="h-2.5 w-2.5" /> Sistema
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Custom</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Agrupar por nome · "{r.padrao}"
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}

            {canManage && (
              <Button
                variant="outline"
                className="w-full gap-1.5 mt-2"
                onClick={() => setView("new")}
              >
                <Plus className="h-4 w-4" /> Adicionar regra
              </Button>
            )}
          </div>
        )}

        {view === "detail" && selected && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]">Agrupar por nome</Badge>
              {selected.origem === "builtin" ? (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Lock className="h-2.5 w-2.5" /> Sistema
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Custom</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Padrão: <code className="font-mono">"{selected.padrao}"</code>
              </span>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Como funciona</AlertTitle>
              <AlertDescription className="text-sm leading-relaxed">
                Por padrão a análise agrupa beneficiários <strong>por CNPJ</strong> (cada CNPJ vira
                um bloco comparado com sua NF). Quando uma empresa tem matriz + filiais com CNPJs
                diferentes mas o mesmo subestipulante, isso gera blocos separados que não batem com
                a NF consolidada. Esta regra força a consolidação{" "}
                <strong>por nome do subestipulante</strong>, somando vidas, inclusões, exclusões,
                devoluções, retroativas, taxa de adesão e faixas etárias num único bloco.
              </AlertDescription>
            </Alert>

            <Card>
              <CardContent className="pt-4">
                <p className="text-sm leading-relaxed">{selected.descricao}</p>
              </CardContent>
            </Card>

            {selected.origem === "custom" && canManage && (
              <Button
                variant="outline"
                className="w-full gap-1.5 text-destructive hover:text-destructive"
                onClick={() => handleRemove(selected.id)}
              >
                <Trash2 className="h-4 w-4" /> Remover regra
              </Button>
            )}
          </div>
        )}

        {view === "new" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome da empresa</Label>
              <Input
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Ex.: Pioneiro Combustíveis"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Padrão do subestipulante (case-insensitive)</Label>
              <Input
                value={padrao}
                onChange={(e) => setPadrao(e.target.value)}
                placeholder='Ex.: "PIONEIRO COMBUSTIVEIS LTD"'
              />
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
              <strong>Tipo:</strong> Agrupar por nome (ignorar CNPJ). Linhas do Excel cujo Pagador{" "}
              <em>contenha</em> o padrão informado serão consolidadas num único bloco.
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setView("list")}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleAdd}>
                Salvar regra
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
