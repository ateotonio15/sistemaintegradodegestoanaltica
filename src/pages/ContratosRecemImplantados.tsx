import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClockAlert, Search, Paperclip, Building2, RefreshCw, FileText, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatDateBR } from "@/lib/date-utils";
import { toast } from "sonner";
import { UploadArquivoDialog } from "@/components/arquivos/UploadArquivoDialog";

const TIPO_LABEL: Record<string, string> = {
  anexo_1: "Anexo 1",
  contrato: "Contrato",
  relatorio_vidas: "Relatório de Vidas",
  primeira_cobranca: "Relatórios da Primeira Cobrança",
  complementar: "Complementar",
};

interface EmpresaRow {
  id: string;
  nome: string;
  codigo_contrato: string | null;
  cnpj: string | null;
  data_implantacao: string | null;
  tipo_movimentacao: string | null;
  periodo_movimentacao: string | null;
  vidas: number | null;
  responsavel_contrato: string | null;
  primeira_competencia_financeira: string | null;
  status_implantacao: string | null;
}

function formatCompetencia(c?: string | null) {
  if (!c) return "—";
  const m = c.match(/^(\d{4})-(\d{2})$/);
  if (!m) return c;
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[Number(m[2]) - 1]}/${m[1]}`;
}

export default function ContratosRecemImplantados() {
  const { user, isAdmin, isComum, isFinanceiro, isDiretora, isAdministradoras } = useAuth();
  const queryClient = useQueryClient();
  const canAnexar = isAdmin || isComum || isAdministradoras;
  const [search, setSearch] = useState("");
  const [uploadEmpresa, setUploadEmpresa] = useState<EmpresaRow | null>(null);
  const [ativando, setAtivando] = useState(false);

  const { data: empresas = [], isLoading } = useQuery<EmpresaRow[]>({
    queryKey: ["contratos-recem-implantados"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select(
          "id, nome, codigo_contrato, cnpj, data_implantacao, tipo_movimentacao, periodo_movimentacao, vidas, responsavel_contrato, primeira_competencia_financeira, status_implantacao",
        )
        .eq("status_implantacao", "aguardando_primeiro_fechamento")
        .order("data_implantacao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EmpresaRow[];
    },
  });

  const empresaIds = useMemo(() => empresas.map((e) => e.id), [empresas]);

  const { data: anexosImpl = [] } = useQuery<any[]>({
    queryKey: ["recem-implantados-anexos", empresaIds],
    enabled: !!user && empresaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_anexos" as any)
        .select("id, empresa_id, tipo, nome_arquivo, storage_path, mime_type, created_at")
        .in("empresa_id", empresaIds);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const anexosPorEmpresa = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of anexosImpl) {
      const arr = map.get(a.empresa_id) ?? [];
      arr.push(a);
      map.set(a.empresa_id, arr);
    }
    return map;
  }, [anexosImpl]);

  const handleDownloadAnexo = async (a: any) => {
    const { data: arquivo, error } = await supabase.storage
      .from("anexos-implantacao")
      .download(a.storage_path);
    if (error || !arquivo) {
      toast.error("Não foi possível baixar o arquivo");
      return;
    }
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url;
    link.download = a.nome_arquivo || "anexo";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return empresas;
    return empresas.filter((e) =>
      (e.nome ?? "").toLowerCase().includes(t) ||
      (e.codigo_contrato ?? "").toLowerCase().includes(t) ||
      (e.cnpj ?? "").toLowerCase().includes(t),
    );
  }, [empresas, search]);

  const totalVidas = useMemo(
    () => empresas.reduce((acc, e) => acc + (e.vidas ?? 0), 0),
    [empresas],
  );

  const proximoFechamento = useMemo(() => {
    const comps = empresas
      .map((e) => e.primeira_competencia_financeira)
      .filter((c): c is string => !!c)
      .sort();
    return comps[0] ?? null;
  }, [empresas]);

  const handleAtivar = async () => {
    setAtivando(true);
    try {
      const { data, error } = await supabase.rpc("ativar_contratos_pendentes" as any);
      if (error) throw error;
      toast.success(`${data ?? 0} contrato(s) ativados`);
      queryClient.invalidateQueries({ queryKey: ["contratos-recem-implantados"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao ativar contratos");
    } finally {
      setAtivando(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ClockAlert className="h-7 w-7 text-amber-500" />
            Contratos Recém Implantados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Contratos aguardando o primeiro fechamento para entrar no ciclo normal de movimentação.
          </p>
        </div>
        {(isAdmin || isFinanceiro) && (
          <Button onClick={handleAtivar} disabled={ativando} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${ativando ? "animate-spin" : ""}`} />
            Ativar contratos elegíveis
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Contratos pendentes</p>
            <p className="text-2xl font-bold mt-1">{empresas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Vidas acumuladas</p>
            <p className="text-2xl font-bold mt-1">{totalVidas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Próximo fechamento</p>
            <p className="text-2xl font-bold mt-1">{formatCompetencia(proximoFechamento)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa, contrato ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
            Nenhum contrato aguardando primeiro fechamento.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((e) => (
            <Card key={e.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base truncate">{e.nome}</CardTitle>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 shrink-0">
                    Aguardando 1º fechamento
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <p className="text-muted-foreground">Contrato: {e.codigo_contrato ?? "—"}</p>
                <p className="text-muted-foreground">CNPJ: {e.cnpj ?? "—"}</p>
                <p className="text-muted-foreground">
                  Implantação: <span className="text-foreground">{formatDateBR(e.data_implantacao)}</span>
                </p>
                <p className="text-muted-foreground">
                  Movimentação: <span className="text-foreground">{e.tipo_movimentacao ?? "—"}</span>
                  {e.periodo_movimentacao ? ` · ${e.periodo_movimentacao}` : ""}
                </p>
                <p className="text-muted-foreground">
                  Vidas: <span className="text-foreground font-medium">{e.vidas ?? 0}</span>
                </p>
                <p className="text-muted-foreground">Responsável: {e.responsavel_contrato ?? "—"}</p>

                {(() => {
                  const lista = anexosPorEmpresa.get(e.id) ?? [];
                  if (lista.length === 0) {
                    return (
                      <div className="pt-2 mt-2 border-t">
                        <p className="text-xs text-muted-foreground italic">
                          Nenhum anexo enviado pelo Cadastro.
                        </p>
                      </div>
                    );
                  }
                  const porTipo = lista.reduce<Record<string, any[]>>((acc, a) => {
                    (acc[a.tipo] ||= []).push(a);
                    return acc;
                  }, {});
                  return (
                    <div className="pt-2 mt-2 border-t space-y-2">
                      <p className="text-xs font-medium text-foreground flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        Anexos do Cadastro ({lista.length})
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {Object.entries(porTipo).map(([tipo, arr]) => (
                          <div key={tipo} className="space-y-1">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {TIPO_LABEL[tipo] ?? tipo}
                            </p>
                            {arr.map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center justify-between bg-muted/50 rounded px-2 py-1 text-xs"
                              >
                                <span className="truncate flex-1 mr-2">{a.nome_arquivo}</span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 shrink-0"
                                  onClick={() => handleDownloadAnexo(a)}
                                  title="Baixar"
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="pt-2 mt-2 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Próximo fechamento: <span className="text-foreground font-medium">{formatCompetencia(e.primeira_competencia_financeira)}</span>
                  </span>
                  {canAnexar && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 h-8"
                      onClick={() => setUploadEmpresa(e)}
                    >
                      <Paperclip className="h-3.5 w-3.5" /> Anexar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {uploadEmpresa && (
        <UploadArquivoDialog
          open={!!uploadEmpresa}
          onOpenChange={(o) => !o && setUploadEmpresa(null)}
          defaultEmpresaId={uploadEmpresa.id}
          defaultCompetencia={uploadEmpresa.primeira_competencia_financeira ?? undefined}
        />
      )}
    </div>
  );
}
