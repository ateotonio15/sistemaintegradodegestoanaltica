import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Users, HeartPulse, Droplets, Scale, AlertTriangle, FileSpreadsheet, FileType, Pencil, Trash2, Mail, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { formatDateBR } from "@/lib/date-utils";
import { MetricCard } from "../components/MetricCard";
import { TriagemInlineForm } from "../components/TriagemInlineForm";
import { BioimpedanciaDialog } from "../components/BioimpedanciaDialog";
import { PaBadge } from "../components/PaBadge";
import { useAcao, useTriagens, useSaudeMutations, useSaudeRealtime, type Triagem } from "../hooks/useSaudeEmpresas";
import { classificarPa, classificarGlicemia, corGlicemia, PA_ALTERADAS } from "../lib/saude-rules";
import { exportTriagensExcel, exportRelatorioPptx } from "../lib/saude-export";

const PA_ORDER = ["Normal", "Pré-Hipertensão", "HA Estágio 1", "HA Estágio 2", "HA Estágio 3", "Não realizado"] as const;
const PA_COLORS: Record<string, string> = {
  "Normal": "hsl(142 71% 45%)",
  "Pré-Hipertensão": "hsl(48 96% 53%)",
  "HA Estágio 1": "hsl(25 95% 53%)",
  "HA Estágio 2": "hsl(0 84% 60%)",
  "HA Estágio 3": "hsl(0 74% 42%)",
  "Não realizado": "hsl(215 16% 65%)",
};
const GLI_ORDER = ["Normal", "Pré-Diabetes", "Alterada pós-prandial", "Diabetes", "Não realizado"] as const;
const GLI_COLORS: Record<string, string> = {
  "Normal": "hsl(142 71% 45%)",
  "Pré-Diabetes": "hsl(48 96% 53%)",
  "Alterada pós-prandial": "hsl(25 95% 53%)",
  "Diabetes": "hsl(0 84% 60%)",
  "Não realizado": "hsl(215 16% 65%)",
};

export default function SaudeAcaoTriagens() {
  useSaudeRealtime();
  const { acaoId = "" } = useParams();
  const { isAdmin, isEnfermeira, isDiretora } = useAuth();
  const canEdit = isAdmin || isEnfermeira;
  const isReadOnly = isDiretora && !isAdmin;
  const [edit, setEdit] = useState<Triagem | null>(null);
  const [bioOpen, setBioOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Triagem | null>(null);

  const { data: acao } = useAcao(acaoId);
  const { data: triagens = [], isLoading } = useTriagens(acaoId);
  const { deleteTriagem, enviarFichaEmail } = useSaudeMutations();

  const temPa = acao?.tem_pa ?? true;
  const temGli = acao?.tem_glicemia ?? true;
  const temBio = acao?.tem_bioimpedancia ?? false;

  const kpis = useMemo(() => {
    const total = triagens.length;
    let paNormal = 0, paAlt = 0, giNormal = 0, giAlt = 0, bioCount = 0;
    let paMedidos = 0, giMedidos = 0;
    triagens.forEach((t) => {
      const pa = classificarPa(t.pas_mmhg, t.pad_mmhg);
      if (pa !== "Não realizado") {
        paMedidos++;
        if (pa === "Normal") paNormal++;
        if (PA_ALTERADAS.includes(pa)) paAlt++;
      }
      const gli = classificarGlicemia(t.glicemia_mg_dl, t.jejum);
      if (gli) {
        giMedidos++;
        if (gli === "Normal") giNormal++;
        else giAlt++;
      }
      if (t.tem_bio) bioCount++;
    });
    const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
    return {
      total,
      paNormalPct: pct(paNormal, paMedidos),
      paAltPct: pct(paAlt, paMedidos),
      giNormalPct: pct(giNormal, giMedidos),
      giAltPct: pct(giAlt, giMedidos),
      bioCount,
    };
  }, [triagens]);

  const paData = useMemo(() => {
    const map = new Map<string, number>();
    PA_ORDER.forEach((k) => map.set(k, 0));
    triagens.forEach((t) => {
      const pa = classificarPa(t.pas_mmhg, t.pad_mmhg);
      map.set(pa, (map.get(pa) ?? 0) + 1);
    });
    return PA_ORDER.map((k) => ({ name: k, value: map.get(k) ?? 0 }));
  }, [triagens]);

  const gliData = useMemo(() => {
    const map = new Map<string, number>();
    GLI_ORDER.forEach((k) => map.set(k, 0));
    triagens.forEach((t) => {
      const gli = classificarGlicemia(t.glicemia_mg_dl, t.jejum);
      const k = gli ?? "Não realizado";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return GLI_ORDER.map((k) => ({ name: k, value: map.get(k) ?? 0 }));
  }, [triagens]);

  if (!acao) {
    return <div className="p-6 text-center text-muted-foreground">Carregando ação...</div>;
  }

  const editRow = (t: Triagem) => { setEdit(t); setBioOpen(true); };

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/saude-empresas/empresa/${acao.empresa_id}`}><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="text-xs text-muted-foreground">
              <Link to="/saude-empresas" className="hover:underline">Saúde nas Empresas</Link> ·{" "}
              <Link to={`/saude-empresas/empresa/${acao.empresa_id}`} className="hover:underline">
                {acao.empresa?.nome}
              </Link>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {acao.empresa?.nome} — {formatDateBR(acao.data_acao)}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {temPa && <Badge variant="secondary">Pressão Arterial</Badge>}
              {temGli && <Badge variant="secondary">Glicemia</Badge>}
              {temBio && <Badge variant="secondary">Bioimpedância</Badge>}
              <span className="text-xs text-muted-foreground">· {triagens.length} triagem(ns)</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportTriagensExcel(acao, triagens)}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
          </Button>
          <Button variant="outline" onClick={() => exportRelatorioPptx(acao, triagens)}>
            <FileType className="h-4 w-4 mr-1" />PowerPoint
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard icon={Users} label="Total triagens" value={kpis.total} />
        {temPa && <MetricCard icon={HeartPulse} label="PA Normal" value={`${kpis.paNormalPct}%`} tone="success" />}
        {temPa && <MetricCard icon={AlertTriangle} label="PA Alterada" value={`${kpis.paAltPct}%`} tone={kpis.paAltPct > 0 ? "danger" : "default"} />}
        {temGli && <MetricCard icon={Droplets} label="Glicemia Normal" value={`${kpis.giNormalPct}%`} tone="success" />}
        {temGli && <MetricCard icon={AlertTriangle} label="Glicemia Alterada" value={`${kpis.giAltPct}%`} tone={kpis.giAltPct > 0 ? "danger" : "default"} />}
        {temBio && <MetricCard icon={Scale} label="Bioimpedâncias" value={kpis.bioCount} />}
      </div>

      {/* Gráficos */}
      {(temPa || temGli) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {temPa && (
            <Card>
              <CardHeader><CardTitle>Pressão Arterial</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={paData} margin={{ bottom: 20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} interval={0} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {paData.map((d) => <Cell key={d.name} fill={PA_COLORS[d.name]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {temGli && (
            <Card>
              <CardHeader><CardTitle>Glicemia</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={gliData} margin={{ bottom: 20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} interval={0} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {gliData.map((d) => <Cell key={d.name} fill={GLI_COLORS[d.name]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Formulário inline */}
      {canEdit && !isReadOnly && (
        <TriagemInlineForm
          acaoId={acao.id}
          empresaId={acao.empresa_id}
          temPa={temPa}
          temGlicemia={temGli}
          temBio={temBio}
        />
      )}

      {/* Tabela */}
      <Card>
        <CardHeader><CardTitle>Triagens registradas ({triagens.length})</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : triagens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma triagem registrada</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  {temPa && <TableHead>PA</TableHead>}
                  {temGli && <TableHead>Glicemia</TableHead>}
                  {temBio && <TableHead>Bio</TableHead>}
                  {canEdit && !isReadOnly && <TableHead className="w-32 text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {triagens.map((t, i) => {
                  const gliCat = classificarGlicemia(t.glicemia_mg_dl, t.jejum);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell className="tabular-nums">{t.cpf ?? "—"}</TableCell>
                      {temPa && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {t.pas_mmhg && t.pad_mmhg ? (
                              <>
                                <span className="tabular-nums text-sm">{t.pas_mmhg}/{t.pad_mmhg}</span>
                                <PaBadge pas={t.pas_mmhg} pad={t.pad_mmhg} />
                              </>
                            ) : <span className="text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                      )}
                      {temGli && (
                        <TableCell>
                          {gliCat ? (
                            <Badge variant="outline" className={corGlicemia(gliCat)}>
                              {t.glicemia_mg_dl} · {gliCat}{t.jejum ? " (jejum)" : ""}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                      )}
                      {temBio && (
                        <TableCell>
                          {t.tem_bio ? (
                            <Button size="icon" variant="ghost" title="Ver ficha bio" onClick={() => editRow(t)}>
                              <Scale className="h-4 w-4 text-primary" />
                            </Button>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                      )}
                      {canEdit && !isReadOnly && (
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            {t.email && (
                              <Button size="icon" variant="ghost" title="Enviar ficha por e-mail" onClick={() => enviarFichaEmail.mutate(t.id)}>
                                <Mail className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => editRow(t)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setToDelete(t)}>
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
          )}
        </CardContent>
      </Card>

      <BioimpedanciaDialog
        open={bioOpen}
        onOpenChange={(v) => { setBioOpen(v); if (!v) setEdit(null); }}
        editing={edit}
        triagemBase={null}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir triagem?</AlertDialogTitle>
            <AlertDialogDescription>
              A triagem de <strong>{toDelete?.nome}</strong> será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (toDelete) deleteTriagem.mutate(toDelete.id); setToDelete(null); }}
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
