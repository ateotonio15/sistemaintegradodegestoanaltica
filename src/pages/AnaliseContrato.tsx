import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extrairTextoContrato } from "@/lib/contrato-text-extract";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileSearch, Upload, Loader2, Plus, Trash2, CheckCircle2, XCircle,
  AlertTriangle, Download, ClipboardCopy, Link2,
} from "lucide-react";

type Criterio = { criterio: string; atendido: boolean | "indeterminado" | null; observacao?: string | null };

type Resultado = {
  contratante?: { nome?: string | null; cnpj?: string | null } | null;
  contratado?: { nome?: string | null; documento?: string | null; tipo_documento?: string | null } | null;
  tipo_vinculo?: string | null;
  valor_honorarios?: string | null;
  data_assinatura?: string | null;
  assinado_por_ambas_partes?: boolean | null;
  clausula_formalizacao_pj?: boolean | null;
  vigencia?: string | null;
  criterios_atendidos?: Criterio[] | null;
  status_elegibilidade?: string | null;
  alertas?: string[] | null;
};

const CRITERIOS_PADRAO = [
  "O CNPJ do contratado deve ter sido constituído especificamente para a prestação de serviços vinculada à FUTURA (não pode ser empresa com existência/operação independente própria)",
  "Contrato deve ser PJ com CNPJ ativo formalizado",
  "Vínculo de prestação de serviços exclusivo com a FUTURA (sem indícios de outros clientes)",
  "Vigência mínima de 12 meses a partir da data de assinatura",
  "Contrato deve estar assinado por ambas as partes",
  "Valor de honorários informado no contrato",
];

const STORAGE_KEY = "analise-contrato-criterios";

function statusTone(status?: string | null) {
  const s = (status || "").toLowerCase();
  if (s.includes("não") || s.includes("nao")) return "bg-destructive/15 text-destructive border-destructive/30";
  if (s.includes("elegível") || s.includes("elegivel")) return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
  return "bg-amber-500/15 text-amber-600 border-amber-500/30";
}

function Bool({ value }: { value: boolean | null | undefined }) {
  if (value === true) return <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Sim</span>;
  if (value === false) return <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" /> Não</span>;
  return <span className="text-muted-foreground">—</span>;
}

function Campo({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium break-words">{value?.toString().trim() || "—"}</p>
    </div>
  );
}

export default function AnaliseContrato() {
  const [criterios, setCriterios] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) && parsed.length ? parsed : CRITERIOS_PADRAO;
    } catch {
      return CRITERIOS_PADRAO;
    }
  });
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [extraindo, setExtraindo] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [vincularId, setVincularId] = useState("");
  const [salvandoVinculo, setSalvandoVinculo] = useState(false);

  const { data: implantacoes = [] } = useQuery({
    queryKey: ["implantacoes-vinculo-analise"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes_contratos" as any)
        .select("id, nome_empresa, codigo_contrato")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const vincular = async () => {
    if (!vincularId || !resultado) return;
    setSalvandoVinculo(true);
    const { error } = await supabase
      .from("implantacoes_contratos" as any)
      .update({ analise_contrato: resultado as any, analise_contrato_em: new Date().toISOString() })
      .eq("id", vincularId);
    setSalvandoVinculo(false);
    if (error) {
      toast.error("Não foi possível vincular: " + error.message);
      return;
    }
    toast.success("Análise vinculada. Execute a Validação Cruzada no fluxo do contrato.");
  };


  const salvarCriterios = (lista: string[]) => {
    setCriterios(lista);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lista)); } catch { /* ignore */ }
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    setExtraindo(true);
    setResultado(null);
    try {
      const t = await extrairTextoContrato(file);
      setTexto(t);
      setArquivo(file.name);
      toast.success(`Texto extraído de ${file.name}`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao ler o arquivo");
    } finally {
      setExtraindo(false);
    }
  };

  const analisar = async () => {
    if (!texto.trim()) { toast.error("Envie um contrato ou cole o texto."); return; }
    setAnalisando(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("analisar-contrato", {
        body: { texto, criterios: criterios.filter((c) => c.trim()) },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResultado((data as any)?.data ?? {});
      toast.success("Análise concluída");
    } catch (e: any) {
      toast.error(e?.message || "Falha na análise");
    } finally {
      setAnalisando(false);
    }
  };

  const baixarJson = () => {
    const blob = new Blob([JSON.stringify(resultado, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analise-contrato-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <FileSearch className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Análise de Contrato — Elegibilidade</h1>
          <p className="text-sm text-muted-foreground">
            Envie o contrato de prestação de serviços (PDF, DOCX ou TXT) e verifique automaticamente os critérios de inclusão no plano empresarial.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">1. Contrato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition hover:border-primary/50 hover:bg-muted/40">
                {extraindo ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                <span className="text-sm font-medium">{arquivo ?? "Clique para enviar PDF, DOCX ou TXT"}</span>
                <span className="text-xs text-muted-foreground">O texto é extraído no navegador antes da análise</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </label>
              <Textarea
                value={texto}
                onChange={(e) => { setTexto(e.target.value); setArquivo(null); }}
                placeholder="Ou cole aqui o texto do contrato..."
                className="min-h-[160px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">{texto.length.toLocaleString("pt-BR")} caracteres</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">2. Critérios de elegibilidade da operadora</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {criterios.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 text-xs text-muted-foreground">{i + 1}.</span>
                  <Input
                    value={c}
                    onChange={(e) => salvarCriterios(criterios.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder="Descreva o critério"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => salvarCriterios(criterios.filter((_, j) => j !== i))}
                    aria-label="Remover critério"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => salvarCriterios([...criterios, ""])}>
                  <Plus className="mr-1.5 h-4 w-4" /> Adicionar critério
                </Button>
                <Button variant="ghost" size="sm" onClick={() => salvarCriterios(CRITERIOS_PADRAO)}>
                  Restaurar padrão
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={analisar} disabled={analisando || extraindo}>
            {analisando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando...</> : <><FileSearch className="mr-2 h-4 w-4" /> Analisar contrato</>}
          </Button>
        </div>

        <Card className="min-h-[300px]">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Resultado</CardTitle>
            {resultado && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(JSON.stringify(resultado, null, 2)); toast.success("JSON copiado"); }}>
                  <ClipboardCopy className="mr-1.5 h-4 w-4" /> JSON
                </Button>
                <Button variant="outline" size="sm" onClick={baixarJson}>
                  <Download className="mr-1.5 h-4 w-4" /> Baixar
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {resultado && (
              <div className="mb-4 space-y-2 rounded-xl border bg-muted/30 p-3">
                <p className="text-sm font-medium">Vincular à proposta de implantação (Validação Cruzada)</p>
                <p className="text-xs text-muted-foreground">
                  Ao vincular, este resultado passa a ser comparado automaticamente com os dados do Anexo I da proposta.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={vincularId} onValueChange={setVincularId}>
                    <SelectTrigger className="sm:flex-1"><SelectValue placeholder="Selecione a proposta" /></SelectTrigger>
                    <SelectContent>
                      {implantacoes.map((i: any) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.nome_empresa || "Sem nome"}{i.codigo_contrato ? ` · ${i.codigo_contrato}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={vincular} disabled={!vincularId || salvandoVinculo}>
                    {salvandoVinculo ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Link2 className="mr-1.5 h-4 w-4" />}
                    Vincular análise
                  </Button>
                </div>
              </div>
            )}

            {!resultado ? (
              <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <FileSearch className="h-8 w-8 opacity-40" />
                Envie um contrato e clique em “Analisar contrato”.
              </div>
            ) : (
              <div className="space-y-5">
                <div className={`rounded-xl border px-4 py-3 ${statusTone(resultado.status_elegibilidade)}`}>
                  <p className="text-[11px] uppercase tracking-wide opacity-80">Status de elegibilidade</p>
                  <p className="text-lg font-semibold capitalize">{resultado.status_elegibilidade || "revisar manualmente"}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo label="Contratante" value={resultado.contratante?.nome} />
                  <Campo label="CNPJ contratante" value={resultado.contratante?.cnpj} />
                  <Campo label="Contratado" value={resultado.contratado?.nome} />
                  <Campo
                    label={`Documento (${resultado.contratado?.tipo_documento || "—"})`}
                    value={resultado.contratado?.documento}
                  />
                  <Campo label="Tipo de vínculo" value={resultado.tipo_vinculo} />
                  <Campo label="Valor de honorários" value={resultado.valor_honorarios} />
                  <Campo label="Data de assinatura" value={resultado.data_assinatura} />
                  <Campo label="Vigência" value={resultado.vigencia} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Assinado por ambas as partes</p>
                    <div className="mt-1"><Bool value={resultado.assinado_por_ambas_partes} /></div>
                  </div>
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cláusula de formalização PJ</p>
                    <div className="mt-1"><Bool value={resultado.clausula_formalizacao_pj} /></div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Critérios avaliados</p>
                  {(resultado.criterios_atendidos ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum critério avaliado.</p>
                  )}
                  {(resultado.criterios_atendidos ?? []).map((c, i) => {
                    const ok = c.atendido === true;
                    const nok = c.atendido === false;
                    return (
                      <div key={i} className="rounded-lg border p-3">
                        <div className="flex items-start gap-2">
                          {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            : nok ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                            : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{c.criterio}</p>
                            {c.observacao && <p className="mt-0.5 text-xs text-muted-foreground">{c.observacao}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(resultado.alertas ?? []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Alertas para verificação humana</p>
                    {(resultado.alertas ?? []).map((a, i) => (
                      <Badge key={i} variant="outline" className="mr-1 whitespace-normal border-amber-500/40 bg-amber-500/10 text-left text-amber-600">
                        {a}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
