import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { parseObservacaoPlantao } from "@/lib/plantoes-observacao";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlantaoEmpresas, usePlantoesRealtime } from "@/hooks/usePlantoes";

export default function PlantoesRelatorios() {
  usePlantoesRealtime();
  const { user, loading: authLoading } = useAuth();
  const { data: empresas = [] } = usePlantaoEmpresas();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [empresaId, setEmpresaId] = useState<string>("all");

  const { data: rows = [] } = useQuery({
    queryKey: ["plantoes-rel", from, to, empresaId],
    enabled: !authLoading && !!user,
    queryFn: async () => {
      let q = supabase
        .from("plantoes_atendimentos")
        .select("*, plantao:plantoes!inner(id, data, turno, plantonista, empresa_id, empresa:plantoes_empresas(nome))")
        .gte("plantao.data", from)
        .lte("plantao.data", to)
        .order("created_at", { ascending: false });
      if (empresaId !== "all") q = q.eq("plantao.empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const kpis = useMemo(() => ({
    total: rows.length,
    resolvidos: rows.filter((r: any) => r.resolvido).length,
    abertos: rows.filter((r: any) => !r.resolvido).length,
  }), [rows]);

  const linhas = useMemo(
    () =>
      rows.map((r: any) => {
        const { matricula, observacao } = parseObservacaoPlantao(r.observacao);
        return { ...r, matricula, observacaoLimpa: observacao };
      }),
    [rows],
  );

  const exportar = () => {
    const data = linhas.map((r: any) => ({
      Data: r.plantao?.data,
      Empresa: r.plantao?.empresa?.nome,
      Turno: r.plantao?.turno,
      Plantonista: r.plantao?.plantonista,
      Hora: r.hora,
      Cliente: r.nome_cliente,
      CPF: r.cpf,
      Matrícula: r.matricula || "—",
      Assunto: r.assunto,
      Resolvido: r.resolvido ? "Sim" : "Não",
      Observação: r.observacaoLimpa,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Atendimentos");
    XLSX.writeFile(wb, `plantoes-${from}-a-${to}.xlsx`);
  };

  const exportarPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const fmt = (d?: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");
    doc.setFontSize(14);
    doc.text("Relatório de Atendimentos - Plantões", 40, 40);
    doc.setFontSize(10);
    doc.text(`Período: ${fmt(from)} a ${fmt(to)}  ·  Total: ${kpis.total}  ·  Resolvidos: ${kpis.resolvidos}  ·  Em aberto: ${kpis.abertos}`, 40, 58);
    autoTable(doc, {
      startY: 74,
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      columnStyles: {
        7: { fontStyle: "bold" },
      },
      head: [[
        "Data", "Empresa", "Turno", "Plantonista", "Hora", "Cliente", "CPF", "Matrícula", "Assunto", "Resolvido", "Observação",
      ]],
      body: linhas.map((r: any) => [
        fmt(r.plantao?.data),
        r.plantao?.empresa?.nome ?? "—",
        r.plantao?.turno ?? "—",
        r.plantao?.plantonista ?? "—",
        r.hora ?? "—",
        r.nome_cliente ?? "—",
        r.cpf ?? "—",
        r.matricula || "—",
        r.assunto ?? "—",
        r.resolvido ? "Sim" : "Não",
        r.observacaoLimpa || "—",
      ]),
    });
    doc.save(`plantoes-${from}-a-${to}.pdf`);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link to="/plantoes"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>
        <h1 className="text-xl font-bold">Relatório de Atendimentos</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportarPdf()}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
          <Button onClick={exportar}><Download className="h-4 w-4 mr-1" /> Exportar</Button>
        </div>
      </div>

      <Card><CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label>Empresa</Label>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{kpis.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Resolvidos</div><div className="text-2xl font-bold text-emerald-600">{kpis.resolvidos}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Em aberto</div><div className="text-2xl font-bold text-destructive">{kpis.abertos}</div></CardContent></Card>
      </div>

      <Card><CardContent className="p-0">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="text-left p-2">Data</th>
                <th className="text-left p-2">Empresa</th>
                <th className="text-left p-2">Hora</th>
                <th className="text-left p-2">Cliente</th>
                <th className="text-left p-2">Assunto</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.plantao?.data && new Date(r.plantao.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className="p-2">{r.plantao?.empresa?.nome}</td>
                  <td className="p-2 font-mono text-xs">{r.hora ?? "—"}</td>
                  <td className="p-2">{r.nome_cliente}</td>
                  <td className="p-2">{r.assunto ?? "—"}</td>
                  <td className="p-2">{r.resolvido ? "Resolvido" : "Em aberto"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem dados.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}
