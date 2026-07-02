import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Gift, Pencil, Plus, Search, Trash2, ExternalLink } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MailingBrindeDialog, type MailingBrinde } from "@/components/mailing/MailingBrindeDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_META: Record<
  MailingBrinde["status"],
  { label: string; className: string }
> = {
  pendente: { label: "Pendente", className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30" },
  enviado: { label: "Enviado", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" },
  entregue: { label: "Entregue", className: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" },
  devolvido: { label: "Devolvido", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" },
};

export default function MailingBrindes() {
  const { isAdmin, isExecutivo, isComum, isExecutivoExterno } = useAuth();
  const canEdit = isAdmin || isExecutivo || isComum || isExecutivoExterno;

  const [rows, setRows] = useState<MailingBrinde[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [execFilter, setExecFilter] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MailingBrinde | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("mailing_brindes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar mailing", { description: error.message });
    } else {
      setRows((data ?? []) as MailingBrinde[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "todos" && r.status !== statusFilter) return false;
      if (tipoFilter !== "todos" && (r.tipo_cesta ?? "") !== tipoFilter) return false;
      if (execFilter !== "todos" && (r.executiva ?? "") !== execFilter) return false;
      if (!q) return true;
      return [r.empresa_nome, r.contato_nome, r.cidade, r.rastreio_codigo, r.email, r.executiva]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter, tipoFilter, execFilter]);

  const counts = useMemo(() => {
    const base = tipoFilter === "todos" ? rows : rows.filter((r) => (r.tipo_cesta ?? "") === tipoFilter);
    const c = { total: base.length, pendente: 0, enviado: 0, entregue: 0, devolvido: 0 };
    base.forEach((r) => { c[r.status]++; });
    return c;
  }, [rows, tipoFilter]);

  const tipoCounts = useMemo(() => {
    const c = { A: 0, B: 0, C: 0 };
    rows.forEach((r) => {
      if (r.tipo_cesta === "A") c.A++;
      else if (r.tipo_cesta === "B") c.B++;
      else if (r.tipo_cesta === "C") c.C++;
    });
    return c;
  }, [rows]);

  const executivas = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.executiva && set.add(r.executiva));
    return Array.from(set).sort();
  }, [rows]);

  const handleNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (item: MailingBrinde) => {
    setEditing(item);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("mailing_brindes").delete().eq("id", deleteId);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
    } else {
      toast.success("Registro excluído");
      setRows((prev) => prev.filter((r) => r.id !== deleteId));
    }
    setDeleteId(null);
  };

  const trackingUrl = (code: string) =>
    `https://www.linkcorreios.com.br/?id=${encodeURIComponent(code)}`;

  return (
    <div className="px-4 py-6 md:py-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-1 mb-6">
        <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2 w-fit">
          <Link to="/"><ArrowLeft className="h-4 w-4" />Voltar</Link>
        </Button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/15">
              <Gift className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Mailing de Brindes</h1>
              <p className="text-sm text-muted-foreground">
                Acompanhe entregas por tipo de cesta
              </p>
            </div>
          </div>
          {canEdit && (
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" />Novo contato
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tipoFilter} onValueChange={setTipoFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="todos">Todas <span className="ml-1.5 text-xs text-muted-foreground">({rows.length})</span></TabsTrigger>
          <TabsTrigger value="A">Cesta Tipo A <span className="ml-1.5 text-xs text-muted-foreground">({tipoCounts.A})</span></TabsTrigger>
          <TabsTrigger value="B">Cesta Tipo B <span className="ml-1.5 text-xs text-muted-foreground">({tipoCounts.B})</span></TabsTrigger>
          <TabsTrigger value="C">Cesta Tipo C <span className="ml-1.5 text-xs text-muted-foreground">({tipoCounts.C})</span></TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total", value: counts.total, color: "text-foreground" },
          { label: "Pendente", value: counts.pendente, color: "text-yellow-600 dark:text-yellow-400" },
          { label: "Enviado", value: counts.enviado, color: "text-blue-600 dark:text-blue-400" },
          { label: "Entregue", value: counts.entregue, color: "text-green-600 dark:text-green-400" },
          { label: "Devolvido", value: counts.devolvido, color: "text-red-600 dark:text-red-400" },
        ].map((k) => (
          <Card key={k.label} className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</div>
            <div className={`text-2xl font-semibold mt-1 ${k.color}`}>{k.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa, contato, cidade, rastreio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={execFilter} onValueChange={setExecFilter}>
            <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Executiva" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas executivas</SelectItem>
              {executivas.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
              <SelectItem value="devolvido">Devolvido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Cesta</TableHead>
                <TableHead>Executiva</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rastreio</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <div>{r.empresa_nome}</div>
                        {r.endereco && (
                          <div className="text-xs text-muted-foreground">{r.endereco}</div>
                        )}
                        {(r.cidade || r.uf) && (
                          <div className="text-xs text-muted-foreground">
                            {r.cidade}{r.uf ? "/" + r.uf : ""}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>{r.contato_nome || "—"}</div>
                        {r.cargo && <div className="text-xs text-muted-foreground">{r.cargo}</div>}
                      </TableCell>
                      <TableCell>
                        {r.tipo_cesta ? (
                          <Badge variant="outline" className="font-mono">{r.tipo_cesta}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{r.executiva || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.rastreio_codigo ? (
                          <a
                            href={trackingUrl(r.rastreio_codigo)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            {r.rastreio_codigo}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {r.transportadora && (
                          <div className="text-xs text-muted-foreground">{r.transportadora}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit && (
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(r)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteId(r.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <MailingBrindeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={load}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
