import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { DadosCnpj, ERRO_CONSULTA_CNPJ, formatarDataSituacaoCnpj, mapearDadosCnpj, normalizarCnpjConsulta, rotuloSituacaoCnpj, TomSituacaoCnpj } from "@/lib/consulta-cnpj";

const TONS_SITUACAO: Record<TomSituacaoCnpj, string> = {
  verde: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  amarelo: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  vermelho: "bg-destructive/15 text-destructive border-destructive/30",
  neutro: "bg-muted text-muted-foreground border-border",
};

// Display-only badge: the CNPJ registry status never replaces the company's internal status.
export function SeloSituacaoCnpj({ situacao, titulo }: { situacao: string; titulo?: string }) {
  const informacao = rotuloSituacaoCnpj(situacao);
  if (!informacao) return null;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONS_SITUACAO[informacao.tom]}`}
      title={titulo || "Situação Cadastral do CNPJ · Não altera o status da empresa no sistema."}
    >
      {informacao.rotulo}
    </span>
  );
}

function SituacaoCnpj({ dados }: { dados: DadosCnpj }) {
  const desde = formatarDataSituacaoCnpj(dados.situacaoDesde);
  return <div className="min-w-0 space-y-1">
    <dt className="text-xs text-muted-foreground">Situação Cadastral do CNPJ</dt>
    <dd>
      {dados.situacao
        ? <SeloSituacaoCnpj situacao={dados.situacao} />
        : <span className="text-sm font-medium">Não informado</span>}
    </dd>
    {desde && <dd className="text-xs text-muted-foreground">Situação desde: {desde}</dd>}
    <dd className="text-xs text-muted-foreground">Não altera o status da empresa no sistema.</dd>
  </div>;
}

function CampoConsulta({ label, valor, vazio }: { label: string; valor: string; vazio?: string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm font-medium">{valor || vazio || "Não informado"}</dd></div>;
}

export function ConsultarCnpj({ cnpj, onAplicar }: { cnpj: string; onAplicar: (dados: DadosCnpj) => void }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState<DadosCnpj | null>(null);
  const tentativa = useRef(0);
  useEffect(() => { tentativa.current++; setErro(""); setDados(null); setCarregando(false); return () => { tentativa.current++; }; }, [cnpj]);
  const buscar = async () => {
    const normalizado = normalizarCnpjConsulta(cnpj);
    if (!normalizado) { setErro("CNPJ inválido."); return; }
    const id = ++tentativa.current;
    setCarregando(true); setErro(""); setDados(null);
    try {
      const { data, error } = await supabase.functions.invoke("consultar-cnpj", { body: { cnpj: normalizado } });
      if (id !== tentativa.current) return;
      if (error) {
        let mensagem = ERRO_CONSULTA_CNPJ;
        if (error.context instanceof Response) {
          const retorno = await error.context.json().catch(() => null);
          if (["CNPJ inválido.", "Empresa não encontrada para este CNPJ."].includes(retorno?.error)) mensagem = retorno.error;
        }
        setErro(mensagem); return;
      }
      const resultado = mapearDadosCnpj(data);
      if (!resultado) { setErro(ERRO_CONSULTA_CNPJ); return; }
      setDados(resultado);
    } catch { if (id === tentativa.current) setErro(ERRO_CONSULTA_CNPJ); }
    finally { if (id === tentativa.current) setCarregando(false); }
  };
  return <div className="space-y-2">
    <Button type="button" size="sm" variant="outline" disabled={carregando} onClick={buscar} className="max-w-full h-auto min-h-9 whitespace-normal text-left">{carregando ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> : <Search className="mr-2 h-4 w-4 shrink-0" />}{carregando ? "Consultando CNPJ..." : "Buscar dados da empresa"}</Button>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <Dialog open={!!dados} onOpenChange={open => { if (!open) setDados(null); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>DADOS ENCONTRADOS</DialogTitle><DialogDescription>Consulta pública CNPJ.ws</DialogDescription></DialogHeader>
        {dados && <div className="space-y-5">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CampoConsulta label="Razão Social" valor={dados.nome} />
            <CampoConsulta label="Nome Fantasia" valor={dados.fantasia} vazio="Nome fantasia não informado" />
            <CampoConsulta label="CNPJ" valor={dados.cnpj || cnpj} />
            <SituacaoCnpj dados={dados} />
          </dl>
          <section className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold">ENDEREÇO ENCONTRADO</h3>
            <dl className="grid grid-cols-2 gap-3">
              <CampoConsulta label="CEP" valor={dados.endereco.cep} />
              <CampoConsulta label="Tipo de Logradouro" valor={dados.tipoLogradouro} />
              <CampoConsulta label="Logradouro" valor={dados.logradouro} />
              <CampoConsulta label="Número" valor={dados.endereco.numero} />
              <CampoConsulta label="Complemento" valor={dados.endereco.complemento} />
              <CampoConsulta label="Bairro" valor={dados.endereco.bairro} />
              <CampoConsulta label="Cidade" valor={dados.endereco.cidade} />
              <CampoConsulta label="UF" valor={dados.endereco.uf} />
            </dl>
          </section>
          <section className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold">CONTATO</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3"><CampoConsulta label="Telefone" valor={dados.telefone} /><CampoConsulta label="E-mail" valor={dados.email} /></dl>
          </section>
        </div>}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => setDados(null)}>Cancelar</Button>
          <Button type="button" onClick={() => { if (!dados) return; onAplicar(dados); setDados(null); }}>Usar estes dados</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}