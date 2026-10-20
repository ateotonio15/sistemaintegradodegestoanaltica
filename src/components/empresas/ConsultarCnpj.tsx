import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { DadosCnpj, ERRO_CONSULTA_CNPJ, mapearDadosCnpj, normalizarCnpjConsulta } from "@/lib/consulta-cnpj";
import { ResumoEndereco } from "@/components/empresas/EmpresaEnderecosFields";

export function ConsultarCnpj({ cnpj }: { cnpj: string }) {
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
    <Dialog open={!!dados} onOpenChange={open => { if (!open) setDados(null); }}><DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Dados da empresa</DialogTitle><DialogDescription>Consulta pública CNPJ.ws. Nenhum dado do cadastro foi alterado ou salvo.</DialogDescription></DialogHeader>{dados && <dl className="space-y-4 break-words"><div><dt className="text-xs text-muted-foreground">CNPJ</dt><dd>{cnpj}</dd></div><div><dt className="text-xs text-muted-foreground">Razão social</dt><dd className="font-medium">{dados.nome}</dd></div>{dados.fantasia && <div><dt className="text-xs text-muted-foreground">Nome fantasia</dt><dd>{dados.fantasia}</dd></div>}<div><dt className="text-xs text-muted-foreground mb-1">Endereço</dt><dd><ResumoEndereco endereco={dados.endereco} /></dd></div></dl>}<div className="flex justify-end"><Button type="button" variant="outline" onClick={() => setDados(null)}>Fechar</Button></div></DialogContent></Dialog>
  </div>;
}