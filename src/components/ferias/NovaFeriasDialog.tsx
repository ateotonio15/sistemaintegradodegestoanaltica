import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, ArrowRight, Plane, CheckCircle2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Props { open: boolean; onClose: () => void; }
type Workload = { user_id: string; display_name: string; empresas: number; implantacoes: number };
type Atribuicao = { empresa_id: string; empresa_nome: string; responsavel_temp_id: string; responsavel_temp_nome: string };

export function NovaFeriasDialog({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user, isAdmin, isDiretora, isComum } = useAuth();
  // Comum (cadastro) só pode marcar férias para si mesmo
  const lockToSelf = isComum && !isAdmin && !isDiretora;
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<string>("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [atribuicoes, setAtribuicoes] = useState<Atribuicao[]>([]);
  const [destinosBase, setDestinosBase] = useState<Workload[]>([]);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(1); setUserId(""); setDataInicio(""); setDataFim(""); setAtribuicoes([]); setDestinosBase([]);
    }
  }, [open]);

  const { data: workload = [] } = useQuery({
    queryKey: ["cadastro-workload"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cadastro_workload" as any);
      if (error) throw error;
      return (data as any[]).map((u) => ({
        user_id: u.user_id, display_name: u.display_name,
        empresas: Number(u.empresas ?? 0), implantacoes: Number(u.implantacoes ?? 0),
      })) as Workload[];
    },
    enabled: open,
  });

  // Auto-seleciona o próprio usuário quando travado
  useEffect(() => {
    if (open && lockToSelf && user?.id && !userId) {
      setUserId(user.id);
    }
  }, [open, lockToSelf, user?.id, userId]);

  const selectedUser = workload.find((u) => u.user_id === userId);

  const simular = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("simular_redistribuicao_ferias" as any, { p_user_id: userId });
      if (error) throw error;
      return data as { antes: any[]; depois: any[]; atribuicoes: Atribuicao[] };
    },
    onSuccess: (data) => {
      setAtribuicoes(data.atribuicoes || []);
      setDestinosBase(workload.filter((w) => w.user_id !== userId));
      setStep(3);
    },
    onError: (e: any) => toast({ title: "Erro ao simular", description: e.message, variant: "destructive" }),
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("criar_ferias_cadastro" as any, {
        p_user_id: userId, p_nome: selectedUser?.display_name ?? "", p_data_inicio: dataInicio, p_data_fim: dataFim, p_atribuicoes: atribuicoes as any,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Férias criadas", description: "Redistribuição registrada." });
      qc.invalidateQueries({ queryKey: ["ferias-list"] });
      qc.invalidateQueries({ queryKey: ["cadastro-workload"] });
      qc.invalidateQueries({ queryKey: ["empresas"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Resumo recalculado a partir das atribuições atuais
  const resumo = useMemo(() => {
    const map = new Map<string, { nome: string; antes: number; recebidas: number }>();
    destinosBase.forEach((d) => map.set(d.user_id, { nome: d.display_name, antes: d.empresas, recebidas: 0 }));
    atribuicoes.forEach((a) => {
      const cur = map.get(a.responsavel_temp_id);
      if (cur) cur.recebidas += 1;
      else map.set(a.responsavel_temp_id, { nome: a.responsavel_temp_nome, antes: 0, recebidas: 1 });
    });
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v, depois: v.antes + v.recebidas }));
  }, [destinosBase, atribuicoes]);

  const podeAvancar1 = userId && dataInicio && dataFim && dataFim >= dataInicio;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary" />Gestão de Férias — Passo {step}/3</DialogTitle>
          <DialogDescription>
            {step === 1 && "Selecione o responsável e o período de férias."}
            {step === 2 && "Simulação da nova distribuição."}
            {step === 3 && "Ajuste manual e confirmação."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Responsável * {lockToSelf && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />Apenas você</Badge>}
              </Label>
              <Select value={userId} onValueChange={setUserId} disabled={lockToSelf}>
                <SelectTrigger><SelectValue placeholder="Selecione um responsável do Cadastro" /></SelectTrigger>
                <SelectContent>
                  {workload.filter((u) => !lockToSelf || u.user_id === user?.id).map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.display_name} — {u.empresas} empresas · {u.implantacoes} impl.
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lockToSelf && (
                <p className="text-xs text-muted-foreground">Suas empresas serão distribuídas entre os demais responsáveis do Cadastro.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data início *</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data fim *</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
            {selectedUser && (
              <Card className="p-4 bg-muted/30">
                <p className="text-xs font-medium mb-2 text-muted-foreground">Você ({selectedUser.display_name})</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div><p className="text-2xl font-bold">{selectedUser.empresas}</p><p className="text-xs text-muted-foreground">Empresas</p></div>
                  <div><p className="text-2xl font-bold">{selectedUser.empresas}</p><p className="text-xs text-muted-foreground">Contratos ativos</p></div>
                  <div><p className="text-2xl font-bold">{selectedUser.implantacoes}</p><p className="text-xs text-muted-foreground">Em implantação</p></div>
                </div>
              </Card>
            )}
            {selectedUser && workload.filter((u) => u.user_id !== userId).length > 0 && (
              <Card className="p-4">
                <p className="text-sm font-semibold mb-3">Demais responsáveis do Cadastro ({workload.filter((u) => u.user_id !== userId).length})</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {workload.filter((u) => u.user_id !== userId).map((u) => {
                    const total = workload.filter((x) => x.user_id !== userId).length;
                    const cota = total > 0 ? Math.ceil(selectedUser.empresas / total) : 0;
                    return (
                      <div key={u.user_id} className="border rounded-md p-3 bg-muted/20">
                        <p className="text-sm font-medium truncate">{u.display_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">Carga atual: {u.empresas}</p>
                        <p className="text-xs text-primary mt-0.5">Receberá ~{cota} empresas</p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">Estimativa balanceada. A divisão exata é calculada na simulação (passo 2) e pode ser ajustada manualmente.</p>
              </Card>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Clique em "Simular" para gerar a distribuição automática balanceada.</p>
            <Button onClick={() => simular.mutate()} disabled={simular.isPending}>
              {simular.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Simular distribuição
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Resumo da distribuição</h3>
              <Table>
                <TableHeader><TableRow><TableHead>Responsável</TableHead><TableHead>Antes</TableHead><TableHead>Recebe</TableHead><TableHead>Depois</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow className="bg-yellow-500/10">
                    <TableCell className="font-medium">{selectedUser?.display_name} <Badge variant="outline">Férias</Badge></TableCell>
                    <TableCell>{selectedUser?.empresas}</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>0</TableCell>
                  </TableRow>
                  {resumo.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.nome}</TableCell>
                      <TableCell>{r.antes}</TableCell>
                      <TableCell className="text-primary font-semibold">+{r.recebidas}</TableCell>
                      <TableCell className="font-semibold">{r.depois}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Empresas — ajuste manual ({atribuicoes.length})</h3>
              <div className="max-h-[40vh] overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10"><TableRow><TableHead>Empresa</TableHead><TableHead>Responsável temporário</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {atribuicoes.map((a, idx) => (
                      <TableRow key={a.empresa_id}>
                        <TableCell className="text-sm">{a.empresa_nome}</TableCell>
                        <TableCell>
                          <Select
                            value={a.responsavel_temp_id}
                            onValueChange={(v) => {
                              const dest = destinosBase.find((d) => d.user_id === v);
                              setAtribuicoes((prev) => prev.map((p, i) => i === idx ? { ...p, responsavel_temp_id: v, responsavel_temp_nome: dest?.display_name ?? p.responsavel_temp_nome } : p));
                            }}
                          >
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {destinosBase.map((d) => (
                                <SelectItem key={d.user_id} value={d.user_id}>{d.display_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>}
          {step === 1 && <Button onClick={() => setStep(2)} disabled={!podeAvancar1}>Avançar <ArrowRight className="h-4 w-4 ml-2" /></Button>}
          {step === 3 && (
            <Button onClick={() => criar.mutate()} disabled={criar.isPending || atribuicoes.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
              {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Confirmar férias
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
