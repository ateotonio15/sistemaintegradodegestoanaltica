import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  FolderArchive,
  Search,
  FileSpreadsheet,
  FileText,
  Receipt,
  FileBadge,
  File,
  Download,
  Eye,
  Building2,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/date-utils";

type Categoria =
  | "Excel faturamento"
  | "Nota fiscal"
  | "Boleto"
  | "Recibos"
  | "Movimentação"
  | "Outros";

const CATEGORIAS: Categoria[] = [
  "Excel faturamento",
  "Nota fiscal",
  "Boleto",
  "Recibos",
  "Movimentação",
  "Outros",
];

const BUCKET_FIN = "anexos-financeiro";
const BUCKET_OP = "anexos-movimentacoes";

interface Empresa {
  id: string;
  nome: string;
  codigo_contrato: string | null;
  cnpj: string | null;
}

interface ArquivoItem {
  id: string;
  empresa_id: string;
  competencia: string; // "MM/YYYY"
  competencia_sort: string; // "YYYY-MM"
  categoria: Categoria;
  nome_arquivo: string;
  storage_path: string;
  bucket: string;
  origem_label: "Movimentação" | "Financeiro";
  origem_extra: string | null; // ex: "cobranca"
  mime_type: string | null;
  tamanho_bytes: number | null;
  created_at: string;
  uploaded_by: string | null;
  uploader_nome: string | null;
}

function classify(
  nome: string,
  mime: string | null,
  source: "movimentacao" | "financeiro",
  origem: string | null,
): Categoria {
  if (source === "movimentacao") return "Movimentação";
  const lower = nome.toLowerCase();
  const m = (mime ?? "").toLowerCase();
  const isPdf = m.includes("pdf") || lower.endsWith(".pdf");
  const isExcel =
    m.includes("spreadsheet") ||
    m.includes("excel") ||
    m.includes("csv") ||
    /\.(xlsx|xls|csv)$/i.test(lower);

  if (isExcel) return "Excel faturamento";
  if (origem === "cobranca") return "Boleto";
  if (isPdf && /(boleto)/i.test(lower)) return "Boleto";
  if (isPdf && /(nfse|nfs|nota)/i.test(lower)) return "Nota fiscal";
  if (isPdf && /(recibo)/i.test(lower)) return "Recibos";
  return "Outros";
}

function compToLabel(mes: string | number, ano: string | number): string {
  const mm = String(mes).padStart(2, "0");
  return `${mm}/${ano}`;
}
function compToSort(mes: string | number, ano: string | number): string {
  const mm = String(mes).padStart(2, "0");
  return `${ano}-${mm}`;
}

function formatBytes(b: number | null): string {
  if (!b && b !== 0) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function iconForCategoria(cat: Categoria) {
  switch (cat) {
    case "Excel faturamento":
      return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
    case "Nota fiscal":
      return <FileBadge className="h-4 w-4 text-blue-500" />;
    case "Boleto":
      return <Receipt className="h-4 w-4 text-amber-500" />;
    case "Recibos":
      return <FileText className="h-4 w-4 text-violet-500" />;
    case "Movimentação":
      return <FileText className="h-4 w-4 text-slate-500" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function Arquivos() {
  const [search, setSearch] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState<string>("todas");
  const [competenciaFilter, setCompetenciaFilter] = useState<string>("todas");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("todas");

  const { data: empresas = [] } = useQuery({
    queryKey: ["arquivos-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, cnpj")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Empresa[];
    },
  });

  const { data: arquivos = [], isLoading } = useQuery({
    queryKey: ["arquivos-todos"],
    queryFn: async () => {
      const [movsOpRes, movsFinRes, anxOpRes, anxFinRes] = await Promise.all([
        supabase
          .from("movimentacoes")
          .select("id, empresa_id, mes_referencia, periodo"),
        supabase
          .from("financeiro_movimentacoes")
          .select("id, empresa_id, mes_referencia, periodo"),
        supabase
          .from("anexos_movimentacao")
          .select(
            "id, movimentacao_id, empresa_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, created_at, uploaded_by",
          ),
        supabase
          .from("anexos_financeiro")
          .select(
            "id, financeiro_movimentacao_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, created_at, uploaded_by, origem",
          ),
      ]);

      if (movsOpRes.error) throw movsOpRes.error;
      if (movsFinRes.error) throw movsFinRes.error;
      if (anxOpRes.error) throw anxOpRes.error;
      if (anxFinRes.error) throw anxFinRes.error;

      const movOpMap = new Map(
        (movsOpRes.data ?? []).map((m: any) => [m.id, m]),
      );
      const movFinMap = new Map(
        (movsFinRes.data ?? []).map((m: any) => [m.id, m]),
      );

      const items: ArquivoItem[] = [];

      for (const a of anxOpRes.data ?? []) {
        const mov: any = movOpMap.get((a as any).movimentacao_id);
        if (!mov) continue;
        // mes_referencia armazenado como "MM/YYYY" ou similar; tentar parse
        const { mes, ano } = parseMesRef(mov.mes_referencia);
        items.push({
          id: (a as any).id,
          empresa_id: (a as any).empresa_id,
          competencia: compToLabel(mes, ano),
          competencia_sort: compToSort(mes, ano),
          categoria: classify(
            (a as any).nome_arquivo,
            (a as any).mime_type,
            "movimentacao",
            null,
          ),
          nome_arquivo: (a as any).nome_arquivo,
          storage_path: (a as any).storage_path,
          bucket: BUCKET_OP,
          origem_label: "Movimentação",
          origem_extra: null,
          mime_type: (a as any).mime_type,
          tamanho_bytes: (a as any).tamanho_bytes,
          created_at: (a as any).created_at,
          uploaded_by: (a as any).uploaded_by,
          uploader_nome: null,
        });
      }

      for (const a of anxFinRes.data ?? []) {
        const mov: any = movFinMap.get((a as any).financeiro_movimentacao_id);
        if (!mov) continue;
        const { mes, ano } = parseMesRef(mov.mes_referencia);
        items.push({
          id: (a as any).id,
          empresa_id: mov.empresa_id,
          competencia: compToLabel(mes, ano),
          competencia_sort: compToSort(mes, ano),
          categoria: classify(
            (a as any).nome_arquivo,
            (a as any).mime_type,
            "financeiro",
            (a as any).origem ?? null,
          ),
          nome_arquivo: (a as any).nome_arquivo,
          storage_path: (a as any).storage_path,
          bucket: BUCKET_FIN,
          origem_label: "Financeiro",
          origem_extra: (a as any).origem ?? null,
          mime_type: (a as any).mime_type,
          tamanho_bytes: (a as any).tamanho_bytes,
          created_at: (a as any).created_at,
          uploaded_by: (a as any).uploaded_by,
          uploader_nome: null,
        });
      }

      // Buscar nomes dos uploaders
      const userIds = Array.from(
        new Set(items.map((i) => i.uploaded_by).filter(Boolean) as string[]),
      );
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        const map = new Map(
          (profs ?? []).map((p: any) => [p.user_id, p.display_name ?? ""]),
        );
        for (const it of items) {
          if (it.uploaded_by) it.uploader_nome = map.get(it.uploaded_by) ?? null;
        }
      }

      return items;
    },
  });

  const competenciasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    arquivos.forEach((a) => set.add(a.competencia_sort));
    return Array.from(set).sort().reverse();
  }, [arquivos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return arquivos.filter((a) => {
      if (empresaFilter !== "todas" && a.empresa_id !== empresaFilter) return false;
      if (competenciaFilter !== "todas" && a.competencia_sort !== competenciaFilter)
        return false;
      if (categoriaFilter !== "todas" && a.categoria !== categoriaFilter) return false;
      if (!q) return true;
      const emp = empresas.find((e) => e.id === a.empresa_id);
      const hay = [
        a.nome_arquivo,
        a.competencia,
        emp?.nome,
        emp?.codigo_contrato,
        emp?.cnpj,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [arquivos, empresas, search, empresaFilter, competenciaFilter, categoriaFilter]);

  // Agrupar empresa -> competencia -> categoria
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { empresa: Empresa | null; total: number; competencias: Map<string, ArquivoItem[]> }
    >();
    for (const it of filtered) {
      let g = map.get(it.empresa_id);
      if (!g) {
        const empresa = empresas.find((e) => e.id === it.empresa_id) ?? null;
        g = { empresa, total: 0, competencias: new Map() };
        map.set(it.empresa_id, g);
      }
      g.total += 1;
      const compKey = it.competencia_sort;
      if (!g.competencias.has(compKey)) g.competencias.set(compKey, []);
      g.competencias.get(compKey)!.push(it);
    }
    return Array.from(map.entries())
      .map(([id, g]) => ({
        id,
        empresa: g.empresa,
        total: g.total,
        competencias: Array.from(g.competencias.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([k, v]) => ({ key: k, label: v[0]?.competencia ?? k, items: v })),
      }))
      .sort((a, b) =>
        (a.empresa?.nome ?? "").localeCompare(b.empresa?.nome ?? "", "pt-BR"),
      );
  }, [filtered, empresas]);

  async function handleDownload(item: ArquivoItem) {
    try {
      const { data, error } = await supabase.storage
        .from(item.bucket)
        .download(item.storage_path);
      if (error || !data) throw error ?? new Error("Falha ao baixar");
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = item.nome_arquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      toast.error("Erro ao baixar: " + (e?.message ?? "desconhecido"));
    }
  }

  async function handlePreview(item: ArquivoItem) {
    try {
      const { data, error } = await supabase.storage
        .from(item.bucket)
        .createSignedUrl(item.storage_path, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("Falha ao gerar preview");
      window.open(data.signedUrl, "_blank", "noopener");
    } catch (e: any) {
      toast.error("Erro ao abrir preview: " + (e?.message ?? "desconhecido"));
    }
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <FolderArchive className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Arquivos</h1>
              <p className="text-sm text-muted-foreground">
                Central de anexos por empresa e competência
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            {filtered.length} arquivo{filtered.length === 1 ? "" : "s"}
          </Badge>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtros</CardTitle>
            <CardDescription>
              Refine por empresa, competência, categoria ou busque pelo nome do arquivo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative md:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, empresa, contrato, CNPJ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as empresas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={competenciaFilter} onValueChange={setCompetenciaFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Competência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as competências</SelectItem>
                  {competenciasDisponiveis.map((c) => {
                    const [y, m] = c.split("-");
                    return (
                      <SelectItem key={c} value={c}>
                        {m}/{y}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Carregando arquivos...
            </CardContent>
          </Card>
        ) : grouped.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum arquivo encontrado com os filtros atuais.
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-3">
            {grouped.map((g) => (
              <Card key={g.id} className="overflow-hidden">
                <AccordionItem value={g.id} className="border-0">
                  <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Building2 className="h-5 w-5 text-primary shrink-0" />
                      <div className="text-left min-w-0">
                        <p className="font-semibold truncate">
                          {g.empresa?.nome ?? "Empresa"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {g.empresa?.codigo_contrato ?? "—"}
                          {g.empresa?.cnpj ? ` · CNPJ ${g.empresa.cnpj}` : ""}
                        </p>
                      </div>
                      <Badge variant="secondary" className="ml-auto mr-3 shrink-0">
                        {g.total} arquivo{g.total === 1 ? "" : "s"}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5">
                    <Accordion type="multiple" className="space-y-2">
                      {g.competencias.map((comp) => {
                        const porCategoria = new Map<Categoria, ArquivoItem[]>();
                        for (const it of comp.items) {
                          if (!porCategoria.has(it.categoria))
                            porCategoria.set(it.categoria, []);
                          porCategoria.get(it.categoria)!.push(it);
                        }
                        return (
                          <AccordionItem
                            key={comp.key}
                            value={`${g.id}-${comp.key}`}
                            className="border rounded-lg bg-muted/20"
                          >
                            <AccordionTrigger className="px-4 py-3 hover:no-underline">
                              <div className="flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{comp.label}</span>
                                <Badge variant="outline" className="ml-2">
                                  {comp.items.length}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                              <div className="space-y-4">
                                {CATEGORIAS.filter((c) => porCategoria.has(c)).map(
                                  (cat) => (
                                    <div key={cat}>
                                      <div className="flex items-center gap-2 mb-2">
                                        {iconForCategoria(cat)}
                                        <h4 className="text-sm font-semibold">{cat}</h4>
                                        <Badge variant="secondary" className="text-xs">
                                          {porCategoria.get(cat)!.length}
                                        </Badge>
                                      </div>
                                      <ul className="space-y-1.5">
                                        {porCategoria.get(cat)!.map((it) => (
                                          <li
                                            key={`${it.bucket}-${it.id}`}
                                            className="flex items-center gap-3 text-sm bg-background border rounded-md px-3 py-2"
                                          >
                                            {iconForCategoria(it.categoria)}
                                            <div className="flex-1 min-w-0">
                                              <p
                                                className="truncate font-medium"
                                                title={it.nome_arquivo}
                                              >
                                                {it.nome_arquivo}
                                              </p>
                                              <p className="text-xs text-muted-foreground truncate">
                                                {formatDateBR(new Date(it.created_at))}
                                                {it.uploader_nome
                                                  ? ` · ${it.uploader_nome}`
                                                  : ""}
                                                {` · ${formatBytes(it.tamanho_bytes)}`}
                                                {` · `}
                                                <span className="inline-flex items-center gap-1">
                                                  <Badge
                                                    variant="outline"
                                                    className="text-[10px] py-0 px-1.5"
                                                  >
                                                    {it.origem_label}
                                                  </Badge>
                                                </span>
                                              </p>
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 shrink-0"
                                              onClick={() => handlePreview(it)}
                                              title="Visualizar"
                                            >
                                              <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 shrink-0"
                                              onClick={() => handleDownload(it)}
                                              title="Download"
                                            >
                                              <Download className="h-4 w-4" />
                                            </Button>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ),
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              </Card>
            ))}
          </Accordion>
        )}
      </div>
    </AppLayout>
  );
}

// Parse "MM/YYYY", "YYYY-MM" ou "YYYY-MM-DD"
function parseMesRef(value: string | null | undefined): { mes: string; ano: string } {
  if (!value) return { mes: "00", ano: "0000" };
  const v = value.trim();
  if (/^\d{2}\/\d{4}$/.test(v)) {
    const [m, y] = v.split("/");
    return { mes: m, ano: y };
  }
  if (/^\d{4}-\d{2}/.test(v)) {
    const [y, m] = v.split("-");
    return { mes: m, ano: y };
  }
  return { mes: "00", ano: v };
}
