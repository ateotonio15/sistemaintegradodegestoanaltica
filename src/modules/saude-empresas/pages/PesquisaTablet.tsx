import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, Loader2, AlertTriangle, Star, HeartPulse, Building2, RefreshCw } from "lucide-react";
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

/**
 * Modo Tablet (quiosque): a enfermeira informa a empresa uma única vez e o
 * formulário se repete automaticamente para cada beneficiário.
 */
export default function PesquisaTablet() {
  const { token } = useParams<{ token: string }>();
  const empresaKey = `pesquisa-tablet-empresa-${token}`;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<any>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [empresaConfirmada, setEmpresaConfirmada] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string | number>>({});
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await db.rpc("get_pesquisa_por_token", { p_token: token });
      if (error || !data) {
        setErro("Link inválido ou expirado.");
        setLoading(false);
        return;
      }
      if (!data.aberta) {
        setErro("Esta pesquisa já foi encerrada.");
        setLoading(false);
        return;
      }
      setInfo(data);
      const salva = localStorage.getItem(empresaKey);
      if (salva) {
        setEmpresaConfirmada(salva);
        setEmpresaNome(salva);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const perguntas: PerguntaPublica[] = info?.perguntas ?? [];

  const confirmarEmpresa = () => {
    const nome = empresaNome.trim();
    if (!nome) {
      toast.error("Informe o nome da empresa");
      return;
    }
    localStorage.setItem(empresaKey, nome);
    setEmpresaConfirmada(nome);
  };

  const trocarEmpresa = () => {
    localStorage.removeItem(empresaKey);
    setEmpresaConfirmada(null);
    setRespostas({});
    setSalvo(false);
  };

  const validar = () => {
    for (const p of perguntas) {
      const v = respostas[p.id];
      if (p.obrigatoria && (v === undefined || v === "")) {
        toast.error(`Responda: ${p.texto}`);
        return false;
      }
    }
    return true;
  };

  const enviar = async () => {
    setConfirmando(false);
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
      p_empresa: empresaConfirmada,
    });
    setEnviando(false);
    if (error) {
      toast.error("Não foi possível salvar. Tente novamente.");
      return;
    }
    setTotal((t) => t + 1);
    setSalvo(true);
    setTimeout(() => {
      setRespostas({});
      setSalvo(false);
    }, 2200);
  };

  if (loading) {
    return (
      <Wrapper>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      </Wrapper>
    );
  }

  if (erro) {
    return (
      <Wrapper>
        <Card className="p-10 text-center space-y-3">
          <AlertTriangle className="h-10 w-10 mx-auto text-amber-500" />
          <p className="text-sm text-muted-foreground">{erro}</p>
        </Card>
      </Wrapper>
    );
  }

  // Passo 1 — enfermeira informa a empresa
  if (!empresaConfirmada) {
    return (
      <Wrapper>
        <div className="mx-auto w-full max-w-lg space-y-6 pt-10">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold">Modo Tablet</h1>
            <p className="text-sm text-muted-foreground">
              Informe a empresa onde a palestra está sendo realizada para iniciar as avaliações.
            </p>
          </div>
          <Card className="p-6 space-y-4">
            <label className="text-sm font-medium">Nome da empresa</label>
            <Input
              value={empresaNome}
              maxLength={150}
              autoFocus
              className="h-14 text-lg"
              onChange={(e) => setEmpresaNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmarEmpresa()}
              placeholder="Ex.: Indústrias Reunidas Vitória Régia"
            />
            <Button className="w-full h-14 text-base" onClick={confirmarEmpresa}>
              Avançar
            </Button>
          </Card>
        </div>
      </Wrapper>
    );
  }

  // Tela de confirmação de salvamento
  if (salvo) {
    return (
      <Wrapper>
        <div className="flex min-h-[70vh] flex-col items-center justify-center text-center space-y-4">
          <CheckCircle2 className="h-20 w-20 text-emerald-500" />
          <h2 className="text-2xl font-bold">Avaliação salva!</h2>
          <p className="text-sm text-muted-foreground">
            Obrigado pela participação. Preparando o formulário para o próximo participante…
          </p>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Empresa</p>
            <p className="truncate text-sm font-semibold">{empresaConfirmada}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avaliações</p>
              <p className="text-sm font-bold">{total}</p>
            </div>
            <Button size="sm" variant="outline" onClick={trocarEmpresa}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Trocar
            </Button>
          </div>
        </div>

        <div className="text-center space-y-1 mb-5">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HeartPulse className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold leading-tight">Pesquisa de Satisfação</h1>
          <p className="text-sm text-muted-foreground">{info?.tema ?? "Palestra de saúde"}</p>
        </div>

        <div className="space-y-3">
          {perguntas.map((p) => (
            <Card key={p.id} className="p-5 space-y-3">
              <p className="text-base font-medium">
                {p.texto} {p.obrigatoria && <span className="text-destructive">*</span>}
              </p>

              {p.tipo === "nota" && (
                <div className="flex justify-center gap-3">
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
                            "h-10 w-10 transition-colors",
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
                        "rounded-lg border px-4 py-3.5 text-base text-left transition-colors",
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

        <Button
          className="mt-6 h-14 w-full text-base"
          disabled={enviando}
          onClick={() => validar() && setConfirmando(true)}
        >
          {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Finalizar avaliação
        </Button>

        <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Salvar avaliação?</AlertDialogTitle>
              <AlertDialogDescription>
                As respostas serão registradas para {empresaConfirmada} e um novo formulário será
                aberto automaticamente para o próximo participante.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Revisar</AlertDialogCancel>
              <AlertDialogAction onClick={enviar}>Salvar avaliação</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </div>
  );
}
