import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClockAlert, Search, Paperclip, Building2, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatDateBR } from "@/lib/date-utils";
import { toast } from "sonner";
import { UploadArquivoDialog } from "@/components/arquivos/UploadArquivoDialog";

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
