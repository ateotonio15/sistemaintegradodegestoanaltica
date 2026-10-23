import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";

const dt = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Manaus" }) : "—");

export function CredenciaisCentralCard() {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [gerando, setGerando] = useState(false);
  const [nova, setNova] = useState<string | null>(null);
  const [revogarId, setRevogarId] = useState<string | null>(null);

  const { data: lista = [] } = useQuery({
    queryKey: ["nfse-central-credenciais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("nfse_central_credenciais")
        .select("id, nome, created_at, revogada_em, ultimo_uso_em").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const gerar = async () => {
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerenciar-credencial-central", { body: { acao: "gerar", nome: nome.trim() } });
      if (error || !data?.credencial) throw error ?? new Error();
      setNova(data.credencial);
      setNome("");
      qc.invalidateQueries({ queryKey: ["nfse-central-credenciais"] });
    } catch { toast.error("Não foi possível gerar a credencial."); }
    finally { setGerando(false); }
  };

  const revogar = async () => {
    if (!revogarId) return;
    const { error } = await supabase.functions.invoke("gerenciar-credencial-central", { body: { acao: "revogar", id: revogarId } });
    setRevogarId(null);
    if (error) toast.error("Não foi possível revogar.");
    else { toast.success("Credencial revogada."); qc.invalidateQueries({ queryKey: ["nfse-central-credenciais"] }); }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" />Credenciais da Central (somente Admin)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Identificação (ex.: Central produção)" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />
          <Button onClick={gerar} disabled={gerando || !nome.trim()}>{gerando ? "Gerando..." : "Gerar nova credencial"}</Button>
        </div>
        <div className="divide-y rounded-md border">
          {lista.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhuma credencial gerada.</p>}
          {lista.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div>
                <div className="font-medium">{c.nome} {c.revogada_em ? <Badge variant="destructive">Revogada</Badge> : <Badge>Ativa</Badge>}</div>
                <div className="text-muted-foreground">Criada em {dt(c.created_at)} · Último uso {dt(c.ultimo_uso_em)}{c.revogada_em ? ` · Revogada em ${dt(c.revogada_em)}` : ""}</div>
              </div>
              {!c.revogada_em && <Button variant="outline" size="sm" onClick={() => setRevogarId(c.id)}>Revogar</Button>}
            </div>
          ))}
        </div>
      </CardContent>

      <AlertDialog open={!!nova} onOpenChange={(o) => !o && setNova(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copie a credencial agora</AlertDialogTitle>
            <AlertDialogDescription>Ela não será exibida novamente. Entregue-a à Central por um canal seguro.</AlertDialogDescription>
          </AlertDialogHeader>
          <code className="block break-all rounded bg-muted p-3 text-xs">{nova}</code>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(nova ?? ""); toast.success("Copiada."); }}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
            <AlertDialogAction onClick={() => setNova(null)}>Já copiei</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!revogarId} onOpenChange={(o) => !o && setRevogarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar credencial?</AlertDialogTitle>
            <AlertDialogDescription>Envios da Central usando esta credencial passarão a ser recusados imediatamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={revogar}>Revogar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
