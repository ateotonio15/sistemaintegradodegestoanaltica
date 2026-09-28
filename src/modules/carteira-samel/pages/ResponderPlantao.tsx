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

const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function ResponderPlantao() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [dataAtend, setDataAtend] = useState(hojeLocal());
  const [unidade, setUnidade] = useState("");
  const [respostas, setRespostas] = useState<Record<string, any>>({});
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await db.rpc("get_avaliacao_plantao_por_token", { p_token: token });
      const r = Array.isArray(data) ? data[0] : data;
      if (error || !r) setErro("Link inválido ou desativado.");
      else { setDados(r); setUnidade(r.unidade || ""); }
      setLoading(false);
    })();
  }, [token]);

  const perguntas: any[] = dados?.perguntas || [];

  const enviar = async () => {
    if (!dataAtend) { toast.error("Informe a data do atendimento"); return; }
    if (dataAtend > hojeLocal()) { toast.error("A data do atendimento não pode ser futura"); return; }
    for (const p of perguntas) {
      if (p.obrigatoria && (respostas[p.id] == null || respostas[p.id] === "")) { toast.error(`Responda: ${p.titulo}`); return; }
    }
    const notas = perguntas.filter((p) => p.tipo === "rating").map((p) => Number(respostas[p.id])).filter((n) => !isNaN(n));
    const media = notas.length ? Number((notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(2)) : null;
    setEnviando(true);
    const { error } = await db.rpc("responder_avaliacao_plantao_por_token", {
      p_token: token, p_respostas: respostas, p_comentario: comentario.trim() || null,
      p_nota_media: media, p_data_atendimento: dataAtend, p_unidade: unidade.trim() || null,
    });
    setEnviando(false);
    if (error) { toast.error("Não foi possível enviar sua avaliação. Tente novamente."); return; }
    setEnviado(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  if (erro) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full p-8 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
        <p className="text-sm text-muted-foreground">{erro}</p>
      </Card>
    </div>
  );

  if (enviado) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full p-8 text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 mx-auto text-primary" />
        <h1 className="text-xl font-bold">Avaliação enviada!</h1>
        <p className="text-sm text-muted-foreground">Obrigado por avaliar o atendimento.</p>
        <Button variant="outline" className="w-full" onClick={() => { setRespostas({}); setComentario(""); setDataAtend(hojeLocal()); setEnviado(false); }}>
          Responder outra avaliação
        </Button>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="p-6 space-y-2">
          <h1 className="text-2xl font-bold">{dados.titulo}</h1>
          <p className="text-sm text-muted-foreground">{dados.instrucoes}</p>
        </Card>
        <Card className="p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Data do atendimento *</label>
              <Input type="date" value={dataAtend} max={hojeLocal()} onChange={(e) => setDataAtend(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Unidade / plantão</label>
              <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} maxLength={160} className="mt-1" />
            </div>
          </div>
          {perguntas.map((p, i) => (
            <div key={p.id} className="space-y-2 pt-2 border-t">
              <p className="text-sm font-medium">{i + 1}. {p.titulo} {p.obrigatoria && <span className="text-destructive">*</span>}</p>
              {p.tipo === "rating" ? (
                <RatingScale value={respostas[p.id] ?? null} onChange={(v) => setRespostas({ ...respostas, [p.id]: v })} />
              ) : (
                <textarea className="w-full rounded-md border bg-background p-2 text-sm" rows={4} maxLength={2000}
                  value={respostas[p.id] || ""}
                  onChange={(e) => { setRespostas({ ...respostas, [p.id]: e.target.value }); setComentario(e.target.value); }}
                  placeholder="Sua resposta..." />
              )}
            </div>
          ))}
          <Button onClick={enviar} disabled={enviando} className="w-full" size="lg">
            {enviando && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enviar avaliação
          </Button>
        </Card>
      </div>
    </div>
  );
}
