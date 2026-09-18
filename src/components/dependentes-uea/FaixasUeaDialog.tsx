import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
  useExcluirFaixaUea,
  useFaixasUea,
  useImportarFaixasUea,
  useSalvarFaixaUea,
  type FaixaInput,
} from "@/hooks/useDependentesUea";
import {
  agruparFaixasEmCapas,
  faixaLabel,
  formatBRL,
  formatDataBR,
  toISODateLocal,
  type FaixaTabelaCapa,
} from "@/lib/dependentes-uea";
import {
  lerPlanilhaFaixas,
  modeloPlanilhaFaixas,
  type FaixaImportLinha,
} from "@/lib/faixas-uea-import";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const vazio = (capa?: FaixaTabelaCapa | null): FaixaInput & { idade_final_txt: string; valor_txt: string } => ({
  idade_inicial: 0,
  idade_final: null,
  valor_mensal: 0,
  vigencia_inicio: capa?.vigencia_inicio ?? toISODateLocal(new Date()),
  vigencia_fim: null,
  observacao: "",
  tabela_nome: capa?.descricao ?? "",
  plano: capa?.plano ?? "",
  idade_final_txt: "",
  valor_txt: "",
});

export function FaixasUeaDialog({ open, onOpenChange }: Props) {
  const { data: faixas = [], isLoading } = useFaixasUea();
  const salvar = useSalvarFaixaUea();
  const excluir = useExcluirFaixaUea();
  const importar = useImportarFaixasUea();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [capaSel, setCapaSel] = useState<string | null>(null);
  const [form, setForm] = useState<ReturnType<typeof vazio> | null>(null);
  const [preview, setPreview] = useState<{ nome: string; linhas: FaixaImportLinha[] } | null>(null);
  const [substituir, setSubstituir] = useState(false);

  const capas = agruparFaixasEmCapas(faixas);
  const capaAtual = capas.find((c) => c.chave === capaSel) ?? null;

  const validas = preview ? preview.linhas.filter((l) => !l.erro) : [];
  const invalidas = preview ? preview.linhas.filter((l) => l.erro) : [];

  const fechar = (v: boolean) => {
    if (!v) {
      setCapaSel(null);
      setForm(null);
      setPreview(null);
    }
    onOpenChange(v);
  };

  const escolherArquivo = async (file: File | undefined) => {
    if (!file) return;
    try {
      const linhas = await lerPlanilhaFaixas(file);
      if (linhas.length === 0) {
        toast({
          title: "Nenhuma linha encontrada",
          description: "Confira se a planilha tem as colunas de faixa e valor mensal.",
          variant: "destructive",
        });
        return;
      }
      setPreview({ nome: file.name, linhas });
    } catch (e: any) {
      toast({ title: "Não foi possível ler a planilha", description: e.message, variant: "destructive" });
    }
  };

  const confirmarImportacao = async () => {
    if (validas.length === 0) return;
    await importar.mutateAsync({
      faixas: validas.map((l) => ({
        idade_inicial: l.idade_inicial,
        idade_final: l.idade_final,
        valor_mensal: l.valor_mensal,
        vigencia_inicio: l.vigencia_inicio,
        vigencia_fim: l.vigencia_fim,
        observacao: l.observacao,
        tabela_nome: l.tabela_nome,
        plano: l.plano,
      })),
      substituir,
    });
    setPreview(null);
    setSubstituir(false);
  };

  const baixarModelo = () => {
    const url = URL.createObjectURL(modeloPlanilhaFaixas());
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-faixas-uea.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!form) return;
    await salvar.mutateAsync({
      id: form.id,
      idade_inicial: Number(form.idade_inicial) || 0,
      idade_final: form.idade_final_txt.trim() === "" ? null : Number(form.idade_final_txt),
      valor_mensal: Number(String(form.valor_txt).replace(",", ".")) || 0,
      vigencia_inicio: form.vigencia_inicio,
      vigencia_fim: form.vigencia_fim || null,
      observacao: form.observacao,
      tabela_nome: form.tabela_nome?.trim() || null,
      plano: form.plano?.trim() || null,
    });
    setForm(null);
  };

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {preview
              ? "Conferir importação"
              : form
                ? form.id
                  ? "Editar faixa"
                  : "Nova faixa"
                : capaAtual
                  ? capaAtual.descricao
                  : "Tabelas de faixas etárias"}
          </DialogTitle>
        </DialogHeader>

        {preview ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{preview.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {validas.length} faixa(s) prontas para importar
                  {invalidas.length > 0 && ` · ${invalidas.length} com problema`}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={substituir}
                  onCheckedChange={(v) => setSubstituir(v === true)}
                />
                Substituir as faixas atuais
              </label>
            </div>
            <div className="max-h-[320px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Faixa</TableHead>
                    <TableHead className="text-right">Valor mensal</TableHead>
                    <TableHead>Vigência início</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.linhas.map((l) => (
                    <TableRow key={l.linha} className={l.erro ? "opacity-70" : undefined}>
                      <TableCell className="text-xs">{l.tabela_nome ?? "—"}</TableCell>
                      <TableCell className="font-medium">
                        {l.idade_inicial} a {l.idade_final ?? "+"} anos
                      </TableCell>
                      <TableCell className="text-right">{formatBRL(l.valor_mensal)}</TableCell>
                      <TableCell>{formatDataBR(l.vigencia_inicio)}</TableCell>
                      <TableCell className="text-xs">{l.plano ?? "—"}</TableCell>
                      <TableCell>
                        {l.erro ? (
                          <Badge variant="destructive">{l.erro}</Badge>
                        ) : (
                          <Badge variant="secondary">Ok</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreview(null)}>
                Cancelar
              </Button>
              <Button
                onClick={confirmarImportacao}
                disabled={validas.length === 0 || importar.isPending}
              >
                Importar {validas.length} faixa(s)
              </Button>
            </div>
          </div>
        ) : form ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Tabela (descrição da capa)</Label>
                <Input
                  placeholder="Ex.: Tabela UEA - 1 (01/10/2025)"
                  value={form.tabela_nome ?? ""}
                  onChange={(e) => setForm((f) => f && { ...f, tabela_nome: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Plano</Label>
                <Input
                  placeholder="Ex.: Quality Plus - Apartamento"
                  value={form.plano ?? ""}
                  onChange={(e) => setForm((f) => f && { ...f, plano: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Idade inicial *</Label>
                <Input
                  inputMode="numeric"
                  value={String(form.idade_inicial)}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, idade_inicial: Number(e.target.value.replace(/\D/g, "")) || 0 })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Idade final</Label>
                <Input
                  inputMode="numeric"
                  placeholder="Vazio = sem limite"
                  value={form.idade_final_txt}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, idade_final_txt: e.target.value.replace(/\D/g, "") })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Valor mensal (R$) *</Label>
                <Input
                  inputMode="decimal"
                  value={form.valor_txt}
                  onChange={(e) => setForm((f) => f && { ...f, valor_txt: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Vigência início *</Label>
                <Input
                  type="date"
                  value={form.vigencia_inicio}
                  onChange={(e) => setForm((f) => f && { ...f, vigencia_inicio: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Vigência fim</Label>
                <Input
                  type="date"
                  value={form.vigencia_fim ?? ""}
                  onChange={(e) => setForm((f) => f && { ...f, vigencia_fim: e.target.value || null })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Observação</Label>
              <Input
                value={form.observacao ?? ""}
                onChange={(e) => setForm((f) => f && { ...f, observacao: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(null)}>
                Voltar
              </Button>
              <Button onClick={submit} disabled={salvar.isPending}>
                Salvar faixa
              </Button>
            </div>
          </div>
        ) : capaAtual ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCapaSel(null)}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Todas as tabelas
              </Button>
              <Button size="sm" onClick={() => setForm(vazio(capaAtual))}>
                <Plus className="mr-1.5 h-4 w-4" /> Nova faixa nesta tabela
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Início de vigência: {formatDataBR(capaAtual.vigencia_inicio)}
              {capaAtual.plano && <> · Plano: {capaAtual.plano}</>}
            </div>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faixa</TableHead>
                    <TableHead className="text-right">Valor mensal</TableHead>
                    <TableHead>Vigência fim</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {capaAtual.faixas.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{faixaLabel(f)} anos</TableCell>
                      <TableCell className="text-right">{formatBRL(f.valor_mensal)}</TableCell>
                      <TableCell>{f.vigencia_fim ? formatDataBR(f.vigencia_fim) : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setForm({
                                id: f.id,
                                idade_inicial: f.idade_inicial,
                                idade_final: f.idade_final,
                                valor_mensal: f.valor_mensal,
                                vigencia_inicio: f.vigencia_inicio.slice(0, 10),
                                vigencia_fim: f.vigencia_fim ? f.vigencia_fim.slice(0, 10) : null,
                                observacao: f.observacao ?? "",
                                tabela_nome: f.tabela_nome ?? "",
                                plano: f.plano ?? "",
                                idade_final_txt: f.idade_final === null ? "" : String(f.idade_final),
                                valor_txt: String(f.valor_mensal),
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => excluir.mutate(f.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="max-w-sm text-sm text-muted-foreground">
                Cada tabela é uma capa com suas faixas etárias. O sistema identifica a faixa do
                dependente pela data de nascimento e usa o valor configurado.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={baixarModelo}>
                  <Download className="mr-1.5 h-4 w-4" /> Modelo
                </Button>
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1.5 h-4 w-4" /> Importar planilha
                </Button>
                <Button size="sm" onClick={() => setForm(vazio())}>
                  <Plus className="mr-1.5 h-4 w-4" /> Nova faixa
                </Button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  escolherArquivo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Nº Sequência</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Início Vigência</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Faixa Etária</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!isLoading && capas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        Nenhuma tabela configurada. Cadastre faixas ou importe uma planilha.
                      </TableCell>
                    </TableRow>
                  )}
                  {capas.map((c, i) => (
                    <TableRow
                      key={c.chave}
                      className="cursor-pointer"
                      onClick={() => setCapaSel(c.chave)}
                    >
                      <TableCell className="font-mono text-xs">
                        {String(capas.length - i).padStart(6, "0")}
                      </TableCell>
                      <TableCell className="font-medium">{c.descricao}</TableCell>
                      <TableCell>{formatDataBR(c.vigencia_inicio)}</TableCell>
                      <TableCell>{c.plano ?? "—"}</TableCell>
                      <TableCell>
                        {c.faixas.length} Faixa{c.faixas.length === 1 ? "" : "s"} Etária
                        {c.faixas.length === 1 ? "" : "s"}
                      </TableCell>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
