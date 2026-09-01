import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, QrCode, Copy, Download, Plus, Trash2, ArrowUp, ArrowDown,
  Save, Star, Lock, Unlock, ClipboardList, BarChart3, Activity, Building2, CalendarDays, Link2, Tablet, FlaskConical,
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
  usePesquisaGeral, useCriarPesquisaGeral, useContagemTestes, useLimparTestes,
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

  const { data: geral } = usePesquisaGeral("palestra");
  const criarGeral = useCriarPesquisaGeral("palestra");
  const { data: contagemGeral = {} } = useContagemRespostas(geral ? [geral.id] : []);

  const { data: geralAcoes } = usePesquisaGeral("acao");
  const criarGeralAcoes = useCriarPesquisaGeral("acao");
  const { data: contagemAcoes = {} } = useContagemRespostas(geralAcoes ? [geralAcoes.id] : []);

  const { data: testes = 0 } = useContagemTestes();
  const limparTestes = useLimparTestes();

  const salvarTema = async (palestraId: string, tema: string) => {
    const { error } = await db.from("palestras_saude").update({ tema }).eq("id", palestraId);
    if (error) return toast.error("Erro ao salvar tema");
    toast.success("Tema atualizado");
    qc.invalidateQueries({ queryKey: ["pp_palestras"] });
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link to="/saude-empresas" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pesquisa de Satisfação</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie o feedback e o engajamento das palestras e ações de saúde.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Respostas · Palestras</p>
            <p className="text-base font-bold">{geral ? contagemGeral[geral.id] ?? 0 : 0}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Respostas · Ações</p>
            <p className="text-base font-bold">{geralAcoes ? contagemAcoes[geralAcoes.id] ?? 0 : 0}</p>
          </div>
        </div>
      </header>


      <div className="grid gap-4 md:grid-cols-3">
        <PesquisaGeralCard
          icone={ClipboardList}
          titulo="QR Code único · Palestras"
          descricao="Acesso simplificado para todas as palestras do período — o participante informa a empresa ao responder."
          pesquisa={geral}
          respostas={geral ? contagemGeral[geral.id] ?? 0 : 0}
          canEdit={canEdit}
          onCriar={() => criarGeral.mutate()}
          onQr={() =>
            setQrPalestra({ empresa: "Pesquisa de Satisfação", tema: "Palestras de Saúde", pesquisa: geral })
          }
          onPerguntas={() => geral && setEditando({ pesquisaId: geral.id, titulo: "Pesquisa geral — Palestras" })}
          onToggle={() => geral && toggle.mutate({ id: geral.id, aberta: !geral.aberta })}
        />

        <PesquisaGeralCard
          icone={Activity}
          titulo="QR Code único · Ações"
          descricao="Link direto para as ações in loco: triagem, sinais vitais, preventivas e bioimpedância."
          pesquisa={geralAcoes}
          respostas={geralAcoes ? contagemAcoes[geralAcoes.id] ?? 0 : 0}
          canEdit={canEdit}
          onCriar={() => criarGeralAcoes.mutate()}
          onQr={() =>
            setQrPalestra({ empresa: "Pesquisa de Satisfação", tema: "Ações de Saúde", pesquisa: geralAcoes })
          }
          onPerguntas={() =>
            geralAcoes && setEditando({ pesquisaId: geralAcoes.id, titulo: "Pesquisa geral — Ações" })
          }
          onToggle={() => geralAcoes && toggle.mutate({ id: geralAcoes.id, aberta: !geralAcoes.aberta })}
        />

        <PesquisaGeralCard
          icone={Tablet}
          titulo="Modo Tablet · Palestras"
          descricao="Link/QR para o tablet da enfermeira: informa a empresa uma vez e o formulário se repete a cada beneficiário."
          pesquisa={geral}
          respostas={geral ? contagemGeral[geral.id] ?? 0 : 0}
          canEdit={canEdit}
          onCriar={() => criarGeral.mutate()}
          onQr={() =>
            setQrPalestra({
              empresa: "Modo Tablet",
              tema: "Palestras de Saúde",
              pesquisa: geral,
              tablet: true,
            })
          }
          onPerguntas={() => geral && setEditando({ pesquisaId: geral.id, titulo: "Pesquisa geral — Palestras" })}
          onToggle={() => geral && toggle.mutate({ id: geral.id, aberta: !geral.aberta })}
        />
      </div>

      {canEdit && (
        <Card className="rounded-xl border-amber-500/40 bg-amber-500/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-amber-600" />
                <h3 className="font-semibold">Modo teste</h3>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                  {testes} resposta{testes === 1 ? "" : "s"} de teste
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Use os links abaixo para testar o fluxo à vontade: as respostas ficam marcadas como teste,
                não entram nos resultados e podem ser apagadas de uma vez.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!geral}
                onClick={() => geral && window.open(`${window.location.origin}/pesquisa/${geral.token}?teste=1`, "_blank")}
              >
                <Link2 className="mr-1.5 h-3.5 w-3.5" /> Testar Palestras
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!geral}
                onClick={() => geral && window.open(`${window.location.origin}/pesquisa/tablet/${geral.token}?teste=1`, "_blank")}
              >
                <Tablet className="mr-1.5 h-3.5 w-3.5" /> Testar Tablet
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!geralAcoes}
                onClick={() => geralAcoes && window.open(`${window.location.origin}/pesquisa/${geralAcoes.token}?teste=1`, "_blank")}
              >
                <Activity className="mr-1.5 h-3.5 w-3.5" /> Testar Ações
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!testes || limparTestes.isPending}
                onClick={() => limparTestes.mutate()}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Limpar testes
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Tabs defaultValue="palestras">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="palestras"
            className="gap-2 rounded-none border-b-2 border-transparent bg-transparent px-6 py-3 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            <ClipboardList className="h-4 w-4" /> Palestras
          </TabsTrigger>
          <TabsTrigger
            value="resultados"
            className="gap-2 rounded-none border-b-2 border-transparent bg-transparent px-6 py-3 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            <BarChart3 className="h-4 w-4" /> Resultados consolidados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="palestras" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center gap-3">
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
            <span className="ml-auto text-xs text-muted-foreground">
              {lista.length} palestra{lista.length === 1 ? "" : "s"} no período
            </span>
          </div>

          {lista.length === 0 && (
            <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
              Nenhuma palestra cadastrada neste período.
            </Card>
          )}

          <div className="grid gap-2.5">
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

function PesquisaGeralCard({
  icone: Icone = QrCode, titulo, descricao, pesquisa, respostas, canEdit, onCriar, onQr, onPerguntas, onToggle,
}: any) {
  return (
    <Card className="group relative overflow-hidden rounded-xl border-border/70 bg-card/60 p-6 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{titulo}</h3>
            {pesquisa && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  pesquisa.aberta
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {pesquisa.aberta ? "Ativa" : "Encerrada"}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{descricao}</p>
          {pesquisa && (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{respostas}</span>{" "}
              resposta{respostas === 1 ? "" : "s"} recebida{respostas === 1 ? "" : "s"}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {!pesquisa ? (
              <Button size="sm" onClick={onCriar} disabled={!canEdit}>
                <QrCode className="mr-2 h-4 w-4" /> Gerar QR Code
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={onQr}>
                  <QrCode className="mr-2 h-4 w-4" /> QR Code e Link
                </Button>
                <Button size="sm" variant="outline" disabled={!canEdit} onClick={onPerguntas}>
                  <ClipboardList className="mr-2 h-4 w-4" /> Perguntas
                </Button>
                <Button size="sm" variant="ghost" disabled={!canEdit} onClick={onToggle}>
                  {pesquisa.aberta
                    ? <><Lock className="mr-2 h-4 w-4" /> Encerrar</>
                    : <><Unlock className="mr-2 h-4 w-4" /> Reabrir</>}
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="rounded-lg bg-muted p-3 text-muted-foreground">
          <Icone className="h-7 w-7" />
        </div>
      </div>
    </Card>
  );
}


function PalestraCard({
  palestra, pesquisa, respostas, canEdit,
  onSalvarTema, onGerar, onQr, onEditarPerguntas, onToggle,
}: any) {
  const [tema, setTema] = useState(palestra.tema ?? "");
  useEffect(() => setTema(palestra.tema ?? ""), [palestra.tema]);

  const dirty = canEdit && tema !== (palestra.tema ?? "");

  return (
    <Card
      className={`flex flex-col gap-4 rounded-xl border-border/70 p-4 transition-colors md:flex-row md:items-center md:justify-between ${
        pesquisa && !pesquisa.aberta ? "bg-card/30" : "bg-card/50 hover:bg-card"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div
          className={`h-12 w-1 shrink-0 rounded-full ${
            !pesquisa ? "bg-border" : pesquisa.aberta ? "bg-primary" : "bg-muted-foreground/40"
          }`}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{palestra.empresa}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                !pesquisa
                  ? "bg-muted text-muted-foreground"
                  : pesquisa.aberta
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {!pesquisa ? "Sem pesquisa" : pesquisa.aberta ? "Ativa" : "Encerrada"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {format(new Date(`${palestra.data}T12:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Input
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Tema de saúde do mês (ex: Saúde Mental)"
              className="h-8 max-w-xs border-transparent bg-muted/40 text-sm hover:border-border focus-visible:border-primary"
              disabled={!canEdit}
            />
            {dirty && (
              <Button size="sm" variant="secondary" className="h-8" onClick={() => onSalvarTema(palestra.id, tema)}>
                <Save className="mr-1 h-3.5 w-3.5" /> Salvar
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 md:justify-end">
        {pesquisa && (
          <div className="flex flex-col items-start md:items-end">
            <span className="text-lg font-bold leading-tight">{respostas}</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Respostas
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {!pesquisa ? (
            <Button size="sm" onClick={onGerar} disabled={!canEdit}>
              <QrCode className="mr-2 h-4 w-4" /> Gerar QR Code
            </Button>
          ) : (
            <>
              <Button size="icon" variant="ghost" className="h-9 w-9" title="QR Code e link" onClick={onQr}>
                <QrCode className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                title="Perguntas"
                onClick={onEditarPerguntas}
                disabled={!canEdit}
              >
                <ClipboardList className="h-4 w-4" />
              </Button>
              <div className="mx-1 h-6 w-px bg-border" />
              <Button size="sm" variant="outline" className="h-9" onClick={onToggle} disabled={!canEdit}>
                {pesquisa.aberta
                  ? <><Lock className="mr-1.5 h-3.5 w-3.5" /> Encerrar</>
                  : <><Unlock className="mr-1.5 h-3.5 w-3.5" /> Reabrir</>}
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}


function QrDialog({ data, onClose }: { data: any; onClose: () => void }) {
  const [png, setPng] = useState<string>("");
  const token = data?.pesquisa?.token;
  const url = token
    ? `${window.location.origin}/pesquisa/${data?.tablet ? "tablet/" : ""}${token}`
    : "";

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
