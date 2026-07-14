import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";

interface Resultado {
  username: string;
  senha_inicial: string;
}

function previewUsername(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return limpo.slice(0, 2).join("_").toUpperCase();
}

export default function CadastrarEmpresa() {
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    valor_mensal: "",
    data_inicio: "",
    codigo_contrato: "",
  });
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [copiado, setCopiado] = useState(false);

  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const usuarioPreview = useMemo(() => previewUsername(form.nome), [form.nome]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.codigo_contrato || !form.valor_mensal || !form.data_inicio) {
      toast.error("Preencha nome, código da empresa, valor e data de início.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("criar-empresa-com-acesso", {
        body: {
          nome: form.nome.trim(),
          cnpj: form.cnpj.trim() || null,
          valor_mensal: Number(form.valor_mensal.replace(",", ".")),
          data_inicio: form.data_inicio,
          codigo_contrato: form.codigo_contrato.trim(),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResultado({
        username: (data as any).username,
        senha_inicial: (data as any).senha_inicial,
      });
      setForm({ nome: "", cnpj: "", valor_mensal: "", data_inicio: "", codigo_contrato: "" });
      toast.success("Empresa cadastrada com sucesso");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao cadastrar empresa");
    } finally {
      setLoading(false);
    }
  }

  async function copiar() {
    if (!resultado) return;
    await navigator.clipboard.writeText(
      `Acesso ao portal:\nUsuário: ${resultado.username}\nSenha inicial: ${resultado.senha_inicial}\n(A empresa será obrigada a trocar a senha no primeiro login.)`,
    );
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Cadastrar Empresa</CardTitle>
          <p className="text-sm text-muted-foreground">
            O usuário de login é gerado a partir das duas primeiras palavras do nome
            da empresa. A senha inicial é o código da empresa. No primeiro login o
            usuário será obrigado a trocar a senha.
          </p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome da empresa *</Label>
              <Input id="nome" value={form.nome} onChange={setF("nome")} required />
              {usuarioPreview && (
                <p className="text-xs text-muted-foreground">
                  Usuário gerado: <strong className="font-mono">{usuarioPreview}</strong>
                  <span className="ml-1">
                    (pode receber sufixo numérico se já existir)
                  </span>
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={form.cnpj} onChange={setF("cnpj")} placeholder="00.000.000/0000-00" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="codigo">Código da empresa *</Label>
                <Input
                  id="codigo"
                  value={form.codigo_contrato}
                  onChange={setF("codigo_contrato")}
                  placeholder="Ex.: 1234"
                  required
                />
                <p className="text-xs text-muted-foreground">Será a senha inicial.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inicio">Data de início *</Label>
                <Input id="inicio" type="date" value={form.data_inicio} onChange={setF("data_inicio")} required />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="valor">Valor mensal do contrato *</Label>
              <Input
                id="valor"
                inputMode="decimal"
                value={form.valor_mensal}
                onChange={setF("valor_mensal")}
                placeholder="0,00"
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Cadastrando..." : "Cadastrar empresa"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={!!resultado} onOpenChange={(o) => !o && setResultado(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acesso criado</DialogTitle>
          </DialogHeader>
          {resultado && (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                Repasse estas credenciais ao responsável da empresa. No primeiro login
                ele será obrigado a trocar a senha.
              </p>
              <div className="grid gap-2 rounded-md border bg-muted/40 p-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Usuário:</span>{" "}
                  <strong className="font-mono">{resultado.username}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Senha inicial:</span>{" "}
                  <strong className="font-mono">{resultado.senha_inicial}</strong>
                </div>
              </div>
              <Button onClick={copiar} variant="secondary">
                {copiado ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copiado ? "Copiado" : "Copiar credenciais"}
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResultado(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
