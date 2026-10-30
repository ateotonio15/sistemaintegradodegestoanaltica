import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Plus, Pencil, Trash2, Search, Car, BarChart3, Tags } from "lucide-react";
import { useUberPassageiros, useDeletePassageiro } from "@/hooks/useUberPassageiros";
import { PassageiroDialog } from "@/components/uber/PassageiroDialog";
import { FuncoesDialog } from "@/components/uber/FuncoesDialog";
import { useUberFuncoes } from "@/hooks/useUberFuncoes";
import { resumoCorridaPadrao, type UberPassageiro } from "@/lib/uber-passageiros";
import { useAuth } from "@/hooks/useAuth";

export default function UberPassageiros() {
  const { user, isViewOnly, isVendas } = useAuth();
  const canManage = !!user && !isViewOnly && !isVendas;
  const { data: passageiros = [], isLoading } = useUberPassageiros();
  const del = useDeletePassageiro();
  const { data: funcoes = [] } = useUberFuncoes();
  const nomeFuncao = useMemo(() => new Map(funcoes.map((f) => [f.id, f.nome])), [funcoes]);
  const [funcoesOpen, setFuncoesOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [edit, setEdit] = useState<UberPassageiro | null>(null);
  const [toDel, setToDel] = useState<UberPassageiro | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return passageiros;
    return passageiros.filter((p) =>
      `${p.nome} ${p.setor} ${p.funcao_id ? nomeFuncao.get(p.funcao_id) ?? "" : ""} ${p.whatsapp}`.toLowerCase().includes(q),
    );
  }, [passageiros, search, nomeFuncao]);

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Passageiros Uber</h1>
            <p className="text-sm text-muted-foreground">Cadastro de passageiros, setor, endereço e WhatsApp</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/uber"><Car className="h-4 w-4 mr-1" />Corridas</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/uber/dashboard"><BarChart3 className="h-4 w-4 mr-1" />Dashboard</Link>
          </Button>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setFuncoesOpen(true)}>
              <Tags className="h-4 w-4 mr-1" />Funções
            </Button>
          )}
          {canManage && (
            <Button size="sm" onClick={() => { setEdit(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />Novo passageiro
            </Button>
          )}
        </div>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome, setor, função ou WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Setor e função</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Corrida padrão</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="w-[100px]">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={canManage ? 7 : 6} className="text-center text-muted-foreground py-8">
                  Carregando passageiros...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 7 : 6} className="text-center text-muted-foreground py-8">
                  {search
                    ? "Nenhum passageiro encontrado para esta busca."
                    : "Nenhum passageiro cadastrado ainda. Clique em \"Novo passageiro\" para começar."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>
                  <div>{p.setor}</div>
                  {p.funcao_id && nomeFuncao.get(p.funcao_id) && (
                    <div className="text-xs text-muted-foreground">{nomeFuncao.get(p.funcao_id)}</div>
                  )}
                </TableCell>
                <TableCell className="max-w-[260px] truncate" title={p.endereco}>{p.endereco}</TableCell>
                <TableCell>{p.whatsapp}</TableCell>
                <TableCell>{resumoCorridaPadrao(p)}</TableCell>
                <TableCell>
                  <Badge variant={p.ativo ? "default" : "secondary"}>
                    {p.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${p.nome}`}
                        onClick={() => { setEdit(p); setDialogOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir ${p.nome}`}
                        onClick={() => setToDel(p)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <FuncoesDialog open={funcoesOpen} onOpenChange={setFuncoesOpen} />
      <PassageiroDialog open={dialogOpen} onOpenChange={setDialogOpen} passageiro={edit} />

      <AlertDialog open={!!toDel} onOpenChange={(v) => { if (!v) setToDel(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir passageiro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{toDel?.nome}</strong>?
              As corridas já registradas para este passageiro serão mantidas e não serão alteradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (toDel) del.mutate(toDel.id); setToDel(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
