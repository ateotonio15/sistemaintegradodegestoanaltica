import { useMemo, useRef, useState } from "react";
import { Building2, Users, TrendingUp, Calendar, QrCode, Copy, Download, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPublicBaseUrl } from "@/lib/public-url";
import { useEmpresasCarteira } from "../context/EmpresasContext";
import { StatCard } from "../components/StatCard";
import { SemaforoBadge } from "../components/SemaforoBadge";
import { diasAteReajuste, classificarProximidadeReajuste, proximoAniversario } from "../lib/risco";
import { GrupoTamanho } from "../data/mockData";
import { cn } from "@/lib/utils";

const db = supabase as any;

type SortKey = "nome" | "contrato" | "vigencia" | "vidas" | "mes" | "valor" | "dias";

export default function Carteira() {
  const { ativas } = useEmpresasCarteira();
  const [grupo, setGrupo] = useState<"todos" | GrupoTamanho>("todos");
  const [busca, setBusca] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [asc, setAsc] = useState(true);

  // QR Code da avaliação RH por empresa
  const qc = useQueryClient();
  const mesAtual = new Date().toISOString().slice(0, 7);
  const [qrModal, setQrModal] = useState<{ open: boolean; empresa: any | null; envio: any | null }>({ open: false, empresa: null, envio: null });
  const [gerandoQr, setGerandoQr] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  const { data: enviosAvaliacao } = useQuery({
    queryKey: ["avaliacoes-envios", mesAtual],
    queryFn: async () => {
      const { data, error } = await db
        .from("avaliacoes_envios")
        .select("id, empresa_id, token_unico")
        .eq("mes_referencia", mesAtual);
      if (error) throw error;
      return data ?? [];
    },
  });

  const envioPorEmpresa = useMemo(() => {
    const m = new Map<string, any>();
    (enviosAvaliacao ?? []).forEach((e: any) => m.set(e.empresa_id, e));
    return m;
  }, [enviosAvaliacao]);

  const abrirQrAvaliacao = async (emp: any) => {
    const existente = envioPorEmpresa.get(emp.id);
    if (existente) {
      setQrModal({ open: true, empresa: emp, envio: existente });
      return;
    }
    setGerandoQr(emp.id);
    const { data, error } = await db.from("avaliacoes_envios").insert({
      empresa_id: emp.id,
      empresa_nome: emp.nome,
      mes_referencia: mesAtual,
      status: "enviado",
    }).select("id, token_unico").single();
    setGerandoQr(null);
    if (error) { toast.error("Erro ao gerar link: " + error.message); return; }
    qc.invalidateQueries({ queryKey: ["avaliacoes-envios"] });
    setQrModal({ open: true, empresa: emp, envio: data });
  };

  const copiarLinkAvaliacao = async () => {
    if (!qrModal.envio?.token_unico) return;
    await navigator.clipboard.writeText(`${getPublicBaseUrl()}/avaliar/${qrModal.envio.token_unico}`);
    toast.success("Link copiado");
  };

  const baixarQrPng = () => {
    const canvas = qrCanvasRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) { toast.error("QR Code ainda não renderizado"); return; }
    const slug = (qrModal.empresa?.nome || "empresa")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qrcode-${slug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const dados = useMemo(() => {
    let arr = ativas.map((e) => ({ ...e, dias: diasAteReajuste(e.vigenciaInicio) }));
    if (grupo !== "todos") arr = arr.filter((e) => e.grupoTamanho === grupo);
    if (busca) arr = arr.filter((e) => e.nome.toLowerCase().includes(busca.toLowerCase()) || e.contrato.includes(busca));
    arr.sort((a, b) => {
      const m = asc ? 1 : -1;
      switch (sortKey) {
        case "nome": return m * a.nome.localeCompare(b.nome);
        case "contrato": return m * a.contrato.localeCompare(b.contrato);
        case "vigencia": return m * a.vigenciaInicio.localeCompare(b.vigenciaInicio);
        case "vidas": return m * (a.vidas - b.vidas);
        case "mes": return m * (a.reajusteMes - b.reajusteMes);
        case "valor": return m * (a.reajusteValor - b.reajusteValor);
        case "dias": return m * (a.dias - b.dias);
      }
    });
    return arr;
  }, [ativas, grupo, busca, sortKey, asc]);

  const totalVidas = dados.reduce((s, e) => s + e.vidas, 0);
  const reajusteMedio = dados.length ? dados.reduce((s, e) => s + e.reajusteValor, 0) / dados.length : 0;
  const proximos90 = dados.filter((e) => e.dias <= 90).length;

  const sortBy = (k: SortKey) => { if (sortKey === k) setAsc(!asc); else { setSortKey(k); setAsc(true); } };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Empresas (filtro)" value={dados.length} />
        <StatCard icon={Users} label="Vidas" value={totalVidas.toLocaleString("pt-BR")} />
        <StatCard icon={TrendingUp} label="Reajuste médio" value={`${reajusteMedio.toFixed(2)}%`} />
        <StatCard icon={Calendar} label="Reajustes em ≤90d" value={proximos90} />
      </div>

      <Card className="p-3 flex flex-wrap gap-2 items-center">
        <Input placeholder="Buscar empresa ou contrato..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
        <Select value={grupo} onValueChange={(v) => setGrupo(v as any)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os grupos</SelectItem>
            <SelectItem value="≥500">≥500 vidas</SelectItem>
            <SelectItem value="100-499">100–499 vidas</SelectItem>
            <SelectItem value="30-99">30–99 vidas</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {([
                ["nome", "Nome"], ["contrato", "Contrato"], ["vigencia", "Vigência"], ["vidas", "Vidas"],
                ["mes", "Mês reajuste"], ["valor", "% reajuste"], ["dias", "Alerta"]
              ] as [SortKey, string][]).map(([k, l]) => (
                <th key={k} className={cn("px-3 py-2 text-left font-medium cursor-pointer hover:text-foreground", sortKey === k && "text-foreground")} onClick={() => sortBy(k)}>
                  {l} {sortKey === k ? (asc ? "▲" : "▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.map((e) => {
              const sem = classificarProximidadeReajuste(e.dias);
              return (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{e.nome}</td>
                  <td className="px-3 py-2">{e.contrato}</td>
                  <td className="px-3 py-2">{format(new Date(e.vigenciaInicio + "T00:00:00"), "dd/MM/yyyy")}</td>
                  <td className="px-3 py-2">{e.vidas}</td>
                  <td className="px-3 py-2">{e.reajusteMes}</td>
                  <td className="px-3 py-2">{e.reajusteValor.toFixed(2)}%</td>
                  <td className="px-3 py-2"><SemaforoBadge semaforo={sem} label={`${e.dias}d (${format(proximoAniversario(e.vigenciaInicio), "dd/MM")})`} /></td>
                </tr>
              );
            })}
            {dados.length === 0 && (
              <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Nenhuma empresa para os filtros.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
