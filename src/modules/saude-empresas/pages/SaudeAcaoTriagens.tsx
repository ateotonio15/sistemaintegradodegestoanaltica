import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Activity, Heart, Droplets, Scale, AlertTriangle, FileSpreadsheet, FileType, Pencil, Trash2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { formatDateBR } from "@/lib/date-utils";
import { MetricCard } from "../components/MetricCard";
import { TriagemInlineForm } from "../components/TriagemInlineForm";
import { BioimpedanciaDialog } from "../components/BioimpedanciaDialog";
import { PaBadge } from "../components/PaBadge";
import { useAcao, useTriagens, useSaudeMutations, useSaudeRealtime, type Triagem } from "../hooks/useSaudeEmpresas";
import { classificarImc, corImc, corRisco, corGlicemia } from "../lib/saude-rules";
import { exportTriagensExcel, exportRelatorioPptx } from "../lib/saude-export";

const PA_ORDER = ["Ótima", "Normal", "Limítrofe", "HA Estágio 1", "HA Estágio 2", "HA Estágio 3"];
const PA_COLORS: Record<string, string> = {
  "Ótima": "#10b981",
  "Normal": "#22c55e",
  "Limítrofe": "#eab308",
  "HA Estágio 1": "#f97316",
  "HA Estágio 2": "#ef4444",
  "HA Estágio 3": "#b91c1c",
};
const IMC_ORDER = ["Baixo peso", "Normal", "Sobrepeso", "Obesidade I", "Obesidade II", "Obesidade III"];
const IMC_COLORS: Record<string, string> = {
  "Baixo peso": "#60a5fa",
  "Normal": "#22c55e",
  "Sobrepeso": "#eab308",
  "Obesidade I": "#f97316",
  "Obesidade II": "#ef4444",
  "Obesidade III": "#7f1d1d",
};

export default function SaudeAcaoTriagens() {
  useSaudeRealtime();
  const { acaoId = "" } = useParams();
  const { isAdmin, isEnfermeira } = useAuth();
  const canEdit = isAdmin || isEnfermeira;
  const [edit, setEdit] = useState<Triagem | null>(null);
  const [bioOpen, setBioOpen] = useState(false);

  const { data: acao } = useAcao(acaoId);
  const { data: triagens = [], isLoading } = useTriagens(acaoId);
  const { deleteTriagem, enviarFichaEmail } = useSaudeMutations();

  const kpis = useMemo(() => {
    const total = triagens.length;
    const has = triagens.filter((t) => t.tem_has).length;
    const dm = triagens.filter((t) => t.tem_dm).length;
    const obesos = triagens.filter((t) => (t.imc ?? 0) >= 30).length;
    const alto = triagens.filter((t) => t.risco_geral === "alto").length;
    const imcMedio = total
      ? Number((triagens.reduce((s, t) => s + (t.imc ?? 0), 0) / total).toFixed(1))
      : 0;
    return { total, has, dm, obesos, alto, imcMedio };
  }, [triagens]);

  const paData = useMemo(() => {
    const map = new Map<string, number>();
    PA_ORDER.forEach((k) => map.set(k, 0));
    triagens.forEach((t) => { if (t.classificacao_pa) map.set(t.classificacao_pa, (map.get(t.classificacao_pa) ?? 0) + 1); });
    return PA_ORDER.map((k) => ({ name: k, value: map.get(k) ?? 0 }));
  }, [triagens]);

  const imcData = useMemo(() => {
    const map = new Map<string, number>();
    IMC_ORDER.forEach((k) => map.set(k, 0));
    triagens.forEach((t) => { const c = classificarImc(t.imc); if (c) map.set(c, (map.get(c) ?? 0) + 1); });
    return IMC_ORDER.map((k) => ({ name: k, value: map.get(k) ?? 0 })).filter((d) => d.value > 0);
  }, [triagens]);

  if (!acao) {
    return <div className="p-6 text-center text-muted-foreground">Carregando ação...</div>;
  }

  const pct = (n: number) => (kpis.total ? Math.round((n / kpis.total) * 100) : 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to={`/saude-empresas/empresa/${acao.empresa_id}`}><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div>
            <div className="text-xs text-muted-foreground">
              <Link to="/saude-empresas" className="hover:underline">Saúde nas Empresas</Link> · <Link to={`/saude-empresas/empresa/${acao.empresa_id}`} className="hover:underline">{acao.empresa?.nome}</Link>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{acao.titulo || acao.tipo}</h1>
            <p className="text-sm text-muted-foreground">{formatDateBR(acao.data_acao)} · {acao.enfermeira_nome ?? "—"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportTriagensExcel(acao, triagens)}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          <Button variant="outline" onClick={() => exportRelatorioPptx(acao, triagens)}><FileType className="h-4 w-4 mr-1" />PowerPoint</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MetricCard icon={Activity} label="Triagens" value={kpis.total} />
        <MetricCard icon={Heart} label="% HAS" value={`${pct(kpis.has)}%`} tone={kpis.has > 0 ? "warning" : "default"} />
        <MetricCard icon={Droplets} label="% DM" value={`${pct(kpis.dm)}%`} tone={kpis.dm > 0 ? "warning" : "default"} />
        <MetricCard icon={Scale} label="% Obesidade" value={`${pct(kpis.obesos)}%`} tone={kpis.obesos > 0 ? "warning" : "default"} />
        <MetricCard icon={AlertTriangle} label="% Risco alto" value={`${pct(kpis.alto)}%`} tone={kpis.alto > 0 ? "danger" : "success"} />
        <MetricCard label="IMC médio" value={kpis.imcMedio || "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Distribuição de Pressão Arterial</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={paData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {paData.map((d) => <Cell key={d.name} fill={PA_COLORS[d.name]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Distribuição de IMC</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={imcData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {imcData.map((d) => <Cell key={d.name} fill={IMC_COLORS[d.name]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {canEdit && <TriagemInlineForm acaoId={acao.id} empresaId={acao.empresa_id} />}

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
                  <TableHead>Colaborador</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>IMC</TableHead>
                  <TableHead>PA</TableHead>
                  <TableHead>Glicemia</TableHead>
                  <TableHead>Risco</TableHead>
                  {canEdit && <TableHead className="w-32" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {triagens.map((t) => {
                  const imcCat = classificarImc(t.imc);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell>{t.cpf ?? "—"}</TableCell>
                      <TableCell>{t.imc ? <Badge variant="outline" className={corImc(imcCat)}>{t.imc} · {imcCat}</Badge> : "—"}</TableCell>
                      <TableCell><PaBadge pas={t.pas_mmhg} pad={t.pad_mmhg} /></TableCell>
                      <TableCell>{t.classificacao_glicemia ? <Badge variant="outline" className={corGlicemia(t.classificacao_glicemia as any)}>{t.glicemia_mg_dl} · {t.classificacao_glicemia}{t.jejum ? " (jejum)" : ""}</Badge> : "—"}</TableCell>
                      <TableCell>{t.risco_geral ? <Badge className={corRisco(t.risco_geral)}>{t.risco_geral}</Badge> : "—"}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            {t.email && (
                              <Button size="icon" variant="ghost" title="Enviar ficha por e-mail" onClick={() => enviarFichaEmail.mutate(t.id)}>
                                <Mail className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => { setEdit(t); setBioOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover triagem?")) deleteTriagem.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
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

      <BioimpedanciaDialog open={bioOpen} onOpenChange={(v) => { setBioOpen(v); if (!v) setEdit(null); }} editing={edit} triagemBase={null} />
    </div>
  );
}
