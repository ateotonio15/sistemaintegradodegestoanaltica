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
import { assinarPdf, nomeAssinado, POSICAO_PADRAO, RUBRICA_LARGURA, type PosicaoAssinatura } from "@/lib/assinatura-cartas";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;
const BUCKET = "assinaturas-cartas";
const TIPOS_IMG = ["image/png", "image/jpeg"];

interface Assinante {
  id: string; nome: string; cargo: string | null; assinatura_path: string | null;
  rubrica_path: string | null; ativo: boolean; observacao: string | null;
}
interface ArquivoProc { nome: string; status: "ok" | "erro"; path?: string; erro?: string }
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
function PreviaPosicao({ arquivo, assinaturaUrl, rubricaUrl, pos, setPos }: {
  arquivo: File; assinaturaUrl: string | null; rubricaUrl: string | null; pos: PosicaoAssinatura; setPos: (p: PosicaoAssinatura) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [proporcao, setProporcao] = useState(1.414);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let cancel = false;
    (async () => {
      setCarregando(true);
      try {
        const doc = await (pdfjsLib as any).getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
        const pagina = await doc.getPage(doc.numPages);
        const vp1 = pagina.getViewport({ scale: 1 });
        const vp = pagina.getViewport({ scale: 520 / vp1.width });
        const c = canvasRef.current; if (!c || cancel) return;
        c.width = vp.width; c.height = vp.height; setProporcao(vp.height / vp.width);
        await pagina.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      } catch { toast.error("Não foi possível mostrar a prévia deste PDF."); }
      finally { if (!cancel) setCarregando(false); }
    })();
    return () => { cancel = true; };
  }, [arquivo]);

  const clicar = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ ...pos, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Clique na última página para posicionar a assinatura. A posição vale para todas as cartas do lote.</p>
      <div className="relative w-full max-w-[520px] cursor-crosshair border rounded-md overflow-hidden bg-white" style={{ aspectRatio: `1 / ${proporcao}` }} onClick={clicar}>
        <canvas ref={canvasRef} className="w-full h-full" />
        {carregando && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
        {assinaturaUrl && (
          <img src={assinaturaUrl} alt="" className="absolute pointer-events-none outline outline-1 outline-dashed outline-primary"
            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, width: `${pos.largura * 100}%`, transform: "translate(-50%, -50%)" }} />
        )}
        {rubricaUrl && (
          <img src={rubricaUrl} alt="" className="absolute pointer-events-none opacity-80"
            style={{ right: "4%", bottom: "4%", width: `${RUBRICA_LARGURA * 100}%` }} />
        )}
      </div>
      <div className="max-w-[520px]">
        <Label className="text-xs">Tamanho da assinatura</Label>
        <Slider min={10} max={60} step={1} value={[Math.round(pos.largura * 100)]} onValueChange={([v]) => setPos({ ...pos, largura: v / 100 })} />
      </div>
    </div>
  );
}

function AbaProcessar({ assinantes, onConcluido }: { assinantes: Assinante[]; onConcluido: () => void }) {
  const { user } = useAuth();
  const ativos = assinantes.filter((a) => a.ativo && a.assinatura_path);
  const [assinanteId, setAssinanteId] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [pos, setPos] = useState<PosicaoAssinatura>(POSICAO_PADRAO);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<ArquivoProc[] | null>(null);
  const assinante = ativos.find((a) => a.id === assinanteId) ?? null;
  const assinaturaUrl = useImagem(assinante?.assinatura_path);
  const rubricaUrl = useImagem(assinante?.rubrica_path);

  const escolher = (lista: FileList | null) => {
    const pdfs = Array.from(lista ?? []).filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (lista && pdfs.length < lista.length) toast.warning("Apenas arquivos PDF são aceitos; os demais foram ignorados.");
    setArquivos(pdfs); setResultado(null);
  };

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
      for (let i = 0; i < arquivos.length; i++) {
        const f = arquivos[i];
        try {
          const saida = await assinarPdf(new Uint8Array(await f.arrayBuffer()), assinatura, rubrica, pos);
          const path = `lotes/${loteId}/${i + 1}-${nomeAssinado(f.name).replace(/[^\w.\- ]/g, "_")}`;
          const { error } = await supabase.storage.from(BUCKET).upload(path, new Blob([saida as BlobPart], { type: "application/pdf" }), { contentType: "application/pdf" });
          if (error) throw error;
          res.push({ nome: nomeAssinado(f.name), status: "ok", path });
        } catch (e: any) {
          res.push({ nome: f.name, status: "erro", erro: e?.message?.includes("encrypt") ? "PDF protegido por senha" : "Não foi possível assinar este PDF" });
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
            {arquivos.length > 0 && <p className="text-xs text-muted-foreground mt-1">{arquivos.length} carta(s) selecionada(s)</p>}
          </div>
          {assinante?.rubrica_path && <p className="text-xs text-muted-foreground">A rubrica será colocada no canto inferior direito de todas as páginas.</p>}
          <Button onClick={processar} disabled={!assinante || !arquivos.length || processando} className="w-full">
            {processando ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Assinando {progresso} de {arquivos.length}…</> : <><Upload className="h-4 w-4 mr-1" />Assinar {arquivos.length || ""} carta(s)</>}
          </Button>
          {resultado && <ListaArquivos arquivos={resultado} />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Posição da assinatura</CardTitle></CardHeader>
        <CardContent>
          {arquivos[0] ? <PreviaPosicao arquivo={arquivos[0]} assinaturaUrl={assinaturaUrl} rubricaUrl={rubricaUrl} pos={pos} setPos={setPos} />
            : <p className="text-sm text-muted-foreground py-10 text-center">Selecione as cartas para ver a prévia.</p>}
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
            ) : <Badge variant="destructive" className="shrink-0">{a.erro}</Badge>}
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
