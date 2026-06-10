import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { RatingScale } from "../components/RatingScale";
import { toast } from "sonner";

const db = supabase as any;

export default function ResponderRH() {
  const { formId } = useParams<{ formId: string }>();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [respondente, setRespondente] = useState("");
  const [respostas, setRespostas] = useState<Record<string, any>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    (async () => {
      if (!formId) return;
      const { data } = await db.from("cs_avaliacao_formularios").select("*").eq("id", formId).maybeSingle();
      setForm(data);
      setLoading(false);
    })();
  }, [formId]);

  const enviar = async () => {
    if (!form) return;
    for (const p of form.perguntas) {
      if (p.obrigatoria && (respostas[p.id] == null || respostas[p.id] === "")) {
        toast.error(`Responda: ${p.titulo}`);
        return;
      }
    }
    setEnviando(true);
    const { error } = await db.from("cs_avaliacao_respostas").insert({ formulario_id: form.id, respondente: respondente || null, respostas });
    setEnviando(false);
    if (error) { toast.error("Erro ao enviar"); return; }
    setEnviado(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!form) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Formulário não encontrado.</div>;

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md w-full p-8 text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold">Avaliação enviada!</h1>
          <p className="text-sm text-muted-foreground">Obrigado por compartilhar sua opinião. Sua resposta foi registrada com sucesso.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="p-6 space-y-2">
          <h1 className="text-2xl font-bold">{form.titulo}</h1>
          <p className="text-sm text-muted-foreground">{form.instrucoes}</p>
        </Card>

        <Card className="p-6 space-y-5">
          <div>
            <label className="text-sm font-medium">Seu nome (opcional)</label>
            <Input value={respondente} onChange={(e) => setRespondente(e.target.value)} placeholder="Nome..." className="mt-1" />
          </div>

          {form.perguntas.map((p: any, i: number) => (
            <div key={p.id} className="space-y-1.5 pt-2 border-t">
              <p className="text-sm font-medium">{i + 1}. {p.titulo} {p.obrigatoria && <span className="text-red-500">*</span>}</p>
              <p className="text-xs text-muted-foreground mb-2">{p.descricao}</p>
              {p.tipo === "rating" ? (
                <RatingScale value={respostas[p.id] ?? null} onChange={(v) => setRespostas({ ...respostas, [p.id]: v })} />
              ) : (
                <textarea
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  rows={4}
                  value={respostas[p.id] || ""}
                  onChange={(e) => setRespostas({ ...respostas, [p.id]: e.target.value })}
                  placeholder="Sua resposta..."
                />
              )}
            </div>
          ))}

          <Button onClick={enviar} disabled={enviando} className="w-full" size="lg">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enviar avaliação
          </Button>
        </Card>
      </div>
    </div>
  );
}
