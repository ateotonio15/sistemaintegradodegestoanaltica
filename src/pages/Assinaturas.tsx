import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore — Vite resolve o worker como URL
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Download, Eye, FileSignature, History, Loader2, PenLine, Plus, RotateCcw, Upload, Users } from "lucide-react";
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
import { emParalelo, statusLote, ROTULO_STATUS_LOTE, posicoesParecidas, type StatusLote } from "@/lib/assinatura-lote";
import { criarModelo, localizarAssinatura, ROTULO_CONFIANCA, type Localizacao, type ModeloPosicao, type PaginaTexto } from "@/lib/assinatura-localizar";
import { lerTextoPdf } from "@/lib/assinatura-pdf-texto";
import { fundoTransparente } from "@/lib/assinatura-fundo";
import { Sparkles } from "lucide-react";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;
const BUCKET = "assinaturas-cartas";
const TIPOS_IMG = ["image/png", "image/jpeg"];

interface Assinante {
  id: string; nome: string; cargo: string | null; assinatura_path: string | null;
  rubrica_path: string | null; ativo: boolean; observacao: string | null; largura_padrao: number | null;
}
interface ArquivoProc { nome: string; original_nome?: string; original_path?: string; status: "ok" | "erro" | "revisao"; path?: string; erro?: string; pagina?: number; referencia?: string | null; confianca?: string; origem?: string }
interface Processamento {
  id: string; criado_em: string; usuario_nome: string | null; assinante_nome: string; assinante_id: string | null;
  total: number; sucesso: number; erro: number; arquivos: ArquivoProc[];
  nome_lote: string | null; status: StatusLote; reprocessado_em: string | null; usuario_id: string;
}
interface Reprocesso { lote: Processamento; arquivos: File[] }

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
  const [largura, setLargura] = useState(30);
  const [limpando, setLimpando] = useState(false);
  const [limpa, setLimpa] = useState<string | null>(null);
  const limparIA = async () => {
    setLimpando(true);
    try {
      const origem: Blob = assin ?? await baixar(editar!.assinatura_path!);
      const dataUrl = await new Promise<string>((ok, err) => { const fr = new FileReader(); fr.onload = () => ok(fr.result as string); fr.onerror = err; fr.readAsDataURL(origem); });
      const { data, error } = await supabase.functions.invoke("limpar-assinatura", { body: { imagem: dataUrl } });
      if (error || !data?.imagem) throw new Error(data?.error ?? error?.message);
      const png = await fundoTransparente(data.imagem);
      setAssin(new File([png], "assinatura-limpa.png", { type: "image/png" }));
      setLimpa(URL.createObjectURL(png));
      toast.success("Assinatura limpa. Confira a prévia e clique em Salvar.");
    } catch (e: any) {
      toast.error("Não foi possível limpar a assinatura.", { description: e?.message });
    } finally { setLimpando(false); }
  };
  useEffect(() => {
    if (!aberto) return;
    setLargura(Math.round(Number(editar?.largura_padrao ?? 0.3) * 100));
    setNome(editar?.nome ?? ""); setCargo(editar?.cargo ?? ""); setObs(editar?.observacao ?? "");
    setAtivo(editar?.ativo ?? true); setAssin(null); setRub(null); setLimpa(null);
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
      const dados = { nome: nome.trim(), cargo: cargo.trim() || null, observacao: obs.trim() || null, ativo, assinatura_path, rubrica_path, largura_padrao: largura / 100, atualizado_em: new Date().toISOString() };
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
            <Input type="file" accept="image/png,image/jpeg" onChange={(e) => { setLimpa(null); escolher(e.target.files?.[0], setAssin); }} />
            {!assin && editar?.assinatura_path && <div className="mt-2"><Miniatura path={editar.assinatura_path} /></div>}
            {(assin || editar?.assinatura_path) && (
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={limparIA} disabled={limpando || !!limpa}>
                {limpando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                {limpa ? "Assinatura limpa" : "Limpar assinatura com IA"}
              </Button>
            )}
            {limpa && (
              <div className="mt-2 rounded-md border p-2 bg-white">
                <img src={limpa} alt="Assinatura limpa" className="h-16 max-w-full object-contain" />
                <p className="text-[11px] text-muted-foreground mt-1">Fundo removido e traço escurecido. Se não ficou boa, escolha a imagem de novo.</p>
              </div>
            )}
          </div>
          <div>
            <Label>Rubrica (opcional)</Label>
            <Input type="file" accept="image/png,image/jpeg" onChange={(e) => escolher(e.target.files?.[0], setRub)} />
            {!rub && editar?.rubrica_path && <div className="mt-2"><Miniatura path={editar.rubrica_path} /></div>}
          </div>
          <div>
            <Label>Tamanho padrão da assinatura: {largura}% da largura da página</Label>
            <Slider min={10} max={60} step={1} value={[largura]} onValueChange={([v]) => setLargura(v)} className="mt-2" />
            <p className="text-[11px] text-muted-foreground mt-1">A proporção da imagem é sempre mantida; só a largura muda.</p>
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
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cargo</TableHead><TableHead>Assinatura</TableHead><TableHead>Rubrica</TableHead><TableHead>Tamanho</TableHead><TableHead>Status</TableHead><TableHead>Observação</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {assinantes.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.nome}</TableCell>
                  <TableCell>{a.cargo ?? "—"}</TableCell>
                  <TableCell><Miniatura path={a.assinatura_path} /></TableCell>
                  <TableCell><Miniatura path={a.rubrica_path} /></TableCell>
                  <TableCell>{Math.round(Number(a.largura_padrao ?? 0.3) * 100)}%</TableCell>
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
interface CartaAnalise { arquivo: File; paginas: PaginaTexto[]; numPaginas: number; loc: Localizacao; status: StatusCarta; rascunho?: Localizacao }

const COR_CONF: Record<string, string> = {
  alta: "bg-primary/15 text-primary border-primary/30",
  media: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  baixa: "bg-destructive/15 text-destructive border-destructive/30",
};
const ROTULO_STATUS: Record<StatusCarta, string> = { pronta: "Pronta para assinar", revisao: "Precisa revisão", ajustada: "Ajuste salvo", erro_leitura: "Erro ao localizar" };

function MiniPrevia({ carta, assinaturaUrl }: { carta: CartaAnalise; assinaturaUrl: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [prop, setProp] = useState(1.414);
  const loc = carta.rascunho ?? carta.loc;
  const caixa = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = caixa.current; if (!el) return;
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisivel(true); ob.disconnect(); } }, { rootMargin: "200px" });
    ob.observe(el); return () => ob.disconnect();
  }, []);
  useEffect(() => {
    if (!visivel) return;
    let cancel = false;
    (async () => {
      try {
        const doc = await (pdfjsLib as any).getDocument({ data: new Uint8Array(await carta.arquivo.arrayBuffer()) }).promise;
        const pg = await doc.getPage(Math.min(loc.pagina, doc.numPages));
        const v1 = pg.getViewport({ scale: 1 });
        const vp = pg.getViewport({ scale: 180 / v1.width });
        const c = ref.current; if (!c || cancel) return;
        c.width = vp.width; c.height = vp.height; setProp(vp.height / vp.width);
        await pg.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      } catch { /* prévia indisponível */ }
    })();
    return () => { cancel = true; };
  }, [carta.arquivo, loc.pagina, visivel]);
  return (
    <div ref={caixa} className="relative w-full bg-white rounded overflow-hidden" style={{ aspectRatio: `1 / ${prop}` }}>
      <canvas ref={ref} className="w-full h-full" />
      {assinaturaUrl && carta.status !== "erro_leitura" && (
        <img src={assinaturaUrl} alt="" className="absolute pointer-events-none"
          style={{ left: `${loc.x * 100}%`, top: `${loc.y * 100}%`, width: `${loc.largura * 100}%`, transform: "translate(-50%, -50%)" }} />
      )}
    </div>
  );
}

function PreviaPosicao({ carta, assinaturaUrl, rubricaUrl, onAjustar }: {
  carta: CartaAnalise; assinaturaUrl: string | null; rubricaUrl: string | null; onAjustar: (l: Localizacao) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [proporcao, setProporcao] = useState(1.414);
  const [carregando, setCarregando] = useState(true);
  const loc = carta.rascunho ?? carta.loc;
  const arrastando = useRef(false);
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

  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    const y = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
    onAjustar({ ...loc, x, y, origem: "manual" });
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className={COR_CONF[loc.confianca]}>Confiança {ROTULO_CONFIANCA[loc.confianca]}</Badge>
        <span className="text-muted-foreground">Página {loc.pagina} de {carta.numPaginas}</span>
        <span className="text-muted-foreground">· Referência: {loc.referencia ? `"${loc.referencia}"` : "nenhuma encontrada"}</span>
      </div>
      <p className="text-xs text-muted-foreground">Arraste a assinatura (ou clique na página) para mover. Depois clique em "Salvar ajuste".</p>
      <div className="relative w-full max-w-[520px] cursor-crosshair border rounded-md overflow-hidden bg-white" style={{ aspectRatio: `1 / ${proporcao}`, touchAction: "none" }}
        onPointerDown={(e) => { arrastando.current = true; e.currentTarget.setPointerCapture(e.pointerId); mover(e); }}
        onPointerMove={(e) => { if (arrastando.current) mover(e); }}
        onPointerUp={() => { arrastando.current = false; }}>
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

function AbaProcessar({ assinantes, onConcluido, reprocesso, onReprocessoFim }: { assinantes: Assinante[]; onConcluido: () => void; reprocesso: Reprocesso | null; onReprocessoFim: () => void }) {
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
  const [nomeLote, setNomeLote] = useState("");
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

  const larguraPadrao = Number(assinante?.largura_padrao ?? 0.3);
  const comLargura = (loc: Localizacao): Localizacao => loc.origem === "modelo" ? loc : { ...loc, largura: larguraPadrao };
  // Ao trocar de assinante, aplica o tamanho padrão dele às cartas não ajustadas.
  useEffect(() => {
    setCartas((cs) => cs.map((c) => c.status === "ajustada" ? c : { ...c, loc: comLargura(c.loc) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [larguraPadrao]);
  useEffect(() => {
    if (!reprocesso) return;
    setAssinanteId(reprocesso.lote.assinante_id ?? "");
    setNomeLote(reprocesso.lote.nome_lote ?? "");
    escolher(reprocesso.arquivos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reprocesso]);

  const escolher = async (lista: File[] | null) => {
    const pdfs = (lista ?? []).filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (lista && pdfs.length < lista.length) toast.warning("Apenas arquivos PDF são aceitos; os demais foram ignorados.");
    setResultado(null); setSel(0); setCartas([]);
    if (!pdfs.length) return;
    setAnalisando(true);
    const ms = modelos.data ?? [];
    setProgresso(0);
    const out = await emParalelo(pdfs, 4, async (f): Promise<CartaAnalise> => {
      try {
        const paginas = await lerTextoPdf(new Uint8Array(await f.arrayBuffer()));
        const loc = comLargura(localizarAssinatura(paginas, ms));
        return { arquivo: f, paginas, numPaginas: paginas.length, loc, status: loc.confianca === "baixa" ? "revisao" : "pronta" };
      } catch {
        return { arquivo: f, paginas: [], numPaginas: 1, loc: comLargura(localizarAssinatura([{ linhas: [] }])), status: "erro_leitura" };
      } finally { setProgresso((p) => p + 1); }
    });
    setCartas(out); setAnalisando(false);
    const rev = out.filter((c) => c.status === "revisao").length;
    if (rev) toast.warning(`${rev} carta(s) precisam de revisão: posição não encontrada com segurança.`);
  };

  const ajustar = (l: Localizacao) => setCartas((cs) => cs.map((c, i) => i === sel ? { ...c, rascunho: l } : c));
  const salvarAjuste = () => setCartas((cs) => cs.map((c, i) => i === sel && c.rascunho ? { ...c, loc: c.rascunho, rascunho: undefined, status: "ajustada" } : c));
  const descartarAjuste = () => setCartas((cs) => cs.map((c, i) => i === sel ? { ...c, rascunho: undefined } : c));
  const atual = cartas[sel];

  const salvarModelo = async () => {
    if (!atual || !nomeModelo.trim() || !atual.paginas.length) return;
    const m = criarModelo(nomeModelo.trim(), atual.paginas, atual.rascunho ?? atual.loc);
    const { error } = await supabase.from("assinatura_modelos").upsert({ ...m, atualizado_em: new Date().toISOString() } as any, { onConflict: "impressao" });
    if (error) return toast.error("Não foi possível salvar o modelo.", { description: error.message });
    toast.success(`Posição salva no modelo "${m.nome}". Cartas parecidas usarão esta posição.`);
    const lista = await qc.fetchQuery({ queryKey: ["assinatura-modelos"], queryFn: async () => {
      const { data } = await supabase.from("assinatura_modelos").select("*").order("nome"); return (data ?? []) as unknown as ModeloPosicao[];
    }, staleTime: 0 });
    // Reaplica o modelo nas outras cartas do lote que ainda não foram ajustadas.
    setCartas((cs) => cs.map((c, i) => {
      if (i === sel || c.status === "ajustada" || !c.paginas.length) return c;
      const loc = comLargura(localizarAssinatura(c.paginas, lista));
      return { ...c, loc, status: loc.confianca === "baixa" ? "revisao" : "pronta" };
    }));
    setNomeModelo("");
  };

  const locAtual = atual ? (atual.rascunho ?? atual.loc) : null;
  const parecidas = locAtual && (atual?.status === "ajustada" || atual?.rascunho)
    ? cartas.filter((c, i) => i !== sel && c.status === "ajustada" && posicoesParecidas(c.loc, locAtual)).length : 0;
  const aptas = cartas.filter((c) => c.status === "pronta" || c.status === "ajustada");
  const pendentes = cartas.filter((c) => c.status === "revisao").length;
  const errosLoc = cartas.filter((c) => c.status === "erro_leitura").length;
  const contagem = resultado
    ? { total: resultado.length, sucesso: resultado.filter((r) => r.status === "ok").length, pendentes: resultado.filter((r) => r.status === "revisao").length, erro: resultado.filter((r) => r.status === "erro").length }
    : null;

  const processar = async () => {
    if (!assinante || !user) return;
    setProcessando(true); setProgresso(0); setResultado(null);
    const loteId = reprocesso?.lote.id ?? crypto.randomUUID();
    const marca = Date.now();
    try {
      const imgA = await baixar(assinante.assinatura_path!);
      const assinatura = { bytes: new Uint8Array(await imgA.arrayBuffer()), tipo: imgA.type || assinante.assinatura_path! };
      let rubrica = null;
      if (assinante.rubrica_path) {
        const imgR = await baixar(assinante.rubrica_path);
        rubrica = { bytes: new Uint8Array(await imgR.arrayBuffer()), tipo: imgR.type || assinante.rubrica_path };
      }
      const seguro = (n: string) => n.replace(/[^\w.\- ]/g, "_");
      const res = await emParalelo(cartas, 4, async (c, i): Promise<ArquivoProc> => {
        const l = c.loc;
        const base = { original_nome: c.arquivo.name };
        // O PDF original é guardado intacto, separado do assinado, para reprocessar falhas.
        let original_path: string | undefined;
        try {
          const p = `lotes/${loteId}/originais/${marca}-${i + 1}-${seguro(c.arquivo.name)}`;
          const { error } = await supabase.storage.from(BUCKET).upload(p, c.arquivo, { contentType: "application/pdf" });
          if (!error) original_path = p;
        } catch { /* segue sem cópia */ }
        const detalhe = { pagina: l.pagina, referencia: l.referencia, confianca: l.confianca, origem: l.origem, x: l.x, y: l.y, largura: l.largura, margem_superior: l.margem_superior, margem_inferior: l.margem_inferior };
        try {
          if (c.status === "revisao" || c.status === "erro_leitura") {
            return { ...base, original_path, nome: c.arquivo.name, status: "revisao", erro: c.status === "erro_leitura" ? "Não foi possível ler o texto do PDF" : "Local da assinatura não encontrado com segurança", ...detalhe };
          }
          try {
            const saida = await assinarPdf(new Uint8Array(await c.arquivo.arrayBuffer()), assinatura, rubrica, { x: l.x, y: l.y, largura: l.largura }, l.pagina);
            const path = `lotes/${loteId}/${marca}-${i + 1}-${seguro(nomeAssinado(c.arquivo.name))}`;
            const { error } = await supabase.storage.from(BUCKET).upload(path, new Blob([saida as BlobPart], { type: "application/pdf" }), { contentType: "application/pdf" });
            if (error) throw new Error("upload:" + error.message);
            return { ...base, original_path, nome: nomeAssinado(c.arquivo.name), status: "ok", path, ...detalhe };
          } catch (e: any) {
            const m = String(e?.message ?? "");
            const erro = m.includes("encrypt") ? "PDF protegido por senha"
              : m.startsWith("upload:") ? "Falha ao salvar o PDF assinado (verifique a internet)"
              : m.includes("Invalid PDF") || m.includes("parse") ? "PDF danificado ou inválido"
              : "Não foi possível assinar este PDF";
            return { ...base, original_path, nome: c.arquivo.name, status: "erro", erro, ...detalhe };
          }
        } finally { setProgresso((p) => p + 1); }
      });
      const sucessoLote = res.filter((r) => r.status === "ok").length;
      let error;
      if (reprocesso) {
        // Substitui só as cartas reprocessadas; as já assinadas continuam no lote.
        const novos = new Set(res.map((r) => r.original_nome));
        const todos = [...reprocesso.lote.arquivos.filter((a) => !novos.has(a.original_nome ?? a.nome)), ...res];
        const sucesso = todos.filter((r) => r.status === "ok").length;
        ({ error } = await supabase.from("assinaturas_processamentos").update({
          arquivos: todos as any, total: todos.length, sucesso, erro: todos.length - sucesso,
          status: statusLote(todos.length, sucesso), reprocessado_em: new Date().toISOString(), nome_lote: nomeLote.trim() || null,
        }).eq("id", loteId));
        onReprocessoFim();
      } else {
        const { data: nomeUsuario } = await supabase.rpc("get_my_username" as any);
        ({ error } = await supabase.from("assinaturas_processamentos").insert({
          id: loteId, usuario_id: user.id, usuario_nome: (nomeUsuario as string) ?? user.email ?? null,
          assinante_id: assinante.id, assinante_nome: assinante.nome, total: res.length, sucesso: sucessoLote, erro: res.length - sucessoLote, arquivos: res as any,
          nome_lote: nomeLote.trim() || `Lote ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`,
          status: statusLote(res.length, sucessoLote),
        }));
      }
      if (error) toast.error("As cartas foram assinadas, mas o histórico não foi salvo.");
      setResultado(res);
      toast.success(`${sucessoLote} de ${res.length} carta(s) assinada(s).`);
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
          {reprocesso && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs flex items-center justify-between gap-2">
              <span>Reprocessando {reprocesso.arquivos.length} carta(s) com falha do lote "{reprocesso.lote.nome_lote ?? "sem nome"}". As já assinadas não serão alteradas.</span>
              <Button size="sm" variant="ghost" onClick={() => { onReprocessoFim(); setCartas([]); setResultado(null); }}>Cancelar</Button>
            </div>
          )}
          <div>
            <Label>Nome do lote</Label>
            <Input placeholder="Ex.: Cartas de cancelamento — novembro" value={nomeLote} onChange={(e) => setNomeLote(e.target.value)} />
          </div>
          <div>
            <Label>Assinante</Label>
            <Select value={assinanteId} onValueChange={setAssinanteId}>
              <SelectTrigger><SelectValue placeholder={ativos.length ? "Escolha o assinante" : "Cadastre um assinante ativo primeiro"} /></SelectTrigger>
              <SelectContent>{ativos.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}{a.cargo ? ` — ${a.cargo}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cartas em PDF (uma ou várias)</Label>
            <Input type="file" accept="application/pdf,.pdf" multiple onChange={(e) => escolher(e.target.files ? Array.from(e.target.files) : null)} />
            {analisando && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Procurando o local da assinatura… {progresso} carta(s) analisada(s)</p>}
          </div>
          {cartas.length > 0 && (
            <div className="grid grid-cols-4 gap-2 text-center">
              {[["Total", cartas.length, ""], ["Prontas", aptas.length, "text-primary"], ["Precisam revisão", pendentes, "text-amber-600 dark:text-amber-400"], ["Erro ao localizar", errosLoc, "text-destructive"]].map(([t, n, cor]) => (
                <div key={t as string} className="rounded-md border p-2"><div className={`text-lg font-semibold ${cor}`}>{n}</div><div className="text-[11px] text-muted-foreground">{t}</div></div>
              ))}
            </div>
          )}
          {cartas.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[520px] overflow-auto pr-1">
              {cartas.map((c, i) => (
                <button key={i} type="button" onClick={() => setSel(i)}
                  className={`text-left rounded-md border p-1.5 space-y-1 hover:border-primary/60 ${i === sel ? "border-primary ring-1 ring-primary" : ""}`}>
                  <MiniPrevia carta={c} assinaturaUrl={assinaturaUrl} />
                  <div className="truncate text-xs" title={c.arquivo.name}>{c.arquivo.name}</div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className={`text-[10px] px-1.5 ${COR_CONF[c.loc.confianca]}`}>{ROTULO_CONFIANCA[c.loc.confianca]}</Badge>
                    <Badge variant={c.status === "revisao" || c.status === "erro_leitura" ? "destructive" : "secondary"} className="text-[10px] px-1.5">{ROTULO_STATUS[c.status]}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
          {pendentes + errosLoc > 0 && <p className="text-xs text-destructive">{pendentes + errosLoc} carta(s) ficarão pendentes. Abra cada uma, posicione a assinatura e clique em "Salvar ajuste".</p>}
          {assinante?.rubrica_path && <p className="text-xs text-muted-foreground">A rubrica será colocada no canto inferior direito de todas as páginas.</p>}
          <Button onClick={processar} disabled={!assinante || !aptas.length || processando || analisando} className="w-full">
            {processando ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Assinando {progresso} de {cartas.length}…</> : <><Upload className="h-4 w-4 mr-1" />Assinar em lote ({aptas.length})</>}
          </Button>
          {contagem && (
            <div className="grid grid-cols-4 gap-2 text-center">
              {[["Total", contagem.total, ""], ["Assinadas", contagem.sucesso, "text-primary"], ["Pendentes", contagem.pendentes, "text-amber-600 dark:text-amber-400"], ["Com erro", contagem.erro, "text-destructive"]].map(([t, n, cor]) => (
                <div key={t as string} className="rounded-md border p-2"><div className={`text-lg font-semibold ${cor}`}>{n}</div><div className="text-[11px] text-muted-foreground">{t}</div></div>
              ))}
            </div>
          )}
          {resultado && <ListaArquivos arquivos={resultado} />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Posição da assinatura</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {atual ? (
            <>
              <PreviaPosicao carta={atual} assinaturaUrl={assinaturaUrl} rubricaUrl={rubricaUrl} onAjustar={ajustar} />
              <div className="flex gap-2 max-w-[520px]">
                <Button onClick={salvarAjuste} disabled={!atual.rascunho}>Salvar ajuste</Button>
                <Button variant="outline" onClick={descartarAjuste} disabled={!atual.rascunho}>Descartar</Button>
                {atual.rascunho && <span className="text-xs text-amber-600 dark:text-amber-400 self-center">Ajuste não salvo</span>}
              </div>
              {atual.paginas.length > 0 && (
                <div className="max-w-[520px] space-y-1 border-t pt-3">
                  {parecidas > 0 && <p className="text-xs text-primary">Você já ajustou {parecidas + 1} cartas nesta mesma posição. Salve como modelo para que as próximas sejam posicionadas sozinhas.</p>}
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

function ListaArquivos({ arquivos, nomeZip = "cartas-assinadas" }: { arquivos: ArquivoProc[]; nomeZip?: string }) {
  const [visualizando, setVisualizando] = useState<{ nome: string; url: string } | null>(null);
  const fecharVisualizacao = () => { if (visualizando) URL.revokeObjectURL(visualizando.url); setVisualizando(null); };
  const ver = async (a: ArquivoProc) => {
    try {
      const url = URL.createObjectURL(await baixar(a.path!));
      if (visualizando) URL.revokeObjectURL(visualizando.url);
      setVisualizando({ nome: a.nome, url });
    } catch { toast.error("Arquivo não encontrado."); }
  };
  const baixarUm = async (a: ArquivoProc) => { try { salvarBlob(await baixar(a.path!), a.nome); } catch { toast.error("Arquivo não encontrado."); } };
  const baixarTodos = async () => {
    const t = toast.loading("Montando o ZIP…");
    try {
      const zip = new JSZip();
      const oks = arquivos.filter((x) => x.status === "ok");
      const blobs = await emParalelo(oks, 6, (a) => baixar(a.path!));
      oks.forEach((a, i) => zip.file(a.nome, blobs[i]));
      salvarBlob(await zip.generateAsync({ type: "blob" }), `${nomeZip.replace(/[^\w\- ]/g, "_")}.zip`);
      toast.success("ZIP baixado.", { id: t });
    } catch { toast.error("Não foi possível montar o ZIP.", { id: t }); }
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
      <Dialog open={!!visualizando} onOpenChange={(o) => { if (!o) fecharVisualizacao(); }}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle className="text-base truncate pr-6">{visualizando?.nome}</DialogTitle></DialogHeader>
          {visualizando && <iframe src={visualizando.url} title={visualizando.nome} className="flex-1 w-full rounded-md border bg-muted/30" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------ Histórico ------------------------------ */
const COR_LOTE: Record<StatusLote, string> = {
  concluido: "bg-primary/15 text-primary border-primary/30",
  parcial: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  falhou: "bg-destructive/15 text-destructive border-destructive/30",
};
function AbaHistorico({ lista, onReprocessar }: { lista: Processamento[]; onReprocessar: (r: Reprocesso) => void }) {
  const [aberto, setAberto] = useState<Processamento | null>(null);
  const [de, setDe] = useState(""); const [ate, setAte] = useState("");
  const [fAssin, setFAssin] = useState("todos"); const [fUser, setFUser] = useState("todos");
  const [fStatus, setFStatus] = useState("todos"); const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState<string | null>(null);
  const assinantesL = [...new Set(lista.map((p) => p.assinante_nome))].sort();
  const usuariosL = [...new Set(lista.map((p) => p.usuario_nome ?? "—"))].sort();
  const dia = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const filtrada = lista.filter((p) => {
    const d = dia(p.criado_em);
    if (de && d < de) return false; if (ate && d > ate) return false;
    if (fAssin !== "todos" && p.assinante_nome !== fAssin) return false;
    if (fUser !== "todos" && (p.usuario_nome ?? "—") !== fUser) return false;
    if (fStatus !== "todos" && (p.status ?? statusLote(p.total, p.sucesso)) !== fStatus) return false;
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      if (!(p.nome_lote ?? "").toLowerCase().includes(q) && !p.arquivos.some((x) => (x.original_nome ?? x.nome).toLowerCase().includes(q))) return false;
    }
    return true;
  });
  const reprocessar = async (p: Processamento) => {
    const falhas = p.arquivos.filter((x) => x.status !== "ok");
    const comOriginal = falhas.filter((x) => x.original_path);
    if (!comOriginal.length) return toast.error("Este lote é antigo e não guardou os PDFs originais. Envie as cartas novamente em \"Processar Cartas\".");
    setCarregando(p.id);
    try {
      const arquivos = await emParalelo(comOriginal, 6, async (x) => new File([await baixar(x.original_path!)], x.original_nome ?? x.nome, { type: "application/pdf" }));
      if (comOriginal.length < falhas.length) toast.warning(`${falhas.length - comOriginal.length} carta(s) sem PDF original guardado ficaram de fora.`);
      setAberto(null);
      onReprocessar({ lote: p, arquivos });
    } catch { toast.error("Não foi possível carregar os PDFs originais."); }
    finally { setCarregando(null); }
  };
  const limpar = () => { setDe(""); setAte(""); setFAssin("todos"); setFUser("todos"); setFStatus("todos"); setBusca(""); };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4 text-primary" />Histórico de Processamentos</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-6 rounded-md border p-3 bg-muted/30">
          <div className="md:col-span-2"><Label className="text-xs">Buscar lote ou carta</Label><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do lote ou do arquivo" /></div>
          <div><Label className="text-xs">De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
          <div><Label className="text-xs">Assinante</Label>
            <Select value={fAssin} onValueChange={setFAssin}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos</SelectItem>{assinantesL.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">Usuário</Label>
            <Select value={fUser} onValueChange={setFUser}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos</SelectItem>{usuariosL.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">Status</Label>
            <Select value={fStatus} onValueChange={setFStatus}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos</SelectItem>{(Object.keys(ROTULO_STATUS_LOTE) as StatusLote[]).map((k) => <SelectItem key={k} value={k}>{ROTULO_STATUS_LOTE[k]}</SelectItem>)}</SelectContent></Select></div>
          <div className="md:col-span-5 flex items-end text-xs text-muted-foreground">{filtrada.length} de {lista.length} lote(s)</div>
          <div className="flex items-end"><Button size="sm" variant="ghost" onClick={limpar} className="w-full">Limpar filtros</Button></div>
        </div>
        {filtrada.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Nenhum processamento encontrado.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Lote</TableHead><TableHead>Data e hora</TableHead><TableHead>Usuário</TableHead><TableHead>Assinante</TableHead><TableHead className="text-right">Arquivos</TableHead><TableHead className="text-right">Assinadas</TableHead><TableHead className="text-right">Falhas</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {filtrada.map((p) => {
                const st = (p.status ?? statusLote(p.total, p.sucesso)) as StatusLote;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium max-w-[220px] truncate" title={p.nome_lote ?? ""}>{p.nome_lote ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(p.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      {p.reprocessado_em && <div className="text-[11px] text-muted-foreground">Reprocessado {new Date(p.reprocessado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</div>}</TableCell>
                    <TableCell>{p.usuario_nome ?? "—"}</TableCell>
                    <TableCell>{p.assinante_nome}</TableCell>
                    <TableCell className="text-right">{p.total}</TableCell>
                    <TableCell className="text-right text-primary font-medium">{p.sucesso}</TableCell>
                    <TableCell className={`text-right ${p.erro ? "text-destructive font-medium" : ""}`}>{p.erro}</TableCell>
                    <TableCell><Badge variant="outline" className={COR_LOTE[st]}>{ROTULO_STATUS_LOTE[st]}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button size="sm" variant="ghost" onClick={() => setAberto(p)}><Eye className="h-4 w-4 mr-1" />Ver / baixar</Button>
                      {p.erro > 0 && <Button size="sm" variant="ghost" disabled={carregando === p.id} onClick={() => reprocessar(p)}>
                        {carregando === p.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}Reprocessar falhas</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{aberto?.nome_lote ?? "Lote"} — {aberto?.assinante_nome}</DialogTitle></DialogHeader>
          {aberto && (() => {
            const falhas = aberto.arquivos.filter((x) => x.status !== "ok");
            return (
              <div className="space-y-4">
                {falhas.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-destructive">Cartas não assinadas ({falhas.length})</h4>
                      <Button size="sm" variant="outline" disabled={carregando === aberto.id} onClick={() => reprocessar(aberto)}><RotateCcw className="h-4 w-4 mr-1" />Reprocessar só as falhas</Button>
                    </div>
                    <div className="divide-y rounded-md border max-h-48 overflow-auto">
                      {falhas.map((x, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                          <span className="truncate">{x.original_nome ?? x.nome}</span>
                          <span className="text-xs text-destructive shrink-0">{x.erro ?? "Motivo não informado"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Cartas assinadas ({aberto.arquivos.length - falhas.length})</h4>
                  <ListaArquivos arquivos={aberto.arquivos.filter((x) => x.status === "ok")} nomeZip={aberto.nome_lote ?? "cartas-assinadas"} />
                </div>
              </div>
            );
          })()}
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
      const { data, error } = await supabase.from("assinaturas_processamentos").select("*").order("criado_em", { ascending: false }).limit(1000);
      if (error) throw error; return (data ?? []) as unknown as Processamento[];
    },
  });
  const [aba, setAba] = useState("processar");
  const [reprocesso, setReprocesso] = useState<Reprocesso | null>(null);
  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><FileSignature className="h-6 w-6 text-primary" />Assinaturas</h1>
        <p className="text-sm text-muted-foreground">Coloque a imagem da assinatura nas cartas em PDF, uma a uma ou em lote.</p>
      </div>
      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="processar">Processar Cartas</TabsTrigger>
          <TabsTrigger value="assinantes">Cadastro de Assinantes</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Processamentos</TabsTrigger>
        </TabsList>
        <TabsContent value="processar"><AbaProcessar assinantes={assinantes.data ?? []} reprocesso={reprocesso} onReprocessoFim={() => setReprocesso(null)} onConcluido={() => qc.invalidateQueries({ queryKey: ["assinaturas-processamentos"] })} /></TabsContent>
        <TabsContent value="assinantes"><AbaAssinantes assinantes={assinantes.data ?? []} /></TabsContent>
        <TabsContent value="historico"><AbaHistorico lista={historico.data ?? []} onReprocessar={(r) => { setReprocesso(r); setAba("processar"); }} /></TabsContent>
      </Tabs>
    </div>
  );
}
