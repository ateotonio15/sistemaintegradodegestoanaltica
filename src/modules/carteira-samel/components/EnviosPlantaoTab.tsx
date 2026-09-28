import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Copy, Plus, QrCode, Download, RefreshCw, Power } from "lucide-react";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import { getPublicBaseUrl } from "@/lib/public-url";
import { formatDateBR } from "@/lib/date-utils";
import { useAuth } from "@/hooks/useAuth";

const db = supabase as any;

export const linkPlantao = (token: string) => `${getPublicBaseUrl()}/avaliacoes/plantao/responder/${token}`;

export function EnviosPlantaoTab({ form }: { form: any }) {
  const qc = useQueryClient();
  const { isAdmin, isDiretora } = useAuth();
  const [unidade, setUnidade] = useState("");
  const [criando, setCriando] = useState(false);
  const [qr, setQr] = useState<any | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["avaliacoes-plantao-links"],
    queryFn: async () => {
      const { data: links, error } = await db
        .from("avaliacoes_envios")
        .select("id, unidade, empresa_nome, token_unico, ativo, data_envio, data_resposta")
        .eq("tipo", "plantao")
        .order("unidade");
      if (error) throw error;
      const { data: resp } = await db
        .from("cs_avaliacao_respostas")
        .select("envio_id, nota_media")
        .eq("tipo", "plantao");
      const agg = new Map<string, { n: number; soma: number; c: number }>();
      (resp ?? []).forEach((r: any) => {
        const a = agg.get(r.envio_id) || { n: 0, soma: 0, c: 0 };
        a.n++;
        if (r.nota_media != null) { a.soma += Number(r.nota_media); a.c++; }
        agg.set(r.envio_id, a);
      });
      return (links ?? []).map((l: any) => {
        const a = agg.get(l.id);
        return { ...l, respostas: a?.n ?? 0, media: a && a.c ? a.soma / a.c : null };
      });
    },
  });

  const criar = async () => {
    const u = unidade.trim();
    if (!u) { toast.error("Informe a unidade/plantão"); return; }
    if ((data ?? []).some((l: any) => (l.unidade || "").toLowerCase() === u.toLowerCase() && l.ativo)) {
      toast.error("Já existe um QR Code ativo para essa unidade"); return;
    }
    setCriando(true);
    const { error } = await db.from("avaliacoes_envios").insert({
      tipo: "plantao", fixo: true, unidade: u, empresa_nome: u, email_destino: "",
      formulario_id: form?.id, status: "enviado",
    });
    setCriando(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    setUnidade("");
    toast.success("QR Code fixo criado");
    qc.invalidateQueries({ queryKey: ["avaliacoes-plantao-links"] });
  };

  const alternar = async (l: any) => {
    const { error } = await db.from("avaliacoes_envios").update({ ativo: !l.ativo }).eq("id", l.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    qc.invalidateQueries({ queryKey: ["avaliacoes-plantao-links"] });
  };

  const copiar = async (t: string) => { await navigator.clipboard.writeText(linkPlantao(t)); toast.success("Link copiado"); };

  const baixar = () => {
    const c = qrRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `qrcode-plantao-${(qr?.unidade || "unidade").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    a.click();
  };

  const lista = data ?? [];
  const total = lista.reduce((s: number, l: any) => s + l.respostas, 0);
  const aguardando = lista.filter((l: any) => l.ativo && l.respostas === 0).length;
  const podeDesativar = isAdmin || isDiretora;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-3"><p className="text-xs text-muted-foreground">QR Codes ativos</p><p className="text-xl font-bold">{lista.filter((l: any) => l.ativo).length}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Respostas</p><p className="text-xl font-bold text-emerald-600">{total}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Aguardando 1ª resposta</p><p className="text-xl font-bold text-yellow-600">{aguardando}</p></Card>
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Unidade / plantão (ex.: Plantão Yamaha - Distrito)" className="flex-1 min-w-[240px]" maxLength={160} />
        <Button onClick={criar} disabled={criando}>
          {criando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Criar QR Code fixo
        </Button>
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["avaliacoes-plantao-links"] })}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </Card>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2">Unidade / Plantão</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Criado em</th>
                  <th className="px-3 py-2">Respostas</th>
                  <th className="px-3 py-2">Média</th>
                  <th className="px-3 py-2">Última resposta</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l: any) => (
                  <tr key={l.id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{l.unidade || l.empresa_nome}</td>
                    <td className="px-3 py-2">{l.ativo ? <Badge variant="outline" className="border-primary/40 text-primary">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatDateBR(l.data_envio)}</td>
                    <td className="px-3 py-2">{l.respostas}</td>
                    <td className="px-3 py-2">{l.media != null ? l.media.toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{l.data_resposta ? formatDateBR(l.data_resposta) : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" disabled={!l.ativo} onClick={() => setQr(l)}><QrCode className="h-3 w-3 mr-1" /> QR Code</Button>
                        <Button size="sm" variant="ghost" disabled={!l.ativo} onClick={() => copiar(l.token_unico)}><Copy className="h-3 w-3 mr-1" /> Copiar link</Button>
                        {podeDesativar && (
                          <Button size="sm" variant="ghost" onClick={() => alternar(l)} title={l.ativo ? "Desativar" : "Reativar"}><Power className="h-3 w-3" /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground text-sm">Nenhum QR Code de plantão criado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!qr} onOpenChange={(o) => !o && setQr(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code fixo — Plantão</DialogTitle>
            <DialogDescription><span className="block font-medium text-foreground">{qr?.unidade}</span></DialogDescription>
          </DialogHeader>
          {qr && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div ref={qrRef} className="rounded-xl border border-border/60 bg-white p-3">
                <QRCodeCanvas value={linkPlantao(qr.token_unico)} size={240} bgColor="#ffffff" fgColor="#000000" level="M" />
              </div>
              <p className="text-xs text-muted-foreground break-all text-center">{linkPlantao(qr.token_unico)}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copiar(qr.token_unico)}><Copy className="h-3 w-3 mr-1" /> Copiar link</Button>
                <Button size="sm" onClick={baixar}><Download className="h-3 w-3 mr-1" /> Baixar PNG</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
