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

const PA_ORDER = ["Ótima", "Normal", "PA Elevada", "Hipertensão Estágio 1", "Hipertensão Estágio 2", "Hipertensão Estágio 3", "Não realizado"] as const;
const PA_COLORS: Record<string, string> = {
  "Ótima": "hsl(142 76% 36%)",
  "Normal": "hsl(142 71% 45%)",
  "PA Elevada": "hsl(48 96% 53%)",
  "Hipertensão Estágio 1": "hsl(25 95% 53%)",
  "Hipertensão Estágio 2": "hsl(0 84% 60%)",
  "Hipertensão Estágio 3": "hsl(0 74% 42%)",
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
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await queryClient.invalidateQueries(); } finally { setRefreshing(false); }
  };
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

  const kpiTiles = [
    { label: "Total triagens", value: kpis.total, icon: Users, tone: "neutral" as const, show: true },
    { label: "PA Normal", value: `${kpis.paNormalPct}%`, icon: HeartPulse, tone: "success" as const, show: temPa },
    { label: "PA Alterada", value: `${kpis.paAltPct}%`, icon: AlertTriangle, tone: kpis.paAltPct > 0 ? ("danger" as const) : ("neutral" as const), show: temPa },
    { label: "Glicemia Normal", value: `${kpis.giNormalPct}%`, icon: Droplets, tone: "success" as const, show: temGli },
    { label: "Glicemia Alterada", value: `${kpis.giAltPct}%`, icon: AlertTriangle, tone: kpis.giAltPct > 0 ? ("danger" as const) : ("neutral" as const), show: temGli },
    { label: "Bioimpedâncias", value: kpis.bioCount, icon: Scale, tone: "neutral" as const, show: temBio },
  ].filter((k) => k.show);

  const toneText = (t: string) =>
    t === "success" ? "text-primary" : t === "danger" ? "text-destructive" : "text-foreground";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-6 space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 md:p-6">
        <div className="absolute top-0 right-0 h-40 w-40 -mr-16 -mt-16 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild className="mt-1">
              <Link to={`/saude-empresas/empresa/${acao.empresa_id}`}><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-1">
                Saúde nas Empresas · Triagens
              </p>
              <div className="text-xs text-muted-foreground mb-1">
                <Link to="/saude-empresas" className="hover:underline">Saúde nas Empresas</Link> ·{" "}
                <Link to={`/saude-empresas/empresa/${acao.empresa_id}`} className="hover:underline">
                  {acao.empresa?.nome}
                </Link>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight break-words">
                {acao.empresa?.nome} — {formatDateBR(acao.data_acao)}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {temPa && <Badge variant="secondary">Pressão Arterial</Badge>}
                {temGli && <Badge variant="secondary">Glicemia</Badge>}
                {temBio && <Badge variant="secondary">Bioimpedância</Badge>}
                <span className="text-xs text-muted-foreground">· {triagens.length} triagem(ns)</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportTriagensExcel(acao, triagens)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
            </Button>
            <Button size="sm" onClick={() => exportRelatorioPptx(acao, triagens)}>
              <FileType className="h-4 w-4 mr-1" />PowerPoint
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiTiles.map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="absolute top-0 right-0 h-24 w-24 -mr-12 -mt-12 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
            <div className="relative flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-primary/70" />
            </div>
            <h3 className={`relative mt-2 text-2xl md:text-3xl font-bold tracking-tight ${toneText(tone)}`}>{value}</h3>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      {(temPa || temGli) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {temPa && (
            <section className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 md:px-6 py-3 border-b border-border flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-primary" />
                <h2 className="text-xs md:text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pressão Arterial</h2>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={paData} margin={{ bottom: 20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} interval={0} />
                    <YAxis allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {paData.map((d) => <Cell key={d.name} fill={PA_COLORS[d.name]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
          {temGli && (
            <section className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 md:px-6 py-3 border-b border-border flex items-center gap-2">
                <Droplets className="h-4 w-4 text-primary" />
                <h2 className="text-xs md:text-sm font-semibold uppercase tracking-wider text-muted-foreground">Glicemia</h2>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={gliData} margin={{ bottom: 20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} interval={0} />
                    <YAxis allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {gliData.map((d) => <Cell key={d.name} fill={GLI_COLORS[d.name]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
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
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 md:px-6 py-3 border-b border-border flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-xs md:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Triagens registradas ({triagens.length})
          </h2>
        </div>
        <div className="p-0 overflow-x-auto">
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
        </div>
      </section>


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
    </div>

  );
}
