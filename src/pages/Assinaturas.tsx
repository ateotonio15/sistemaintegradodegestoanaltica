import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore — Vite resolve o worker como URL
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Download, Eye, FileSignature, History, Loader2, PenLine, Plus, Upload, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assinarPdf, nomeAssinado, RUBRICA_LARGURA } from "@/lib/assinatura-cartas";
import { criarModelo, localizarAssinatura, ROTULO_CONFIANCA, type Localizacao, type ModeloPosicao, type PaginaTexto } from "@/lib/assinatura-localizar";
import { lerTextoPdf } from "@/lib/assinatura-pdf-texto";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;
const BUCKET = "assinaturas-cartas";
const TIPOS_IMG = ["image/png", "image/jpeg"];

interface Assinante {
  id: string; nome: string; cargo: string | null; assinatura_path: string | null;
  rubrica_path: string | null; ativo: boolean; observacao: string | null;
}
interface ArquivoProc { nome: string; status: "ok" | "erro" | "revisao"; path?: string; erro?: string; pagina?: number; referencia?: string | null; confianca?: string; origem?: string }
interface Processamento {
  id: string; criado_em: string; usuario_nome: string | null; assinante_nome: string;
  total: number; sucesso: number; erro: number; arquivos: ArquivoProc[];
}

async function baixar(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error("Arquivo não encontrado");
  return data;
}
function salvarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function useImagem(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null; let ativo = true;
    setUrl(null);
    if (path) baixar(path).then((b) => { if (ativo) { u = URL.createObjectURL(b); setUrl(u); } }).catch(() => {});
    return () => { ativo = false; if (u) URL.revokeObjectURL(u); };
  }, [path]);
  return url;
}

function Miniatura({ path, className }: { path: string | null; className?: string }) {
  const url = useImagem(path);
  if (!path) return <span className="text-xs text-muted-foreground">—</span>;
  return url ? <img src={url} alt="" className={className ?? "h-10 max-w-[140px] object-contain rounded bg-background"} /> : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
}

/* ------------------------------ Assinantes ------------------------------ */
function AssinanteDialog({ aberto, onClose, editar }: { aberto: boolean; onClose: () => void; editar: Assinante | null }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(""); const [cargo, setCargo] = useState("");
  const [obs, setObs] = useState(""); const [ativo, setAtivo] = useState(true);
  const [assin, setAssin] = useState<File | null>(null); const [rub, setRub] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    setNome(editar?.nome ?? ""); setCargo(editar?.cargo ?? ""); setObs(editar?.observacao ?? "");
    setAtivo(editar?.ativo ?? true); setAssin(null); setRub(null);
  }, [aberto, editar]);

  const escolher = (f: File | undefined, set: (f: File | null) => void) => {
    if (!f) return set(null);
    if (!TIPOS_IMG.includes(f.type)) { toast.error("Use uma imagem PNG ou JPG."); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("A imagem pode ter no máximo 5 MB."); return; }
    set(f);
  };

  const salvar = async () => {
    if (!nome.trim()) return toast.error("Informe o nome do assinante.");
    if (!editar?.assinatura_path && !assin) return toast.error("Envie a imagem da assinatura.");
    setSalvando(true);
    try {
      const id = editar?.id ?? crypto.randomUUID();
      const enviar = async (f: File, tipo: string) => {
        const path = `assinantes/${id}/${tipo}-${Date.now()}.${f.type === "image/png" ? "png" : "jpg"}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type });
        if (error) throw error;
        return path;
      };
      const assinatura_path = assin ? await enviar(assin, "assinatura") : editar?.assinatura_path ?? null;
      const rubrica_path = rub ? await enviar(rub, "rubrica") : editar?.rubrica_path ?? null;
      const dados = { nome: nome.trim(), cargo: cargo.trim() || null, observacao: obs.trim() || null, ativo, assinatura_path, rubrica_path, atualizado_em: new Date().toISOString() };
      const { error } = editar
        ? await supabase.from("assinantes").update(dados).eq("id", id)
        : await supabase.from("assinantes").insert({ id, ...dados });
      if (error) throw error;
      toast.success("Assinante salvo.");
      await qc.invalidateQueries({ queryKey: ["assinantes"] });
      onClose();
    } catch (e: any) {
      toast.error("Não foi possível salvar o assinante.", { description: e?.message });
    } finally { setSalvando(false); }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editar ? "Editar assinante" : "Novo assinante"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome do assinante</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><Label>Cargo</Label><Input value={cargo} onChange={(e) => setCargo(e.target.value)} /></div>
          </div>
          <div>
            <Label>Imagem da assinatura (PNG ou JPG)</Label>
            <Input type="file" accept="image/png,image/jpeg" onChange={(e) => escolher(e.target.files?.[0], setAssin)} />
            {!assin && editar?.assinatura_path && <div className="mt-2"><Miniatura path={editar.assinatura_path} /></div>}
          </div>
          <div>
            <Label>Rubrica (opcional)</Label>
            <Input type="file" accept="image/png,image/jpeg" onChange={(e) => escolher(e.target.files?.[0], setRub)} />
            {!rub && editar?.rubrica_path && <div className="mt-2"><Miniatura path={editar.rubrica_path} /></div>}
          </div>
          <div className="flex items-center gap-2"><Switch checked={ativo} onCheckedChange={setAtivo} /><Label>{ativo ? "Ativo" : "Inativo"}</Label></div>
          <div><Label>Observação</Label><Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AbaAssinantes({ assinantes }: { assinantes: Assinante[] }) {
  const [aberto, setAberto] = useState(false); const [editar, setEditar] = useState<Assinante | null>(null);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Cadastro de Assinantes</CardTitle>
        <Button size="sm" onClick={() => { setEditar(null); setAberto(true); }}><Plus className="h-4 w-4 mr-1" />Novo assinante</Button>
      </CardHeader>
      <CardContent>
        {assinantes.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Nenhum assinante cadastrado.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cargo</TableHead><TableHead>Assinatura</TableHead><TableHead>Rubrica</TableHead><TableHead>Status</TableHead><TableHead>Observação</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {assinantes.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.nome}</TableCell>
                  <TableCell>{a.cargo ?? "—"}</TableCell>
                  <TableCell><Miniatura path={a.assinatura_path} /></TableCell>
                  <TableCell><Miniatura path={a.rubrica_path} /></TableCell>
                  <TableCell><Badge variant={a.ativo ? "default" : "secondary"}>{a.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">{a.observacao ?? "—"}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => { setEditar(a); setAberto(true); }}><PenLine className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <AssinanteDialog aberto={aberto} onClose={() => setAberto(false)} editar={editar} />
    </Card>
  );
}

/* ------------------------------ Processar ------------------------------ */
type StatusCarta = "pronta" | "revisao" | "ajustada" | "erro_leitura";
interface CartaAnalise { arquivo: File; paginas: PaginaTexto[]; numPaginas: number; loc: Localizacao; status: StatusCarta }

const COR_CONF: Record<string, string> = {
  alta: "bg-primary/15 text-primary border-primary/30",
  media: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  baixa: "bg-destructive/15 text-destructive border-destructive/30",
};
const ROTULO_STATUS: Record<StatusCarta, string> = { pronta: "Pronta", revisao: "Revisão necessária", ajustada: "Ajustada manualmente", erro_leitura: "Não foi possível ler" };

function PreviaPosicao({ carta, assinaturaUrl, rubricaUrl, onAjustar }: {
  carta: CartaAnalise; assinaturaUrl: string | null; rubricaUrl: string | null; onAjustar: (l: Localizacao) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [proporcao, setProporcao] = useState(1.414);
  const [carregando, setCarregando] = useState(true);
  const { loc } = carta;
  useEffect(() => {
    let cancel = false;
    (async () => {
      setCarregando(true);
      try {
        const doc = await (pdfjsLib as any).getDocument({ data: new Uint8Array(await carta.arquivo.arrayBuffer()) }).promise;
        const pagina = await doc.getPage(Math.min(loc.pagina, doc.numPages));
        const vp1 = pagina.getViewport({ scale: 1 });
        const vp = pagina.getViewport({ scale: 520 / vp1.width });
        const c = canvasRef.current; if (!c || cancel) return;
        c.width = vp.width; c.height = vp.height; setProporcao(vp.height / vp.width);
        await pagina.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      } catch { toast.error("Não foi possível mostrar a prévia deste PDF."); }
      finally { if (!cancel) setCarregando(false); }
    })();
    return () => { cancel = true; };
  }, [carta.arquivo, loc.pagina]);

  const clicar = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onAjustar({ ...loc, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, origem: "manual" });
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className={COR_CONF[loc.confianca]}>Confiança {ROTULO_CONFIANCA[loc.confianca]}</Badge>
        <span className="text-muted-foreground">Página {loc.pagina} de {carta.numPaginas}</span>
        <span className="text-muted-foreground">· Referência: {loc.referencia ? `"${loc.referencia}"` : "nenhuma encontrada"}</span>
      </div>
      <p className="text-xs text-muted-foreground">Clique na página para ajustar a posição desta carta.</p>
      <div className="relative w-full max-w-[520px] cursor-crosshair border rounded-md overflow-hidden bg-white" style={{ aspectRatio: `1 / ${proporcao}` }} onClick={clicar}>
        <canvas ref={canvasRef} className="w-full h-full" />
        {carregando && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
        {assinaturaUrl && (
          <img src={assinaturaUrl} alt="" className="absolute pointer-events-none outline outline-1 outline-dashed outline-primary"
            style={{ left: `${loc.x * 100}%`, top: `${loc.y * 100}%`, width: `${loc.largura * 100}%`, transform: "translate(-50%, -50%)" }} />
        )}
        {rubricaUrl && <img src={rubricaUrl} alt="" className="absolute pointer-events-none opacity-80" style={{ right: "4%", bottom: "4%", width: `${RUBRICA_LARGURA * 100}%` }} />}
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-[520px]">
        <div className="col-span-2">
          <Label className="text-xs">Tamanho da assinatura</Label>
          <Slider min={10} max={60} step={1} value={[Math.round(loc.largura * 100)]} onValueChange={([v]) => onAjustar({ ...loc, largura: v / 100, origem: "manual" })} />
        </div>
        <div>
          <Label className="text-xs">Página</Label>
          <Input type="number" min={1} max={carta.numPaginas} value={loc.pagina}
            onChange={(e) => onAjustar({ ...loc, pagina: Math.min(Math.max(1, Number(e.target.value) || 1), carta.numPaginas), origem: "manual" })} />
        </div>
        <div>
          <Label className="text-xs">Margem acima do texto (%)</Label>
          <Input type="number" min={0} max={20} step={0.5} value={Math.round(loc.margem_superior * 1000) / 10}
            onChange={(e) => {
              const m = Math.max(0, Number(e.target.value) || 0) / 100;
              onAjustar({ ...loc, y: loc.y - (m - loc.margem_superior), margem_superior: m, origem: "manual" });
            }} />
        </div>
        <div>
          <Label className="text-xs">Margem inferior mínima (%)</Label>
          <Input type="number" min={0} max={20} step={0.5} value={Math.round(loc.margem_inferior * 1000) / 10}
            onChange={(e) => {
              const m = Math.max(0, Number(e.target.value) || 0) / 100;
              onAjustar({ ...loc, y: Math.min(loc.y, 1 - m), margem_inferior: m, origem: "manual" });
            }} />
        </div>
      </div>
    </div>
  );
}

function AbaProcessar({ assinantes, onConcluido }: { assinantes: Assinante[]; onConcluido: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const ativos = assinantes.filter((a) => a.ativo && a.assinatura_path);
  const [assinanteId, setAssinanteId] = useState("");
  const [cartas, setCartas] = useState<CartaAnalise[]>([]);
  const [sel, setSel] = useState(0);
  const [analisando, setAnalisando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<ArquivoProc[] | null>(null);
  const [nomeModelo, setNomeModelo] = useState("");
  const assinante = ativos.find((a) => a.id === assinanteId) ?? null;
  const assinaturaUrl = useImagem(assinante?.assinatura_path);
  const rubricaUrl = useImagem(assinante?.rubrica_path);
  const modelos = useQuery({
    queryKey: ["assinatura-modelos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assinatura_modelos").select("*").order("nome");
      if (error) throw error; return (data ?? []) as unknown as ModeloPosicao[];
    },
  });

  const escolher = async (lista: FileList | null) => {
    const pdfs = Array.from(lista ?? []).filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (lista && pdfs.length < lista.length) toast.warning("Apenas arquivos PDF são aceitos; os demais foram ignorados.");
    setResultado(null); setSel(0); setCartas([]);
    if (!pdfs.length) return;
    setAnalisando(true);
    const ms = modelos.data ?? [];
    const out: CartaAnalise[] = [];
    for (const f of pdfs) {
      try {
        const paginas = await lerTextoPdf(new Uint8Array(await f.arrayBuffer()));
        const loc = localizarAssinatura(paginas, ms);
        out.push({ arquivo: f, paginas, numPaginas: paginas.length, loc, status: loc.confianca === "baixa" ? "revisao" : "pronta" });
      } catch {
        out.push({ arquivo: f, paginas: [], numPaginas: 1, loc: localizarAssinatura([{ linhas: [] }]), status: "erro_leitura" });
      }
    }
    setCartas(out); setAnalisando(false);
    const rev = out.filter((c) => c.status === "revisao").length;
    if (rev) toast.warning(`${rev} carta(s) precisam de revisão: posição não encontrada com segurança.`);
  };

  const ajustar = (l: Localizacao) => setCartas((cs) => cs.map((c, i) => i === sel ? { ...c, loc: l, status: c.status === "erro_leitura" ? c.status : "ajustada" } : c));
  const atual = cartas[sel];

  const salvarModelo = async () => {
    if (!atual || !nomeModelo.trim() || !atual.paginas.length) return;
    const m = criarModelo(nomeModelo.trim(), atual.paginas, atual.loc);
    const { error } = await supabase.from("assinatura_modelos").upsert({ ...m, atualizado_em: new Date().toISOString() } as any, { onConflict: "impressao" });
    if (error) return toast.error("Não foi possível salvar o modelo.", { description: error.message });
    toast.success(`Posição salva no modelo "${m.nome}". Cartas parecidas usarão esta posição.`);
    const lista = await qc.fetchQuery({ queryKey: ["assinatura-modelos"], queryFn: async () => {
      const { data } = await supabase.from("assinatura_modelos").select("*").order("nome"); return (data ?? []) as unknown as ModeloPosicao[];
    }, staleTime: 0 });
    // Reaplica o modelo nas outras cartas do lote que ainda não foram ajustadas.
    setCartas((cs) => cs.map((c, i) => {
      if (i === sel || c.status === "ajustada" || !c.paginas.length) return c;
      const loc = localizarAssinatura(c.paginas, lista);
      return { ...c, loc, status: loc.confianca === "baixa" ? "revisao" : "pronta" };
    }));
    setNomeModelo("");
  };

  const aptas = cartas.filter((c) => c.status === "pronta" || c.status === "ajustada");
  const pendentes = cartas.length - aptas.length;

  const processar = async () => {
    if (!assinante || !user) return;
    setProcessando(true); setProgresso(0); setResultado(null);
    const loteId = crypto.randomUUID();
    const res: ArquivoProc[] = [];
    try {
      const imgA = await baixar(assinante.assinatura_path!);
      const assinatura = { bytes: new Uint8Array(await imgA.arrayBuffer()), tipo: imgA.type || assinante.assinatura_path! };
      let rubrica = null;
      if (assinante.rubrica_path) {
        const imgR = await baixar(assinante.rubrica_path);
        rubrica = { bytes: new Uint8Array(await imgR.arrayBuffer()), tipo: imgR.type || assinante.rubrica_path };
      }
      for (let i = 0; i < cartas.length; i++) {
        const c = cartas[i]; const l = c.loc;
        const detalhe = { pagina: l.pagina, referencia: l.referencia, confianca: l.confianca, origem: l.origem, x: l.x, y: l.y, largura: l.largura, margem_superior: l.margem_superior, margem_inferior: l.margem_inferior };
        if (c.status === "revisao" || c.status === "erro_leitura") {
          res.push({ nome: c.arquivo.name, status: "revisao", erro: c.status === "erro_leitura" ? "Não foi possível ler o texto" : "Revisão necessária", ...detalhe });
          setProgresso(i + 1); continue;
        }
        try {
          const saida = await assinarPdf(new Uint8Array(await c.arquivo.arrayBuffer()), assinatura, rubrica, { x: l.x, y: l.y, largura: l.largura }, l.pagina);
          const path = `lotes/${loteId}/${i + 1}-${nomeAssinado(c.arquivo.name).replace(/[^\w.\- ]/g, "_")}`;
          const { error } = await supabase.storage.from(BUCKET).upload(path, new Blob([saida as BlobPart], { type: "application/pdf" }), { contentType: "application/pdf" });
          if (error) throw error;
          res.push({ nome: nomeAssinado(c.arquivo.name), status: "ok", path, ...detalhe });
        } catch (e: any) {
          res.push({ nome: c.arquivo.name, status: "erro", erro: e?.message?.includes("encrypt") ? "PDF protegido por senha" : "Não foi possível assinar este PDF", ...detalhe });
        }
        setProgresso(i + 1);
      }
      const { data: nomeUsuario } = await supabase.rpc("get_my_username" as any);
      const sucesso = res.filter((r) => r.status === "ok").length;
      const { error } = await supabase.from("assinaturas_processamentos").insert({
        id: loteId, usuario_id: user.id, usuario_nome: (nomeUsuario as string) ?? user.email ?? null,
        assinante_id: assinante.id, assinante_nome: assinante.nome, total: res.length, sucesso, erro: res.length - sucesso, arquivos: res as any,
      });
      if (error) toast.error("As cartas foram assinadas, mas o histórico não foi salvo.");
      setResultado(res);
      toast.success(`${sucesso} de ${res.length} carta(s) assinada(s).`);
      onConcluido();
    } catch (e: any) {
      toast.error("Não foi possível carregar a assinatura do assinante.", { description: e?.message });
    } finally { setProcessando(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_560px]">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSignature className="h-4 w-4 text-primary" />Processar Cartas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Assinante</Label>
            <Select value={assinanteId} onValueChange={setAssinanteId}>
              <SelectTrigger><SelectValue placeholder={ativos.length ? "Escolha o assinante" : "Cadastre um assinante ativo primeiro"} /></SelectTrigger>
              <SelectContent>{ativos.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}{a.cargo ? ` — ${a.cargo}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cartas em PDF (uma ou várias)</Label>
            <Input type="file" accept="application/pdf,.pdf" multiple onChange={(e) => escolher(e.target.files)} />
            {analisando && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Procurando o local da assinatura…</p>}
          </div>
          {cartas.length > 0 && (
            <div className="rounded-md border divide-y max-h-80 overflow-auto">
              {cartas.map((c, i) => (
                <button key={i} type="button" onClick={() => setSel(i)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted/50 ${i === sel ? "bg-primary/10" : ""}`}>
                  <span className="truncate flex-1">{c.arquivo.name}</span>
                  <Badge variant="outline" className={COR_CONF[c.loc.confianca]}>{ROTULO_CONFIANCA[c.loc.confianca]}</Badge>
                  <Badge variant={c.status === "revisao" || c.status === "erro_leitura" ? "destructive" : "secondary"} className="shrink-0">{ROTULO_STATUS[c.status]}</Badge>
                </button>
              ))}
            </div>
          )}
          {pendentes > 0 && <p className="text-xs text-destructive">{pendentes} carta(s) com revisão necessária não serão assinadas. Abra cada uma e clique na posição correta.</p>}
          {assinante?.rubrica_path && <p className="text-xs text-muted-foreground">A rubrica será colocada no canto inferior direito de todas as páginas.</p>}
          <Button onClick={processar} disabled={!assinante || !aptas.length || processando || analisando} className="w-full">
            {processando ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Assinando {progresso} de {cartas.length}…</> : <><Upload className="h-4 w-4 mr-1" />Assinar {aptas.length || ""} carta(s)</>}
          </Button>
          {resultado && <ListaArquivos arquivos={resultado} />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Posição da assinatura</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {atual ? (
            <>
              <PreviaPosicao carta={atual} assinaturaUrl={assinaturaUrl} rubricaUrl={rubricaUrl} onAjustar={ajustar} />
              {atual.paginas.length > 0 && (
                <div className="max-w-[520px] space-y-1 border-t pt-3">
                  <Label className="text-xs">Salvar esta posição como modelo de carta</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Ex.: Carta de cancelamento" value={nomeModelo} onChange={(e) => setNomeModelo(e.target.value)} />
                    <Button variant="outline" onClick={salvarModelo} disabled={!nomeModelo.trim()}>Salvar modelo</Button>
                  </div>
                  {atual.loc.origem === "modelo" && <p className="text-xs text-primary">Posição vinda de um modelo salvo.</p>}
                </div>
              )}
            </>
          ) : <p className="text-sm text-muted-foreground py-10 text-center">Selecione as cartas para ver a prévia.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function ListaArquivos({ arquivos }: { arquivos: ArquivoProc[] }) {
  const ver = async (a: ArquivoProc) => { try { window.open(URL.createObjectURL(await baixar(a.path!)), "_blank"); } catch { toast.error("Arquivo não encontrado."); } };
  const baixarUm = async (a: ArquivoProc) => { try { salvarBlob(await baixar(a.path!), a.nome); } catch { toast.error("Arquivo não encontrado."); } };
  const baixarTodos = async () => {
    const zip = new JSZip();
    for (const a of arquivos.filter((x) => x.status === "ok")) zip.file(a.nome, await baixar(a.path!));
    salvarBlob(await zip.generateAsync({ type: "blob" }), "cartas-assinadas.zip");
  };
  const ok = arquivos.filter((a) => a.status === "ok").length;
  return (
    <div className="space-y-2">
      {ok > 1 && <Button size="sm" variant="outline" onClick={baixarTodos}><Download className="h-4 w-4 mr-1" />Baixar todas (ZIP)</Button>}
      <div className="divide-y rounded-md border max-h-72 overflow-auto">
        {arquivos.map((a, i) => (
          <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="truncate">{a.nome}</span>
            {a.status === "ok" ? (
              <span className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => ver(a)} title="Visualizar"><Eye className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => baixarUm(a)} title="Baixar"><Download className="h-4 w-4" /></Button>
              </span>
            ) : <span className="flex items-center gap-1 shrink-0">{a.confianca && <span className="text-[11px] text-muted-foreground">Confiança {ROTULO_CONFIANCA[a.confianca as "alta"]}</span>}<Badge variant="destructive">{a.erro}</Badge></span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Histórico ------------------------------ */
function AbaHistorico({ lista }: { lista: Processamento[] }) {
  const [aberto, setAberto] = useState<Processamento | null>(null);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4 text-primary" />Histórico de Processamentos</CardTitle></CardHeader>
      <CardContent>
        {lista.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Nenhum processamento ainda.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Data e hora</TableHead><TableHead>Usuário</TableHead><TableHead>Assinante</TableHead><TableHead className="text-right">Cartas</TableHead><TableHead className="text-right">Sucesso</TableHead><TableHead className="text-right">Erro</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {lista.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                  <TableCell>{p.usuario_nome ?? "—"}</TableCell>
                  <TableCell>{p.assinante_nome}</TableCell>
                  <TableCell className="text-right">{p.total}</TableCell>
                  <TableCell className="text-right text-primary font-medium">{p.sucesso}</TableCell>
                  <TableCell className={`text-right ${p.erro ? "text-destructive font-medium" : ""}`}>{p.erro}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => setAberto(p)}><Eye className="h-4 w-4 mr-1" />Ver cartas</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Cartas assinadas por {aberto?.assinante_nome}</DialogTitle></DialogHeader>
          {aberto && <ListaArquivos arquivos={aberto.arquivos} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function Assinaturas() {
  const qc = useQueryClient();
  const assinantes = useQuery({
    queryKey: ["assinantes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assinantes").select("*").order("nome");
      if (error) throw error; return (data ?? []) as Assinante[];
    },
  });
  const historico = useQuery({
    queryKey: ["assinaturas-processamentos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assinaturas_processamentos").select("*").order("criado_em", { ascending: false }).limit(200);
      if (error) throw error; return (data ?? []) as unknown as Processamento[];
    },
  });
  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><FileSignature className="h-6 w-6 text-primary" />Assinaturas</h1>
        <p className="text-sm text-muted-foreground">Coloque a imagem da assinatura nas cartas em PDF, uma a uma ou em lote.</p>
      </div>
      <Tabs defaultValue="processar">
        <TabsList>
          <TabsTrigger value="processar">Processar Cartas</TabsTrigger>
          <TabsTrigger value="assinantes">Cadastro de Assinantes</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Processamentos</TabsTrigger>
        </TabsList>
        <TabsContent value="processar"><AbaProcessar assinantes={assinantes.data ?? []} onConcluido={() => qc.invalidateQueries({ queryKey: ["assinaturas-processamentos"] })} /></TabsContent>
        <TabsContent value="assinantes"><AbaAssinantes assinantes={assinantes.data ?? []} /></TabsContent>
        <TabsContent value="historico"><AbaHistorico lista={historico.data ?? []} /></TabsContent>
      </Tabs>
    </div>
  );
}
