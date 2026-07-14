import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";

interface Resultado {
  email: string;
  senha_provisoria: string;
}

export default function CadastrarEmpresa() {
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    valor_mensal: "",
    data_inicio: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [copiado, setCopiado] = useState(false);

  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.email || !form.valor_mensal || !form.data_inicio) {
      toast.error("Preencha nome, e-mail, valor e data de início.");
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
          email: form.email.trim().toLowerCase(),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResultado(data as Resultado);
      setForm({ nome: "", cnpj: "", valor_mensal: "", data_inicio: "", email: "" });
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
      `Acesso ao portal:\nE-mail: ${resultado.email}\nSenha provisória: ${resultado.senha_provisoria}`,
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
            Cria a empresa, o contrato e o usuário de acesso ao portal. Uma senha
            provisória é gerada e mostrada uma única vez.
          </p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome da empresa *</Label>
              <Input id="nome" value={form.nome} onChange={setF("nome")} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={form.cnpj} onChange={setF("cnpj")} placeholder="00.000.000/0000-00" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="valor">Valor mensal do contrato *</Label>
                <Input id="valor" inputMode="decimal" value={form.valor_mensal} onChange={setF("valor_mensal")} placeholder="0,00" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inicio">Data de início *</Label>
                <Input id="inicio" type="date" value={form.data_inicio} onChange={setF("data_inicio")} required />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail de acesso *</Label>
              <Input id="email" type="email" value={form.email} onChange={setF("email")} required />
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
                Copie e entregue estas credenciais ao responsável da empresa. A senha
                provisória <strong>não será mostrada novamente</strong>. No primeiro
                login o usuário será obrigado a trocá-la.
              </p>
              <div className="grid gap-2 rounded-md border bg-muted/40 p-3 text-sm">
                <div><span className="text-muted-foreground">E-mail:</span> <strong>{resultado.email}</strong></div>
                <div><span className="text-muted-foreground">Senha provisória:</span> <strong className="font-mono">{resultado.senha_provisoria}</strong></div>
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
