import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload, FileText, Sparkles, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle,
  Loader2, Trash2, Download, Building2, FileSignature, DollarSign, Users,
  ShieldCheck, XCircle, AlertTriangle, Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { validarRelatorioVidas, type ValidacaoResultado } from "@/lib/relatorio-vidas-validator";

interface Props {
  id: string;
  open: boolean;
  onClose: () => void;
  readOnly?: boolean;
}

const STEPS = [
  { n: 1, label: "Upload", icon: Upload },
  { n: 2, label: "Extração", icon: Sparkles },
  { n: 3, label: "Contrato", icon: FileSignature },
  { n: 4, label: "Comissão", icon: DollarSign },
  { n: 5, label: "Vidas Ativas", icon: Users },
  { n: 6, label: "Revisão", icon: CheckCircle2 },
];

const TIPO_LABEL: Record<string, string> = {
  anexo_1: "Anexo 1",
  contrato: "Contrato",
  relatorio_vidas: "Relatório de Vidas",
  primeira_cobranca: "Relatórios da Primeira Cobrança",
  complementar: "Complementar",
};

function isValidCNPJ(cnpj: string) {
  const c = cnpj.replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (slice: number) => {
    let s = 0, p = slice - 7;
    for (let i = slice; i >= 1; i--) {
      s += parseInt(c[slice - i]) * p--;
      if (p < 2) p = 9;
    }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(c[12]) && calc(13) === parseInt(c[13]);
}

function centsFromBR(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

function brFromCents(c: number | null | undefined): string {
  if (c == null) return "";
  return (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ImplantacaoWizard({ id, open, onClose, readOnly }: Props) {
  const qc = useQueryClient();
  const { isAdmin, isComum, isVendas, isDiretora } = useAuth();
  const [data, setData] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [extracting, setExtracting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: impl } = useQuery({
    queryKey: ["impl", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes_contratos" as any)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ["impl-anexos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_anexos" as any)
        .select("*")
        .eq("implantacao_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    if (impl) {
      setData(impl);
      setStep(impl.etapa_atual || 1);
    }
  }, [impl]);

  const update = (patch: any) => setData((d: any) => ({ ...d, ...patch }));

  const save = async (extra: any = {}) => {
    const payload = { ...data, ...extra, updated_at: new Date().toISOString() };
    delete payload.id; delete payload.created_at; delete payload.created_by; delete payload.created_by_nome;
    const { error } = await supabase
      .from("implantacoes_contratos" as any)
      .update(payload)
      .eq("id", id);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return false;
    }
    qc.invalidateQueries({ queryKey: ["impl", id] });
    return true;
  };

  const handleUpload = async (file: File, tipo: string) => {
    if (readOnly) return;
    setUploading(true);
    try {
      // Sanitiza o nome para o path do Storage (remove acentos e caracteres especiais)
      const safeName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_");
      const path = `${id}/${tipo}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("anexos-implantacao")
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) throw upErr;
      const { data: u } = await supabase.auth.getUser();
      const { error: insErr } = await supabase
        .from("implantacao_anexos" as any)
        .insert({
          implantacao_id: id,
          tipo,
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
          uploaded_by: u.user?.id,
        } as any);
      if (insErr) throw insErr;
      qc.invalidateQueries({ queryKey: ["impl-anexos", id] });
      toast.success("Arquivo enviado");

      // Auto-análise do Relatório de Vidas: extrai total de vidas automaticamente
      if (tipo === "relatorio_vidas") {
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        if (["xlsx", "xlsm", "xls"].includes(ext)) {
          try {
            toast.info("Analisando Relatório de Vidas...");
            const buffer = await file.arrayBuffer();
            const sig = new Uint8Array(buffer.slice(0, 4));
            if (sig[0] === 0x50 && sig[1] === 0x4b) {
              const result = await validarRelatorioVidas(buffer);
              update({
                relatorio_validacao: result,
                total_vidas: result.total_vidas,
                vidas_titulares: result.titulares,
                vidas_dependentes: result.dependentes,
              });
              await supabase
                .from("implantacoes_contratos" as any)
                .update({
                  relatorio_validacao: result as any,
                  total_vidas: result.total_vidas,
                  vidas_titulares: result.titulares,
                  vidas_dependentes: result.dependentes,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", id);
              qc.invalidateQueries({ queryKey: ["impl", id] });
              toast.success(`Vidas preenchidas automaticamente: ${result.total_vidas}`);
            }
          } catch (err: any) {
            console.warn("Auto-análise do Relatório de Vidas falhou:", err);
            toast.warning("Não foi possível analisar automaticamente. Use 'Verificar Layout' na Etapa 5.");
          }
        }
      }
    } catch (e: any) {
      console.error("Erro upload anexo:", e);
      toast.error(e.message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAnexo = async (a: any) => {
    if (readOnly) return;
    await supabase.storage.from("anexos-implantacao").remove([a.storage_path]);
    await supabase.from("implantacao_anexos" as any).delete().eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["impl-anexos", id] });
  };

  const handleDownload = async (a: any) => {
    const { data: signed } = await supabase.storage
      .from("anexos-implantacao")
      .createSignedUrl(a.storage_path, 60);
    if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
  };

  const anexo1 = useMemo(() => anexos.find((a) => a.tipo === "anexo_1"), [anexos]);

  const handleExtrair = async () => {
    if (!anexo1) { toast.error("Anexe o Anexo 1 primeiro"); return; }
    setExtracting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("extrair-anexo1", {
        body: { storage_path: anexo1.storage_path, mime_type: anexo1.mime_type },
      });
      if (error) throw error;
      const ext = (result as any)?.dados || {};
      const novoEnf = ext.valor_enfermaria_centavos ?? data.valor_enfermaria_centavos;
      update({
        nome_empresa: ext.nome_empresa || data.nome_empresa,
        cnpj: ext.cnpj || data.cnpj,
        telefone: ext.telefone || data.telefone,
        inscricao_municipal: ext.inscricao_municipal || data.inscricao_municipal,
        inscricao_estadual: ext.inscricao_estadual || data.inscricao_estadual,
        endereco: ext.endereco || data.endereco,
        cep: ext.cep || data.cep,
        grupo_contrato: ext.grupo_contrato || data.grupo_contrato,
        valor_enfermaria_centavos: novoEnf,
        valor_apartamento_centavos: ext.valor_apartamento_centavos ?? data.valor_apartamento_centavos,
        inicio_atendimento: ext.inicio_atendimento || data.inicio_atendimento,
        ticket: novoEnf != null && (data.ticket_auto_sync ?? true) ? brFromCents(novoEnf) : data.ticket,
      });
      toast.success("Dados extraídos! Revise e edite se necessário.");
    } catch (e: any) {
      toast.error("Falha na extração: " + (e.message || "erro"));
    } finally {
      setExtracting(false);
    }
  };

  // Sincroniza ticket automaticamente quando valor_enfermaria mudar e auto_sync ativo
  useEffect(() => {
    if (!data) return;
    if ((data.ticket_auto_sync ?? true) && data.valor_enfermaria_centavos != null) {
      const expected = brFromCents(data.valor_enfermaria_centavos);
      if (data.ticket !== expected) setData((d: any) => ({ ...d, ticket: expected }));
    }
  }, [data?.valor_enfermaria_centavos, data?.ticket_auto_sync]);

  const ultimoRelVidas = useMemo(
    () => anexos.filter((a: any) => a.tipo === "relatorio_vidas")[0],
    [anexos],
  );

  // ----- validations per step -----
  const tiposObrigatorios = ["anexo_1", "contrato", "relatorio_vidas", "primeira_cobranca", "complementar"];
  const todosAnexosOk = tiposObrigatorios.every((t) => anexos.some((a: any) => a.tipo === t));
  const validacao: ValidacaoResultado | null = data?.relatorio_validacao || null;

  const valid: Record<number, boolean> = {
    1: todosAnexosOk,
    2: !!data?.nome_empresa && !!data?.cnpj && isValidCNPJ(data.cnpj || ""),
    3: !!data?.data_vigencia && !!data?.codigo_contrato && !!data?.modalidade && !!data?.acomodacao && !!data?.tipo_contrato && !!data?.periodo_movimentacao && (data?.periodo_movimentacao !== "Diário" || (!!data?.data_corte && data.data_corte >= 1 && data.data_corte <= 31)),
    4: data?.percentual_agenciamento != null && data?.percentual_vitalicio != null,
    5: !!validacao && validacao.valido === true && (data?.total_vidas || 0) > 0,
    6: true,
  };

  const goNext = async () => {
    if (!valid[step]) { toast.error("Preencha os campos obrigatórios"); return; }
    const next = Math.min(6, step + 1);
    if (await save({ etapa_atual: next })) setStep(next);
  };
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const handleEnviarAnalise = async () => {
    const ok = await save({ status: "em_analise_diretoria", etapa_atual: 6, motivo_correcao: null });
    if (ok) {
      toast.success("Implantação enviada para análise da Diretoria!");
      onClose();
    }
  };

  const handleFinalizarCadastro = async () => {
    try {
      const { error } = await supabase.rpc("finalizar_implantacao_cadastro", { p_impl: data.id });
      if (error) throw error;
      toast.success("Implantação concluída! Empresa criada automaticamente.");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao concluir implantação");
    }
  };

  if (!data) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent><Loader2 className="h-6 w-6 animate-spin mx-auto" /></DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Implantação — {data.nome_empresa || "Nova"}
            {readOnly && <Badge variant="outline">Somente leitura</Badge>}
          </DialogTitle>
        </DialogHeader>

        {(data.status === "necessita_correcao" || data.status === "rejeitado") && data.motivo_correcao && (
          <div className={cn(
            "rounded-lg border p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-1",
            data.status === "rejeitado"
              ? "border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          )}>
            {data.status === "rejeitado"
              ? <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
              : <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />}
            <div className="text-sm">
              <p className="font-semibold mb-0.5">
                {data.status === "rejeitado" ? "Contrato rejeitado pela Diretoria" : "Correção solicitada pela Diretoria"}
              </p>
              <p className="text-xs opacity-90">{data.motivo_correcao}</p>
              <p className="text-[11px] opacity-70 mt-1">Ajuste os dados e clique em <strong>Enviar para Análise</strong> novamente.</p>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="flex items-center justify-between gap-2 py-2 overflow-x-auto">
          {STEPS.map((s, i) => {
            const done = step > s.n;
            const active = step === s.n;
            return (
              <div key={s.n} className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className={cn(
                    "flex items-center gap-2 cursor-pointer flex-shrink-0",
                    !active && !done && "opacity-50"
                  )}
                  onClick={() => done && setStep(s.n)}
                >
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2",
                    active ? "bg-primary text-primary-foreground border-primary" :
                    done ? "bg-green-500 text-white border-green-500" : "border-muted-foreground"
                  )}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : s.n}
                  </div>
                  <span className={cn("text-xs font-medium hidden md:inline", active && "text-primary")}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-0.5 flex-1", done ? "bg-green-500" : "bg-muted")} />
                )}
              </div>
            );
          })}
        </div>

        <div className="min-h-[400px] py-4">
          {step === 1 && (
            <Step1Upload
              anexos={anexos}
              onUpload={handleUpload}
              onDelete={handleDeleteAnexo}
              onDownload={handleDownload}
              uploading={uploading}
              readOnly={readOnly}
            />
          )}
          {step === 2 && (
            <Step2Extracao
              data={data}
              update={update}
              onExtrair={handleExtrair}
              extracting={extracting}
              hasAnexo1={!!anexo1}
              readOnly={readOnly}
            />
          )}
          {step === 3 && <Step3Contrato data={data} update={update} readOnly={readOnly} isAdmin={isAdmin} />}
          {step === 4 && <Step4Comissao data={data} update={update} readOnly={readOnly} />}
          {step === 5 && <Step5Vidas data={data} update={update} readOnly={readOnly} relAnexo={ultimoRelVidas} />}
          {step === 6 && <Step6Revisao data={data} anexos={anexos} />}
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="outline" onClick={goBack} disabled={step === 1} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {valid[step] ? (
              <><CheckCircle2 className="h-3 w-3 text-green-500" /> Etapa válida</>
            ) : (
              <><AlertCircle className="h-3 w-3 text-orange-500" /> Preencha os obrigatórios</>
            )}
          </div>
          {step < 6 ? (
            <Button onClick={goNext} disabled={!valid[step] || readOnly} className="gap-2">
              Avançar <ArrowRight className="h-4 w-4" />
            </Button>
          ) : isComum || isAdmin ? (
            <Button onClick={handleFinalizarCadastro} disabled={readOnly} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Concluir Implantação
            </Button>
          ) : isVendas ? (
            <Button onClick={handleEnviarAnalise} disabled={readOnly} className="gap-2">
              <Send className="h-4 w-4" /> Enviar para Análise
            </Button>
          ) : (
            <div className="text-xs text-muted-foreground italic">Aguardando próxima etapa do fluxo</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============= STEP 1 =============
function Step1Upload({ anexos, onUpload, onDelete, onDownload, uploading, readOnly }: any) {
  const tipos = ["anexo_1", "contrato", "relatorio_vidas", "primeira_cobranca", "complementar"];
  return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
        <strong>Importante:</strong> O <strong>Anexo 1</strong> é prioridade total para a extração automática.
      </div>
      {tipos.map((tipo) => {
        const list = anexos.filter((a: any) => a.tipo === tipo);
        const isAnexo1 = tipo === "anexo_1";
        return (
          <Card key={tipo} className={cn(isAnexo1 && "border-primary border-2", list.length === 0 && "border-destructive/40")}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold flex items-center gap-2">
                  {list.length > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  {TIPO_LABEL[tipo]}
                  <Badge variant="outline">{list.length}</Badge>
                  {isAnexo1 && <Badge variant="default">Prioritário</Badge>}
                  <Badge variant={list.length > 0 ? "secondary" : "destructive"}>Obrigatório</Badge>
                </Label>
                {!readOnly && (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      multiple={tipo === "complementar" || tipo === "primeira_cobranca"}
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        for (const f of files) {
                          await onUpload(f, tipo);
                        }
                        e.target.value = "";
                      }}
                      disabled={uploading}
                    />
                    <Button asChild size="sm" variant="outline">
                      <span>
                        <Upload className="h-3 w-3 mr-1" />
                        {tipo === "complementar" || tipo === "primeira_cobranca" ? "Anexar (vários)" : "Anexar"}
                      </span>
                    </Button>
                  </label>
                )}
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-destructive">Nenhum arquivo — envie ao menos 1 arquivo desta categoria.</p>
              ) : (
                list.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between bg-muted/50 rounded p-2 text-sm">
                    <span className="flex items-center gap-2 truncate"><FileText className="h-4 w-4" /> {a.nome_arquivo}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDownload(a)}>
                        <Download className="h-3 w-3" />
                      </Button>
                      {!readOnly && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(a)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============= STEP 2 =============
function Step2Extracao({ data, update, onExtrair, extracting, hasAnexo1, readOnly }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Extraia automaticamente do Anexo 1 e revise.</p>
        {!readOnly && (
          <Button onClick={onExtrair} disabled={!hasAnexo1 || extracting} className="gap-2">
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Extrair do Anexo 1
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nome da empresa *" v={data.nome_empresa} onChange={(v: string) => update({ nome_empresa: v })} readOnly={readOnly} />
        <Field
          label="CNPJ *"
          v={data.cnpj}
          onChange={(v: string) => update({ cnpj: v })}
          readOnly={readOnly}
          error={data.cnpj && !isValidCNPJ(data.cnpj) ? "CNPJ inválido" : undefined}
        />
        <Field label="Telefone" v={data.telefone} onChange={(v: string) => update({ telefone: v })} readOnly={readOnly} />
        <Field label="Inscrição Municipal" v={data.inscricao_municipal} onChange={(v: string) => update({ inscricao_municipal: v })} readOnly={readOnly} />
        <Field label="Inscrição Estadual" v={data.inscricao_estadual} onChange={(v: string) => update({ inscricao_estadual: v })} readOnly={readOnly} />
        <Field label="CEP" v={data.cep} onChange={(v: string) => update({ cep: v })} readOnly={readOnly} />
        <div className="md:col-span-2">
          <Field label="Endereço" v={data.endereco} onChange={(v: string) => update({ endereco: v })} readOnly={readOnly} />
        </div>
        <Field label="Grupo do Contrato" v={data.grupo_contrato} onChange={(v: string) => update({ grupo_contrato: v })} readOnly={readOnly} />
        <Field label="Início do atendimento" type="date" v={data.inicio_atendimento} onChange={(v: string) => update({ inicio_atendimento: v })} readOnly={readOnly} />
        <Field
          label="Valor Enfermaria (R$)"
          v={brFromCents(data.valor_enfermaria_centavos)}
          onChange={(v: string) => update({ valor_enfermaria_centavos: centsFromBR(v) })}
          readOnly={readOnly}
        />
        <Field
          label="Valor Apartamento (R$)"
          v={brFromCents(data.valor_apartamento_centavos)}
          onChange={(v: string) => update({ valor_apartamento_centavos: centsFromBR(v) })}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}

// ============= STEP 3 =============
function Step3Contrato({ data, update, readOnly, isAdmin }: any) {
  const ticketLocked = !isAdmin && (data.ticket_auto_sync ?? true);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <Label>Tipo de Contrato *</Label>
        <Select value={data.tipo_contrato || ""} onValueChange={(v) => update({ tipo_contrato: v })} disabled={readOnly}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Período">Período</SelectItem>
            <SelectItem value="Diário">Diário</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Field label="Data Vigência *" type="date" v={data.data_vigencia} onChange={(v: string) => update({ data_vigencia: v })} readOnly={readOnly} />
      <Field label="Vencimento" type="date" v={data.data_vencimento} onChange={(v: string) => update({ data_vencimento: v })} readOnly={readOnly} />
      <div>
        <Label className="flex items-center gap-2">
          Ticket
          <Badge variant="secondary" className="text-[10px]">Auto = Valor Enfermaria</Badge>
          {isAdmin && (
            <button
              type="button"
              onClick={() => update({ ticket_auto_sync: !(data.ticket_auto_sync ?? true) })}
              className="text-xs text-primary underline"
            >
              {data.ticket_auto_sync ?? true ? "Desbloquear" : "Sincronizar"}
            </button>
          )}
        </Label>
        <Input
          value={data.ticket ?? ""}
          onChange={(e) => update({ ticket: e.target.value })}
          readOnly={readOnly || ticketLocked}
          className={ticketLocked ? "bg-muted" : ""}
        />
        {ticketLocked && (
          <p className="text-xs text-muted-foreground mt-1">Sincronizado com Valor Enfermaria. Apenas Admin pode editar.</p>
        )}
      </div>
      <div>
        <Label>Modalidade *</Label>
        <Select value={data.modalidade || ""} onValueChange={(v) => update({ modalidade: v })} disabled={readOnly}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Coletivo Empresarial">Coletivo Empresarial</SelectItem>
            <SelectItem value="Coletivo por Adesão">Coletivo por Adesão</SelectItem>
            <SelectItem value="Individual">Individual</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Acomodação *</Label>
        <Select value={data.acomodacao || ""} onValueChange={(v) => update({ acomodacao: v })} disabled={readOnly}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Enfermaria">Enfermaria</SelectItem>
            <SelectItem value="Apartamento">Apartamento</SelectItem>
            <SelectItem value="Ambos">Ambos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Field label="Corretora" v={data.corretora} onChange={(v: string) => update({ corretora: v })} readOnly={readOnly} />
      <Field label="Código do Contrato *" v={data.codigo_contrato} onChange={(v: string) => update({ codigo_contrato: v })} readOnly={readOnly} />
      {data.tipo_contrato === "Período" && (
        <div>
          <Label>Período de Movimentação *</Label>
          <Select
            value={data.periodo_movimentacao && data.periodo_movimentacao !== "Diário" ? data.periodo_movimentacao : ""}
            onValueChange={(v) => update({ periodo_movimentacao: v, data_corte: null })}
            disabled={readOnly}
          >
            <SelectTrigger><SelectValue placeholder="Selecione o período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="01-05">01-05</SelectItem>
              <SelectItem value="05-10">05-10</SelectItem>
              <SelectItem value="10-15">10-15</SelectItem>
              <SelectItem value="15-20">15-20</SelectItem>
              <SelectItem value="20-25">20-25</SelectItem>
              <SelectItem value="25-30">25-30</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">Janela mensal de movimentação.</p>
        </div>
      )}
      {data.tipo_contrato === "Diário" && (
        <div>
          <Label>Data de Corte (dia) *</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={data.data_corte ?? ""}
            onChange={(e) => {
              const n = parseInt(e.target.value);
              update({ data_corte: isNaN(n) ? null : Math.min(31, Math.max(1, n)), periodo_movimentacao: "Diário" });
            }}
            readOnly={readOnly}
          />
          <p className="text-xs text-muted-foreground mt-1">Informe o dia de corte mensal (1 a 31).</p>
        </div>
      )}
    </div>
  );
}

// ============= STEP 4 =============
function Step4Comissao({ data, update, readOnly }: any) {
  const base = ((data.valor_enfermaria_centavos || 0) + (data.valor_apartamento_centavos || 0)) / 100;
  const agen = base * (parseFloat(data.percentual_agenciamento || 0) / 100);
  const vit = base * (parseFloat(data.percentual_vitalicio || 0) / 100);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="% Agenciamento *" type="number" v={data.percentual_agenciamento} onChange={(v: string) => update({ percentual_agenciamento: parseFloat(v) || 0 })} readOnly={readOnly} />
        <Field label="% Vitalício *" type="number" v={data.percentual_vitalicio} onChange={(v: string) => update({ percentual_vitalicio: parseFloat(v) || 0 })} readOnly={readOnly} />
      </div>
      <Card>
        <CardContent className="p-4 space-y-2">
          <h4 className="font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" /> Resumo Financeiro</h4>
          <div className="text-sm space-y-1">
            <p>Base mensal: <strong>R$ {base.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>
            <p>Agenciamento ({data.percentual_agenciamento || 0}%): <strong>R$ {agen.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>
            <p>Vitalício ({data.percentual_vitalicio || 0}%): <strong>R$ {vit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============= STEP 5 =============
function Step5Vidas({ data, update, readOnly, relAnexo }: any) {
  const [verificando, setVerificando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const validacao: ValidacaoResultado | null = data.relatorio_validacao || null;

  const handleVerificar = async () => {
    if (!relAnexo) { toast.error("Anexe o Relatório de Vidas na Etapa 1."); return; }
    const nome = (relAnexo.nome_arquivo || "").toLowerCase();
    const ext = nome.split(".").pop() || "";
    if (!["xlsx", "xlsm", "xls"].includes(ext)) {
      toast.error(`Formato inválido (.${ext}). Envie o Relatório de Vidas em Excel (.xlsx). PDF/CSV não são suportados.`);
      return;
    }
    setVerificando(true);
    setProgresso(0);
    try {
      const { data: signed } = await supabase.storage
        .from("anexos-implantacao")
        .createSignedUrl(relAnexo.storage_path, 60);
      if (!signed?.signedUrl) throw new Error("Falha ao baixar arquivo");
      const resp = await fetch(signed.signedUrl);
      const buffer = await resp.arrayBuffer();
      // Verifica assinatura ZIP (xlsx é um zip: PK\x03\x04)
      const sig = new Uint8Array(buffer.slice(0, 4));
      if (!(sig[0] === 0x50 && sig[1] === 0x4b)) {
        throw new Error("Arquivo não é um Excel válido (.xlsx). Reenvie o Relatório de Vidas em formato Excel.");
      }
      const result = await validarRelatorioVidas(buffer, setProgresso);
      update({
        relatorio_validacao: result,
        total_vidas: result.total_vidas,
        vidas_titulares: result.titulares,
        vidas_dependentes: result.dependentes,
      });
      if (result.valido) toast.success(`Layout válido! ${result.total_vidas} vidas.`);
      else toast.error(`${result.erros} erro(s) encontrado(s). Corrija antes de avançar.`);
    } catch (e: any) {
      toast.error("Erro na verificação: " + e.message);
    } finally {
      setVerificando(false);
      setProgresso(0);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Verificação de Layout</h4>
              <p className="text-xs text-muted-foreground">
                {relAnexo ? `Arquivo: ${relAnexo.nome_arquivo}` : "Anexe o Relatório de Vidas na Etapa 1."}
              </p>
            </div>
            {!readOnly && (
              <Button onClick={handleVerificar} disabled={!relAnexo || verificando} className="gap-2">
                {verificando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Verificar Layout
              </Button>
            )}
          </div>
          {verificando && (
            <div className="space-y-1">
              <Progress value={progresso} />
              <p className="text-xs text-muted-foreground">Processando linhas... {progresso.toFixed(0)}%</p>
            </div>
          )}
        </CardContent>
      </Card>

      {validacao && (
        <>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-700 dark:text-yellow-400 space-y-1">
            <div>Linhas sem <strong>TIPO OPERACAO = I</strong> foram ignoradas automaticamente.</div>
            <div>Linhas sem <strong>GRAU PARENTESCO</strong> foram identificadas automaticamente como <strong>TITULAR</strong>.</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <KpiBox label="Linhas Lidas" value={validacao.linhas_lidas ?? validacao.total_linhas} color="text-muted-foreground" />
            <KpiBox label="Válidas (I)" value={validacao.linhas_validas ?? validacao.total_linhas} color="text-primary" />
            <KpiBox label="Ignoradas (vazias)" value={validacao.linhas_ignoradas_vazias ?? 0} color="text-muted-foreground" />
            <KpiBox label="Ignoradas (outro tipo)" value={validacao.linhas_ignoradas_outro_tipo ?? 0} color="text-muted-foreground" />
            <KpiBox label="Reaproveitadas" value={validacao.linhas_reaproveitadas ?? 0} color="text-green-500" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <KpiBox label="Titulares" value={validacao.titulares} color="text-blue-500" />
            <KpiBox label="Dep. Filhos" value={validacao.filhos ?? 0} color="text-purple-500" />
            <KpiBox label="Dep. Cônjuges" value={validacao.conjuges ?? 0} color="text-pink-500" />
            <KpiBox label="Outros Dep." value={validacao.outros_dependentes ?? 0} color="text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-2">
            <KpiBox label="Erros" value={validacao.erros} color="text-destructive" />
            <KpiBox label="Alertas" value={validacao.alertas} color="text-orange-500" />
          </div>

          {validacao.colunas_ausentes.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm">
              <strong className="flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" /> Colunas obrigatórias ausentes:</strong>
              <p className="mt-1">{validacao.colunas_ausentes.join(", ")}</p>
            </div>
          )}

          <Card>
            <CardContent className="p-4">
              <h5 className="font-semibold mb-2 text-sm">Conferência por Coluna</h5>
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {validacao.colunas.map((c) => (
                    <div key={c.coluna} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                      <span className="flex items-center gap-2">
                        {c.severidade === "ok" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                        {c.severidade === "alerta" && <AlertTriangle className="h-3 w-3 text-orange-500" />}
                        {c.severidade === "erro" && <XCircle className="h-3 w-3 text-destructive" />}
                        {c.coluna}
                        {!c.presente && <Badge variant="destructive" className="text-[9px]">ausente</Badge>}
                      </span>
                      <span className="text-muted-foreground">
                        {c.presente ? `${c.preenchidas} ok / ${c.vazias} vazias / ${c.invalidas} inválidas` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {validacao.pendencias.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h5 className="font-semibold mb-2 text-sm">Pendências por Linha ({validacao.pendencias.length}{validacao.pendencias.length === 500 ? "+" : ""})</h5>
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {validacao.pendencias.map((p, i) => (
                      <div key={i} className="text-xs flex items-center gap-2 py-0.5">
                        {p.severidade === "erro" ? (
                          <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-orange-500 flex-shrink-0" />
                        )}
                        <span>Linha {p.linha} — <strong>{p.coluna}</strong>: {p.motivo}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div>
        <Label>Faixas etárias (observações)</Label>
        <Textarea
          value={data.faixas_etarias?.observacao || ""}
          onChange={(e) => update({ faixas_etarias: { observacao: e.target.value } })}
          readOnly={readOnly}
          placeholder="Ex: 0-18: 5 vidas / 19-58: 20 vidas / 59+: 3 vidas"
          rows={3}
        />
      </div>
    </div>
  );
}

function KpiBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <div className={cn("text-2xl font-bold", color)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// ============= STEP 6 =============
function Step6Revisao({ data, anexos }: any) {
  const Row = ({ k, v }: { k: string; v: any }) => (
    <div className="flex justify-between text-sm py-1 border-b last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v || "—"}</span>
    </div>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card><CardContent className="p-4">
        <h4 className="font-semibold mb-2 flex items-center gap-2"><Building2 className="h-4 w-4" /> Empresa</h4>
        <Row k="Nome" v={data.nome_empresa} />
        <Row k="CNPJ" v={data.cnpj} />
        <Row k="Telefone" v={data.telefone} />
        <Row k="Endereço" v={data.endereco} />
        <Row k="CEP" v={data.cep} />
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <h4 className="font-semibold mb-2 flex items-center gap-2"><FileSignature className="h-4 w-4" /> Contrato</h4>
        <Row k="Código" v={data.codigo_contrato} />
        <Row k="Tipo de Contrato" v={data.tipo_contrato} />
        <Row k="Período Movimentação" v={data.periodo_movimentacao} />
        {data.periodo_movimentacao === "Diário" && <Row k="Data de Corte" v={data.data_corte} />}
        <Row k="Vigência" v={data.data_vigencia} />
        <Row k="Modalidade" v={data.modalidade} />
        <Row k="Acomodação" v={data.acomodacao} />
        <Row k="Corretora" v={data.corretora} />
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <h4 className="font-semibold mb-2 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Valores & Comissão</h4>
        <Row k="Enfermaria" v={`R$ ${brFromCents(data.valor_enfermaria_centavos)}`} />
        <Row k="Apartamento" v={`R$ ${brFromCents(data.valor_apartamento_centavos)}`} />
        <Row k="% Agenciamento" v={`${data.percentual_agenciamento || 0}%`} />
        <Row k="% Vitalício" v={`${data.percentual_vitalicio || 0}%`} />
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <h4 className="font-semibold mb-2 flex items-center gap-2"><Users className="h-4 w-4" /> Vidas Ativas & Documentos</h4>
        <Row k="Total Vidas Ativas" v={data.total_vidas} />
        <Row k="Titulares" v={data.vidas_titulares} />
        <Row k="Dependentes" v={data.vidas_dependentes} />
        <Row k="Layout Validado" v={data.relatorio_validacao?.valido ? "Sim" : "Não"} />
        <Row k="Documentos" v={`${anexos.length} anexo(s)`} />
      </CardContent></Card>
    </div>
  );
}

function Field({ label, v, onChange, type = "text", readOnly, error }: any) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type={type}
        value={v ?? ""}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className={error ? "border-destructive" : ""}
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
