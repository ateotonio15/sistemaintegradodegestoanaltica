import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { RatingScale } from "../components/RatingScale";
import { toast } from "sonner";

const db = supabase as any;

export default function ResponderPorToken() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [envio, setEnvio] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [comentario, setComentario] = useState("");
  const [respostas, setRespostas] = useState<Record<string, any>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return;
      setLoading(true);
      const { data: rows, error } = await db.rpc("get_avaliacao_envio_por_token", { p_token: token });
      const env = Array.isArray(rows) ? rows[0] : rows;
      if (error || !env) {
        setErro("Link inválido ou expirado.");
        setLoading(false);
        return;
      }
      if (env.data_resposta) {
        setErro("Esta avaliação já foi respondida. Obrigado!");
        setLoading(false);
        return;
      }
      setEnvio(env);
      const { data: frows } = await db.rpc("get_avaliacao_formulario_por_token", { p_token: token });
      const f = Array.isArray(frows) ? frows[0] : frows;
      if (f) setForm(f);
      setLoading(false);
    })();
  }, [token]);

  const enviar = async () => {
    if (!form || !envio) return;
    for (const p of form.perguntas) {
      if (p.obrigatoria && (respostas[p.id] == null || respostas[p.id] === "")) {
        toast.error(`Responda: ${p.titulo}`);
        return;
      }
    }
    const ratings = form.perguntas
      .filter((p: any) => p.tipo === "rating")
      .map((p: any) => Number(respostas[p.id]))
      .filter((n: number) => !isNaN(n));
    const notaMedia = ratings.length ? Number((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(2)) : null;

    setEnviando(true);
    const { error: errResp } = await db.rpc("responder_avaliacao_por_token", {
      p_token: token,
      p_respostas: respostas,
      p_comentario: comentario.trim() || null,
      p_nota_media: notaMedia,
    });

    if (errResp) {
      console.error("survey submit error:", errResp);
      setEnviando(false);
      toast.error("Não foi possível enviar sua avaliação. Tente novamente.");
      return;
    }


    setEnviando(false);
    setEnviado(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  if (erro) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full p-8 text-center space-y-3">
        <div className="mx-auto h-14 w-14 rounded-full bg-yellow-500/15 text-yellow-500 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold">Aviso</h1>
        <p className="text-sm text-muted-foreground">{erro}</p>
      </Card>
    </div>
  );

  if (enviado) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full p-8 text-center space-y-3">
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold">Avaliação enviada!</h1>
        <p className="text-sm text-muted-foreground">Obrigado por compartilhar sua opinião.</p>
      </Card>
    </div>
  );

  if (!form || !envio) return null;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="p-6 space-y-2">
          <h1 className="text-2xl font-bold">{form.titulo}</h1>
          <p className="text-sm text-muted-foreground">{form.instrucoes}</p>
        </Card>

        <Card className="p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Empresa</label>
              <Input value={envio.empresa_nome || ""} readOnly className="mt-1 bg-muted/40" />
            </div>
            <div>
              <label className="text-sm font-medium">Executiva avaliada</label>
              <Input value={envio.executiva_nome || "—"} readOnly className="mt-1 bg-muted/40" />
            </div>
          </div>

          {form.perguntas.map((p: any, i: number) => (
            <div key={p.id} className="space-y-2 pt-2 border-t">
              <p className="text-sm font-medium">{i + 1}. {p.titulo} {p.obrigatoria && <span className="text-red-500">*</span>}</p>
              {p.tipo === "rating" ? (
                <RatingScale value={respostas[p.id] ?? null} onChange={(v) => setRespostas({ ...respostas, [p.id]: v })} />
              ) : (
                <textarea className="w-full rounded-md border bg-background p-2 text-sm" rows={4}
                  value={respostas[p.id] || ""} onChange={(e) => setRespostas({ ...respostas, [p.id]: e.target.value })}
                  placeholder="Sua resposta..." />
              )}
            </div>
          ))}

          <div className="pt-2 border-t space-y-1.5">
            <label className="text-sm font-medium">Comentários e sugestões (opcional)</label>
            <textarea className="w-full rounded-md border bg-background p-2 text-sm" rows={4}
              value={comentario} onChange={(e) => setComentario(e.target.value)}
              placeholder="Sua mensagem..." />
          </div>

          <Button onClick={enviar} disabled={enviando} className="w-full" size="lg">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enviar avaliação
          </Button>
        </Card>
      </div>
    </div>
  );
}
