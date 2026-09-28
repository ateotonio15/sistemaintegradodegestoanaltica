import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Copy, Send, Search, RefreshCw, CheckCircle2, Clock, Bell, QrCode, Download } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/date-utils";
import { QRCodeCanvas } from "qrcode.react";
import { getPublicBaseUrl } from "@/lib/public-url";
import { empresaSemExecutivaUnica, ROTULO_VARIAS_EXECUTIVAS } from "@/lib/empresa-executiva";

const db = supabase as any;

interface Props { form: any; tipo?: "rh" | "plantao" }

interface QRModalState {
  open: boolean;
  empresa: any | null;
  envio: any | null;
}

export function EnviosAvaliacaoTab({ form, tipo = "rh" }: Props) {
  const rota = (t: string) => tipo === "plantao" ? `${getPublicBaseUrl()}/avaliacoes/plantao/responder/${t}` : `${getPublicBaseUrl()}/avaliar/${t}`;
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<QRModalState>({ open: false, empresa: null, envio: null });
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  const mesAtual = new Date().toISOString().slice(0, 7);

  const { data: empresas, isLoading: loadEmp } = useQuery({
    queryKey: ["carteira-samel", "empresas-avaliacao"],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, email_empresa, responsavel_user_id, responsavel_contrato, executiva_user_id, sem_executiva_vinculada")
        .eq("status_empresa", "Ativa")
        .eq("tipo_contrato", "EMPRESARIAL")
        .lte("data_implantacao", hoje)
        .is("data_rescisao", null)
        .order("nome");
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((e: any) => e.executiva_user_id).filter(Boolean)));
      const nameMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await db.rpc("get_user_display_names", { _ids: ids });
        (profs ?? []).forEach((p: any) => nameMap.set(p.user_id, p.display_name || ""));
      }

      return (data ?? []).map((e: any) => {
        const semExec = empresaSemExecutivaUnica(e.nome, e.sem_executiva_vinculada);
        return {
          ...e,
          sem_executiva: semExec,
          executiva_user_id: semExec ? null : e.executiva_user_id,
          executiva_nome: semExec ? null : (e.executiva_user_id ? (nameMap.get(e.executiva_user_id) || "—") : "—"),
        };
      });
    },
  });


  const { data: envios, isLoading: loadEnv } = useQuery({
    queryKey: ["avaliacoes-envios", mesAtual, tipo],
    queryFn: async () => {
      const { data, error } = await db
        .from("avaliacoes_envios")
        .select("id, empresa_id, empresa_nome, executiva_nome, status, data_envio, data_resposta, token_unico, mes_referencia, lembrete_enviado_em")
        .eq("mes_referencia", mesAtual)
        .eq("tipo", tipo)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const envioPorEmpresa = useMemo(() => {
    const m = new Map<string, any>();
    (envios ?? []).forEach((e: any) => m.set(e.empresa_id, e));
    return m;
  }, [envios]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (empresas ?? []).filter((e: any) => !q || e.nome.toLowerCase().includes(q));
  }, [empresas, busca]);

  const criarEnvio = async (emp: any) => {
    setCriando(emp.id);
    const { data, error } = await db.from("avaliacoes_envios").insert({
      empresa_id: emp.id,
      empresa_nome: emp.nome,
      email_destino: emp.email_empresa || "",
      executiva_user_id: emp.executiva_user_id,
      executiva_nome: emp.executiva_nome,
      formulario_id: form?.id,
      mes_referencia: mesAtual,
      status: "enviado",
      tipo,
      ...(tipo === "plantao" ? { ativo: true, unidade: emp.nome } : {}),
    }).select("id, token_unico").single();
    setCriando(null);
    if (error) { toast.error("Erro ao gerar link: " + error.message); return; }
    const link = rota(data.token_unico);
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Link gerado e copiado!");
    qc.invalidateQueries({ queryKey: ["avaliacoes-envios"] });
  };

  const copiarLink = async (token: string) => {
    const link = rota(token);
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado");
  };

  const copiarLinkTexto = async (link: string) => {
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado");
  };

  const abrirQRCode = (emp: any, env: any) => {
    setQrModal({ open: true, empresa: emp, envio: env });
  };

  const baixarQRCodePNG = () => {
    const canvas = qrCanvasRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) {
      toast.error("QR Code ainda não renderizado");
      return;
    }
    const url = canvas.toDataURL("image/png");
    const nomeEmpresa = qrModal.empresa?.nome || "empresa";
    const slug = nomeEmpresa
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const link = document.createElement("a");
    link.href = url;
    link.download = `qrcode-${slug}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const gerarTodos = async () => {
    const pendentes = filtradas.filter((e: any) => !envioPorEmpresa.has(e.id));
    if (pendentes.length === 0) { toast.info("Todas as empresas já possuem envio neste mês"); return; }
    const rows = pendentes.map((emp: any) => ({
      empresa_id: emp.id, empresa_nome: emp.nome, email_destino: emp.email_empresa || "",
      executiva_user_id: emp.executiva_user_id, executiva_nome: emp.executiva_nome,
      formulario_id: form?.id, mes_referencia: mesAtual, status: "enviado", tipo,
      ...(tipo === "plantao" ? { ativo: true, unidade: emp.nome } : {}),
    }));
    const { error } = await db.from("avaliacoes_envios").insert(rows);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(`${rows.length} links gerados`);
    qc.invalidateQueries({ queryKey: ["avaliacoes-envios"] });
  };


  const loading = loadEmp || loadEnv;

  const stats = useMemo(() => {
    const total = filtradas.length;
    const enviados = filtradas.filter((e: any) => envioPorEmpresa.has(e.id)).length;
    const respondidos = filtradas.filter((e: any) => envioPorEmpresa.get(e.id)?.data_resposta).length;
    const pendentes = enviados - respondidos;
    return { total, enviados, respondidos, pendentes };
  }, [filtradas, envioPorEmpresa]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Empresas elegíveis</p><p className="text-xl font-bold">{stats.total}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Links gerados ({mesAtual})</p><p className="text-xl font-bold">{stats.enviados}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Respondidos</p><p className="text-xl font-bold text-emerald-600">{stats.respondidos}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Aguardando</p><p className="text-xl font-bold text-yellow-600">{stats.pendentes}</p></Card>
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa..." className="pl-8" />
        </div>
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["avaliacoes-envios"] })}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
        <Button onClick={gerarTodos}>
          <Send className="h-4 w-4 mr-1" /> Gerar links em lote
        </Button>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2">Empresa</th>
                  <th className="px-3 py-2">Executiva</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Envio</th>
                  <th className="px-3 py-2">Resposta</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((emp: any) => {
                  const env = envioPorEmpresa.get(emp.id);
                  return (
                    <tr key={emp.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{emp.nome}</td>
                      <td className="px-3 py-2 text-muted-foreground">{emp.sem_executiva ? <span className="italic opacity-70">{ROTULO_VARIAS_EXECUTIVAS}</span> : (emp.executiva_nome || "—")}</td>
                      <td className="px-3 py-2">
                        {!env ? (
                          <Badge variant="outline">Não enviado</Badge>
                        ) : env.data_resposta ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Respondido</Badge>
                        ) : env.lembrete_enviado_em ? (
                          <Badge className="bg-orange-500/15 text-orange-700 hover:bg-orange-500/15 border-orange-500/30"><Bell className="h-3 w-3 mr-1" />Lembrete</Badge>
                        ) : (
                          <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/15 border-blue-500/30"><Clock className="h-3 w-3 mr-1" />Aguardando</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{env ? formatDateBR(env.data_envio) : "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{env?.data_resposta ? formatDateBR(env.data_resposta) : "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {!env ? (
                          <Button size="sm" variant="outline" onClick={() => criarEnvio(emp)} disabled={criando === emp.id}>
                            {criando === emp.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            <span className="ml-1">Gerar link</span>
                          </Button>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => abrirQRCode(emp, env)}>
                              <QrCode className="h-3 w-3 mr-1" /> QR Code
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => copiarLink(env.token_unico)}>
                              <Copy className="h-3 w-3 mr-1" /> Copiar link
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtradas.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-sm">Nenhuma empresa encontrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={qrModal.open} onOpenChange={(open) => setQrModal({ ...qrModal, open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code de Avaliação</DialogTitle>
            <DialogDescription>
              {qrModal.empresa?.nome && (
                <span className="block font-medium text-foreground">{qrModal.empresa.nome}</span>
              )}
              {qrModal.empresa?.sem_executiva && (
                <span className="block text-xs">{ROTULO_VARIAS_EXECUTIVAS}</span>
              )}
              {qrModal.empresa?.executiva_nome && (
                <span className="block text-xs">Executiva: {qrModal.empresa.executiva_nome}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            {qrModal.envio?.token_unico && (
              <>
                <div
                  ref={qrCanvasRef}
                  className="rounded-xl border border-border/60 bg-white p-3 shadow-sm"
                >
                  <QRCodeCanvas
                    value={rota(qrModal.envio.token_unico)}
                    size={240}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                    includeMargin={false}
                  />
                </div>

                <div className="w-full space-y-2">
                  <p className="text-xs text-muted-foreground break-all text-center">
                    {rota(qrModal.envio.token_unico)}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        copiarLinkTexto(rota(qrModal.envio.token_unico))
                      }
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copiar link
                    </Button>
                    <Button size="sm" onClick={baixarQRCodePNG}>
                      <Download className="h-3 w-3 mr-1" /> Baixar PNG
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
