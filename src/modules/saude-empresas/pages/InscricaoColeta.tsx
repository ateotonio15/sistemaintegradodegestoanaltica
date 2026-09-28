import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, CalendarDays, Clock, MapPin, AlertCircle, Loader2 } from "lucide-react";
import { cpfValido, fmtDataBR, fmtHora, maskCpf, maskTel } from "../hooks/useColeta";

const sb = supabase as any;

const MSG_BLOQUEIO: Record<string, string> = {
  encerrado: "As inscrições para esta ação foram encerradas.",
  prazo: "O prazo de inscrição para esta ação terminou.",
  lotado: "Todas as vagas desta ação já foram preenchidas.",
};

export default function InscricaoColeta() {
  const { token = "" } = useParams();
  const { data: info, isLoading } = useQuery({
    queryKey: ["coleta_publica", token],
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_coleta_por_token", { p_token: token });
      if (error) throw error;
      return data as any;
    },
  });
  const [f, setF] = useState({ nome: "", cpf: "", nasc: "", tel: "", setor: "", ok: false });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (f.nome.trim().length < 3) return setErro("Informe o nome completo.");
    if (!cpfValido(f.cpf)) return setErro("CPF inválido.");
    if (!f.nasc) return setErro("Informe a data de nascimento.");
    if (f.tel.replace(/\D/g, "").length < 10) return setErro("Telefone inválido.");
    if (!f.ok) return setErro("É necessário aceitar o termo de consentimento.");
    setEnviando(true);
    const { data, error } = await sb.rpc("inscrever_coleta", {
      p_token: token, p_nome: f.nome.slice(0, 150), p_cpf: f.cpf, p_nascimento: f.nasc,
      p_telefone: f.tel, p_setor: f.setor.slice(0, 100), p_consentimento: f.ok,
    });
    setEnviando(false);
    if (error) return setErro("Não foi possível enviar. Tente novamente.");
    if (data?.erro) {
      if (data.erro === "duplicado") return setErro("Este CPF já está inscrito nesta ação.");
      return setErro(MSG_BLOQUEIO[data.erro] ?? data.erro);
    }
    setSucesso(true);
  };

  const Detalhes = () => (
    <div className="space-y-1.5 text-sm text-muted-foreground">
      <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />{fmtDataBR(info.data)}</div>
      {info.horario_inicio && <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{fmtHora(info.horario_inicio)}{info.horario_fim ? ` – ${fmtHora(info.horario_fim)}` : ""}</div>}
      {info.local && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{info.local}</div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex justify-center p-4">
      <Card className="w-full max-w-md p-5 space-y-4 self-start mt-4">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !info ? (
          <div className="text-center py-8 space-y-2"><AlertCircle className="h-10 w-10 mx-auto text-destructive" /><p>Link inválido ou inexistente.</p></div>
        ) : sucesso ? (
          <div className="text-center py-6 space-y-4">
            <CheckCircle2 className="h-14 w-14 mx-auto text-primary" />
            <h1 className="text-xl font-semibold">Inscrição realizada com sucesso</h1>
            <p className="text-sm">{info.empresa}</p>
            <div className="inline-block text-left"><Detalhes /></div>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs uppercase tracking-wide text-primary font-medium">Ação de Coleta · Preventivo</p>
              <h1 className="text-lg font-semibold mt-1">{info.empresa}</h1>
              <div className="mt-2"><Detalhes /></div>
            </div>
            {info.bloqueio ? (
              <div className="rounded-md border border-border bg-muted p-4 text-sm flex gap-2"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{MSG_BLOQUEIO[info.bloqueio]}</div>
            ) : (
              <form onSubmit={enviar} className="space-y-3">
                <div><Label>Nome completo *</Label><Input value={f.nome} maxLength={150} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
                <div><Label>CPF *</Label><Input inputMode="numeric" value={f.cpf} onChange={(e) => setF({ ...f, cpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" /></div>
                <div><Label>Data de nascimento *</Label><Input type="date" value={f.nasc} onChange={(e) => setF({ ...f, nasc: e.target.value })} /></div>
                <div><Label>Telefone / WhatsApp *</Label><Input inputMode="tel" value={f.tel} onChange={(e) => setF({ ...f, tel: maskTel(e.target.value) })} placeholder="(92) 90000-0000" /></div>
                <div><Label>Setor / Matrícula</Label><Input value={f.setor} maxLength={100} onChange={(e) => setF({ ...f, setor: e.target.value })} /></div>
                <label className="flex gap-2 items-start text-xs text-muted-foreground">
                  <Checkbox checked={f.ok} onCheckedChange={(v) => setF({ ...f, ok: !!v })} className="mt-0.5" />
                  Autorizo o uso dos meus dados apenas para organizar esta ação de saúde, conforme a LGPD.
                </label>
                {erro && <p className="text-sm text-destructive">{erro}</p>}
                <Button type="submit" className="w-full" disabled={enviando}>{enviando ? "Enviando..." : "Confirmar inscrição"}</Button>
              </form>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
