import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, AlertTriangle, Star, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const db = supabase as any;

interface PerguntaPublica {
  id: string;
  texto: string;
  tipo: "nota" | "multipla_escolha" | "texto_livre";
  opcoes: string[];
  obrigatoria: boolean;
  ordem: number;
}

export default function ResponderPesquisa() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<any>(null);
  const [respostas, setRespostas] = useState<Record<string, string | number>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return;
      if (localStorage.getItem(`pesquisa-respondida-${token}`)) {
        setEnviado(true);
        setLoading(false);
        return;
      }
      const { data, error } = await db.rpc("get_pesquisa_por_token", { p_token: token });
      if (error || !data) {
        setErro("Link inválido ou expirado.");
        setLoading(false);
        return;
      }
      if (!data.aberta) {
        setErro("Esta pesquisa já foi encerrada. Obrigado!");
        setLoading(false);
        return;
      }
      setInfo(data);
      setLoading(false);
    })();
  }, [token]);

  const perguntas: PerguntaPublica[] = info?.perguntas ?? [];

  const enviar = async () => {
    for (const p of perguntas) {
      const v = respostas[p.id];
      if (p.obrigatoria && (v === undefined || v === "")) {
        toast.error(`Responda: ${p.texto}`);
        return;
      }
    }
    setEnviando(true);
    const payload = perguntas
      .filter((p) => respostas[p.id] !== undefined && respostas[p.id] !== "")
      .map((p) =>
        p.tipo === "nota"
          ? { pergunta_id: p.id, valor_nota: Number(respostas[p.id]) }
          : { pergunta_id: p.id, valor_texto: String(respostas[p.id]) },
      );
    const { error } = await db.rpc("responder_pesquisa_por_token", {
      p_token: token,
      p_respostas: payload,
    });
    setEnviando(false);
    if (error) {
      toast.error("Não foi possível enviar. Tente novamente.");
      return;
    }
    localStorage.setItem(`pesquisa-respondida-${token}`, "1");
    setEnviado(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (enviado) {
    return (
      <Wrapper>
        <Card className="p-8 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
          <h1 className="text-xl font-bold">Obrigado pela sua participação!</h1>
          <p className="text-sm text-muted-foreground">
            Sua avaliação foi registrada e nos ajuda a melhorar as próximas palestras.
          </p>
        </Card>
      </Wrapper>
    );
  }

  if (erro) {
    return (
      <Wrapper>
        <Card className="p-8 text-center space-y-3">
          <AlertTriangle className="h-10 w-10 mx-auto text-amber-500" />
          <p className="text-sm text-muted-foreground">{erro}</p>
        </Card>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div className="text-center space-y-1 mb-5">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <HeartPulse className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold leading-tight">{info?.empresa}</h1>
        <p className="text-sm text-muted-foreground">{info?.tema ?? "Palestra de saúde"}</p>
        {info?.data && (
          <p className="text-xs text-muted-foreground">
            {String(info.data).split("-").reverse().join("/")}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {perguntas.map((p) => (
          <Card key={p.id} className="p-4 space-y-3">
            <p className="text-sm font-medium">
              {p.texto} {p.obrigatoria && <span className="text-destructive">*</span>}
            </p>

            {p.tipo === "nota" && (
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const ativo = Number(respostas[p.id] ?? 0) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRespostas((r) => ({ ...r, [p.id]: n }))}
                      className="p-1"
                      aria-label={`Nota ${n}`}
                    >
                      <Star
                        className={cn(
                          "h-8 w-8 transition-colors",
                          ativo ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {p.tipo === "multipla_escolha" && (
              <div className="grid gap-2">
                {(p.opcoes ?? []).map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setRespostas((r) => ({ ...r, [p.id]: o }))}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-sm text-left transition-colors",
                      respostas[p.id] === o
                        ? "border-primary bg-primary/10 font-medium"
                        : "hover:bg-muted",
                    )}
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}

            {p.tipo === "texto_livre" && (
              <Textarea
                rows={3}
                value={String(respostas[p.id] ?? "")}
                onChange={(e) => setRespostas((r) => ({ ...r, [p.id]: e.target.value }))}
                placeholder="Escreva aqui…"
              />
            )}
          </Card>
        ))}
      </div>

      <Button className="w-full mt-5 h-12 text-base" onClick={enviar} disabled={enviando}>
        {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Enviar avaliação
      </Button>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md">{children}</div>
    </div>
  );
}
