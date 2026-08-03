import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, QrCode, Copy, Download, Plus, Trash2, ArrowUp, ArrowDown,
  Save, Star, Lock, Unlock, ClipboardList, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Pergunta, PerguntaTipo, TIPO_LABEL,
  useContagemRespostas, useCriarPesquisa, usePerguntasPesquisa,
  usePesquisasPorPalestras, useSalvarComoPadrao, useSalvarPerguntas, useToggleAberta,
  usePesquisaGeral, useCriarPesquisaGeral,
} from "../hooks/usePesquisas";
import { ResultadosPesquisa } from "../components/pesquisa/ResultadosPesquisa";

const db = supabase as any;
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function PesquisaSatisfacao() {
  const { user, isAdmin, isEnfermeira, isExecutivo } = useAuth();
  const canEdit = isAdmin || isEnfermeira || isExecutivo;
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [empresa, setEmpresa] = useState("all");
  const [qrPalestra, setQrPalestra] = useState<any>(null);
  const [editando, setEditando] = useState<{ pesquisaId: string; titulo: string } | null>(null);

  const ini = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const fimDate = new Date(ano, mes + 1, 0);
  const fim = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(fimDate.getDate()).padStart(2, "0")}`;

  const { data: palestras = [] } = useQuery({
    queryKey: ["pp_palestras", ini, fim],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("palestras_saude")
        .select("id, empresa, tema, data, status")
        .gte("data", ini)
        .lte("data", fim)
        .order("data", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const empresas = useMemo(
    () => (Array.from(new Set(palestras.map((p: any) => String(p.empresa)))) as string[]).sort(),
    [palestras],
  );
  const lista = useMemo(
    () => palestras.filter((p: any) => empresa === "all" || p.empresa === empresa),
    [palestras, empresa],
  );

  const { data: pesquisas = [] } = usePesquisasPorPalestras(lista.map((p: any) => p.id));
  const pesquisaPorPalestra = useMemo(
    () => new Map(pesquisas.map((p) => [p.palestra_id, p])),
    [pesquisas],
  );
  const { data: contagem = {} } = useContagemRespostas(pesquisas.map((p) => p.id));

  const criar = useCriarPesquisa();
  const toggle = useToggleAberta();
  const qc = useQueryClient();

  const { data: geral } = usePesquisaGeral();
  const criarGeral = useCriarPesquisaGeral();
  const { data: contagemGeral = {} } = useContagemRespostas(geral ? [geral.id] : []);

  const salvarTema = async (palestraId: string, tema: string) => {
    const { error } = await db.from("palestras_saude").update({ tema }).eq("id", palestraId);
    if (error) return toast.error("Erro ao salvar tema");
    toast.success("Tema atualizado");
    qc.invalidateQueries({ queryKey: ["pp_palestras"] });
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/saude-empresas"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Pesquisa de Satisfação</h1>
          <p className="text-sm text-muted-foreground">
            Avaliação dos participantes após as palestras de saúde
          </p>
        </div>
      </div>

      <Card className="p-4 space-y-3 border-primary/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">QR Code e Link únicos</p>
            <p className="text-xs text-muted-foreground">
              Um único QR Code para todas as palestras — o participante informa o nome da empresa ao responder.
            </p>
          </div>
          {geral && (
            <div className="flex items-center gap-2">
              <Badge variant={geral.aberta ? "default" : "secondary"}>
                {geral.aberta ? "Aberta" : "Encerrada"}
              </Badge>
              <Badge variant="outline">
                {contagemGeral[geral.id] ?? 0} resposta{(contagemGeral[geral.id] ?? 0) === 1 ? "" : "s"}
              </Badge>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!geral ? (
            <Button size="sm" onClick={() => criarGeral.mutate()} disabled={!canEdit}>
              <QrCode className="h-4 w-4 mr-1" /> Gerar QR Code único
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => setQrPalestra({ empresa: "Pesquisa de Satisfação", tema: "Palestras de Saúde", pesquisa: geral })}
              >
                <QrCode className="h-4 w-4 mr-1" /> QR Code e Link
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canEdit}
                onClick={() => setEditando({ pesquisaId: geral.id, titulo: "Pesquisa geral" })}
              >
                <ClipboardList className="h-4 w-4 mr-1" /> Perguntas
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!canEdit}
                onClick={() => toggle.mutate({ id: geral.id, aberta: !geral.aberta })}
              >
                {geral.aberta
                  ? <><Lock className="h-4 w-4 mr-1" /> Encerrar</>
                  : <><Unlock className="h-4 w-4 mr-1" /> Reabrir</>}
              </Button>
            </>
          )}
        </div>
      </Card>


      <Tabs defaultValue="palestras">
        <TabsList>
          <TabsTrigger value="palestras" className="gap-2">
            <ClipboardList className="h-4 w-4" /> Palestras
          </TabsTrigger>
          <TabsTrigger value="resultados" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Resultados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="palestras" className="space-y-4 mt-4">
          <Card className="p-4 flex flex-wrap items-center gap-3">
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </Card>

          {lista.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma palestra cadastrada neste período.
            </Card>
          )}

          <div className="grid gap-3">
            {lista.map((p: any) => {
              const pes = pesquisaPorPalestra.get(p.id);
              return (
                <PalestraCard
                  key={p.id}
                  palestra={p}
                  pesquisa={pes}
                  respostas={pes ? contagem[pes.id] ?? 0 : 0}
                  canEdit={canEdit}
                  onSalvarTema={salvarTema}
                  onGerar={() => criar.mutate(p.id, { onSuccess: (nova) => setQrPalestra({ ...p, pesquisa: nova }) })}
                  onQr={() => setQrPalestra({ ...p, pesquisa: pes })}
                  onEditarPerguntas={() =>
                    pes && setEditando({ pesquisaId: pes.id, titulo: `${p.empresa} — ${p.tema ?? "sem tema"}` })
                  }
                  onToggle={() => pes && toggle.mutate({ id: pes.id, aberta: !pes.aberta })}
                />
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="resultados" className="mt-4">
          <ResultadosPesquisa />
        </TabsContent>
      </Tabs>

      <QrDialog data={qrPalestra} onClose={() => setQrPalestra(null)} />
      <PerguntasDialog
        pesquisaId={editando?.pesquisaId ?? null}
        titulo={editando?.titulo ?? ""}
        onClose={() => setEditando(null)}
      />
    </div>
  );
}

function PalestraCard({
  palestra, pesquisa, respostas, canEdit,
  onSalvarTema, onGerar, onQr, onEditarPerguntas, onToggle,
}: any) {
  const [tema, setTema] = useState(palestra.tema ?? "");
  useEffect(() => setTema(palestra.tema ?? ""), [palestra.tema]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold truncate">{palestra.empresa}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(`${palestra.data}T12:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pesquisa ? (
            <>
              <Badge variant={pesquisa.aberta ? "default" : "secondary"}>
                {pesquisa.aberta ? "Aberta" : "Encerrada"}
              </Badge>
              <Badge variant="outline">{respostas} resposta{respostas === 1 ? "" : "s"}</Badge>
            </>
          ) : (
            <Badge variant="outline">Sem pesquisa</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder="Tema de saúde do mês (ex: Saúde Mental)"
          className="max-w-sm"
          disabled={!canEdit}
        />
        {canEdit && tema !== (palestra.tema ?? "") && (
          <Button size="sm" variant="secondary" onClick={() => onSalvarTema(palestra.id, tema)}>
            <Save className="h-4 w-4 mr-1" /> Salvar tema
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!pesquisa ? (
          <Button size="sm" onClick={onGerar} disabled={!canEdit}>
            <QrCode className="h-4 w-4 mr-1" /> Gerar QR Code e Link
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={onQr}>
              <QrCode className="h-4 w-4 mr-1" /> QR Code e Link
            </Button>
            <Button size="sm" variant="outline" onClick={onEditarPerguntas} disabled={!canEdit}>
              <ClipboardList className="h-4 w-4 mr-1" /> Perguntas
            </Button>
            <Button size="sm" variant="ghost" onClick={onToggle} disabled={!canEdit}>
              {pesquisa.aberta
                ? <><Lock className="h-4 w-4 mr-1" /> Encerrar</>
                : <><Unlock className="h-4 w-4 mr-1" /> Reabrir</>}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function QrDialog({ data, onClose }: { data: any; onClose: () => void }) {
  const [png, setPng] = useState<string>("");
  const token = data?.pesquisa?.token;
  const url = token ? `${window.location.origin}/pesquisa/${token}` : "";

  useEffect(() => {
    let cancel = false;
    if (!url) { setPng(""); return; }
    QRCode.toDataURL(url, { width: 280, margin: 1, errorCorrectionLevel: "M" })
      .then((d) => { if (!cancel) setPng(d); })
      .catch(() => { if (!cancel) setPng(""); });
    return () => { cancel = true; };
  }, [url]);

  const baixar = () => {
    if (!png) return;
    const a = document.createElement("a");
    a.href = png;
    a.download = `qrcode-pesquisa-${(data?.empresa ?? "palestra").replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code da pesquisa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center">
            <p className="font-semibold">{data?.empresa}</p>
            <p className="text-sm text-muted-foreground">{data?.tema ?? "Tema não definido"}</p>
          </div>
          <div className="flex justify-center rounded-lg bg-white p-4 min-h-[288px] items-center">
            {png
              ? <img src={png} alt="QR Code da pesquisa de satisfação" width={280} height={280} />
              : <span className="text-sm text-muted-foreground">Gerando QR Code…</span>}
          </div>

          <div className="flex gap-2">
            <Input readOnly value={url} className="text-xs" />
            <Button
              size="icon"
              variant="outline"
              onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button className="w-full" onClick={baixar}>
            <Download className="h-4 w-4 mr-1" /> Baixar QR Code (PNG)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PerguntasDialog({
  pesquisaId, titulo, onClose,
}: { pesquisaId: string | null; titulo: string; onClose: () => void }) {
  const { data: perguntasDb } = usePerguntasPesquisa(pesquisaId);
  const [itens, setItens] = useState<Partial<Pergunta>[]>([]);
  const [removidas, setRemovidas] = useState<string[]>([]);
  const salvar = useSalvarPerguntas();
  const salvarPadrao = useSalvarComoPadrao();

  useEffect(() => {
    setItens((perguntasDb ?? []).map((p) => ({ ...p, opcoes: p.opcoes ?? [] })));
    setRemovidas([]);
  }, [perguntasDb, pesquisaId]);

  const set = (i: number, patch: Partial<Pergunta>) =>
    setItens((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const mover = (i: number, dir: -1 | 1) =>
    setItens((prev) => {
      const arr = [...prev];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });

  const remover = (i: number) => {
    const p = itens[i];
    if (p.id && !String(p.id).startsWith("novo-")) setRemovidas((r) => [...r, p.id as string]);
    setItens((prev) => prev.filter((_, idx) => idx !== i));
  };

  return (
    <Dialog open={!!pesquisaId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Perguntas — {titulo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {itens.map((p, i) => (
            <Card key={p.id ?? i} className="p-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  value={p.texto ?? ""}
                  onChange={(e) => set(i, { texto: e.target.value })}
                  placeholder="Texto da pergunta"
                />
                <Button size="icon" variant="ghost" onClick={() => mover(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => mover(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remover(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={p.tipo ?? "nota"}
                  onValueChange={(v) => set(i, { tipo: v as PerguntaTipo })}
                >
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_LABEL) as PerguntaTipo[]).map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={p.obrigatoria ?? true}
                    onCheckedChange={(v) => set(i, { obrigatoria: v })}
                  />
                  Obrigatória
                </label>
              </div>
              {p.tipo === "multipla_escolha" && (
                <Textarea
                  value={(p.opcoes ?? []).join("\n")}
                  onChange={(e) => set(i, { opcoes: e.target.value.split("\n").filter(Boolean) })}
                  placeholder="Uma opção por linha"
                  rows={3}
                />
              )}
            </Card>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setItens((prev) => [
                ...prev,
                { id: `novo-${Date.now()}`, texto: "", tipo: "nota", opcoes: [], obrigatoria: true },
              ])
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Adicionar pergunta
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={() =>
              pesquisaId &&
              salvar.mutate(
                { pesquisaId, perguntas: itens.filter((p) => (p.texto ?? "").trim()), removidas },
                { onSuccess: onClose },
              )
            }
          >
            <Save className="h-4 w-4 mr-1" /> Salvar perguntas
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              salvarPadrao.mutate({
                nome: `Padrão ${new Date().toLocaleDateString("pt-BR")}`,
                perguntas: itens.filter((p) => (p.texto ?? "").trim()),
              })
            }
          >
            <Star className="h-4 w-4 mr-1" /> Salvar como padrão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
