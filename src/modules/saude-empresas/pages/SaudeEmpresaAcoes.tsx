import { useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Plus, Building2, Pencil, Trash2, ArrowLeft, CalendarDays, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDateBR } from "@/lib/date-utils";
import { NovaAcaoDialog } from "../components/NovaAcaoDialog";
import { useAcoesEmpresa, useSaudeMutations, useSaudeRealtime, type AcaoSaude } from "../hooks/useSaudeEmpresas";

const sb = supabase as any;

const tipoLabel: Record<string, string> = {
  triagem: "Triagem", palestra: "Palestra", preventiva: "Preventiva", bioimpedancia: "Bioimpedância", outro: "Outro",
};
const statusColor: Record<string, string> = {
  agendada: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  em_andamento: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  concluida: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelada: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export default function SaudeEmpresaAcoes() {
  useSaudeRealtime();
  const { empresaId = "" } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isEnfermeira } = useAuth();
  const canEdit = isAdmin || isEnfermeira;
  const [dlg, setDlg] = useState(false);
  const [edit, setEdit] = useState<AcaoSaude | null>(null);

  const { data: empresa } = useQuery({
    queryKey: ["empresa_basic", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await sb.from("empresas").select("id,nome,codigo_contrato,cnpj").eq("id", empresaId).maybeSingle();
      return data;
    },
  });

  const { data: acoes = [], isLoading } = useAcoesEmpresa(empresaId);
  const { deleteAcao } = useSaudeMutations();

  const kpis = useMemo(() => {
    const ano = new Date().getFullYear();
    const doAno = acoes.filter((a) => a.data_acao.startsWith(String(ano)));
    return { ano: doAno.length, triagens: doAno.reduce((s, a) => s + (a.total_atendidos ?? 0), 0) };
  }, [acoes]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/saude-empresas"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{empresa?.nome ?? "Empresa"}</h1>
            <p className="text-sm text-muted-foreground">Contrato {empresa?.codigo_contrato ?? "—"}</p>
          </div>
        </div>
        {canEdit && <Button onClick={() => { setEdit(null); setDlg(true); }}><Plus className="h-4 w-4 mr-1" />Nova ação</Button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2 flex-row items-center justify-between"><CardTitle className="text-xs text-muted-foreground">Ações no ano</CardTitle><CalendarDays className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-3xl font-semibold">{kpis.ano}</div></CardContent></Card>
        <Card><CardHeader className="pb-2 flex-row items-center justify-between"><CardTitle className="text-xs text-muted-foreground">Triagens no ano</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-3xl font-semibold">{kpis.triagens}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total histórico</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{acoes.length}</div></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : acoes.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma ação registrada</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {acoes.map((a) => (
            <Card key={a.id} className="hover:border-primary/40 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{a.titulo || tipoLabel[a.tipo]}</CardTitle>
                  <Badge className={statusColor[a.status]}>{a.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{formatDateBR(a.data_acao)} {a.hora_inicio ? `· ${a.hora_inicio.slice(0,5)}` : ""}</p>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">{tipoLabel[a.tipo]} · {a.enfermeira_nome ?? "—"}</div>
                <div className="text-2xl font-semibold mt-2">{a.total_atendidos} atendidos</div>
                <div className="flex items-center justify-between mt-3">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/saude-empresas/acao/${a.id}`)}>Abrir triagens</Button>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEdit(a); setDlg(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover esta ação e TODAS as triagens?")) deleteAcao.mutate(a.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NovaAcaoDialog open={dlg} onOpenChange={setDlg} acao={edit} empresaIdLock={empresaId} onSaved={(id) => navigate(`/saude-empresas/acao/${id}`)} />
    </div>
  );
}
