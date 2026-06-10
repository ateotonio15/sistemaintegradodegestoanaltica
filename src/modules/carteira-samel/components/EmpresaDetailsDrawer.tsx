import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { EmpresaCarteira } from "../data/mockData";
import { Semaforo, proximoAniversario, diasAteReajuste } from "../lib/risco";
import { useAvaliacoesExecutiva, useSalvarAvaliacaoExecutiva, useDeleteAvaliacaoExecutiva } from "../hooks/useRiscoData";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function EmpresaDetailsDrawer({ empresa, open, onOpenChange }: { empresa: EmpresaCarteira | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const { data: avaliacoes = [] } = useAvaliacoesExecutiva(empresa?.nome || "");
  const salvar = useSalvarAvaliacaoExecutiva();
  const excluir = useDeleteAvaliacaoExecutiva();

  const [relacionamento, setRelacionamento] = useState<Semaforo>("Verde");
  const [satisfacao, setSatisfacao] = useState<Semaforo>("Verde");
  const [observacao, setObservacao] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  if (!empresa) return null;
  const aniv = proximoAniversario(empresa.vigenciaInicio);
  const dias = diasAteReajuste(empresa.vigenciaInicio);

  const handleSalvar = async () => {
    await salvar.mutateAsync({
      id: editId || undefined,
      empresa: empresa.nome,
      contrato: empresa.contrato,
      relacionamento,
      satisfacao,
      observacao,
      created_by: user?.email || "sistema",
    });
    toast.success("Avaliação salva");
    setEditId(null);
    setObservacao("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="truncate">{empresa.nome}</SheetTitle>
          <p className="text-xs text-muted-foreground">Contrato {empresa.contrato} · {empresa.vidas} vidas</p>
        </SheetHeader>

        <Tabs defaultValue="reclamacoes" className="mt-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="reclamacoes">Reclamações</TabsTrigger>
            <TabsTrigger value="reajuste">Reajuste</TabsTrigger>
            <TabsTrigger value="avaliacao">Avaliação</TabsTrigger>
          </TabsList>

          <TabsContent value="reclamacoes" className="mt-4">
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Conexão externa pendente</p>
                <p className="text-xs opacity-80">Configure a base externa para listar as reclamações da empresa (últimos 30 dias).</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reajuste" className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">Data do próximo reajuste</span><span className="font-medium">{format(aniv, "dd/MM/yyyy")}</span></div>
            <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">Dias restantes</span><span className="font-medium">{dias}</span></div>
            <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">Mês de reajuste</span><span className="font-medium">{empresa.reajusteMes}</span></div>
            <div className="flex justify-between py-2"><span className="text-muted-foreground">Último %</span><span className="font-medium">{empresa.reajusteValor.toFixed(2)}%</span></div>
          </TabsContent>

          <TabsContent value="avaliacao" className="mt-4 space-y-3">
            <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">Avaliação será incorporada ao Score em fase futura.</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Relacionamento</label>
                <Select value={relacionamento} onValueChange={(v) => setRelacionamento(v as Semaforo)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Verde">Verde — Excelente</SelectItem>
                    <SelectItem value="Amarelo">Amarelo — Atenção</SelectItem>
                    <SelectItem value="Vermelho">Vermelho — Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Satisfação</label>
                <Select value={satisfacao} onValueChange={(v) => setSatisfacao(v as Semaforo)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Verde">Verde — Satisfeito</SelectItem>
                    <SelectItem value="Amarelo">Amarelo — Neutro</SelectItem>
                    <SelectItem value="Vermelho">Vermelho — Insatisfeito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea placeholder="Observação..." value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            <Button onClick={handleSalvar} disabled={salvar.isPending} className="w-full">{editId ? "Atualizar" : "Salvar"} avaliação</Button>

            <div className="pt-3">
              <h5 className="text-xs font-semibold mb-2 text-muted-foreground">Histórico</h5>
              {avaliacoes.length === 0 && <p className="text-xs text-muted-foreground">Sem avaliações ainda.</p>}
              <div className="space-y-2">
                {avaliacoes.map((a) => (
                  <div key={a.id} className="rounded border p-2 text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">{format(new Date(a.created_at), "dd/MM/yyyy HH:mm")}</span>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditId(a.id); setRelacionamento(a.relacionamento || "Verde"); setSatisfacao(a.satisfacao || "Verde"); setObservacao(a.observacao || ""); }}><Edit className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => excluir.mutate(a.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    <div>Relac.: {a.relacionamento} · Satisf.: {a.satisfacao}</div>
                    {a.observacao && <div className="text-muted-foreground mt-1">{a.observacao}</div>}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
