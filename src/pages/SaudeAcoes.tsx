import { useMemo, useState } from "react";
import { Plus, Stethoscope, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AcaoDialog } from "@/components/saude/AcaoDialog";
import { useSaudeAcoes, useSaudeMutations, useSaudeRealtime, type SaudeAcao } from "@/hooks/useSaude";
import { useAuth } from "@/hooks/useAuth";
import { formatDateBR } from "@/lib/date-utils";

function imcLabel(imc: number | null) {
  if (!imc) return null;
  if (imc < 18.5) return { label: "Abaixo", cls: "bg-blue-500/15 text-blue-600" };
  if (imc < 25) return { label: "Normal", cls: "bg-green-500/15 text-green-600" };
  if (imc < 30) return { label: "Sobrepeso", cls: "bg-yellow-500/15 text-yellow-600" };
  return { label: "Obesidade", cls: "bg-red-500/15 text-red-600" };
}

export default function SaudeAcoes() {
  useSaudeRealtime();
  const { isAdmin, isEnfermeira } = useAuth();
  const canEdit = isAdmin || isEnfermeira;
  const [dlg, setDlg] = useState(false);
  const [edit, setEdit] = useState<SaudeAcao | null>(null);
  const [search, setSearch] = useState("");
  const { data: acoes = [], isLoading } = useSaudeAcoes();
  const { deleteAcao } = useSaudeMutations();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return acoes;
    return acoes.filter(
      (a) =>
        a.colaborador_nome.toLowerCase().includes(q) ||
        (a.empresa?.nome ?? "").toLowerCase().includes(q) ||
        (a.cpf ?? "").includes(q),
    );
  }, [acoes, search]);

  const kpis = useMemo(() => {
    const total = acoes.length;
    const empresas = new Set(acoes.map((a) => a.empresa_id)).size;
    const sobrepeso = acoes.filter((a) => (a.imc ?? 0) >= 25).length;
    return { total, empresas, sobrepeso };
  }, [acoes]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ações Saúde nas Empresas</h1>
            <p className="text-sm text-muted-foreground">Triagens, PA, IMC e fichas biométricas</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => { setEdit(null); setDlg(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova Ficha
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total de fichas</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{kpis.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Empresas atendidas</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{kpis.empresas}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Com sobrepeso/obesidade</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold text-yellow-600">{kpis.sobrepeso}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>Fichas registradas</CardTitle>
          <div className="relative w-72">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar colaborador, empresa, CPF..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhuma ficha encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>PA</TableHead>
                    <TableHead>IMC</TableHead>
                    <TableHead>Glic.</TableHead>
                    <TableHead>FC</TableHead>
                    <TableHead>SatO₂</TableHead>
                    {canEdit && <TableHead className="w-24" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const imc = imcLabel(a.imc);
                    return (
                      <TableRow key={a.id}>
                        <TableCell>{formatDateBR(a.data)}</TableCell>
                        <TableCell className="font-medium">{a.colaborador_nome}</TableCell>
                        <TableCell>{a.empresa?.nome}</TableCell>
                        <TableCell>{a.pressao_arterial ?? "—"}</TableCell>
                        <TableCell>
                          {a.imc ? (
                            <div className="flex items-center gap-2">
                              <span>{a.imc}</span>
                              {imc && <Badge className={imc.cls}>{imc.label}</Badge>}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{a.glicemia ?? "—"}</TableCell>
                        <TableCell>{a.frequencia_cardiaca ?? "—"}</TableCell>
                        <TableCell>{a.saturacao ? `${a.saturacao}%` : "—"}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => { setEdit(a); setDlg(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => {
                                if (confirm("Remover esta ficha?")) deleteAcao.mutate(a.id);
                              }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AcaoDialog open={dlg} onOpenChange={setDlg} acao={edit} />
    </div>
  );
}
